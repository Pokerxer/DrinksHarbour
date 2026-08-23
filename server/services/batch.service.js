// server/services/batch.service.js — DB operations for the WarehouseBatch sub-ledger.
const WarehouseBatch = require('../models/WarehouseBatch');
const { buildBatchNumber, nextBatchSeq, formatBatchDate, allocateFefo } = require('./batch.helpers');
const { ValidationError } = require('../utils/errors');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Weighted-average unit cost when incoming stock merges into an existing lot. */
function mergedUnitCost(oldQty, oldCost, incQty, incCost) {
  const oq = Number(oldQty) || 0;
  const iq = Number(incQty) || 0;
  if (iq <= 0) return round2(Number(oldCost) || 0);
  if (oq <= 0) return round2(Number(incCost) || 0);
  return round2((oq * (Number(oldCost) || 0) + iq * (Number(incCost) || 0)) / (oq + iq));
}

/**
 * Build the next auto batch number for a (warehouse, subProduct, size) on a date:
 * `${SKU}-${YYYYMMDD}-${seq}`.
 */
async function generateBatchNumber({ tenantId, warehouseId, subProduct, size, sku, date = new Date() }) {
  const prefix = `${sku}-${formatBatchDate(date)}`;
  const existing = await WarehouseBatch.find({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
  }).select('batchNumber').lean();
  const seq = nextBatchSeq(existing.map((b) => b.batchNumber), prefix);
  return buildBatchNumber(sku, date, seq);
}

function sameExpiry(a, b) {
  const ta = a ? new Date(a).getTime() : null;
  const tb = b ? new Date(b).getTime() : null;
  return ta === tb;
}

/**
 * Create a batch, or merge into an existing one with the same batchNumber for the
 * (wh, sub, size) when the expiry matches. Different expiry on an existing number
 * is a conflict. Pass an optional Mongoose session for transactional writes.
 * Does not modify WarehouseStock (the caller increments stock separately).
 */
async function receiveBatch(
  { tenantId, warehouseId, subProduct, size, product, batchNumber, quantity, unitCost = 0, expiryDate = null, sourcePO, poNumber },
  session = null
) {
  if (!(quantity > 0)) throw new ValidationError('Received quantity must be positive');
  const cost = unitCost > 0 ? unitCost : 0;

  const q = WarehouseBatch.findOne({
    tenant: tenantId, warehouse: warehouseId, subProduct, size, batchNumber,
  });
  if (session) q.session(session);
  const existing = await q;

  if (existing) {
    if (!sameExpiry(existing.expiryDate, expiryDate)) {
      throw new ValidationError(
        `Batch "${batchNumber}" already exists with a different expiry date; use a different batch number.`
      );
    }
    // Blend the lot's unit cost as a quantity-weighted average of the existing
    // on-hand and the incoming receipt (only when a new cost is supplied).
    if (cost > 0) {
      const prevQty = existing.quantity || 0;
      const prevCost = existing.unitCost || 0;
      const totalQty = prevQty + quantity;
      existing.unitCost = totalQty > 0
        ? (prevQty * prevCost + quantity * cost) / totalQty
        : cost;
    }
    existing.quantity = (existing.quantity || 0) + quantity;
    existing.initialQuantity = (existing.initialQuantity || 0) + quantity;
    await existing.save(session ? { session } : undefined);
    return existing;
  }

  const doc = {
    tenant: tenantId, warehouse: warehouseId, subProduct, size, product,
    batchNumber, quantity, initialQuantity: quantity, unitCost: cost,
    expiryDate, receivedDate: new Date(), sourcePO, poNumber,
  };
  if (session) {
    const [created] = await WarehouseBatch.create([doc], { session });
    return created;
  }
  return WarehouseBatch.create(doc);
}

/**
 * Deplete `quantity` from a (wh, sub, size)'s open batches. Returns the
 * allocations actually drawn from batches (caller persists them on the order
 * line). Any remainder is silently left to untracked slack — WarehouseStock is
 * the authoritative guard and is decremented by the caller.
 *
 * `order` ('fefo'|'fifo') and `excludeExpired` honour the tenant's fefoPicking
 * and blockExpiredStock settings; when expired batches are excluded they are
 * left untouched in the sub-ledger rather than depleted.
 */
async function depleteBatchesFefo(
  { tenantId, warehouseId, subProduct, size, quantity, order = 'fefo', excludeExpired = false },
  session = null
) {
  let query = WarehouseBatch.find({
    tenant: tenantId, warehouse: warehouseId, subProduct, size, quantity: { $gt: 0 }, quarantined: { $ne: true },
  });
  if (session) query = query.session(session);
  const batches = await query.lean();

  const { allocations } = allocateFefo(batches, quantity, { order, excludeExpired });
  for (const a of allocations) {
    const update = WarehouseBatch.updateOne({ _id: a.batch }, { $inc: { quantity: -a.quantity } });
    if (session) update.session(session);
    await update;
  }
  return allocations;
}

/**
 * Sum the on-hand quantity of already-expired batches for a (wh, sub, size).
 * Used to gate sales when blockExpiredStock is on: sellable = onHand − expired.
 */
async function expiredQuantity({ tenantId, warehouseId, subProduct, size, now = new Date() }, session = null) {
  let query = WarehouseBatch.find({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    quantity: { $gt: 0 }, expiryDate: { $ne: null, $lte: now },
  }).select('quantity');
  if (session) query = query.session(session);
  const batches = await query.lean();
  return batches.reduce((s, b) => s + (b.quantity || 0), 0);
}

/** Increment specific batches (refund restore). allocations: [{batch, quantity}]. */
async function restoreBatches(allocations, session = null) {
  for (const a of allocations || []) {
    if (!a.batch || !(a.quantity > 0)) continue;
    const update = WarehouseBatch.updateOne({ _id: a.batch }, { $inc: { quantity: a.quantity } });
    if (session) update.session(session);
    await update;
  }
}

/**
 * Move `quantity` of a (sub, size) between warehouses FEFO: decrement source
 * batches and upsert matching (number + expiry) batches at the destination,
 * preserving expiry. Caller wraps this in a transaction and updates WarehouseStock.
 *
 * Destination valuation: an explicit `destUnitCost` prices NEW lots at the
 * transfer's effective landed cost and re-weights EXISTING twins via
 * `mergedUnitCost`; omitted keeps the historical behaviour of carrying the
 * source lot's cost over (no extra destination lookup).
 */
async function transferBatchesFefo(
  { tenantId, subProduct, size, fromWarehouse, toWarehouse, quantity, order = 'fefo', destUnitCost }, session = null
) {
  let query = WarehouseBatch.find({
    tenant: tenantId, warehouse: fromWarehouse, subProduct, size, quantity: { $gt: 0 }, quarantined: { $ne: true },
  });
  if (session) query = query.session(session);
  const srcBatches = await query.lean();

  const { allocations } = allocateFefo(srcBatches, quantity, { order });
  const byId = new Map(srcBatches.map((b) => [String(b._id), b]));
  const revalue = typeof destUnitCost === 'number';

  for (const a of allocations) {
    const src = byId.get(String(a.batch));
    const destFilter = {
      tenant: tenantId, warehouse: toWarehouse, subProduct, size, batchNumber: a.batchNumber,
    };

    let existing = null;
    if (revalue) {
      const destQuery = WarehouseBatch.findOne(destFilter);
      if (session) destQuery.session(session);
      existing = await destQuery;
    }
    const incomingCost =
      revalue ? destUnitCost : ((src && src.unitCost) || 0);
    const nextCost = existing
      ? mergedUnitCost(existing.quantity, existing.unitCost, a.quantity, incomingCost)
      : incomingCost;

    const dec = WarehouseBatch.updateOne({ _id: a.batch }, { $inc: { quantity: -a.quantity } });
    if (session) dec.session(session);
    await dec;

    const update = {
      $inc: { quantity: a.quantity, initialQuantity: a.quantity },
      $setOnInsert: {
        ...destFilter, product: src && src.product, expiryDate: a.expiryDate || null,
        unitCost: nextCost, receivedDate: new Date(),
      },
    };
    if (existing) update.$set = { unitCost: nextCost };
    const up = WarehouseBatch.findOneAndUpdate(destFilter, update, {
      new: true, upsert: true, setDefaultsOnInsert: true,
    });
    if (session) up.session(session);
    await up;
  }
  return allocations;
}

/**
 * Quarantine every newly-expired lot for a tenant: flag it quarantined and carve
 * its quantity out of available stock via a WarehouseStock.reservedQuantity bump.
 * Idempotent — already-quarantined lots are skipped, so re-running never double-
 * counts. Returns the number of lots quarantined.
 */
async function quarantineExpiredBatches({ tenantId, now = new Date() }) {
  const WarehouseStock = require('../models/WarehouseStock');
  const expired = await WarehouseBatch.find({
    tenant: tenantId,
    quantity: { $gt: 0 },
    quarantined: { $ne: true },
    expiryDate: { $ne: null, $lte: now },
  });

  let quarantinedCount = 0;
  for (const b of expired) {
    b.quarantined = true;
    b.quarantinedAt = now;
    await b.save();
    await WarehouseStock.updateOne(
      { tenant: tenantId, warehouse: b.warehouse, subProduct: b.subProduct, size: b.size },
      { $inc: { reservedQuantity: b.quantity || 0 } }
    );
    quarantinedCount += 1;
  }
  return { quarantinedCount };
}

module.exports = {
  generateBatchNumber, receiveBatch, depleteBatchesFefo, restoreBatches, transferBatchesFefo,
  expiredQuantity, quarantineExpiredBatches, mergedUnitCost,
};
