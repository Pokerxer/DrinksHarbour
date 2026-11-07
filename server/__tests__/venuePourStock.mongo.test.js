'use strict';
// Task 4 (S2) — pour stock: explicit bottle opening, guarded pours, auditable waste.
// Acceptance basis (08 §4): one sealed 750 ml → two 50 ml pours + 20 ml spill = 630 ml left;
// pours never auto-open; waste respects the remainingMl guard and requires approval.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code) => assert.rejects(promise, error => codeOf(error) === code);

async function bottleBeverage(args, stock = {}) {
  const beverageRow = await beverage(args, stock);
  await require('../models/Size').updateOne({ _id: beverageRow.sizeId }, { volumeMl: 750 });
  return beverageRow;
}

test('pour stock: open → pour → waste acceptance chain, guards and batch allocation', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'recipe_pours');
  const args = await fixture();
  const pourStock = require('../services/venue/pour-stock');
  const Stock = require('../models/WarehouseStock');
  const OpenedBottle = require('../models/OpenedBottle');
  const WasteEvent = require('../models/VenueWasteEvent');
  await OpenedBottle.createIndexes(); await WasteEvent.createIndexes();
  const userId = new mongoose.Types.ObjectId(args.actor.userId);
  const approver = new mongoose.Types.ObjectId().toString();
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, idempotencyKey: over.idempotencyKey || 'pour-key', ...over });

  // Acceptance: exactly one sealed 750 ml bottle
  const bottle = await bottleBeverage(args, { currentQuantity: 1, reservedQuantity: 0 });
  const opened = await pourStock.openBottle(base({ subProductId: bottle.subProductId, sizeId: bottle.sizeId, idempotencyKey: 'open-1' }));
  assert.ok(opened.id);
  assert.deepEqual(opened.batchAllocation, []);
  assert.equal(opened.contentsMl, 750); assert.equal(opened.remainingMl, 750); assert.equal(opened.state, 'open');
  assert.equal(opened.subProductId, bottle.subProductId); assert.equal(opened.sizeId, bottle.sizeId);
  const stockRow = await Stock.findOne({ tenant: args.tenantId, warehouse: args.locationId, subProduct: bottle.subProductId }).lean();
  assert.equal(stockRow.currentQuantity, 0); // "a sealed source can never simultaneously stay sellable"
  assert.equal(stockRow.reservedQuantity, 0); // reserved quantity untouched on open

  // Idempotent open: same key replays and must not decrement again
  const replayOpen = await pourStock.openBottle(base({ subProductId: bottle.subProductId, sizeId: bottle.sizeId, idempotencyKey: 'open-1' }));
  assert.equal(replayOpen.id, opened.id);
  assert.equal((await Stock.findOne({ tenant: args.tenantId, subProduct: bottle.subProductId }).lean()).currentQuantity, 0);

  // No second sealed unit to open
  await assertFails(pourStock.openBottle(base({ subProductId: bottle.subProductId, sizeId: bottle.sizeId, idempotencyKey: 'open-2' })), 'STOCK_UNAVAILABLE');
  // available-unreserved guard: a fully-reserved unit is not openable, and an empty row is not openable
  const reservedOut = await bottleBeverage(args, { currentQuantity: 1, reservedQuantity: 1 });
  await assertFails(pourStock.openBottle(base({ subProductId: reservedOut.subProductId, sizeId: reservedOut.sizeId, idempotencyKey: 'open-3' })), 'STOCK_UNAVAILABLE');
  const emptyOut = await bottleBeverage(args, { currentQuantity: 0, reservedQuantity: 0 });
  await assertFails(pourStock.openBottle(base({ subProductId: emptyOut.subProductId, sizeId: emptyOut.sizeId, idempotencyKey: 'open-4' })), 'STOCK_UNAVAILABLE');

  // pours: 50 + 50, then a 20 ml recorded spill → 630 ml remaining
  const first = await pourStock.pour(base({ openedBottleId: opened.id, ml: 50, idempotencyKey: 'pour-1' }));
  assert.equal(first.remainingMl, 700);
  await pourStock.pour(base({ openedBottleId: opened.id, ml: 50, idempotencyKey: 'pour-2' }));
  const wasted = await pourStock.recordWaste(base({ openedBottleId: opened.id, ml: 20, reason: 'spill', approvedBy: approver, idempotencyKey: 'waste-1' }));
  assert.equal(wasted.remainingMl, 630);
  assert.equal(wasted.event.quantity, 20); assert.equal(wasted.event.unit, 'ml');
  assert.equal(String(wasted.event.approvedBy), approver);
  assert.ok(await WasteEvent.findOne({ tenant: args.tenantId, location: args.locationId, reason: 'spill', quantity: 20 }).lean());
  assert.equal((await OpenedBottle.findById(opened.id).lean()).remainingMl, 630);

  // pouring more than remaining refuses and never auto-opens a new bottle
  await assertFails(pourStock.pour(base({ openedBottleId: opened.id, ml: 700, idempotencyKey: 'pour-3' })), 'STOCK_UNAVAILABLE');
  assert.equal(await OpenedBottle.countDocuments({ tenant: args.tenantId, location: args.locationId }), 1);
  assert.equal((await OpenedBottle.findById(opened.id).lean()).remainingMl, 630);

  // exhaust exactly at the remaining amount, then the bottle is spent for pours
  const final = await pourStock.pour(base({ openedBottleId: opened.id, ml: 630, idempotencyKey: 'pour-4' }));
  assert.equal(final.remainingMl, 0); assert.equal(final.state, 'exhausted');
  await assertFails(pourStock.pour(base({ openedBottleId: opened.id, ml: 5, idempotencyKey: 'pour-5' })), 'STOCK_UNAVAILABLE');
  // a fresh bottle was never opened implicitly
  assert.equal(await OpenedBottle.countDocuments({ tenant: args.tenantId, location: args.locationId }), 1);
  assert.equal((await Stock.findOne({ tenant: args.tenantId, subProduct: bottle.subProductId }).lean()).currentQuantity, 0);

  // no auto-open also means: an unknown opened bottle is NOT a reason to open one
  await assertFails(pourStock.pour(base({ openedBottleId: new mongoose.Types.ObjectId().toString(), ml: 5, idempotencyKey: 'pour-6' })), 'NOT_FOUND');

  // waste guards: larger than remaining fails, approval + reason enum are required
  const bottle2 = await bottleBeverage(args, { currentQuantity: 1, reservedQuantity: 0 });
  const opened2 = await pourStock.openBottle(base({ subProductId: bottle2.subProductId, sizeId: bottle2.sizeId, idempotencyKey: 'open-5' }));
  await assertFails(pourStock.recordWaste(base({ openedBottleId: opened2.id, ml: 750.01, reason: 'spill', approvedBy: approver, idempotencyKey: 'waste-2' })), 'STOCK_UNAVAILABLE');
  assert.equal((await OpenedBottle.findById(opened2.id).lean()).remainingMl, 750);
  await assertFails(pourStock.recordWaste(base({ openedBottleId: opened2.id, ml: 5, reason: 'spill', idempotencyKey: 'waste-3' })), 'INVALID_INPUT');
  await assertFails(pourStock.recordWaste(base({ openedBottleId: opened2.id, ml: 5, reason: 'burned', approvedBy: approver, idempotencyKey: 'waste-4' })), 'INVALID_INPUT');
  assert.equal(await WasteEvent.countDocuments({ tenant: args.tenantId, location: args.locationId }), 1);

  // Remainder-loss policy: draining the bottle's implicit remainder at exhaustion is
  // recorded as its own waste event ONLY when the policy flag + consent ref are passed.
  const first50 = await pourStock.pour(base({ openedBottleId: opened2.id, ml: 720, idempotencyKey: 'pour-7' }));
  assert.equal(first50.remainingMl, 30);
  await assertFails(pourStock.recordWaste(base({ openedBottleId: opened2.id, ml: 5, reason: 'spill', approvedBy: approver, drainRemainder: true, idempotencyKey: 'waste-5' })), 'INVALID_INPUT');
  const drained = await pourStock.recordWaste(base({ openedBottleId: opened2.id, ml: 5, reason: 'spill', approvedBy: approver, drainRemainder: true, policyConsentRef: 'manager-consent-1', idempotencyKey: 'waste-6' }));
  assert.equal(drained.remainingMl, 0); assert.equal(drained.state, 'exhausted');
  assert.equal(drained.event.quantity, 30); // the ACTUAL remainder drained, not the requested measure
  assert.equal(drained.event.policyConsentRef, 'manager-consent-1');
  assert.equal(await WasteEvent.countDocuments({ tenant: args.tenantId, location: args.locationId }), 2);

  // tenancy: tenant-scoped addressing — no bottle of another tenant pours through
  await assertFails(pourStock.pour({ tenantId: new mongoose.Types.ObjectId().toString(), locationId: args.locationId, openedBottleId: opened.id, ml: 5, actor: { ...args.actor }, idempotencyKey: 'pour-fail-ten' }), 'NOT_FOUND');
});

test('pour stock open honours batch tracking (FEFO allocation copied onto the bottle)', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'recipe_pours_batch');
  const args = await fixture();
  const pourStock = require('../services/venue/pour-stock');
  const Stock = require('../models/WarehouseStock');
  const OpenedBottle = require('../models/OpenedBottle');
  await OpenedBottle.createIndexes();
  const oid = () => new mongoose.Types.ObjectId(); const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const product = oid(); const subproduct = oid(); const size = oid();
  // raw product insert with no tracksBatch field — service must treat it as batch-tracked
  await require('../models/Product').collection.insertOne({ _id: product, name: 'Tracked', type: 'beer' });
  await require('../models/SubProduct').collection.insertOne({ _id: subproduct, tenant, product, status: 'active' });
  await require('../models/Size').create({ _id: size, tenant, subproduct, size: 'bottle-750ml', sellingPrice: 100, costPrice: 50, volumeMl: 750 });
  await Stock.create({ tenant, warehouse: args.locationId, subProduct: subproduct, size, currentQuantity: 1, reservedQuantity: 0 });
  const batch = await require('../models/WarehouseBatch').create({ tenant, warehouse: args.locationId, subProduct: subproduct, size, quantity: 1, batchNumber: 'BATCH-OPEN-1' });
  const opened = await pourStock.openBottle({ tenantId: args.tenantId, locationId: args.locationId, subProductId: String(subproduct), sizeId: String(size), actor: { ...args.actor }, idempotencyKey: 'open-batch' });
  assert.equal(opened.batchAllocation.length, 1);
  assert.equal(String(opened.batchAllocation[0].batch), String(batch._id));
  assert.equal(opened.batchAllocation[0].quantity, 1);
  assert.equal((await require('../models/WarehouseBatch').findById(batch._id).lean()).quantity, 0);
  assert.equal((await Stock.findOne({ tenant, subProduct: subproduct }).lean()).currentQuantity, 0);
  // a second tracked bottle with no batch coverage left refuses the open
  await Stock.updateOne({ tenant, subProduct: subproduct }, { currentQuantity: 1 });
  const batch2 = await require('../models/WarehouseBatch').create({ warehouse: args.locationId, subProduct: subproduct, size, tenant, quantity: 1, quarantined: true, batchNumber: 'BATCH-OPEN-2' });
  void batch2;
  await assertFails(pourStock.openBottle({ tenantId: args.tenantId, locationId: args.locationId, subProductId: String(subproduct), sizeId: String(size), actor: { ...args.actor }, idempotencyKey: 'open-batch-2' }), 'STOCK_UNAVAILABLE');
  assert.equal((await Stock.findOne({ tenant, subProduct: subproduct }).lean()).currentQuantity, 1); // rollback left the sealed unit intact
});

test('pour stock routes open and pour over the venue-ops router', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'recipe_pours_http');
  const args = await fixture();
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'pour-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const output = await bottleBeverage(args, { currentQuantity: 1, reservedQuantity: 0 });
  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });
  const openUrl = `${root}/locations/${args.locationId}/opened-bottles`;
  const pourUrl = id => `${openUrl}/${id}/pours`;
  assert.equal((await fetch(openUrl, { method: 'POST' })).status, 401);
  const noKey = await fetch(openUrl, { method: 'POST', headers: headers(), body: JSON.stringify({ subProductId: output.subProductId, sizeId: output.sizeId }) });
  assert.equal(noKey.status, 400); assert.equal((await noKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');
  const opened = await fetch(openUrl, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'pour-http-open' }, body: JSON.stringify({ subProductId: output.subProductId, sizeId: output.sizeId }) });
  assert.equal(opened.status, 201);
  const bottle = (await opened.json()).data;
  assert.equal(bottle.remainingMl, 750);
  const replay = await fetch(openUrl, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'pour-http-open' }, body: JSON.stringify({ subProductId: output.subProductId, sizeId: output.sizeId }) });
  assert.equal(replay.status, 201); assert.equal((await replay.json()).data.id, bottle.id);
  const poured = await fetch(pourUrl(bottle.id), { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'pour-http-pour' }, body: JSON.stringify({ ml: 50 }) });
  assert.equal(poured.status, 200);
  assert.equal((await poured.json()).data.remainingMl, 700);
  // pouring beyond the open bottle refuses and never auto-opens
  const refused = await fetch(pourUrl(bottle.id), { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'pour-http-big' }, body: JSON.stringify({ ml: 900 }) });
  assert.equal(refused.status, 409); assert.equal((await refused.json()).code, 'STOCK_UNAVAILABLE');
  assert.equal(await require('../models/OpenedBottle').countDocuments({ tenant: args.tenantId, location: args.locationId }), 1);
});
