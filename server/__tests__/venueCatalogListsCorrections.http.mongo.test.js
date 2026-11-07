'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

async function setup(t, suffix) {
  await connectVenueMongo(t, suffix);
  const scope = await fixture();
  const other = await fixture();
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'venue-catalog-lists-local-test';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  await require('../models/User').updateOne({ _id: scope.actor.userId }, { $set: {
    posPermissions: ['pos:sell', 'venue:servings_write', 'venue:production_write', 'venue:costs_review'],
  } });
  const app = express();
  app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/venue-ops/locations/${scope.locationId}`;
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: scope.actor.userId }, process.env.JWT_SECRET, { expiresIn: '1h' })}` };
  const get = async path => {
    const result = await fetch(base + path, { headers });
    return { status: result.status, ...(await result.json()) };
  };
  return { scope, other, get };
}

test('serving and production lists expose every owned row beyond the first hundred through bounded cursors', async t => {
  const { scope, other, get } = await setup(t, 'catalog_lists');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = new mongoose.Types.ObjectId(scope.tenantId);
  const subproduct = oid();
  await require('../models/Size').collection.insertMany(Array.from({ length: 101 }, (_, i) => ({
    _id: oid(), tenant, subproduct, servingSchemaVersion: 2, size: 'venue_serving',
    displayName: `Plate ${i}`, sellingPrice: 100, costPrice: i === 0 ? null : 25,
    venueServing: { code: `plate-${i}`, mode: 'made_to_order', version: 1, saleUnit: 'plate' },
  })));
  await require('../models/Size').collection.insertOne({ _id: oid(), tenant: new mongoose.Types.ObjectId(other.tenantId), servingSchemaVersion: 2 });
  await require('../models/VenueProductionBatch').collection.insertMany(Array.from({ length: 101 }, () => ({
    _id: oid(), tenant, location: new mongoose.Types.ObjectId(scope.locationId), state: 'draft', version: 0,
  })));
  await require('../models/VenueProductionBatch').collection.insertOne({ _id: oid(), tenant,
    location: new mongoose.Types.ObjectId(other.locationId), state: 'draft' });
  for (const path of ['/servings', '/production']) {
    const first = await get(path);
    assert.equal(first.status, 200);
    assert.equal(first.data.items.length, 100);
    assert.equal(typeof first.data.nextCursor, 'string');
    const second = await get(`${path}?cursor=${first.data.nextCursor}`);
    assert.equal(second.data.items.length, 1);
    assert.equal(second.data.nextCursor, null);
    assert.equal(new Set([...first.data.items, ...second.data.items].map(row => row.id)).size, 101);
    assert.equal((await get(`${path}?cursor=invalid`)).status, 400);
    assert.equal((await get(`${path}?limit=0`)).status, 400);
  }
});

test('original lot and receipt selectors provide independent complete cursor pages', async t => {
  const { scope, get } = await setup(t, 'receipt_lists');
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = new mongoose.Types.ObjectId(scope.tenantId);
  const warehouse = new mongoose.Types.ObjectId(scope.locationId);
  const subProduct = oid(), size = oid();
  await require('../models/WarehouseBatch').collection.insertMany(Array.from({ length: 3 }, (_, i) => ({
    _id: oid(), tenant, warehouse, subProduct, size, batchNumber: `lot-${i}`, quantity: 1, initialQuantity: 1,
  })));
  await require('../models/InventoryMovement').collection.insertMany(Array.from({ length: 5 }, (_, i) => ({
    _id: oid(), tenant, warehouse, subProduct, size, type: 'received', status: 'confirmed', quantity: 1,
    batchNumber: `receipt-${i}`, totalCost: 1, performedAt: new Date(),
  })));
  const first = await get('/cost-sources?limit=2');
  assert.equal(first.status, 200);
  assert.equal(first.data.lots.length, 2);
  assert.equal(first.data.receipts.length, 2);
  assert.equal(typeof first.data.nextLotsCursor, 'string');
  assert.equal(typeof first.data.nextReceiptsCursor, 'string');
  const second = await get(`/cost-sources?limit=2&lotsCursor=${first.data.nextLotsCursor}&receiptsCursor=${first.data.nextReceiptsCursor}`);
  assert.equal(second.data.lots.length, 1);
  assert.equal(second.data.nextLotsCursor, null);
  assert.equal(second.data.receipts.length, 2);
  const third = await get(`/cost-sources?limit=2&receiptsCursor=${second.data.nextReceiptsCursor}`);
  assert.equal(third.data.receipts.length, 1);
  assert.equal(third.data.nextReceiptsCursor, null);
  assert.equal(new Set([...first.data.receipts, ...second.data.receipts, ...third.data.receipts].map(row => row.id)).size, 5);
});

test('receipt selector does not label an unconverted foreign purchase as a known NGN cost', async t => {
  const { scope, get } = await setup(t, 'receipt_list_currency');
  const oid = () => new mongoose.Types.ObjectId();
  const po = oid();
  await require('../models/PurchaseOrder').collection.insertOne({ _id: po,
    tenant: new mongoose.Types.ObjectId(scope.tenantId), currency: 'USD' });
  await require('../models/InventoryMovement').collection.insertOne({ _id: oid(),
    tenant: new mongoose.Types.ObjectId(scope.tenantId), warehouse: new mongoose.Types.ObjectId(scope.locationId),
    subProduct: oid(), size: oid(), type: 'received', status: 'confirmed', quantity: 1,
    totalCost: 100, relatedPurchaseOrder: po,
  });
  const result = await get('/cost-sources');
  assert.equal(result.status, 200);
  assert.equal(result.data.receipts.length, 1);
  assert.equal(result.data.receipts[0].amountMinor, null);
});

test('ingredient profiles and distinct source candidates return cursor pages without missing or duplicate stock identities', async t => {
  const { scope, get } = await setup(t, 'ingredient_lists');
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const item = await beverage(scope);
    const profile = await require('../models/IngredientProfile').create({ tenant: scope.tenantId,
      subProduct: item.subProductId, dimension: 'count', createdBy: scope.actor.userId });
    rows.push(profile.id);
  }
  for (const path of ['/ingredient-profiles', '/ingredient-candidates']) {
    const first = await get(`${path}?limit=2`);
    assert.equal(first.status, 200);
    assert.equal(first.data.items.length, 2);
    assert.equal(typeof first.data.nextCursor, 'string');
    const second = await get(`${path}?limit=2&cursor=${first.data.nextCursor}`);
    assert.equal(second.data.items.length, 1);
    assert.equal(second.data.nextCursor, null);
    assert.equal(new Set([...first.data.items, ...second.data.items].map(row => row.id)).size, 3);
  }
});
