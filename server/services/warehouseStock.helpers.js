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

module.exports = { computeRollup, recalcSubProductStock };
