'use strict';
// Task 7 (S2) — waste events service surface: reason enum, required approval,
// tenant/location-scoped newest-first listing with the venue cursor idiom, and
// DELEGATION not duplication (waste.recordWaste IS pour-stock's drain
// coordination; identical input through either module surface yields one
// identical event shape). Waste is recorded through pour-stock ops internally —
// S2 deliberately has no POST waste route.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code) => assert.rejects(promise, error => codeOf(error) === code);

async function bottleBeverage(args, stock = {}) {
  const beverageRow = await beverage(args, stock);
  await require('../models/Size').updateOne({ _id: beverageRow.sizeId }, { volumeMl: 750 });
  return beverageRow;
}

test('waste service: delegation, guards and event shape', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'waste_events');
  const args = await fixture();
  const waste = require('../services/venue/waste');
  const pourStock = require('../services/venue/pour-stock');
  const OpenedBottle = require('../models/OpenedBottle');
  const WasteEvent = require('../models/VenueWasteEvent');
  await OpenedBottle.createIndexes(); await WasteEvent.createIndexes();
  const approver = new mongoose.Types.ObjectId().toString();
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, idempotencyKey: over.idempotencyKey || 'waste-key', ...over });

  // Delegation not duplication: the waste module exposes pour-stock's exact
  // coordination — one implementation of the drain, zero drift by construction.
  assert.equal(waste.recordWaste, pourStock.recordWaste);

  // Approval is required and the reason enum is enforced through the waste module surface
  const bottleRow = await bottleBeverage(args, { currentQuantity: 1, reservedQuantity: 0 });
  const opened = await pourStock.openBottle(base({ subProductId: bottleRow.subProductId, sizeId: bottleRow.sizeId, idempotencyKey: 'open-1' }));
  await assertFails(waste.recordWaste(base({ openedBottleId: opened.id, ml: 20, reason: 'spill', idempotencyKey: 'waste-no-approval' })), 'INVALID_INPUT');
  await assertFails(waste.recordWaste(base({ openedBottleId: opened.id, ml: 20, reason: 'burned', approvedBy: approver, idempotencyKey: 'waste-bad-reason' })), 'INVALID_INPUT');
  assert.equal(await WasteEvent.countDocuments({ tenant: args.tenantId }), 0);
  assert.equal((await OpenedBottle.findById(opened.id).lean()).remainingMl, 750); // refusals never drain

  // Recording through waste.js drains remainingMl in the same coordinated way
  const viaWaste = await waste.recordWaste(base({ openedBottleId: opened.id, ml: 20, reason: 'spill', approvedBy: approver, idempotencyKey: 'waste-1' }));
  assert.equal(viaWaste.remainingMl, 730);
  assert.deepEqual(Object.keys(viaWaste.event).sort(), ['approvedBy', 'id', 'policyConsentRef', 'quantity', 'reason', 'unit']);
  assert.equal(viaWaste.event.quantity, 20); assert.equal(viaWaste.event.unit, 'ml');
  assert.equal(viaWaste.event.approvedBy, approver);
  assert.ok(await WasteEvent.findOne({ tenant: args.tenantId, location: args.locationId, reason: 'spill', quantity: 20 }).lean());

  // No drift: the same input through either module surface produces one
  // identical event shape (ids/consent refs differ only by the bottle addressed)
  const second = await bottleBeverage(args, { currentQuantity: 1, reservedQuantity: 0 });
  const opened2 = await pourStock.openBottle(base({ subProductId: second.subProductId, sizeId: second.sizeId, idempotencyKey: 'open-2' }));
  const viaPourStock = await pourStock.recordWaste(base({ openedBottleId: opened2.id, ml: 20, reason: 'spill', approvedBy: approver, idempotencyKey: 'waste-2' }));
  const normalise = dto => ({ ...dto.event, id: '<event>', policyConsentRef: String(dto.event.policyConsentRef).replace(/^opened-bottle:.*$/, 'opened-bottle:<id>') });
  assert.deepEqual(normalise(viaWaste), normalise(viaPourStock));
  assert.equal(viaPourStock.remainingMl, viaWaste.remainingMl);
  assert.equal(viaPourStock.state, viaWaste.state);
});

test('waste listing: tenant/location scoping, newest-first, cursor pagination', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'waste_events_list');
  const args = await fixture();
  const waste = require('../services/venue/waste');
  const pourStock = require('../services/venue/pour-stock');
  const OpenedBottle = require('../models/OpenedBottle');
  const WasteEvent = require('../models/VenueWasteEvent');
  await OpenedBottle.createIndexes(); await WasteEvent.createIndexes();
  const approver = new mongoose.Types.ObjectId().toString();
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, idempotencyKey: over.idempotencyKey || 'waste-key', ...over });

  // A second location of the SAME tenant: ledger stays location-composable
  const staff = new mongoose.Types.ObjectId(args.actor.userId);
  const secondLocation = await require('../models/Warehouse').create({ tenant: args.tenantId, name: 'Bar 2', code: 'BAR2',
    venueServices: { enabled: true, reviewedAt: new Date(), canonicalCheckoutEnabled: true, capabilities: ['tables', 'tabs', 'preparation'] }, venueStaff: [staff] });

  async function spillAt(locationId, key) {
    const row = await bottleBeverage({ ...args, locationId }, { currentQuantity: 1, reservedQuantity: 0 });
    const bottle = await pourStock.openBottle({ ...base({}), locationId, subProductId: row.subProductId, sizeId: row.sizeId, idempotencyKey: `open-${key}` });
    return waste.recordWaste({ ...base({}), locationId, openedBottleId: bottle.id, ml: 25, reason: 'remake', approvedBy: approver, idempotencyKey: `waste-${key}` });
  }
  const oldest = await spillAt(args.locationId, 'a');
  const inSecondLocation = await spillAt(String(secondLocation._id), 'b');
  const newest = await spillAt(args.locationId, 'c');
  // Deterministic ordering independent of insert-time millisecond collisions
  const hour = h => new Date(Date.UTC(2026, 9, 27, h));
  await WasteEvent.collection.updateOne({ _id: new mongoose.Types.ObjectId(oldest.event.id) }, { $set: { createdAt: hour(10) } });
  await WasteEvent.collection.updateOne({ _id: new mongoose.Types.ObjectId(inSecondLocation.event.id) }, { $set: { createdAt: hour(11) } });
  await WasteEvent.collection.updateOne({ _id: new mongoose.Types.ObjectId(newest.event.id) }, { $set: { createdAt: hour(12) } });

  const listing = await waste.listWaste({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor } });
  assert.deepEqual(listing.items.map(row => row.id), [newest.event.id, oldest.event.id]); // newest-first, location-scoped
  assert.deepEqual(listing.items[0], { id: newest.event.id, locationId: args.locationId, consumptionEventId: null, lineId: null,
    reason: 'remake', quantity: 25, unit: 'ml', approvedBy: approver, policyConsentRef: newest.event.policyConsentRef, actorId: args.actor.userId, createdAt: hour(12).toISOString() });
  assert.equal(listing.next, null);

  // cursor: `after` the newest returns only the older row of this location
  const paged = await waste.listWaste({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, pagination: { after: newest.event.id } });
  assert.deepEqual(paged.items.map(row => row.id), [oldest.event.id]);
  assert.equal(paged.next, null);

  // tenancy: another tenant's location address fails at eligibility (never leaks)
  const other = await fixture();
  await assertFails(waste.listWaste({ tenantId: other.tenantId, locationId: args.locationId, actor: { ...other.actor } }), 'NOT_FOUND');
  await assertFails(waste.listWaste({ tenantId: args.tenantId, locationId: other.locationId, actor: { ...args.actor } }), 'NOT_FOUND');
  // and the other tenant's own ledger only holds its own rows
  const otherListing = await waste.listWaste({ tenantId: other.tenantId, locationId: other.locationId, actor: { ...other.actor } });
  assert.deepEqual(otherListing.items.map(row => row.id), []);
});

test('waste list route: read over the venue-ops router with the staff action surface', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'waste_events_http');
  const args = await fixture();
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'waste-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const listUrl = `${root}/locations/${args.locationId}/waste`;
  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}` });

  assert.equal((await fetch(listUrl, {})).status, 401); // no token
  const listed = await fetch(listUrl, { headers: headers() });
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  const listing = (await listed.json()).data;
  assert.deepEqual(listing, { items: [], next: null });

  // cross-tenant location addressing fails at eligibility, not with a leak
  const foreign = await fixture();
  const denied = await fetch(`${root}/locations/${foreign.locationId}/waste`, { headers: headers() });
  assert.equal(denied.status, 404); assert.equal((await denied.json()).code, 'NOT_FOUND');

  // S2 non-goal honoured: waste is recorded through pour-stock ops — no POST route
  const posted = await fetch(listUrl, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ml: 5, reason: 'spill' }) });
  assert.equal(posted.status, 404);
});
