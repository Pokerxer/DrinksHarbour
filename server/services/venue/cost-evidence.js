'use strict';
const Snapshot = require('../../models/VenueCostSnapshot');
const { fail } = require('./errors');
const math = require('./cost-math');
async function costIndexesReady() {
  let indexes;
  try {
    indexes = await Snapshot.collection.listIndexes().toArray();
  } catch (error) {
    if (error.code !== 26) throw error;
    indexes = [];
  }
  if (
    !indexes.some(
      (index) =>
        index.unique &&
        !index.partialFilterExpression &&
        !index.sparse &&
        JSON.stringify(index.key) ===
          JSON.stringify({ tenant: 1, effectKey: 1 }),
    )
  )
    fail(
      'COST_INDEX_REVIEW_REQUIRED',
      'Install reviewed cost evidence uniqueness guard',
      503,
    );
}
async function issueCostSnapshot(args) {
  const {
    tenantId,
    locationId,
    effectKey,
    sourceAllocations,
    quantity,
    mongoSession,
  } = args;
  if (!mongoSession?.inTransaction())
    fail(
      'COST_TRANSACTION_REQUIRED',
      'Physical cost evidence needs its stock transaction',
    );
  await costIndexesReady();
  math.assertQuantity(quantity);
  const previous = await Snapshot.findOne({
    tenant: tenantId,
    location: locationId,
    effectKey,
  })
    .session(mongoSession)
    .lean();
  if (previous) {
    if (
      String(previous.sourceEvent) !== String(args.sourceEvent) ||
      previous.quantity.amountScaled !== quantity.amountScaled ||
      previous.quantity.unit !== quantity.unit
    )
      fail('IDEMPOTENCY_CONFLICT', 'Cost evidence identity changed');
    return previous;
  }
  if (!Array.isArray(sourceAllocations) || !sourceAllocations.length)
    fail('COST_EVIDENCE_REQUIRED');
  let known = 0;
  const reasons = [];
  for (const allocation of sourceAllocations) {
    math.assertQuantity(allocation.quantity);
    const movement = await require('../../models/InventoryMovement')
      .findOne({
        _id: allocation.movementId,
        tenant: tenantId,
        warehouse: locationId,
        status: 'confirmed',
      })
      .session(mongoSession)
      .lean();
    if (!movement) fail('NOT_FOUND', 'Original cost movement not found', 404);
    if (allocation.allocatedCostMinor == null) {
      reasons.push('source_cost_unknown');
      continue;
    }
    math.requireMinor(allocation.allocatedCostMinor);
    if (
      !allocation.receiptId ||
      !allocation.lotId ||
      !allocation.sourceTimestamp
    )
      fail(
        'COST_EVIDENCE_REQUIRED',
        'Verified cost needs original receipt and lot',
      );
    const lot = await require('../../models/WarehouseBatch')
      .findOne({
        _id: allocation.lotId,
        tenant: tenantId,
        warehouse: locationId,
        subProduct: movement.subProduct,
        size: movement.size,
      })
      .session(mongoSession)
      .lean();
    if (
      !lot ||
      String(lot.venueValuation?.receiptId) !== String(allocation.receiptId)
    )
      fail('COST_EVIDENCE_REQUIRED', 'Lot receipt lineage is incomplete');
    await require('./source-receipt').originalReceipt({
      tenantId,
      locationId,
      lot,
      mongoSession,
    });
    known = math.sumMinor([known, allocation.allocatedCostMinor]);
  }
  const amountMinor = reasons.length ? null : known;
  const [created] = await Snapshot.create(
    [
      {
        tenant: tenantId,
        location: locationId,
        effectKey,
        sourceKind: args.sourceKind || 'recipe_issue',
        sourceEvent: args.sourceEvent,
        session: args.visit?._id,
        billOrder: args.billOrder?._id,
        lineId: args.line?.lineId,
        revision: args.line?.revision,
        recipeVersionId: args.recipeVersionId,
        quantity,
        sourceAllocations,
        amountMinor,
        status: reasons.length ? (known ? 'mixed' : 'unknown') : 'verified',
        missingReasons: [...new Set(reasons)],
        valuationMethod: args.valuationMethod,
        policyVersion: args.policyVersion,
        currency: 'NGN',
      },
    ],
    { session: mongoSession },
  );
  return created.toObject();
}
module.exports = { issueCostSnapshot, costIndexesReady };
