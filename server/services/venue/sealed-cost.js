'use strict';
const { fail } = require('./errors');
const { id } = require('./eligibility');
const math = require('./cost-math');
const { originalReceipt } = require('./source-receipt');
async function sealedCosts({
  tenantId,
  locationId,
  effect,
  mongoSession,
  advance = false,
  movementId,
}) {
  // Only an existing owned reservation may finish while new costing is paused.
  if (advance) {
    const reserved = effect._id && await require('../../models/VenueStockEffect')
      .exists({ _id: effect._id, tenant: tenantId, location: locationId,
        billOrder: effect.billOrder, session: effect.session, state: 'reserved',
        subproduct: effect.subproduct, size: effect.size, quantity: effect.quantity,
        costPolicyVersion: effect.costPolicyVersion, valuationMethod: effect.valuationMethod })
      .session(mongoSession);
    if (!reserved || !effect.costPolicyVersion || !effect.valuationMethod)
      fail('COST_REVIEW_REQUIRED', 'Original costed stock reservation required');
  }
  const { policy, valuationMethod: currentMethod } =
    await require('./costing-policy').requireCostingPolicy({
      tenantId,
      locationId,
      mongoSession,
      forRecognition: advance,
    });
  if (advance && effect.costPolicyVersion !== policy.version)
    fail('COST_REVIEW_REQUIRED', 'Original reservation costing policy changed');
  const valuationMethod = advance ? effect.valuationMethod : currentMethod;
  if (valuationMethod !== 'fifo')
    fail(
      'COST_POLICY_UNSUPPORTED',
      'Reviewed average-valued sealed adapter required',
      503,
    );
  const allocations = [];
  for (const allocation of effect.batchAllocations || []) {
    const lot = await require('../../models/WarehouseBatch')
      .findOne({
        _id: allocation.batch,
        tenant: tenantId,
        warehouse: locationId,
        subProduct: effect.subproduct,
        size: effect.size,
      })
      .session(mongoSession);
    if (!lot) fail('COST_EVIDENCE_REQUIRED', 'Reserved original lot not found');
    await originalReceipt({ tenantId, locationId, lot, mongoSession });
    const value = lot.venueValuation;
    if (
      value.initialQuantityScaled !== lot.initialQuantity ||
      !Number.isSafeInteger(allocation.quantity) ||
      allocation.quantity < 1
    )
      fail(
        'COST_REVIEW_REQUIRED',
        'Sealed lot needs exact whole-unit valuation',
      );
    await require('./sealed-valuation').assertSealedValuation({
      tenantId, locationId, lot, pendingQuantity: advance ? 0 : allocation.quantity, mongoSession,
    });
    const cost = math.allocateSourceCost({
      costMinor: value.initialCostMinor,
      quantityScaled: value.initialQuantityScaled,
      issuedBeforeScaled: value.issuedQuantityScaled || 0,
      issueScaled: allocation.quantity,
    });
    if (advance) {
      lot.venueValuation.issuedQuantityScaled =
        (value.issuedQuantityScaled || 0) + allocation.quantity;
      lot.venueValuation.issuedCostMinor = (value.issuedCostMinor || 0) + cost;
      await lot.save({ session: mongoSession });
    }
    allocations.push({
      movementId,
      lotId: lot._id,
      receiptId: value.receiptId,
      quantity: { amountScaled: allocation.quantity, scale: 1, unit: 'count' },
      allocatedCostMinor: cost,
      valuationMethod,
      sourceTimestamp: lot.receivedDate,
    });
  }
  if (
    allocations.reduce((sum, row) => sum + row.quantity.amountScaled, 0) !==
    effect.quantity
  )
    fail(
      'COST_EVIDENCE_REQUIRED',
      'Complete original lot cost required before new actual-cost billing',
      503,
    );
  return {
    allocations,
    policy,
    valuationMethod,
    amountMinor: math.sumMinor(
      allocations.map((row) => row.allocatedCostMinor),
    ),
  };
}
async function recordSealedCost({
  tenantId,
  billOrder,
  effect,
  movementId,
  eventId,
  actor,
  mongoSession,
  cost,
}) {
  const locationId = id(effect.location);
  const line = { lineId: effect.lineId, revision: effect.revision };
  const snapshot = await require('./cost-evidence').issueCostSnapshot({
    tenantId,
    locationId,
    line,
    billOrder,
    visit: { _id: billOrder.venueServiceSession },
    effectKey: `physical:${eventId}`,
    sourceEvent: eventId,
    sourceKind: 'sealed_issue',
    quantity: { amountScaled: effect.quantity, scale: 1, unit: 'count' },
    sourceAllocations: cost.allocations,
    valuationMethod: cost.valuationMethod,
    policyVersion: cost.policy.version,
    mongoSession,
  });
  await require('./cost-recognition').postIssuedCosts({
    tenantId,
    locationId,
    eventId,
    cost: snapshot,
    policy: cost.policy,
    mongoSession,
  });
  await require('../../models/VenueConsumptionEvent').create(
    [
      {
        _id: eventId,
        tenant: tenantId,
        location: locationId,
        session: billOrder.venueServiceSession,
        billOrder: billOrder._id,
        lineId: effect.lineId,
        revision: effect.revision,
        effectKey: `sealed:${id(effect)}`,
        kind: 'sealed-issue',
        fireDelta: effect.quantity,
        physicalCoverage: 'complete',
        movementIds: [movementId],
        costSnapshotId: snapshot._id,
        items: [
          {
            subProduct: effect.subproduct,
            size: effect.size,
            quantity: effect.quantity,
            unit: 'count',
          },
        ],
        actor: actor.userId,
      },
    ],
    { session: mongoSession },
  );
}
module.exports = { sealedCosts, recordSealedCost };
