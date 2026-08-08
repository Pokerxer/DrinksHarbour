// server/services/warehouseStock.helpers.js
const WarehouseStock = require('../models/WarehouseStock');
const SubProduct = require('../models/SubProduct');

/**
 * Pure: roll a list of warehouse-stock rows into subproduct totals.
 * @param {Array<{currentQuantity?:number, reservedQuantity?:number}>} rows
 */
function computeRollup(rows) {
  const totalStock = rows.reduce((s, r) => s + (r.currentQuantity || 0), 0);
  const reservedStock = rows.reduce((s, r) => s + (r.reservedQuantity || 0), 0);
  return { totalStock, reservedStock, availableStock: Math.max(0, totalStock - reservedStock) };
}

/**
 * DB wrapper: recompute and persist SubProduct rollups from its WarehouseStock rows.
 * Pass an optional Mongoose session for transactional writes.
 */
async function recalcSubProductStock(subProductId, session = null) {
  const q = WarehouseStock.find({ subProduct: subProductId }).select(
    'currentQuantity reservedQuantity'
  );
  if (session) q.session(session);
  const rows = await q.lean();
  const rollup = computeRollup(rows);
  const update = SubProduct.updateOne({ _id: subProductId }, { $set: rollup });
  if (session) update.session(session);
  await update;
  return rollup;
}

const MS_PER_DAY = 86_400_000;
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * Pure: derive the warehouse reporting status flags for one stock line from the
 * tenant's warehouseSettings. Centralises the thresholds (low-stock, reorder
 * point, overstock ceiling, near-expiry window) so the server is the single
 * source of truth and the client no longer hard-codes them.
 *
 * @param {object} row   { currentQuantity, reservedQuantity, minStockLevel, earliestExpiry }
 * @param {object} settings  tenant.warehouseSettings (defaults applied upstream)
 * @param {Date}   now
 */
function computeStockFlags(row = {}, settings = {}, now = new Date()) {
  const onHand = num(row.currentQuantity, 0);
  const reserved = num(row.reservedQuantity, 0);
  const available = Math.max(0, onHand - reserved);

  const lowStockThreshold = num(settings.lowStockThreshold, 10);
  // A per-line minStockLevel overrides the tenant-global reorder point.
  const reorderPoint = num(row.minStockLevel, 0) > 0 ? row.minStockLevel : num(settings.reorderPoint, 0);
  const overstockCeiling = num(settings.overstockCeiling, 0);
  const nearExpiryDays = num(settings.nearExpiryDays, 30);

  const outOfStock = onHand <= 0;
  const lowStock = !outOfStock && available <= lowStockThreshold;
  const belowReorder = !!settings.flagBelowReorderPoint && reorderPoint > 0 && available <= reorderPoint;
  const overstocked = overstockCeiling > 0 && onHand >= overstockCeiling;

  let expiryDays = null;
  let nearExpiry = false;
  if (row.earliestExpiry) {
    const ms = new Date(row.earliestExpiry).getTime();
    if (Number.isFinite(ms)) {
      expiryDays = Math.floor((ms - now.getTime()) / MS_PER_DAY);
      nearExpiry = expiryDays <= nearExpiryDays;
    }
  }

  const status = outOfStock ? 'out_of_stock' : lowStock ? 'low_stock' : 'in_stock';

  return {
    status,
    outOfStock,
    lowStock,
    belowReorder,
    overstocked,
    nearExpiry,
    available,
    reorderPoint,
    reorderQuantity: num(settings.reorderQuantity, 0),
    // Whether to surface a zero-on-hand alert (gated by the tenant toggle).
    outOfStockAlert: outOfStock && settings.outOfStockAlert !== false,
    expiryDays,
  };
}

/**
 * Decide whether a SubProduct may be deleted, given its WarehouseStock lines.
 *
 * Deleting a SubProduct used to leave its stock rows behind pointing at an id
 * that no longer resolves. Mongoose populate turns such a ref into `null`, and
 * because `typeof null === 'object'` the admin's render-time accessors narrowed
 * null into the "populated" branch and threw — one orphan blanked the whole
 * warehouse page. Worse, the rows still held real quantity (289 units across 11
 * rows in the wyncity tenant), so the stock was neither visible nor written off.
 *
 * The rule: a SubProduct still holding stock cannot be deleted — the operator
 * must write it off or transfer it first, so the loss is deliberate and
 * auditable. Rows that are already empty carry no inventory value and are safe
 * to remove alongside the SubProduct, which is what keeps refs from dangling.
 *
 * @param {Array} rows WarehouseStock docs for the SubProduct
 * @returns {{ blocked: boolean, blocking: Array, removable: Array, totalQuantity: number, totalReserved: number }}
 */
function assessSubProductDeletion(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const held = (r) =>
    Math.max(0, Number(r.currentQuantity) || 0) > 0 ||
    Math.max(0, Number(r.reservedQuantity) || 0) > 0;

  const blocking = list.filter(held);
  return {
    blocked: blocking.length > 0,
    blocking,
    // Empty lines: no inventory value, so deleting them destroys nothing.
    removable: list.filter((r) => !held(r)),
    totalQuantity: blocking.reduce((s, r) => s + (Number(r.currentQuantity) || 0), 0),
    totalReserved: blocking.reduce((s, r) => s + (Number(r.reservedQuantity) || 0), 0),
  };
}

module.exports = {
  computeRollup,
  recalcSubProductStock,
  computeStockFlags,
  assessSubProductDeletion,
};
