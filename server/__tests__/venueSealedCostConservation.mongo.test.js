'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

async function setup(t, suffix) {
  await connectVenueMongo(t, suffix);
  const scope = await fixture();
  const item = await beverage(scope, { currentQuantity: 3, reservedQuantity: 0 });
  const policy = { version: 1, state: 'approved', approvedBy: scope.actor.userId,
    approvedAt: new Date(), recognitionTiming: 'canonical_sale', currency: 'NGN',
    accounts: { rawInventory: '1200', preparedInventory: '1210', issuedService: '1220', cogs: '5000', waste: '5100' } };
  await require('../models/Warehouse').collection.updateOne({ _id: new mongoose.Types.ObjectId(scope.locationId) },
    { $set: { 'venueServices.catalogCosting': { actualCostingEnabled: true, policy } } });
  for (const [code, type] of [['1200', 'asset'], ['1210', 'asset'], ['1220', 'asset'], ['5000', 'expense'], ['5100', 'expense']]) {
    await require('../models/Account').collection.insertOne({ tenant: new mongoose.Types.ObjectId(scope.tenantId), code, type, isActive: true });
  }
  await require('../services/venue/costing-indexes').prepareCostingIndexes(mongoose.connection.db);
  const previous = process.env.VENUE_ACTUAL_COSTING_ENABLED;
  process.env.VENUE_ACTUAL_COSTING_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.VENUE_ACTUAL_COSTING_ENABLED; else process.env.VENUE_ACTUAL_COSTING_ENABLED = previous; });
  const receipt = await require('../models/InventoryMovement').create({ tenant: scope.tenantId,
    warehouse: scope.locationId, subProduct: item.subProductId, size: item.sizeId, type: 'received',
    category: 'in', quantity: 3, quantityBefore: 0, quantityAfter: 3, totalCost: 1,
    status: 'confirmed', performedBy: scope.actor.userId });
  const lot = await require('../models/WarehouseBatch').create({ tenant: scope.tenantId,
    warehouse: scope.locationId, subProduct: item.subProductId, size: item.sizeId,
    batchNumber: 'thirds', quantity: 1, initialQuantity: 3, venueValuation: {
      initialCostMinor: 100, initialQuantityScaled: 3, issuedQuantityScaled: 0,
      issuedCostMinor: 0, receiptId: receipt._id, reason: 'original_supplier_receipt' } });
  const preview = { subproduct: item.subProductId, size: item.sizeId, quantity: 1,
    batchAllocations: [{ batch: lot._id, quantity: 1 }] };
  return { scope, lot, preview, api: require('../services/venue/sealed-cost').sealedCosts };
}

test('sealed cost refuses a receipt lot depleted outside retained valuation and reservations', async t => {
  const x = await setup(t, 'sealed_gap');
  // Three received, two removed, but only the current one-unit reservation is explained.
  await assert.rejects(x.api({ ...x.scope, effect: x.preview }), e => e.code === 'COST_REVIEW_REQUIRED');
  assert.equal((await require('../models/WarehouseBatch').findById(x.lot.id).lean()).venueValuation.issuedQuantityScaled, 0);
});

test('public sealed availability refuses unexplained lot depletion without exposing private cost', async t => {
  const x = await setup(t, 'sealed_menu');
  const Size = require('../models/Size');
  await Size.collection.updateMany({}, { $set: { servingSchemaVersion: 1, size: 'unit' } });
  for (const row of require('../services/venue/serving-indexes').SERVING_MODEL_INDEXES)
    await Size.collection.createIndex(row.key, { unique: true, ...row.options });
  await Size.collection.updateOne({ _id: new mongoose.Types.ObjectId(x.preview.size) }, { $set: {
    servingSchemaVersion: 2, size: 'venue_serving',
    venueServing: { code: 'bottle', mode: 'sealed', saleUnit: 'bottle', channels: ['venue'], version: 1 },
  } });
  await require('../models/Warehouse').collection.updateOne({ _id: new mongoose.Types.ObjectId(x.scope.locationId) },
    { $set: { 'venueServices.catalogCosting.servingsV2Enabled': true } });
  const previous = process.env.VENUE_SERVINGS_V2_ENABLED;
  process.env.VENUE_SERVINGS_V2_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.VENUE_SERVINGS_V2_ENABLED; else process.env.VENUE_SERVINGS_V2_ENABLED = previous; });
  const availabilityArgs = { ...x.scope,
    servingSnapshot: { subProductId: x.preview.subproduct, sizeId: x.preview.size, mode: 'sealed', servingVersion: 1 },
    at: new Date('2026-10-30T12:00:00Z'),
  };
  const available = require('../services/venue/serving-availability').getServingAvailability;
  const result = await available(availabilityArgs);
  assert.deepEqual(result, { available: false, reason: 'not_configured', asOf: '2026-10-30T12:00:00.000Z' });
  await require('../models/WarehouseBatch').updateOne({ _id: x.lot._id }, { $set: {
    'venueValuation.issuedQuantityScaled': 2, 'venueValuation.issuedCostMinor': 66,
  } });
  assert.deepEqual(await available(availabilityArgs), { available: true, reason: 'available', asOf: '2026-10-30T12:00:00.000Z' });
});

test('sealed cost conserves rounding across outstanding reservations and refuses a corrupt cost watermark', async t => {
  const x = await setup(t, 'sealed_round');
  const Effect = require('../models/VenueStockEffect');
  const makeEffect = () => Effect.create({ ...x.preview, tenant: x.scope.tenantId,
    location: x.scope.locationId, session: new mongoose.Types.ObjectId(), billOrder: new mongoose.Types.ObjectId(),
    lineId: 'bottle', revision: 1, state: 'reserved', costPolicyVersion: 1, valuationMethod: 'fifo' });
  const first = await makeEffect(), second = await makeEffect();
  const session = await mongoose.startSession();
  const costs = [];
  try {
    for (const effect of [first, second]) {
      let amountMinor;
      await session.withTransaction(async () => {
        const cost = await x.api({ ...x.scope, effect, advance: true, mongoSession: session });
        amountMinor = cost.amountMinor;
        await Effect.updateOne({ _id: effect._id }, { $set: { state: 'consumed' } }, { session });
      });
      costs.push(amountMinor);
    }
    await require('../models/WarehouseBatch').updateOne({ _id: x.lot._id }, { $set: { quantity: 0 } });
    assert.equal((await x.api({ ...x.scope, effect: x.preview })).amountMinor, 34);
    const third = await makeEffect();
    let finalAmount;
    await session.withTransaction(async () => {
      finalAmount = (await x.api({ ...x.scope, effect: third, advance: true, mongoSession: session })).amountMinor;
      await Effect.updateOne({ _id: third._id }, { $set: { state: 'consumed' } }, { session });
    });
    costs.push(finalAmount);
    assert.deepEqual(costs, [33, 33, 34]);
    const lot = await require('../models/WarehouseBatch').findById(x.lot.id).lean();
    assert.equal(lot.venueValuation.issuedCostMinor, 100);
    await require('../models/WarehouseBatch').updateOne({ _id: lot._id }, { $set: {
      quantity: 1, 'venueValuation.issuedQuantityScaled': 1, 'venueValuation.issuedCostMinor': 99 } });
    await assert.rejects(x.api({ ...x.scope, effect: x.preview }), e => e.code === 'COST_REVIEW_REQUIRED');
  } finally { await session.endSession(); }
});
