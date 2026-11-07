'use strict';
const { fail } = require('./errors');
const { id } = require('./eligibility');
const { mappedSource, issueSource } = require('./recipe-stock-source');
const math = require('./cost-math');
const Stock = require('../../models/WarehouseStock');
async function sourcesFor(args, job) {
  const recipe = await require('../../models/RecipeVersion')
    .findOne({
      _id: job.recipeVersionId,
      tenant: args.tenantId,
      'output.subProduct': job.output.subProduct,
      'output.size': job.output.size,
    })
    .session(args.mongoSession)
    .lean();
  if (!recipe || recipe.supersededBy || recipe.effectiveFrom > new Date())
    fail('RECIPE_AMENDMENT_REQUIRED', 'Production recipe requires review');
  const sources = [];
  for (const component of recipe.components)
    sources.push(
      await mappedSource({
        ...args,
        component,
        fireDelta: job.expectedOutput.amountScaled,
      }),
    );
  if (!sources.length) fail('STOCK_MAPPING_REQUIRED');
  return sources.sort((a, b) =>
    `${a.mapping.sourceSubProductId}:${a.mapping.sourceSizeId}`.localeCompare(
      `${b.mapping.sourceSubProductId}:${b.mapping.sourceSizeId}`,
    ),
  );
}
async function reserveInputs(args, job) {
  const sources = await sourcesFor(args, job);
  const reservations = [];
  for (const source of sources) {
    const quantity =
      source.amount.amountScaled / source.mapping.contentQuantity.amountScaled;
    const filter = {
      tenant: args.tenantId,
      warehouse: args.locationId,
      subProduct: source.mapping.sourceSubProductId,
      size: source.mapping.sourceSizeId,
    };
    const stock = await Stock.findOneAndUpdate(
      {
        ...filter,
        $expr: {
          $gte: [
            {
              $subtract: [
                '$currentQuantity',
                { $ifNull: ['$reservedQuantity', 0] },
              ],
            },
            quantity,
          ],
        },
      },
      { $inc: { reservedQuantity: quantity } },
      { session: args.mongoSession, returnDocument: 'after' },
    );
    if (!stock) fail('STOCK_UNAVAILABLE', 'Ingredient reservation unavailable');
    reservations.push({ stockId: stock._id, quantity, source });
  }
  return reservations;
}
async function releaseInputs(args, job) {
  for (const reservation of job.reservations) {
    const result = await Stock.updateOne(
      {
        _id: reservation.stockId,
        tenant: args.tenantId,
        warehouse: args.locationId,
        reservedQuantity: { $gte: reservation.quantity },
      },
      { $inc: { reservedQuantity: -reservation.quantity } },
      { session: args.mongoSession },
    );
    if (result.modifiedCount !== 1)
      fail('STOCK_REVIEW_REQUIRED', 'Production reservation changed');
  }
}
async function issueInputs(args, job, valuationMethod) {
  const sources = await sourcesFor(args, job);
  await releaseInputs(args, job);
  const allocations = [];
  for (const source of sources) {
    const result = await issueSource({
      ...args,
      source,
      effectKey: `production-complete:${id(job)}`,
      valuationMethod,
    });
    allocations.push(...result.allocations);
  }
  return {
    allocations,
    totalCostMinor: math.sumMinor(allocations.map((a) => a.allocatedCostMinor)),
  };
}
async function receiveOutput(args, job, actualOutput, costMinor) {
  const count = actualOutput.amountScaled;
  const reference = `production-complete:${id(job)}`;
  const stockFilter = {
    tenant: args.tenantId,
    warehouse: args.locationId,
    subProduct: job.output.subProduct,
    size: job.output.size,
  };
  const before = await Stock.findOne(stockFilter)
    .session(args.mongoSession)
    .lean();
  await require('../warehouse.service').adjustStock(
    {
      warehouseId: args.locationId,
      subProduct: job.output.subProduct,
      size: job.output.size,
      quantity: count,
      type: 'received',
      notes: reference,
      unitCost: costMinor / 100 / count,
      recordHistory: false,
      session: args.mongoSession,
    },
    args.actor.userId,
    args.tenantId,
  );
  const [receipt] = await require('../../models/InventoryMovement').create(
    [
      {
        ...stockFilter,
        type: 'received',
        category: 'in',
        quantity: count,
        quantityBefore: before?.currentQuantity || 0,
        quantityAfter: (before?.currentQuantity || 0) + count,
        unitCost: costMinor / 100 / count,
        totalCost: costMinor / 100,
        reference,
        referenceType: 'adjustment',
        source: 'system',
        status: 'confirmed',
        performedBy: args.actor.userId,
        performedAt: new Date(),
      },
    ],
    { session: args.mongoSession },
  );
  const lot = await require('../batch.service').receiveBatch(
    {
      tenantId: args.tenantId,
      warehouseId: args.locationId,
      subProduct: job.output.subProduct,
      size: job.output.size,
      batchNumber: `VP-${id(job)}`,
      quantity: count,
      unitCost: costMinor / 100 / count,
    },
    args.mongoSession,
  );
  lot.venueValuation = {
    initialCostMinor: costMinor,
    initialQuantityScaled: count,
    issuedQuantityScaled: 0,
    issuedCostMinor: 0,
    receiptId: receipt._id,
    reason: 'prepared_production',
  };
  lot.venueProduction = { batchId: job._id };
  await lot.save({ session: args.mongoSession });
  return lot;
}
module.exports = {
  sourcesFor,
  reserveInputs,
  releaseInputs,
  issueInputs,
  receiveOutput,
};
