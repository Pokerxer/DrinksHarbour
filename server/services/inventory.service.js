/**
 * inventory.service.js — single source of truth for all stock mutations.
 *
 * Stock accounting model:
 *   totalStock     = physical units in the warehouse
 *   reservedStock  = units held for confirmed-but-not-yet-shipped orders
 *   availableStock = units customers can still order (= totalStock - reservedStock)
 *
 * Order lifecycle:
 *   placed         → reserve()        availableStock--, reservedStock++
 *   shipped        → commitShipment() reservedStock--,  totalStock--   (left warehouse)
 *   cancel/fail
 *     before ship  → releaseReserve() availableStock++, reservedStock--
 *     after  ship  → restoreStock()   availableStock++, totalStock++   (returned)
 *   refund         → restoreStock()   availableStock++, totalStock++
 */

'use strict';

const SubProduct        = require('../models/SubProduct');
const Size              = require('../models/Size');
const InventoryMovement = require('../models/InventoryMovement');

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
    for (const item of items) {
      if (!item.subproduct || !item.tenant) continue;
      try {
        const sp = await SubProduct.findById(item.subproduct)
          .select('availableStock totalStock costPrice lowStockThreshold')
          .lean();

        await InventoryMovement.create({
          subProduct:    item.subproduct,
          tenant:        item.tenant,
          product:       item.product,
          size:          item.size  || undefined,
          type,
          category,
          quantity:      item.quantity,
          quantityBefore: 0,                         // exact value not critical for audit
          quantityAfter:  sp?.availableStock ?? 0,
          relatedOrder:  orderId,
          sellingPrice:  item.priceAtPurchase,
          unitCost:      sp?.costPrice ?? 0,
          totalCost:     (sp?.costPrice ?? 0) * item.quantity,
          referenceType: 'order',
          source:        'order',
          performedBy:   performedBy || orderId,     // system fallback: reuse orderId ObjectId
          performedAt:   new Date(),
          status:        'confirmed',
          isVerified:    true,
          verifiedAt:    new Date(),
        });
      } catch (err) {
        console.error(`[Inventory] audit(${type}) failed for subproduct ${item.subproduct}:`, err.message);
      }
    }
  });
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
      { $inc: { availableStock: -item.quantity, reservedStock: item.quantity } },
      { new: true }
    );

    if (!updated) {
      if (committed.length) await releaseReserve(committed, orderId, userId);
      return { success: false, failedItem: item };
    }

    if (item.size) {
      Size.findOneAndUpdate(
        { _id: item.size, $or: [{ availableStock: { $gte: item.quantity } }, { stock: { $gte: item.quantity } }] },
        { $inc: { availableStock: -item.quantity, reservedStock: item.quantity } }
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
      { $inc: { availableStock: item.quantity, reservedStock: -item.quantity } },
      { new: true }
    ).catch(() => null);

    if (item.size) {
      Size.findByIdAndUpdate(
        item.size,
        { $inc: { availableStock: item.quantity, reservedStock: -item.quantity } }
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
    await SubProduct.findByIdAndUpdate(item.subproduct, {
      $inc: {
        totalStock:    -item.quantity,
        reservedStock: -item.quantity,
        totalSold:      item.quantity,
        totalRevenue:   item.itemSubtotal || 0,
        purchaseCount:  1,
      },
      $set: { lastSoldDate: new Date() },
    }).catch(() => {});

    if (item.size) {
      Size.findByIdAndUpdate(
        item.size,
        { $inc: { stock: -item.quantity, reservedStock: -item.quantity } }
      ).catch(() => {});
    }
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

module.exports = { reserve, releaseReserve, commitShipment, restoreStock, isShipped };
