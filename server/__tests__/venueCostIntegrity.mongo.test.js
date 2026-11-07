'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

async function valuedLot(scope, item, overrides = {}) {
  const receipt = await require('../models/InventoryMovement').create({
    tenant: scope.tenantId, warehouse: scope.locationId,
    subProduct: item.subProductId, size: item.sizeId,
    type: 'received', category: 'in', quantity: 3,
    quantityBefore: 0, quantityAfter: 3, totalCost: 1,
    status: 'confirmed', performedBy: scope.actor.userId,
  });
  const lot = await require('../models/WarehouseBatch').create({
    tenant: scope.tenantId, warehouse: scope.locationId,
    subProduct: item.subProductId, size: item.sizeId,
    batchNumber: 'integrity', quantity: 2, initialQuantity: 3,
    venueValuation: { receiptId: receipt._id, reason: 'supplier_receipt',
      initialCostMinor: 100, initialQuantityScaled: 3,
      issuedQuantityScaled: 1, issuedCostMinor: 33, ...overrides },
  });
  return { lot, receipt };
}

test('recipe stock issue rejects corrupt cumulative cost without changing stock', async t => {
  await connectVenueMongo(t, 'recipe_cost_integrity');
  const scope = await fixture();
  const item = await beverage(scope, { currentQuantity: 2, reservedQuantity: 0 });
  const { lot } = await valuedLot(scope, item, { issuedCostMinor: 0 });
  const mongoSession = await mongoose.startSession();
  try {
    await assert.rejects(mongoSession.withTransaction(() =>
      require('../services/venue/recipe-stock-source').issueSource({
        ...scope, mongoSession, effectKey: 'corrupt-cost', valuationMethod: 'fifo',
        source: { sub: { product: item.productId },
          amount: { amountScaled: 1, scale: 1, unit: 'count' },
          mapping: { sourceSubProductId: item.subProductId, sourceSizeId: item.sizeId,
            contentQuantity: { amountScaled: 1, scale: 1, unit: 'count' } } },
      })), error => error.code === 'COST_REVIEW_REQUIRED');
  } finally { await mongoSession.endSession(); }
  assert.equal((await require('../models/WarehouseBatch').findById(lot._id).lean()).quantity, 2);
  assert.equal((await require('../models/WarehouseStock').findOne({ tenant: scope.tenantId,
    subProduct: item.subProductId }).lean()).currentQuantity, 2);
  assert.equal(await require('../models/InventoryMovement').countDocuments({ reference: 'corrupt-cost' }), 0);
});

test('cost evidence cannot attach one stock forms movement to another original lot', async t => {
  await connectVenueMongo(t, 'cost_movement_integrity');
  const scope = await fixture();
  const item = await beverage(scope);
  const other = await beverage(scope);
  const { lot, receipt } = await valuedLot(scope, item);
  const movement = await require('../models/InventoryMovement').create({
    tenant: scope.tenantId, warehouse: scope.locationId,
    subProduct: other.subProductId, size: other.sizeId,
    type: 'shipped', category: 'out', quantity: 1,
    quantityBefore: 1, quantityAfter: 0, status: 'confirmed', performedBy: scope.actor.userId,
  });
  await require('../models/VenueCostSnapshot').createIndexes();
  const mongoSession = await mongoose.startSession();
  try {
    await assert.rejects(mongoSession.withTransaction(() =>
      require('../services/venue/cost-evidence').issueCostSnapshot({
        ...scope, mongoSession, effectKey: 'wrong-stock-form', sourceEvent: new mongoose.Types.ObjectId(),
        quantity: { amountScaled: 1, scale: 1, unit: 'count' },
        sourceAllocations: [{ movementId: movement._id, lotId: lot._id, receiptId: receipt._id,
          quantity: { amountScaled: 1, scale: 1, unit: 'count' }, allocatedCostMinor: 33,
          valuationMethod: 'fifo', sourceTimestamp: lot.receivedDate }],
      })), error => error.code === 'COST_EVIDENCE_REQUIRED');
  } finally { await mongoSession.endSession(); }
  assert.equal(await require('../models/VenueCostSnapshot').countDocuments({ effectKey: 'wrong-stock-form' }), 0);
});

test('original receipt revalidation rejects fractional minor money instead of rounding it', async t => {
  await connectVenueMongo(t, 'receipt_money_integrity');
  const scope = await fixture();
  const item = await beverage(scope);
  const { lot, receipt } = await valuedLot(scope, item);
  await require('../models/InventoryMovement').collection.updateOne({ _id: receipt._id },
    { $set: { totalCost: 1.004 } });
  await assert.rejects(require('../services/venue/source-receipt').originalReceipt({
    tenantId: scope.tenantId, locationId: scope.locationId, lot,
  }), error => error.code === 'COST_EVIDENCE_REQUIRED');
});

test('public recipe availability rejects quantity and cost drift without exposing amounts', async t => {
  await connectVenueMongo(t, 'recipe_availability_integrity');
  const scope = await fixture();
  const source = await beverage(scope, { currentQuantity: 2, reservedQuantity: 0 });
  const output = await beverage(scope);
  const { lot } = await valuedLot(scope, source);
  const profile = await require('../models/IngredientProfile').create({ tenant: scope.tenantId,
    subProduct: source.subProductId, dimension: 'count', createdBy: scope.actor.userId });
  await require('../models/RecipeVersion').create({ tenant: scope.tenantId,
    output: { subProduct: output.subProductId, size: output.sizeId }, version: 1,
    components: [{ profile: profile._id, quantity: 1, unit: 'count', stockMapping: {
      sourceSubProductId: source.subProductId, sourceSizeId: source.sizeId,
      sourceLocationId: scope.locationId, contentQuantity: { amountScaled: 1, scale: 1, unit: 'count' },
      reviewedBy: scope.actor.userId, reviewedAt: new Date() } }],
    yieldAssumption: { units: 1 }, effectiveFrom: new Date(), createdBy: scope.actor.userId });
  const Size = require('../models/Size');
  await Size.collection.updateMany({}, { $set: { servingSchemaVersion: 1, size: 'unit' } });
  for (const index of require('../services/venue/serving-indexes').SERVING_MODEL_INDEXES)
    await Size.collection.createIndex(index.key, { unique: true, ...index.options });
  await Size.collection.updateOne({ _id: new mongoose.Types.ObjectId(output.sizeId) }, { $set: {
    servingSchemaVersion: 2, size: 'venue_serving', venueServing: {
      code: 'plate', mode: 'made_to_order', saleUnit: 'plate', channels: ['venue'], version: 1 } } });
  await require('../models/Warehouse').collection.updateOne({ _id: new mongoose.Types.ObjectId(scope.locationId) },
    { $set: { 'venueServices.catalogCosting': { actualCostingEnabled: true, servingsV2Enabled: true,
      policy: { version: 1, state: 'approved', approvedBy: scope.actor.userId, approvedAt: new Date(),
        recognitionTiming: 'canonical_sale', currency: 'NGN', accounts: {
          rawInventory: '1200', preparedInventory: '1210', issuedService: '1220', cogs: '5000', waste: '5100' } } } } });
  for (const [code, type] of [['1200', 'asset'], ['1210', 'asset'], ['1220', 'asset'], ['5000', 'expense'], ['5100', 'expense']])
    await require('../models/Account').collection.insertOne({ tenant: new mongoose.Types.ObjectId(scope.tenantId), code, type, isActive: true });
  await require('../services/venue/costing-indexes').prepareCostingIndexes(mongoose.connection.db);
  for (const key of ['VENUE_ACTUAL_COSTING_ENABLED', 'VENUE_SERVINGS_V2_ENABLED']) {
    const before = process.env[key]; process.env[key] = 'true';
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  const available = () => require('../services/venue/serving-availability').getServingAvailability({ ...scope,
    servingSnapshot: { sizeId: output.sizeId, mode: 'made_to_order', servingVersion: 1 } });
  assert.equal((await available()).available, true);
  await require('../models/WarehouseBatch').updateOne({ _id: lot._id }, { $set: { 'venueValuation.issuedCostMinor': 0 } });
  let result = await available();
  assert.equal(result.available, false);
  assert.equal(result.reason, 'not_configured');
  assert.deepEqual(Object.keys(result).sort(), ['asOf', 'available', 'reason']);
  await require('../models/WarehouseBatch').updateOne({ _id: lot._id }, { $set: {
    'venueValuation.issuedCostMinor': 33, 'venueValuation.issuedQuantityScaled': 0 } });
  result = await available();
  assert.equal(result.available, false);
  assert.equal(result.reason, 'not_configured');
});
