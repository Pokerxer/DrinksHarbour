/**
 * inventory.service.js — single source of truth for all stock mutations.
 *
 * Stock accounting model:
 *   totalStock     = sellable units remaining (decrements on order placement, not shipment)
 *   reservedStock  = units in-flight: order placed but not yet shipped
 *   availableStock = same as totalStock (kept in sync for backwards compat)
 *
 * Order lifecycle:
 *   placed         → reserve()        totalStock--, availableStock--, reservedStock++
 *   shipped        → commitShipment() reservedStock--, totalSold++  (stock already decremented)
 *   cancel/fail
 *     before ship  → releaseReserve() totalStock++, availableStock++, reservedStock--
 *     after  ship  → restoreStock()   totalStock++, availableStock++, totalSold--  (item returned)
 *   refund         → restoreStock()   totalStock++, availableStock++, totalSold--
 */

'use strict';

const mongoose          = require('mongoose');
const SubProduct        = require('../models/SubProduct');
const Size              = require('../models/Size');
const InventoryMovement = require('../models/InventoryMovement');
const Warehouse         = require('../models/Warehouse');

// ─── helpers ────────────────────────────────────────────────────────────────

function computeStockStatus(available, threshold = 10) {
  if (available <= 0)         return 'out_of_stock';
  if (available <= threshold) return 'low_stock';
  return 'in_stock';
}

/** Sync stockStatus field after a mutation (best-effort, non-blocking). */
function syncStatus(subProductId, threshold) {
  SubProduct.findById(subProductId)
    .select('availableStock lowStockThreshold stockStatus')
    .lean()
    .then(sp => {
      if (!sp) return;
      const s = computeStockStatus(sp.availableStock, sp.lowStockThreshold ?? threshold ?? 10);
      if (s !== sp.stockStatus) {
        return SubProduct.findByIdAndUpdate(subProductId, { stockStatus: s });
      }
    })
    .catch(() => {});
}

/** Fire-and-forget audit trail in InventoryMovement. */
function audit(items, orderId, type, category, performedBy) {
  setImmediate(async () => {
    const tenantForWh = items[0]?.tenant;
    const auditWarehouse = tenantForWh
      ? await resolveMovementWarehouse(tenantForWh, undefined)
      : null;
    for (const item of items) {
      if (!item.subproduct || !item.tenant) continue;
      try {
        const sp = await SubProduct.findById(item.subproduct)
          .select('availableStock totalStock costPrice lowStockThreshold')
          .lean();

        const currentStock = sp?.availableStock ?? 0;
        // Audit fires after the mutation, so we reconstruct quantityBefore from current state
        const quantityBefore = category === 'out'
          ? currentStock + item.quantity   // stock was decremented, so before = current + qty
          : Math.max(0, currentStock - item.quantity); // stock was incremented, so before = current - qty
        await InventoryMovement.create({
          subProduct:    item.subproduct,
          tenant:        item.tenant,
          warehouse:     auditWarehouse || undefined,
          product:       item.product,
          size:          item.size  || undefined,
          type,
          category,
          quantity:      item.quantity,
          quantityBefore,
          quantityAfter:  currentStock,
          relatedOrder:  orderId || undefined,
          sellingPrice:  item.priceAtPurchase,
          unitCost:      sp?.costPrice ?? 0,
          totalCost:     (sp?.costPrice ?? 0) * item.quantity,
          referenceType: 'order',
          source:        'system',
          performedBy:   performedBy || item.tenant, // fallback to tenant ObjectId
          performedAt:   new Date(),
          status:        'confirmed',
          isVerified:    true,
          verifiedAt:    new Date(),
        });
      } catch (err) {
        console.error(`[Inventory] audit(${type}) failed for subproduct ${item.subproduct}:`, err.message, JSON.stringify({ tenant: item.tenant, performedBy, orderId }));
      }
    }
  });
}

/**
 * Resolve the warehouse a movement should be attributed to.
 * @param {string|ObjectId} tenantId
 * @param {string|ObjectId|null|undefined} explicitWarehouseId
 * @returns {Promise<ObjectId|string|null>} explicit id if given, else the tenant's
 *   default warehouse id, else null. Never throws.
 */
async function resolveMovementWarehouse(tenantId, explicitWarehouseId) {
  if (explicitWarehouseId) return explicitWarehouseId;
  try {
    const def = await Warehouse.findOne({ tenant: tenantId, isDefault: true })
      .select('_id')
      .lean();
    return def?._id || null;
  } catch {
    return null;
  }
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Reserve stock when an order is placed.
 * Atomically decrements availableStock, increments reservedStock.
 * If any item fails, all already-committed reservations are rolled back.
 *
 * @returns {{ success: boolean, failedItem?: object }}
 */
async function reserve(items, orderId, userId) {
  const committed = [];

  for (const item of items) {
    if (!item.subproduct) continue;

    const updated = await SubProduct.findOneAndUpdate(
      {
        _id: item.subproduct,
        $or: [
          { availableStock: { $gte: item.quantity } },
          // graceful fallback for docs where availableStock was never initialised
          { availableStock: { $exists: false }, totalStock: { $gte: item.quantity } },
        ],
      },
      {
        $inc: {
          totalStock:     -item.quantity,  // visible stock drops immediately on order
          availableStock: -item.quantity,
          reservedStock:   item.quantity,
        },
      },
      { new: true }
    );

    if (!updated) {
      if (committed.length) await releaseReserve(committed, orderId, userId);
      return { success: false, failedItem: item };
    }

    if (item.size) {
      Size.findOneAndUpdate(
        { _id: item.size, $or: [{ availableStock: { $gte: item.quantity } }, { stock: { $gte: item.quantity } }] },
        { $inc: { stock: -item.quantity, availableStock: -item.quantity, reservedStock: item.quantity } }
      ).catch(() => {});
    }

    syncStatus(item.subproduct, updated.lowStockThreshold);
    committed.push(item);
  }

  audit(items.filter(i => i.subproduct), orderId, 'reserved', 'out', userId);
  return { success: true };
}

/**
 * Release a reservation (pre-shipment cancel, payment failure).
 * Increments availableStock, decrements reservedStock.
 */
async function releaseReserve(items, orderId, userId) {
  const ops = items.filter(i => i.subproduct).map(async (item) => {
    const updated = await SubProduct.findByIdAndUpdate(
      item.subproduct,
      {
        $inc: {
          totalStock:      item.quantity,   // restore visible stock
          availableStock:  item.quantity,
          reservedStock:  -item.quantity,
        },
      },
      { new: true }
    ).catch(() => null);

    if (item.size) {
      Size.findByIdAndUpdate(
        item.size,
        { $inc: { stock: item.quantity, availableStock: item.quantity, reservedStock: -item.quantity } }
      ).catch(() => {});
    }

    if (updated) syncStatus(item.subproduct, updated.lowStockThreshold);
  });

  await Promise.allSettled(ops);
  audit(items.filter(i => i.subproduct), orderId, 'released', 'in', userId);
}

/**
 * Commit shipment: item has physically left the warehouse.
 * Decrements totalStock and reservedStock; updates sales analytics.
 * Call when order status → 'shipped'.
 */
async function commitShipment(items, orderId, userId) {
  const ops = items.filter(i => i.subproduct).map(async (item) => {
    // totalStock and availableStock were already decremented at reserve() time.
    // Here we only clear the reservation and record the sale.
    const updated = await SubProduct.findByIdAndUpdate(item.subproduct, {
      $inc: {
        reservedStock: -item.quantity,
        totalSold:      item.quantity,
        totalRevenue:   item.itemSubtotal || 0,
        purchaseCount:  1,
      },
      $set: { lastSoldDate: new Date() },
    }, { new: true }).catch(() => null);

    if (item.size) {
      Size.findByIdAndUpdate(
        item.size,
        { $inc: { reservedStock: -item.quantity } }
      ).catch(() => {});
    }

    if (updated) syncStatus(item.subproduct, updated.lowStockThreshold);
  });

  await Promise.allSettled(ops);
  audit(items.filter(i => i.subproduct), orderId, 'shipped', 'out', userId);
}

/**
 * Restore stock after a post-shipment cancellation or refund.
 * Increments both availableStock and totalStock (item physically returned).
 */
async function restoreStock(items, orderId, userId) {
  const ops = items.filter(i => i.subproduct).map(async (item) => {
    const updated = await SubProduct.findByIdAndUpdate(
      item.subproduct,
      {
        $inc: {
          availableStock:  item.quantity,
          totalStock:      item.quantity,
          totalSold:      -item.quantity,
        },
      },
      { new: true }
    ).catch(() => null);

    if (item.size) {
      Size.findByIdAndUpdate(
        item.size,
        { $inc: { availableStock: item.quantity, stock: item.quantity } }
      ).catch(() => {});
    }

    if (updated) syncStatus(item.subproduct, updated.lowStockThreshold);
  });

  await Promise.allSettled(ops);
  audit(items.filter(i => i.subproduct), orderId, 'return', 'in', userId);
}

/**
 * Has stock already been committed to a shipment (i.e. left the warehouse)?
 */
function isShipped(status) {
  return ['shipped', 'delivered', 'refunded'].includes(status);
}

// ─── Admin / manual inventory management API ───────────────────────────────

/**
 * Record received goods (purchase / restock).
 * Increments totalStock and availableStock.
 */
async function recordReceived(subProductId, tenantId, data, performedBy) {
  const {
    quantity, unitCost, reference, supplierId, supplierName,
    batchNumber, lotNumber, expirationDate, notes, reason,
    sizeId, sizeName, warehouseId,
  } = data;

  if (!quantity || quantity <= 0) throw new Error('Quantity must be positive');

  const sp = await SubProduct.findOne({ _id: subProductId, tenant: tenantId }).select(
    'totalStock availableStock reservedStock lowStockThreshold stockStatus tenant'
  );
  if (!sp) throw new Error('SubProduct not found');

  const qBefore = sp.availableStock ?? 0;
  const qAfter  = qBefore + quantity;

  sp.totalStock     = (sp.totalStock     ?? 0) + quantity;
  sp.availableStock = (sp.availableStock ?? 0) + quantity;
  sp.stockStatus    = computeStockStatus(sp.availableStock, sp.lowStockThreshold);
  sp.status         = sp.availableStock <= 0 ? 'out_of_stock'
                    : sp.availableStock <= (sp.lowStockThreshold ?? 10) ? 'low_stock'
                    : 'active';
  await sp.save();

  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, warehouseId);

  const movement = await InventoryMovement.create({
    subProduct:     subProductId,
    tenant:         tenantId || sp.tenant,
    warehouse:      movementWarehouse || undefined,
    type:           'received',
    category:       'in',
    quantity,
    quantityBefore: qBefore,
    quantityAfter:  qAfter,
    reference,
    referenceType:  'purchase_order',
    unitCost:       unitCost ?? sp.costPrice ?? 0,
    totalCost:      (unitCost ?? sp.costPrice ?? 0) * quantity,
    supplierName,
    supplier:       supplierId || undefined,
    batchNumber,
    lotNumber,
    expirationDate,
    reason:         reason || 'Stock received',
    notes,
    size:           sizeId   || undefined,
    sizeName:       sizeName || undefined,
    performedBy,
    performedAt:    new Date(),
    source:         'manual',
    status:         'confirmed',
    isVerified:     true,
    verifiedAt:     new Date(),
  });

  // Update size stock: specific size if sizeId given, else distribute across all sizes
  if (sizeId) {
    Size.findByIdAndUpdate(sizeId, { $inc: { stock: quantity, availableStock: quantity } }).catch(() => {});
  } else {
    // No size specified — keep all Size docs in sync with the SubProduct total
    const spFull = await SubProduct.findById(subProductId).select('sizes sellWithoutSizeVariants totalStock').lean();
    if (spFull?.sizes?.length > 0 && !spFull.sellWithoutSizeVariants) {
      const sizes = await Size.find({ _id: { $in: spFull.sizes } }).select('stock availableStock').lean();
      if (sizes.length > 0) {
        const sizeStockSum = sizes.reduce((sum, s) => sum + (s.stock || 0), 0);
        const target = spFull.totalStock;
        if (sizeStockSum === 0) {
          const perSize   = Math.floor(target / sizes.length);
          const remainder = target % sizes.length;
          await Promise.all(sizes.map((s, i) => {
            const val = perSize + (i === 0 ? remainder : 0);
            return Size.findByIdAndUpdate(s._id, { $set: { stock: val, availableStock: val } });
          }));
        } else {
          let remaining = target;
          await Promise.all(sizes.map((s, i) => {
            const isLast   = i === sizes.length - 1;
            const share    = (s.stock || 0) / sizeStockSum;
            const newStock = isLast
              ? Math.max(0, remaining)
              : Math.max(0, Math.min(remaining, Math.round(share * target)));
            remaining -= newStock;
            return Size.findByIdAndUpdate(s._id, { $set: { stock: newStock, availableStock: newStock } });
          }));
        }
      }
    }
  }

  return movement;
}

/**
 * Record the sub-product history for a single received PO line.
 *
 * This is an AUDIT-ONLY write plus the per-size + lastRestock bookkeeping that the
 * warehouse posting path (warehouseService.adjustStock → recalcSubProductStock)
 * does NOT do. It must NOT touch SubProduct.totalStock/availableStock — those are
 * already recomputed from WarehouseStock by the caller, so mutating them here would
 * double-count. It writes:
 *   • an InventoryMovement (type 'received', category 'in') so the purchase shows in
 *     the sub-product's History tab and the received totals,
 *   • the per-size Size.stock/availableStock increment (POS/edit-page figure), and
 *   • SubProduct.lastRestockDate.
 *
 * @returns {Promise<InventoryMovement>} the created movement
 */
async function recordReceiptMovement({
  subProduct, tenant, product, size, warehouse,
  quantity, balanceBefore, balanceAfter,
  unitCost, supplierName, reference, relatedPurchaseOrder,
  batchNumber, expirationDate, notes, performedBy,
}) {
  const before = Number.isFinite(balanceBefore) ? balanceBefore : 0;
  const after  = Number.isFinite(balanceAfter)  ? balanceAfter  : before + quantity;

  const movement = await InventoryMovement.create({
    subProduct,
    tenant,
    product:        product || undefined,
    size:           size || undefined,
    warehouse:      warehouse || undefined,
    type:           'received',
    category:       'in',
    quantity,
    quantityBefore: before,
    quantityAfter:  after,
    reference:      reference || undefined,
    referenceType:  'purchase_order',
    relatedPurchaseOrder: relatedPurchaseOrder || undefined,
    unitCost:       unitCost ?? undefined,
    totalCost:      unitCost != null ? unitCost * quantity : undefined,
    supplierName:   supplierName || undefined,
    batchNumber:    batchNumber || undefined,
    expirationDate: expirationDate || undefined,
    reason:         'Purchase received',
    notes:          notes || undefined,
    performedBy,
    performedAt:    new Date(),
    source:         'system',
    status:         'confirmed',
    isVerified:     true,
    verifiedAt:     new Date(),
  });

  // Keep the per-size figure (read by the POS and the sub-product edit page) moving
  // with the receipt — adjustStock only updates WarehouseStock + the SubProduct rollup.
  if (size) {
    await Size.findByIdAndUpdate(size, {
      $inc: { stock: quantity, availableStock: quantity },
    }).catch(() => {});
  }
  await SubProduct.findByIdAndUpdate(subProduct, {
    $set: { lastRestockDate: new Date() },
  }).catch(() => {});

  return movement;
}

/**
 * Adjust inventory by a signed delta (positive = add, negative = remove).
 */
async function adjustInventory(subProductId, tenantId, adjustment, reason, performedBy, notes, reference) {
  if (adjustment === 0) throw new Error('Adjustment cannot be zero');

  const sp = await SubProduct.findOne({ _id: subProductId, tenant: tenantId }).select(
    'totalStock availableStock reservedStock lowStockThreshold stockStatus tenant sizes sellWithoutSizeVariants'
  );
  if (!sp) throw new Error('SubProduct not found');

  const qBefore = sp.availableStock ?? 0;

  sp.totalStock     = Math.max(0, (sp.totalStock     ?? 0) + adjustment);
  sp.availableStock = Math.max(0, (sp.availableStock ?? 0) + adjustment);
  sp.stockStatus    = computeStockStatus(sp.availableStock, sp.lowStockThreshold);
  sp.status         = sp.availableStock <= 0 ? 'out_of_stock'
                    : sp.availableStock <= (sp.lowStockThreshold ?? 10) ? 'low_stock'
                    : 'active';
  await sp.save();

  // Keep Size documents in sync so the POS (which reads per-size availableStock)
  // matches the inventory page (which reads SubProduct.availableStock).
  if (sp.sizes?.length > 0 && !sp.sellWithoutSizeVariants) {
    const sizes = await Size.find({ _id: { $in: sp.sizes } }).select('stock availableStock').lean();
    if (sizes.length > 0) {
      const sizeStockSum = sizes.reduce((sum, s) => sum + (s.stock || 0), 0);
      const target = sp.totalStock;
      if (sizeStockSum === 0) {
        const perSize   = Math.floor(target / sizes.length);
        const remainder = target % sizes.length;
        await Promise.all(sizes.map((s, i) => {
          const val = perSize + (i === 0 ? remainder : 0);
          return Size.findByIdAndUpdate(s._id, { $set: { stock: val, availableStock: val } });
        }));
      } else {
        let remaining = target;
        await Promise.all(sizes.map((s, i) => {
          const isLast   = i === sizes.length - 1;
          const share    = (s.stock || 0) / sizeStockSum;
          const newStock = isLast
            ? Math.max(0, remaining)
            : Math.max(0, Math.min(remaining, Math.round(share * target)));
          remaining -= newStock;
          return Size.findByIdAndUpdate(s._id, { $set: { stock: newStock, availableStock: newStock } });
        }));
      }
    }
  }

  const qAfter = sp.availableStock;
  const type   = adjustment > 0 ? 'adjustment_in' : 'adjustment_out';
  const cat    = adjustment > 0 ? 'in' : 'out';

  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, undefined);

  const movement = await InventoryMovement.create({
    subProduct:     subProductId,
    tenant:         tenantId || sp.tenant,
    warehouse:      movementWarehouse || undefined,
    type,
    category:       cat,
    quantity:       Math.abs(adjustment),
    quantityBefore: qBefore,
    quantityAfter:  qAfter,
    reference,
    referenceType:  'adjustment',
    reason:         reason || (adjustment > 0 ? 'Manual adjustment in' : 'Manual adjustment out'),
    notes,
    performedBy,
    performedAt:    new Date(),
    source:         'manual',
    status:         'confirmed',
    isVerified:     true,
    verifiedAt:     new Date(),
  });

  return movement;
}

/**
 * Record a customer return.
 */
async function recordReturn(subProductId, tenantId, data, performedBy) {
  const { quantity, reason, notes, reference, relatedOrder, warehouseId } = data;
  if (!quantity || quantity <= 0) throw new Error('Quantity must be positive');

  const sp = await SubProduct.findOne({ _id: subProductId, tenant: tenantId }).select(
    'totalStock availableStock lowStockThreshold stockStatus tenant sizes sellWithoutSizeVariants'
  );
  if (!sp) throw new Error('SubProduct not found');

  const qBefore = sp.availableStock ?? 0;
  sp.totalStock     = (sp.totalStock     ?? 0) + quantity;
  sp.availableStock = (sp.availableStock ?? 0) + quantity;
  sp.stockStatus    = computeStockStatus(sp.availableStock, sp.lowStockThreshold);
  sp.status         = sp.availableStock <= 0 ? 'out_of_stock'
                    : sp.availableStock <= (sp.lowStockThreshold ?? 10) ? 'low_stock'
                    : 'active';
  await sp.save();

  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, warehouseId);

  const movement = await InventoryMovement.create({
    subProduct:     subProductId,
    tenant:         tenantId || sp.tenant,
    warehouse:      movementWarehouse || undefined,
    type:           'return',
    category:       'in',
    quantity,
    quantityBefore: qBefore,
    quantityAfter:  sp.availableStock,
    reference,
    referenceType:  'return',
    relatedOrder,
    reason:         reason || 'Customer return',
    notes,
    performedBy,
    performedAt:    new Date(),
    source:         'manual',
    status:         'confirmed',
  });

  // Keep Size documents in sync with the updated SubProduct total
  if (sp.sizes?.length > 0 && !sp.sellWithoutSizeVariants) {
    const sizes = await Size.find({ _id: { $in: sp.sizes } }).select('stock availableStock').lean();
    if (sizes.length > 0) {
      const sizeStockSum = sizes.reduce((sum, s) => sum + (s.stock || 0), 0);
      const target = sp.totalStock;
      if (sizeStockSum === 0) {
        const perSize   = Math.floor(target / sizes.length);
        const remainder = target % sizes.length;
        await Promise.all(sizes.map((s, i) => {
          const val = perSize + (i === 0 ? remainder : 0);
          return Size.findByIdAndUpdate(s._id, { $set: { stock: val, availableStock: val } });
        }));
      } else {
        let remaining = target;
        await Promise.all(sizes.map((s, i) => {
          const isLast   = i === sizes.length - 1;
          const share    = (s.stock || 0) / sizeStockSum;
          const newStock = isLast
            ? Math.max(0, remaining)
            : Math.max(0, Math.min(remaining, Math.round(share * target)));
          remaining -= newStock;
          return Size.findByIdAndUpdate(s._id, { $set: { stock: newStock, availableStock: newStock } });
        }));
      }
    }
  }

  return movement;
}

/**
 * Transfer stock between warehouses.
 */
async function transferStock(data, performedBy, tenantId) {
  const { subProductId, sourceWarehouseId, destinationWarehouseId, quantity, notes, reference } = data;
  if (!quantity || quantity <= 0) throw new Error('Quantity must be positive');

  const sp = await SubProduct.findOne({ _id: subProductId, tenant: tenantId }).select('totalStock availableStock tenant');
  if (!sp) throw new Error('SubProduct not found');

  const qBefore = sp.availableStock ?? 0;

  const outMovement = await InventoryMovement.create({
    subProduct:          subProductId,
    tenant:              tenantId || sp.tenant,
    type:                'transfer_out',
    category:            'transfer',
    quantity,
    quantityBefore:      qBefore,
    quantityAfter:       qBefore,   // transfer doesn't change total
    warehouse:           sourceWarehouseId,
    sourceWarehouse:     sourceWarehouseId,
    destinationWarehouse: destinationWarehouseId,
    reference,
    referenceType:       'transfer',
    reason:              'Stock transfer',
    notes,
    performedBy,
    performedAt:         new Date(),
    source:              'manual',
    status:              'confirmed',
  });

  const inMovement = await InventoryMovement.create({
    subProduct:          subProductId,
    tenant:              tenantId || sp.tenant,
    type:                'transfer_in',
    category:            'transfer',
    quantity,
    quantityBefore:      qBefore,
    quantityAfter:       qBefore,
    warehouse:           destinationWarehouseId,
    sourceWarehouse:     sourceWarehouseId,
    destinationWarehouse: destinationWarehouseId,
    reference,
    referenceType:       'transfer',
    reason:              'Stock transfer',
    notes,
    performedBy,
    performedAt:         new Date(),
    source:              'manual',
    status:              'confirmed',
  });

  return { outMovement, inMovement };
}

/**
 * Create a raw InventoryMovement (generic endpoint).
 */
async function createMovement(data, performedBy, tenantId) {
  const sp = await SubProduct.findOne({ _id: data.subProductId, tenant: tenantId }).select(
    'availableStock totalStock lowStockThreshold stockStatus tenant'
  );
  if (!sp) throw new Error('SubProduct not found');

  const qBefore = sp.availableStock ?? 0;
  const isIn = ['in'].includes(data.category);
  const qty  = isIn ? Math.abs(data.quantity) : -Math.abs(data.quantity);

  if (data.category !== 'transfer') {
    sp.totalStock     = Math.max(0, (sp.totalStock     ?? 0) + qty);
    sp.availableStock = Math.max(0, (sp.availableStock ?? 0) + qty);
    sp.stockStatus    = computeStockStatus(sp.availableStock, sp.lowStockThreshold);
    sp.status         = sp.availableStock <= 0 ? 'out_of_stock'
                      : sp.availableStock <= (sp.lowStockThreshold ?? 10) ? 'low_stock'
                      : 'active';
    await sp.save();
  }

  const movementWarehouse = await resolveMovementWarehouse(tenantId || sp.tenant, data.warehouseId);

  const movement = await InventoryMovement.create({
    subProduct:     data.subProductId,
    tenant:         tenantId || sp.tenant,
    warehouse:      movementWarehouse || undefined,
    type:           data.type,
    category:       data.category,
    quantity:       Math.abs(data.quantity),
    quantityBefore: qBefore,
    quantityAfter:  sp.availableStock,
    reference:      data.reference,
    referenceType:  data.referenceType || 'manual',
    reason:         data.reason,
    notes:          data.notes,
    unitCost:       data.unitCost,
    totalCost:      data.unitCost ? data.unitCost * Math.abs(data.quantity) : undefined,
    performedBy,
    performedAt:    new Date(),
    source:         'manual',
    status:         data.status || 'confirmed',
  });

  return movement;
}

/**
 * Get paginated movements for a tenant/subProduct.
 */
async function getMovements(tenantId, options = {}) {
  const {
    subProductId, type, category, startDate, endDate,
    page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc',
  } = options;

  // Build query — tenant-scoped when tenantId provided, platform-wide when null (super_admin)
  const query = {};
  if (tenantId) {
    query.tenant = new mongoose.Types.ObjectId(tenantId.toString());
  }
  if (subProductId) query.subProduct = new mongoose.Types.ObjectId(subProductId.toString());
  if (type)         query.type       = type;
  if (category)     query.category   = category;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate)   query.createdAt.$lte = new Date(endDate);
  }

  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [movements, total] = await Promise.all([
    InventoryMovement.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'firstName lastName email posName')
      .populate('size', 'displayName size')
      .populate('relatedOrder', 'orderNumber receiptNumber placedAt')
      .populate('warehouse', 'name code')
      .populate('sourceWarehouse', 'name code')
      .populate('destinationWarehouse', 'name code')
      .lean(),
    InventoryMovement.countDocuments(query),
  ]);

  return {
    data: { movements, total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get full inventory summary for a subProduct.
 */
async function getInventorySummary(tenantId, subProductId) {
  const tId = new mongoose.Types.ObjectId(tenantId.toString());
  const spId = new mongoose.Types.ObjectId(subProductId.toString());

  const [sp, recentMovements, summary, stockFlow] = await Promise.all([
    SubProduct.findById(subProductId)
      .select('sku totalStock availableStock reservedStock stockStatus lowStockThreshold costPrice')
      .lean(),
    InventoryMovement.find({ tenant: tId, subProduct: spId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('performedBy', 'firstName lastName')
      .populate('size', 'displayName size')
      .populate('warehouse', 'name code')
      .populate('sourceWarehouse', 'name code')
      .populate('destinationWarehouse', 'name code')
      .lean(),
    InventoryMovement.aggregate([
      { $match: { tenant: tId, subProduct: spId, status: 'confirmed' } },
      { $group: { _id: '$type', totalQuantity: { $sum: '$quantity' }, count: { $sum: 1 }, totalCost: { $sum: '$totalCost' } } },
    ]),
    InventoryMovement.aggregate([
      {
        $match: {
          tenant:    tId,
          subProduct: spId,
          status:    'confirmed',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            date:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            category: '$category',
          },
          totalQuantity: { $sum: '$quantity' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]),
  ]);

  // Build totals from summary groups
  const totals = { received: 0, sold: 0, returned: 0, adjusted: 0, damaged: 0 };
  for (const row of summary) {
    if (['received', 'purchase'].includes(row._id))            totals.received  += row.totalQuantity;
    if (['sold', 'shipped'].includes(row._id))                  totals.sold      += row.totalQuantity;
    if (['return', 'return_in'].includes(row._id))              totals.returned  += row.totalQuantity;
    if (['adjustment_in', 'adjustment_out'].includes(row._id))  totals.adjusted  += row.totalQuantity;
    if (['damaged', 'written_off', 'expired', 'theft'].includes(row._id)) totals.damaged += row.totalQuantity;
  }

  // Source breakdown (POS vs online vs manual)
  const sourceBreakdown = await InventoryMovement.aggregate([
    { $match: { tenant: tId, subProduct: spId, status: 'confirmed', type: { $in: ['sold', 'shipped'] } } },
    { $group: { _id: '$source', totalQuantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
  ]);

  const sources = { pos: 0, online: 0, manual: 0 };
  for (const row of sourceBreakdown) {
    if (row._id === 'order')  sources.pos    += row.totalQuantity; // POS uses source:'order'
    else if (row._id === 'system') sources.online += row.totalQuantity; // ecommerce audit uses source implicitly
    else                          sources.manual += row.totalQuantity;
  }

  return { subProduct: sp, totals, sources, summary, recentMovements, stockFlow };
}

/**
 * Cancel a movement and reverse its stock effect.
 */
async function cancelMovement(movementId, tenantId, performedBy, reason) {
  // Build filter — tenant-scoped when tenantId provided, platform-wide when null (super_admin)
  const filter = { _id: movementId };
  if (tenantId) filter.tenant = tenantId;

  const movement = await InventoryMovement.findOne(filter);
  if (!movement) throw new Error('Movement not found');
  if (movement.status === 'cancelled') throw new Error('Movement is already cancelled');

  // Reverse stock effect — scope SubProduct by tenant for defense-in-depth
  const spFilter = { _id: movement.subProduct };
  if (tenantId) spFilter.tenant = tenantId;
  const sp = await SubProduct.findOne(spFilter).select(
    'totalStock availableStock lowStockThreshold stockStatus tenant'
  );
  if (sp) {
    const reversal = movement.category === 'in' ? -movement.quantity : movement.quantity;
    sp.totalStock     = Math.max(0, (sp.totalStock     ?? 0) + reversal);
    sp.availableStock = Math.max(0, (sp.availableStock ?? 0) + reversal);
    sp.stockStatus    = computeStockStatus(sp.availableStock, sp.lowStockThreshold);
    sp.status         = sp.availableStock <= 0 ? 'out_of_stock'
                      : sp.availableStock <= (sp.lowStockThreshold ?? 10) ? 'low_stock'
                      : 'active';
    await sp.save();
  }

  movement.status   = 'cancelled';
  movement.notes    = movement.notes ? `${movement.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  await movement.save();

  return movement;
}

/**
 * Get next PO number for a tenant.
 */
async function getNextPONumber(tenantId) {
  const count = await InventoryMovement.countDocuments({ tenant: tenantId, type: 'received' });
  const year  = new Date().getFullYear();
  return `PO-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Get low stock items for a tenant.
 */
async function getLowStockItems(tenantId) {
  return SubProduct.find({
    tenant: tenantId,
    $or: [{ stockStatus: 'low_stock' }, { stockStatus: 'out_of_stock' }],
  })
    .select('name totalStock availableStock lowStockThreshold stockStatus')
    .lean();
}

/**
 * Get inventory valuation for a tenant.
 */
async function getInventoryValuation(tenantId) {
  return SubProduct.aggregate([
    { $match: { tenant: new mongoose.Types.ObjectId(tenantId.toString()) } },
    {
      $group: {
        _id: null,
        totalUnits:     { $sum: '$totalStock' },
        totalCostValue: { $sum: { $multiply: ['$totalStock', { $ifNull: ['$costPrice', 0] }] } },
        productCount:   { $sum: 1 },
      },
    },
  ]);
}

module.exports = {
  // Order lifecycle (used by order processing)
  reserve, releaseReserve, commitShipment, restoreStock, isShipped,
  // Admin / manual inventory management
  recordReceived, recordReceiptMovement, adjustInventory, recordReturn, transferStock,
  createMovement, getMovements, getInventorySummary,
  cancelMovement, getNextPONumber, getLowStockItems, getInventoryValuation,
  resolveMovementWarehouse,
};
