// services/warehouse.service.js
const mongoose = require('mongoose');
const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
// The unified audit trail the inventory history/summary reads. Warehouse-side
// operations write BOTH ledgers so no movement is invisible to either view.
const InventoryMovement = require('../models/InventoryMovement');
const { recalcSubProductStock, computeStockFlags } = require('./warehouseStock.helpers');
const { valuationCost } = require('./batch.helpers');
const batchService = require('./batch.service');
const { NotFoundError, ValidationError } = require('../utils/errors');

// ── Place CRUD ──────────────────────────────────────────────
const CODE_PREFIX = { warehouse: 'WH', store: 'ST', distribution_center: 'DC' };

// Generate the next sequential, tenant-unique code for a warehouse type,
// e.g. WH-001, ST-002, DC-003.
async function generateWarehouseCode(tenantId, type) {
  const prefix = CODE_PREFIX[type] || 'WH';
  const existing = await Warehouse.find({
    tenant: tenantId,
    code: new RegExp(`^${prefix}-\\d+$`),
  })
    .select('code')
    .lean();
  const max = existing.reduce((m, w) => {
    const n = parseInt(String(w.code).split('-')[1], 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

async function createWarehouse(data, userId, tenantId) {
  if (data.isDefault) {
    await Warehouse.updateMany({ tenant: tenantId }, { $set: { isDefault: false } });
  }

  const payload = { ...data, tenant: tenantId, createdBy: userId };
  const autoCode = !payload.code || !String(payload.code).trim();

  // Retry on the unique {tenant, code} index in case of a concurrent insert.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (autoCode) payload.code = await generateWarehouseCode(tenantId, payload.type);
    try {
      return await Warehouse.create(payload);
    } catch (err) {
      const isDupCode = err?.code === 11000 && err?.keyPattern?.code;
      if (autoCode && isDupCode && attempt < 4) continue;
      throw err;
    }
  }
}

async function getWarehouses(tenantId, filters = {}) {
  const query = { tenant: tenantId };
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.type) query.type = filters.type;
  return Warehouse.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function getWarehouseById(id, tenantId) {
  const wh = await Warehouse.findOne({ _id: id, tenant: tenantId }).lean();
  if (!wh) throw new NotFoundError('Warehouse not found');
  return wh;
}

async function updateWarehouse(id, data, tenantId) {
  if (data.isDefault) {
    await Warehouse.updateMany({ tenant: tenantId }, { $set: { isDefault: false } });
  }
  const wh = await Warehouse.findOneAndUpdate(
    { _id: id, tenant: tenantId },
    { $set: data },
    { new: true }
  );
  if (!wh) throw new NotFoundError('Warehouse not found');
  return wh;
}

async function deleteWarehouse(id, tenantId) {
  const hasStock = await WarehouseStock.exists({
    tenant: tenantId,
    warehouse: id,
    currentQuantity: { $gt: 0 },
  });
  if (hasStock) {
    throw new ValidationError(
      'Cannot delete a warehouse that still holds stock. Transfer or zero it out first.'
    );
  }
  const wh = await Warehouse.findOneAndDelete({ _id: id, tenant: tenantId });
  if (!wh) throw new NotFoundError('Warehouse not found');
  await WarehouseStock.deleteMany({ tenant: tenantId, warehouse: id });
  return wh;
}

// ── Stock ───────────────────────────────────────────────────
async function getWarehouseStock(warehouseId, tenantId, settings = null) {
  const WarehouseBatch = require('../models/WarehouseBatch');
  const [rows, batches] = await Promise.all([
    WarehouseStock.find({ tenant: tenantId, warehouse: warehouseId })
      .populate({
        path: 'subProduct',
        // Prices included so the warehouse-detail drawer can show cost/price
        // without a second round-trip (tenant-scoped endpoint, not public).
        select: 'sku product imagesOverride costPrice baseSellingPrice currency',
        populate: { path: 'product', select: 'name slug images' },
      })
      // wholesalePrice + unitsPerPack feed the transfer create form's seeded
      // cost and packs breakdown (same defaults as the purchases module).
      .populate('size', 'size sellingPrice costPrice wholesalePrice unitsPerPack')
      .sort({ updatedAt: -1 })
      .lean(),
    WarehouseBatch.find({
      tenant: tenantId, warehouse: warehouseId, quantity: { $gt: 0 }, expiryDate: { $ne: null }, quarantined: { $ne: true },
    })
      .select('subProduct size expiryDate')
      .lean(),
  ]);

  // Earliest (most-urgent) expiry per (subProduct, size) line in this warehouse.
  const expMap = new Map();
  for (const b of batches) {
    if (!b.expiryDate) continue;
    const key = `${b.subProduct}|${b.size}`;
    const t = new Date(b.expiryDate).getTime();
    const cur = expMap.get(key);
    if (cur == null || t < cur) expMap.set(key, t);
  }

  const now = new Date();
  return rows.map((r) => {
    const spId = String(typeof r.subProduct === 'object' && r.subProduct ? r.subProduct._id : r.subProduct);
    const szId = String(typeof r.size === 'object' && r.size ? r.size._id : r.size);
    const exp = expMap.get(`${spId}|${szId}`);
    const earliestExpiry = exp != null ? new Date(exp).toISOString() : null;
    return {
      ...r,
      earliestExpiry,
      flags: computeStockFlags({ ...r, earliestExpiry }, settings || {}, now),
    };
  });
}

/**
 * Adjust stock for one (warehouse, subProduct, size) line.
 * type: 'received' | 'shipped' | 'adjusted'
 *   received → +quantity, shipped → -quantity, adjusted → set to quantity (absolute)
 */
/**
 * Mirror a warehouse-ledger change into the unified InventoryMovement ledger
 * (what /inventory/movements and the product history/summary read). Kept in
 * step with the WarehouseMovement write inside the same session/transaction.
 * Mapping: received→received(in) · shipped→shipped(out) · returned→return(in)
 * adjusted→adjustment_in/out · transfer_out/in (category 'transfer').
 */
async function mirrorToInventoryLedger(entries, session = null) {
  if (!entries.length) return;
  try {
    await InventoryMovement.create(entries, session ? { session } : {});
  } catch (err) {
    // The warehouse ledger is authoritative for stock levels; a mirror write
    // must not roll back a completed stock operation. Surface for monitoring.
    console.error('[warehouse] InventoryMovement mirror failed:', err.message);
  }
}

function adjustmentSplit(type, quantity, balanceAfter, prevBalance) {
  if (type === 'adjusted') {
    const delta = balanceAfter - (typeof prevBalance === 'number' ? prevBalance : 0);
    return {
      type: delta >= 0 ? 'adjustment_in' : 'adjustment_out',
      category: 'adjustment',
      quantity: Math.abs(delta),
      quantityBefore:
        typeof prevBalance === 'number' ? prevBalance : balanceAfter,
    };
  }
  const map = {
    received: { t: 'received', c: 'in', sign: 1 },
    shipped: { t: 'shipped', c: 'out', sign: -1 },
    returned: { t: 'return', c: 'in', sign: 1 },
  }[type];
  return {
    type: map.t,
    category: map.c,
    quantity,
    quantityBefore: balanceAfter - map.sign * quantity,
  };
}

async function adjustStock({ warehouseId, subProduct, size, quantity, type, notes, unitCost = null, tracksBatch = false, allowNegativeStock = false, fefoPicking = false }, userId, tenantId) {
  if (!['received', 'shipped', 'adjusted'].includes(type)) {
    throw new ValidationError('Invalid adjustment type');
  }
  let row = await WarehouseStock.findOne({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
  });
  if (!row) {
    row = new WarehouseStock({ tenant: tenantId, warehouse: warehouseId, subProduct, size });
  }
  const before = row.currentQuantity || 0;
  // When negative stock is disallowed, reject a down-adjustment that would drive
  // on-hand below zero rather than silently flooring (which would lose the
  // shortfall). When allowed, the WarehouseStock schema still clamps at min:0 on
  // save, so on-hand bottoms out at 0 here — overselling to a true negative
  // happens only on the atomic sellStock path.
  if (type === 'received') row.currentQuantity += quantity;
  else if (type === 'shipped') {
    if (!allowNegativeStock && before < quantity) {
      throw new ValidationError('Insufficient stock to issue — negative stock is disabled for this tenant');
    }
    row.currentQuantity = Math.max(0, before - quantity);
  } else if (type === 'adjusted') row.currentQuantity = Math.max(0, quantity);
  const prevBalance = before; // captured before mutation above
  await row.save();

  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type, quantity, balanceAfter: row.currentQuantity, reference: notes,
    // Cost rides along on receipts (the buy price); other types leave null
    // unless the caller explicitly supplies one.
    unitCost:
      typeof unitCost === 'number' && unitCost >= 0 ? unitCost : null,
    performedBy: userId,
  });

  // Mirror into the unified ledger so /inventory/movements-based views see it.
  const split = adjustmentSplit(type, quantity, row.currentQuantity, prevBalance);
  await mirrorToInventoryLedger([
    {
      subProduct, tenant: tenantId, warehouse: warehouseId, size,
      type: split.type, category: split.category,
      quantity: Math.abs(split.quantity),
      quantityBefore: split.quantityBefore,
      quantityAfter: row.currentQuantity,
      unitCost: typeof unitCost === 'number' && unitCost > 0 ? unitCost : undefined,
      totalCost:
        typeof unitCost === 'number' && unitCost > 0
          ? unitCost * Math.abs(split.quantity)
          : undefined,
      reference: notes ? String(notes).slice(0, 100) : undefined,
      referenceType: 'manual',
      reason: notes ? String(notes).slice(0, 200) : undefined,
      performedBy: userId,
      performedAt: new Date(),
      source: 'system',
    },
  ]);

  await recalcSubProductStock(subProduct);

  // Reconcile batches on a downward correction: deplete the shortfall FEFO. An
  // upward adjustment lands in untracked slack (no batch context to attribute it to).
  if (tracksBatch) {
    const removed =
      type === 'shipped' ? Math.min(before, quantity)
      : type === 'adjusted' && row.currentQuantity < before ? before - row.currentQuantity
      : 0;
    if (removed > 0) {
      await batchService.depleteBatchesFefo({
        tenantId, warehouseId, subProduct, size, quantity: removed,
        order: fefoPicking ? 'fefo' : 'fifo',
      });
    }
  }
  return row;
}

/**
 * Move quantity of one (subProduct, size) from one warehouse to another, atomically.
 */
async function transferStock(
  { subProduct, size, fromWarehouse, toWarehouse, quantity, notes, tracksBatch = false, allowInterWarehouseTransfers = true, allowNegativeStock = false, fefoPicking = false },
  userId,
  tenantId
) {
  if (!allowInterWarehouseTransfers) {
    throw new ValidationError('Inter-warehouse transfers are disabled for this tenant');
  }
  if (String(fromWarehouse) === String(toWarehouse)) {
    throw new ValidationError('Source and destination warehouses must differ');
  }
  if (!(quantity > 0)) throw new ValidationError('Quantity must be positive');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const src = await WarehouseStock.findOne(
        { tenant: tenantId, warehouse: fromWarehouse, subProduct, size }
      ).session(session);
      // A missing source row always blocks (nothing to move). An insufficient
      // balance only blocks when negative stock is disallowed.
      if (!src || (!allowNegativeStock && src.currentQuantity < quantity)) {
        throw new ValidationError('Insufficient stock in source warehouse');
      }
      src.currentQuantity = Math.max(0, src.currentQuantity - quantity);
      await src.save({ session });

      let dest = await WarehouseStock.findOne(
        { tenant: tenantId, warehouse: toWarehouse, subProduct, size }
      ).session(session);
      if (!dest) {
        dest = new WarehouseStock({
          tenant: tenantId, warehouse: toWarehouse, subProduct, size,
        });
      }
      dest.currentQuantity += quantity;
      await dest.save({ session });

      if (tracksBatch) {
        await batchService.transferBatchesFefo(
          { tenantId, subProduct, size, fromWarehouse, toWarehouse, quantity, order: fefoPicking ? 'fefo' : 'fifo' },
          session
        );
      }

      const transferGroupId = new mongoose.Types.ObjectId();
      await WarehouseMovement.create(
        [
          { tenant: tenantId, warehouse: fromWarehouse, subProduct, size, type: 'transfer_out',
            quantity, balanceAfter: src.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
          { tenant: tenantId, warehouse: toWarehouse, subProduct, size, type: 'transfer_in',
            quantity, balanceAfter: dest.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
        ],
        { session, ordered: true }
      );

      // Mirror the pair into the unified ledger (same transaction) so the
      // product history/summary reflects transfers immediately.
      await mirrorToInventoryLedger(
        [
          {
            subProduct, tenant: tenantId, warehouse: fromWarehouse, size,
            type: 'transfer_out', category: 'transfer',
            quantity, quantityBefore: src.currentQuantity + quantity,
            quantityAfter: src.currentQuantity,
            sourceWarehouse: fromWarehouse,
            destinationWarehouse: toWarehouse,
            reference: notes ? String(notes).slice(0, 100) : String(transferGroupId),
            referenceType: 'transfer',
            reason: notes ? String(notes).slice(0, 200) : undefined,
            performedBy: userId,
            performedAt: new Date(),
            source: 'system',
          },
          {
            subProduct, tenant: tenantId, warehouse: toWarehouse, size,
            type: 'transfer_in', category: 'transfer',
            quantity, quantityBefore: dest.currentQuantity - quantity,
            quantityAfter: dest.currentQuantity,
            sourceWarehouse: fromWarehouse,
            destinationWarehouse: toWarehouse,
            reference: notes ? String(notes).slice(0, 100) : String(transferGroupId),
            referenceType: 'transfer',
            reason: notes ? String(notes).slice(0, 200) : undefined,
            performedBy: userId,
            performedAt: new Date(),
            source: 'system',
          },
        ],
        session
      );
      // Total across warehouses is unchanged; recompute as a safety no-op.
      await recalcSubProductStock(subProduct, session);
      result = { from: src, to: dest, transferGroupId };
    });
    return result;
  } finally {
    session.endSession();
  }
}

/**
 * List warehouse batches, optionally filtered by warehouse/subProduct/size.
 * Sorted earliest-expiry first (FEFO order) for the read UI.
 */
async function getBatches({ warehouseId, subProduct, size } = {}, tenantId) {
  const WarehouseBatch = require('../models/WarehouseBatch');
  const q = { tenant: tenantId };
  if (warehouseId) q.warehouse = warehouseId;
  if (subProduct) q.subProduct = subProduct;
  if (size) q.size = size;
  return WarehouseBatch.find(q)
    .populate('size', 'size')
    .sort({ expiryDate: 1, createdAt: 1 })
    .lean();
}

/**
 * Resolve the most recent known buy price for a stock line from candidate
 * sources, in priority order:
 *   1. a receipt movement that captured unitCost
 *   2. the latest still-stocked batch's landed unit cost
 *   3. the configured standard cost (size, then sub-product)
 * Pure so it can be unit-tested; the controller gathers the candidates.
 */
function resolveLastCost({ movementCost, movementDate, batch, standardCost }) {
  if (
    typeof movementCost === 'number' &&
    movementCost > 0 &&
    (!batch?.receivedDate ||
      !movementDate ||
      new Date(movementDate) >= new Date(batch.receivedDate))
  ) {
    return {
      unitCost: movementCost,
      source: 'movement',
      asOf: movementDate,
      reference: null,
    };
  }
  if (batch && typeof batch.unitCost === 'number' && batch.unitCost > 0) {
    return {
      unitCost: batch.unitCost,
      source: 'batch',
      asOf: batch.receivedDate ?? null,
      reference: batch.poNumber || batch.batchNumber || null,
    };
  }
  if (typeof standardCost === 'number' && standardCost > 0) {
    return { unitCost: standardCost, source: 'standard', asOf: null, reference: null };
  }
  return { unitCost: null, source: 'none', asOf: null, reference: null };
}

/** Latest receipt cost + latest batch for one (subProduct, size) line. */
async function getLastCost({ subProduct, size }, tenantId) {
  const WarehouseBatch = require('../models/WarehouseBatch');
  const [lastReceipt, lastBatch] = await Promise.all([
    WarehouseMovement.findOne({
      tenant: tenantId, subProduct, size,
      type: 'received', unitCost: { $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .select('unitCost createdAt')
      .lean(),
    WarehouseBatch.findOne({
      tenant: tenantId, subProduct, size, quantity: { $gt: 0 },
    })
      .sort({ receivedDate: -1 })
      .select('unitCost receivedDate poNumber batchNumber')
      .lean(),
  ]);
  return { lastReceipt, lastBatch };
}

/**
 * Audit trail for one warehouse (optionally narrowed to a single stock line).
 * Tenant + warehouse are mandatory filters — this is the Workstream B pattern:
 * the caller can never read another tenant's movements by passing loose ids.
 */
const MAX_MOVEMENTS_LIMIT = 200;
async function getMovements(
  { warehouseId, subProduct, size, limit } = {},
  tenantId
) {
  const q = { tenant: tenantId };
  if (!warehouseId) throw new ValidationError('Warehouse id is required');
  q.warehouse = warehouseId;
  if (subProduct) q.subProduct = subProduct;
  if (size) q.size = size;
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), MAX_MOVEMENTS_LIMIT);
  return WarehouseMovement.find(q)
    .populate('performedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();
}

/**
 * Aggregate every WarehouseStock row across all warehouses for a tenant, flattened
 * for the warehouse-analysis reporting page. Mirrors getPOSProductMeta's lean
 * pattern (one query + lean) instead of N per-warehouse calls. Each row carries its
 * own cost basis (size.costPrice, falling back to subProduct.costPrice) and the
 * earliest expiry among its still-stocked batches, so the client can attribute
 * stock value and expiry buckets without extra round-trips.
 */
async function getAllStock(tenantId, settings = null) {
  const WarehouseBatch = require('../models/WarehouseBatch');
  const [rows, batches] = await Promise.all([
    WarehouseStock.find({ tenant: tenantId })
      .populate({
        path: 'subProduct',
        select: 'sku costPrice baseSellingPrice product',
        populate: {
          path: 'product',
          select: 'name category',
          populate: { path: 'category', select: 'name' },
        },
      })
.populate('size', 'size costPrice sellingPrice wholesalePrice unitsPerPack')
      .populate('warehouse', 'name code')
      .lean(),
    WarehouseBatch.find({
      tenant: tenantId,
      quantity: { $gt: 0 },
      quarantined: { $ne: true },
    })
      .select('warehouse subProduct size expiryDate quantity unitCost receivedDate')
      .lean(),
  ]);

  const valuationMethod = (settings && settings.valuationMethod) || 'fifo';

  // Earliest (most-urgent) expiry per line, and the on-hand lots per line (for
  // FIFO / weighted-average valuation).
  const expMap = new Map();
  const lotsMap = new Map();
  for (const b of batches) {
    const key = `${b.warehouse}|${b.subProduct}|${b.size}`;
    if (b.expiryDate) {
      const t = new Date(b.expiryDate).getTime();
      const cur = expMap.get(key);
      if (cur == null || t < cur) expMap.set(key, t);
    }
    if (!lotsMap.has(key)) lotsMap.set(key, []);
    lotsMap.get(key).push(b);
  }

  const now = new Date();
  return rows.map((r) => {
    const sp = r.subProduct || {};
    const sz = r.size || {};
    const wh = r.warehouse || {};
    const standardCost = (sz.costPrice > 0 ? sz.costPrice : null) ?? sp.costPrice ?? 0;
    const whId = String(wh._id || r.warehouse || '');
    const spId = String(sp._id || r.subProduct || '');
    const szId = String(sz._id || r.size || '');
    // Cost basis honours the tenant's valuationMethod, falling back to the
    // product/size standard cost when no batch carries a captured unit cost.
    const cost = valuationCost(lotsMap.get(`${whId}|${spId}|${szId}`), valuationMethod, standardCost);
    const exp = expMap.get(`${whId}|${spId}|${szId}`);
    const earliestExpiry = exp != null ? new Date(exp).toISOString() : null;
    return {
      _id: String(r._id),
      warehouseId: whId,
      warehouseName: wh.name || 'Unknown Warehouse',
      subProductId: spId,
      productName: sp.product?.name || sp.sku || 'Unknown Product',
      categoryId: sp.product?.category?._id ? String(sp.product.category._id) : null,
      categoryName: sp.product?.category?.name || 'Uncategorized',
      sku: sp.sku || '',
      sizeId: szId,
      sizeName: sz.size || '—',
      currentQuantity: r.currentQuantity || 0,
      reservedQuantity: r.reservedQuantity || 0,
      costPrice: cost,
      sellingPrice: (sz.sellingPrice > 0 ? sz.sellingPrice : null) ?? sp.baseSellingPrice ?? 0,
      // Bundle markup_on_cost (bundleMarkupBase='wholesale') and formula rules
      // (markupBase='wholesale') need the size's wholesale price to compute
      // their price on the customer pricelist print — same basis the POS uses.
      wholesalePrice: Number(sz.wholesalePrice) || 0,
      unitsPerPack: Number(sz.unitsPerPack) || 1,
      valuationMethod,
      minStockLevel: r.minStockLevel || 0,
      earliestExpiry,
      flags: computeStockFlags(
        { currentQuantity: r.currentQuantity, reservedQuantity: r.reservedQuantity, minStockLevel: r.minStockLevel, earliestExpiry },
        settings || {},
        now
      ),
    };
  });
}

async function getStockByWarehouse(subProductId, tenantId) {
  // Prices + product identity included so product-level inventory views can
  // show names, last/standard cost and stock value without extra round-trips.
  return WarehouseStock.find({ tenant: tenantId, subProduct: subProductId })
    .populate({
      path: 'subProduct',
      select: 'sku costPrice baseSellingPrice currency',
      populate: { path: 'product', select: 'name slug images' },
    })
    .populate('warehouse', 'name code type')
    .populate('size', 'size costPrice sellingPrice')
    .lean();
}

/**
 * Atomically decrement WarehouseStock for a POS sale and record a 'shipped' movement.
 * Unless allowOverselling is true, the decrement is guarded so it fails (returns null
 * from findOneAndUpdate) when currentQuantity < quantity, throwing a ValidationError.
 */
async function sellStock({ warehouseId, subProduct, size, quantity, allowOverselling = false, allowNegativeStock = false, tracksBatch = false, blockExpiredStock = false, fefoPicking = false }, userId, tenantId) {
  // Block the sale up front when the only stock that could satisfy it is expired.
  // Sellable = on-hand − expired-batch quantity, so untracked slack (on-hand not
  // attributed to any batch) stays sellable and we don't over-reject.
  if (tracksBatch && blockExpiredStock) {
    const [cur, expired] = await Promise.all([
      WarehouseStock.findOne({ tenant: tenantId, warehouse: warehouseId, subProduct, size })
        .select('currentQuantity').lean(),
      batchService.expiredQuantity({ tenantId, warehouseId, subProduct, size }),
    ]);
    const sellable = (cur?.currentQuantity || 0) - expired;
    if (sellable < quantity) {
      throw new ValidationError('Cannot fulfil sale — only expired stock is available');
    }
  }

  // Either the POS oversell toggle OR the tenant's negative-stock policy lets a
  // sale proceed past available on-hand (driving currentQuantity negative on this
  // atomic path, which skips the schema min:0 validator).
  const overdraw = allowOverselling || allowNegativeStock;
  const filter = { tenant: tenantId, warehouse: warehouseId, subProduct, size };
  if (!overdraw) {
    filter.currentQuantity = { $gte: quantity };
  }

  const row = await WarehouseStock.findOneAndUpdate(
    filter,
    { $inc: { currentQuantity: -quantity } },
    { new: true, upsert: overdraw, setDefaultsOnInsert: overdraw }
  );
  if (!row) {
    throw new ValidationError('Insufficient stock for this sale');
  }

  const after = row.currentQuantity;
  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type: 'shipped', quantity, balanceAfter: after, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);

  let batchAllocations = [];
  if (tracksBatch) {
    batchAllocations = await batchService.depleteBatchesFefo({
      tenantId, warehouseId, subProduct, size, quantity,
      order: fefoPicking ? 'fefo' : 'fifo',
      excludeExpired: blockExpiredStock,
    });
  }

  return { before: after + quantity, after, batchAllocations };
}

/**
 * Atomically increment WarehouseStock for a POS refund/void and record a 'returned'
 * movement. Upserts the (warehouse, subProduct, size) row if it doesn't exist yet.
 */
async function returnStock({ warehouseId, subProduct, size, quantity, batchAllocations = null }, userId, tenantId) {
  const row = await WarehouseStock.findOneAndUpdate(
    { tenant: tenantId, warehouse: warehouseId, subProduct, size },
    { $inc: { currentQuantity: quantity } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const after = row.currentQuantity;
  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type: 'returned', quantity, balanceAfter: after, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);

  if (batchAllocations && batchAllocations.length) {
    await batchService.restoreBatches(batchAllocations);
  }

  return { before: after - quantity, after };
}

/**
 * Resolve the warehouse a POS shop's stock should be sourced from. A custom
 * shop (posSettings.shops entry) uses its bound `warehouse`, or null for
 * aggregate stock if left unbound. The built-in retail/wholesale shops, and
 * any other shopId that doesn't match a custom shop, always use the
 * tenant's default warehouse (Warehouse.isDefault), or null if none is set.
 */
async function resolveShopWarehouse(tenant, tenantId, shopId) {
  let shop = null;
  if (shopId) {
    try {
      shop = tenant?.posSettings?.shops?.id?.(shopId) || null;
    } catch (_) {
      shop = null;
    }
  }
  if (shop) {
    // `posSettings.shops.warehouse` is populated by several callers, so this is
    // a document as often as it is an id. Always hand back the id — callers put
    // it straight into WarehouseStock queries and stock deductions.
    const w = shop.warehouse;
    return w && typeof w === 'object' ? (w._id ?? null) : (w || null);
  }
  const def = await Warehouse.findOne({ tenant: tenantId, isDefault: true }).select('_id').lean();
  return def?._id || null;
}

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustStock, transferStock, getStockByWarehouse,
  sellStock, returnStock, resolveShopWarehouse, getBatches, getAllStock,
  getMovements, getLastCost, resolveLastCost,
};
