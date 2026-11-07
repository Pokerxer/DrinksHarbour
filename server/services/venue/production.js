'use strict';
const Job = require('../../models/VenueProductionBatch');
const { loadVenueContext } = require('./context');
const { runVenueOperation, fingerprint } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const math = require('./cost-math');
const stock = require('./production-stock');
const dto = (row) => ({
  id: id(row),
  version: row.version,
  state: row.state,
  outputBatchId: row.outputBatchId ? id(row.outputBatchId) : null,
  sourceCostMinor: row.sourceCostMinor ?? null,
  outputCostMinor: row.outputCostMinor ?? null,
  lossCostMinor: row.lossCostMinor ?? null,
});
async function context(args, mongoSession = null, cancellation = false) {
  const scope = await loadVenueContext({
    ...args,
    action: 'production.write',
    mongoSession,
  });
  // Releasing an owned reservation creates no new physical or financial cost.
  if (cancellation) return scope;
  const policy = await require('./costing-policy').requireCostingPolicy({
    ...args,
    mongoSession,
  });
  if (policy.policy.productionLossTreatment !== 'normal_absorbed')
    fail(
      'PRODUCTION_POLICY_REQUIRED',
      'Reviewed production loss treatment required',
      503,
    );
  return { ...scope, ...policy };
}
function outputCount(value, allowZero = false) {
  math.assertQuantity(value, { allowZero });
  if (value.unit !== 'count' || value.scale !== 1)
    fail(
      'INVALID_INPUT',
      'Production output must be whole reviewed serving units',
      400,
    );
  if (value.amountScaled > 100)
    fail(
      'INVALID_INPUT',
      'Production initially supports 1–100 output servings',
      400,
    );
  return value;
}
async function createProduction(args) {
  const input = args.input;
  if (
    !input ||
    Object.keys(input).some(
      (key) =>
        ![
          'subProductId',
          'sizeId',
          'recipeVersionId',
          'expectedOutput',
        ].includes(key),
    )
  )
    fail('INVALID_INPUT', 'Invalid production fields', 400);
  for (const key of ['subProductId', 'sizeId', 'recipeVersionId'])
    requireId(input[key]);
  outputCount(input.expectedOutput);
  const scope = await context(args);
  const indexes = await Job.collection
    .listIndexes()
    .toArray()
    .catch((error) => {
      if (error.code === 26) return [];
      throw error;
    });
  if (
    !indexes.some(
      (i) =>
        i.unique &&
        !i.partialFilterExpression &&
        !i.sparse &&
        JSON.stringify(i.key) ===
          JSON.stringify({ tenant: 1, productionKey: 1 }),
    )
  )
    fail(
      'PRODUCTION_INDEX_REVIEW_REQUIRED',
      'Reviewed production uniqueness required',
      503,
    );
  return runVenueOperation({
    ...args,
    actor: scope.actor,
    operation: 'production.create',
    key: args.idempotencyKey,
    payload: input,
    targetType: 'VenueProductionBatch',
    execute: async ({ mongoSession }) => {
      await context(args, mongoSession);
      const recipe = await require('../../models/RecipeVersion')
        .findOne({
          _id: input.recipeVersionId,
          tenant: args.tenantId,
          'output.subProduct': input.subProductId,
          'output.size': input.sizeId,
          supersededBy: null,
        })
        .session(mongoSession)
        .lean();
      const size = await require('../../models/Size')
        .findOne({
          _id: input.sizeId,
          tenant: args.tenantId,
          subproduct: input.subProductId,
          servingSchemaVersion: 2,
          'venueServing.mode': 'prepared_batch',
        })
        .session(mongoSession)
        .lean();
      if (!recipe || !size)
        fail('NOT_FOUND', 'Prepared output recipe not found', 404);
      const [row] = await Job.create(
        [
          {
            tenant: args.tenantId,
            location: args.locationId,
            productionKey: args.idempotencyKey,
            requestHash: fingerprint(input),
            output: { subProduct: input.subProductId, size: input.sizeId },
            recipeVersionId: recipe._id,
            expectedOutput: input.expectedOutput,
            createdBy: scope.actor.userId,
          },
        ],
        { session: mongoSession },
      );
      return dto(row);
    },
  });
}
async function command(args, operation, execute) {
  requireId(args.batchId);
  if (!Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0)
    fail('STATE_CHANGED');
  const scope = await context(args, null, operation === 'cancel');
  return runVenueOperation({
    ...args,
    actor: scope.actor,
    operation: `production.${operation}`,
    key: args.idempotencyKey,
    payload: {
      batchId: args.batchId,
      expectedVersion: args.expectedVersion,
      actualOutput: args.actualOutput,
      waste: args.waste,
      reason: args.reason,
    },
    targetType: 'VenueProductionBatch',
    execute: async ({ mongoSession }) => {
      const fresh = await context(args, mongoSession, operation === 'cancel');
      const row = await Job.findOne({
        _id: args.batchId,
        tenant: args.tenantId,
        location: args.locationId,
      }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Production batch not found', 404);
      if (
        row.version !== args.expectedVersion ||
        ['completed', 'cancelled'].includes(row.state)
      )
        fail('STATE_CHANGED');
      await execute({ ...args, actor: fresh.actor, mongoSession }, row, fresh);
      row.version++;
      await row.save({ session: mongoSession });
      return dto(row);
    },
  });
}
const reserveProduction = (args) =>
  command(args, 'reserve', async (scope, row) => {
    if (row.state !== 'draft') fail('STATE_CHANGED');
    row.reservations = await stock.reserveInputs(scope, row);
    row.state = 'reserved';
  });
const cancelProduction = (args) =>
  command(args, 'cancel', async (scope, row) => {
    if (
      typeof args.reason !== 'string' ||
      args.reason.trim().length < 3 ||
      args.reason.length > 500
    )
      fail('INVALID_INPUT', 'Cancellation reason required', 400);
    if (row.state === 'reserved') await stock.releaseInputs(scope, row);
    row.state = 'cancelled';
    row.cancelledAt = new Date();
    row.waste = { reason: args.reason };
  });
const completeProduction = (args) =>
  command(args, 'complete', async (scope, row, fresh) => {
    if (row.state !== 'reserved') fail('STATE_CHANGED');
    outputCount(args.actualOutput, true);
    const zero = args.actualOutput.amountScaled === 0;
    if (
      zero &&
      (!fresh.policy.allowZeroOutputWaste ||
        args.waste?.classification !== 'abnormal' ||
        typeof args.waste.reason !== 'string' ||
        args.waste.reason.trim().length < 5)
    )
      fail(
        'PRODUCTION_WASTE_REVIEW_REQUIRED',
        'Explicit approved zero-output waste required',
      );
    if (
      !zero &&
      args.waste?.classification &&
      args.waste.classification !== 'normal'
    )
      fail(
        'PRODUCTION_WASTE_REVIEW_REQUIRED',
        'Partial abnormal loss needs a separately reviewed allocation',
      );
    const { allocations, totalCostMinor } = await stock.issueInputs(
      scope,
      row,
      fresh.valuationMethod,
    );
    const cost = await require('./cost-evidence').issueCostSnapshot({
      ...scope,
      effectKey: `production-complete:${id(row)}`,
      sourceEvent: row._id,
      sourceKind: zero ? 'waste' : 'production_output',
      quantity: row.expectedOutput,
      sourceAllocations: allocations,
      valuationMethod: fresh.valuationMethod,
      policyVersion: fresh.policy.version,
    });
    let lot = null;
    if (!zero) {
      lot = await stock.receiveOutput(
        scope,
        row,
        args.actualOutput,
        totalCostMinor,
      );
      lot.venueProduction.costSnapshotId = cost._id;
      await lot.save({ session: scope.mongoSession });
    }
    let journal = null;
    if (totalCostMinor)
      journal = await require('../journalEntry.service').postJournalEntry({
        tenantId: scope.tenantId,
        refDoc: row._id,
        refDocType: 'VenueProductionBatch',
        entryType: 'inventory_adjust',
        source: 'venue_production',
        lines: [
          {
            account: zero
              ? fresh.policy.accounts.waste
              : fresh.policy.accounts.preparedInventory,
            debit: totalCostMinor / 100,
            credit: 0,
          },
          {
            account: fresh.policy.accounts.rawInventory,
            debit: 0,
            credit: totalCostMinor / 100,
          },
        ],
        venueCostSnapshotIds: [cost._id],
        session: scope.mongoSession,
      });
    row.state = zero ? 'cancelled' : 'completed';
    row.completedAt = new Date();
    row.actualOutput = args.actualOutput;
    row.waste = args.waste;
    row.sourceCostMinor = totalCostMinor;
    row.outputCostMinor = zero ? 0 : totalCostMinor;
    row.lossCostMinor = zero ? totalCostMinor : 0;
    row.outputBatchId = lot?._id;
    row.costSnapshotId = cost._id;
    row.journalId = journal?._id;
  });
module.exports = {
  createProduction,
  reserveProduction,
  completeProduction,
  cancelProduction,
};
