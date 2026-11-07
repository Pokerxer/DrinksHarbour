'use strict';
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { mappedSource, issueSource } = require('./recipe-stock-source');
const { issueCostSnapshot, costIndexesReady } = require('./cost-evidence');
const Events = require('../../models/VenueConsumptionEvent');
async function issueRecipe(args) {
  const {
    tenantId,
    locationId,
    line,
    fireDelta,
    acceptedRecipeVersionId,
    visit,
    actor,
    mongoSession,
    effectKey,
  } = args;
  if (!mongoSession?.inTransaction()) fail('COST_TRANSACTION_REQUIRED');
  requireId(id(acceptedRecipeVersionId));
  if (!Number.isSafeInteger(fireDelta) || fireDelta < 1 || fireDelta > 100)
    fail('INVALID_LINES', 'Invalid fired delta', 400);
  const { policy, valuationMethod } =
    await require('./costing-policy').requireCostingPolicy(args);
  await costIndexesReady();
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
      id(previous.recipeVersion) !== id(acceptedRecipeVersionId)
    )
      fail(
        'COST_REVIEW_REQUIRED',
        'Existing event does not prove this physical delta',
      );
    return {
      consumptionId: id(previous),
      movementIds: previous.movementIds.map(id),
      costSnapshotId: id(previous.costSnapshotId),
      coverage: 'complete',
    };
  }
  const recipe = await require('../../models/RecipeVersion')
    .findOne({
      _id: acceptedRecipeVersionId,
      tenant: tenantId,
      'output.subProduct': line.subproduct,
      'output.size': line.size,
    })
    .session(mongoSession)
    .lean();
  if (!recipe) fail('NOT_FOUND', 'Accepted recipe not found', 404);
  if (recipe.supersededBy || recipe.effectiveFrom > new Date())
    fail(
      'RECIPE_AMENDMENT_REQUIRED',
      'Accepted recipe requires reviewed amendment',
    );
  const sources = [];
  for (const component of recipe.components)
    sources.push(
      await mappedSource({
        tenantId,
        locationId,
        component,
        fireDelta,
        mongoSession,
      }),
    );
  if (!sources.length)
    fail('STOCK_MAPPING_REQUIRED', 'Physical recipe components required', 503);
  sources.sort((a, b) =>
    `${a.mapping.sourceSubProductId}:${a.mapping.sourceSizeId}`.localeCompare(
      `${b.mapping.sourceSubProductId}:${b.mapping.sourceSizeId}`,
    ),
  );
  const eventId = new (require('mongoose').Types.ObjectId)();
  const movementIds = [];
  const allocations = [];
  for (const source of sources) {
    const result = await issueSource({
      tenantId,
      locationId,
      actor,
      source,
      effectKey: `physical:${eventId}`,
      mongoSession,
      valuationMethod,
    });
    movementIds.push(result.movementId);
    allocations.push(...result.allocations);
  }
  const cost = await issueCostSnapshot({
    ...args,
    effectKey: `physical:${eventId}`,
    sourceEvent: eventId,
    sourceKind: 'recipe_issue',
    recipeVersionId: recipe._id,
    quantity: { amountScaled: fireDelta, scale: 1, unit: 'count' },
    sourceAllocations: allocations,
    valuationMethod,
    policyVersion: policy.version,
  });
  await require('./cost-recognition').postIssuedCosts({
    tenantId,
    locationId,
    eventId,
    cost,
    mongoSession,
    policy,
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
        recipeVersion: recipe._id,
        recipeCostMinor: cost.amountMinor,
        fireDelta,
        physicalCoverage: 'complete',
        movementIds,
        costSnapshotId: cost._id,
        items: sources.map((source) => ({
          subProduct: source.mapping.sourceSubProductId,
          size: source.mapping.sourceSizeId,
          profile: source.profileId,
          quantity: source.amount.amountScaled / source.amount.scale,
          unit: source.amount.unit,
        })),
        actor: actor.userId,
      },
    ],
    { session: mongoSession },
  );
  return {
    consumptionId: id(eventId),
    movementIds: movementIds.map(id),
    costSnapshotId: id(cost),
    coverage: 'complete',
  };
}
module.exports = { issueRecipe };
