'use strict';
const { fail } = require('./errors');
const { id } = require('./eligibility');
const Events = require('../../models/VenueConsumptionEvent');
async function issuePrepared(args) {
  const {
    tenantId,
    locationId,
    line,
    visit,
    fireDelta,
    effectKey,
    mongoSession,
    actor,
  } = args;
  if (!mongoSession?.inTransaction()) fail('COST_TRANSACTION_REQUIRED');
  if (!Number.isSafeInteger(fireDelta) || fireDelta < 1 || fireDelta > 100)
    fail('INVALID_QUANTITY', 'Invalid prepared issue', 400);
  const { policy, valuationMethod } =
    await require('./costing-policy').requireCostingPolicy(args);
  await require('./cost-evidence').costIndexesReady();
  const previous = await Events.findOne({
    tenant: tenantId,
    location: locationId,
    effectKey,
  })
    .session(mongoSession)
    .lean();
  if (previous) {
    if (
      previous.fireDelta !== fireDelta ||
      previous.physicalCoverage !== 'complete' ||
      id(previous.recipeVersion) !== id(line.acceptedRecipeVersionId)
    )
      fail('COST_REVIEW_REQUIRED');
    return {
      consumptionId: id(previous),
      costSnapshotId: id(previous.costSnapshotId),
      movementIds: previous.movementIds.map(id),
      coverage: 'complete',
    };
  }
  const size = await require('../../models/Size')
    .findOne({
      _id: line.size,
      tenant: tenantId,
      subproduct: line.subproduct,
      servingSchemaVersion: 2,
      'venueServing.mode': 'prepared_batch',
    })
    .session(mongoSession)
    .lean();
  const sub = await require('../../models/SubProduct')
    .findOne({ _id: line.subproduct, tenant: tenantId })
    .session(mongoSession)
    .lean();
  if (!size || !sub) fail('NOT_FOUND', 'Prepared serving not found', 404);
  const lots = await require('../../models/WarehouseBatch')
    .find({
      tenant: tenantId,
      warehouse: locationId,
      subProduct: line.subproduct,
      size: line.size,
      quantity: { $gt: 0 },
    })
    .session(mongoSession)
    .lean();
  for (const lot of lots) {
    const job =
      lot.venueProduction?.batchId &&
      (await require('../../models/VenueProductionBatch')
        .findOne({
          _id: lot.venueProduction.batchId,
          tenant: tenantId,
          location: locationId,
          state: 'completed',
          recipeVersionId: line.acceptedRecipeVersionId,
          outputBatchId: lot._id,
        })
        .session(mongoSession)
        .lean());
    if (!job)
      fail(
        'COST_REVIEW_REQUIRED',
        'Prepared lot does not match the accepted recipe',
      );
  }
  const eventId = new (require('mongoose').Types.ObjectId)();
  const amount = { amountScaled: fireDelta, scale: 1, unit: 'count' };
  const source = {
    sub,
    amount,
    mapping: {
      sourceSubProductId: line.subproduct,
      sourceSizeId: line.size,
      sourceLocationId: locationId,
      contentQuantity: { amountScaled: 1, scale: 1, unit: 'count' },
    },
  };
  const issued = await require('./recipe-stock-source').issueSource({
    ...args,
    source,
    effectKey: `physical:${eventId}`,
    valuationMethod,
  });
  const cost = await require('./cost-evidence').issueCostSnapshot({
    ...args,
    sourceEvent: eventId,
    effectKey: `physical:${eventId}`,
    sourceKind: 'recipe_issue',
    recipeVersionId: line.acceptedRecipeVersionId,
    quantity: amount,
    sourceAllocations: issued.allocations,
    valuationMethod,
    policyVersion: policy.version,
  });
  await require('./cost-recognition').postIssuedCosts({
    ...args,
    eventId,
    cost,
    policy,
    inventoryRole: 'preparedInventory',
  });
  await Events.create(
    [
      {
        _id: eventId,
        tenant: tenantId,
        location: locationId,
        session: id(visit),
        billOrder: id(visit.heldOrder),
        lineId: line.lineId,
        revision: line.revision,
        effectKey,
        kind: 'recipe',
        recipeVersion: line.acceptedRecipeVersionId,
        recipeCostMinor: cost.amountMinor,
        fireDelta,
        physicalCoverage: 'complete',
        movementIds: [issued.movementId],
        costSnapshotId: cost._id,
        items: [
          {
            subProduct: line.subproduct,
            size: line.size,
            quantity: fireDelta,
            unit: 'count',
          },
        ],
        actor: actor.userId,
      },
    ],
    { session: mongoSession },
  );
  return {
    consumptionId: id(eventId),
    costSnapshotId: id(cost),
    movementIds: [id(issued.movementId)],
    coverage: 'complete',
  };
}
module.exports = { issuePrepared };
