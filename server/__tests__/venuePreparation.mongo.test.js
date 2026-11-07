'use strict';
// Task 4 (S3) — station routing at fire + the item advancement ledger: menu-item
// category → PreparationStation.categories (default-station fallback; neither =
// unrouted item still created), stationId snapshotted on the round item, strict
// pending→preparing→ready→served advancement with append-only history, station
// ownership + location-manager fallback, and ZERO stock/consumption effect.
// Suffix: preparation_advance.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code) => assert.rejects(promise, error => codeOf(error) === code);

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../models/VenueConsumptionEvent').createIndexes();
  await require('../models/OpenedBottle').createIndexes();
  await require('../models/PreparationStation').createIndexes();
  await require('../models/VenuePreparationItem').createIndexes();
}

async function freshVisit(args, name) {
  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name });
  return require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: `visit-${name}` });
}

test('fire routes items by category (default fallback, unrouted still created) and snapshots the station', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'preparation_routing');
  await indexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);

  const grilled = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const plain = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const mystery = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const pour = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });

  const grillStaff = new mongoose.Types.ObjectId();
  await require('../models/User').collection.insertOne({ _id: grillStaff, tenant, role: 'tenant_staff', status: 'active', posPermissions: ['pos:sell'], venueDeniedActions: [] });
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $push: { venueStaff: grillStaff } });
  const grill = await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Grill', categories: ['grill'], staffIds: [String(grillStaff)] });
  await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Pass', isDefault: true, staffIds: [] });

  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, published: true, category: 'grill' },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, published: true },
    { subProductId: mystery.subProductId, sizeId: mystery.sizeId, published: true, category: 'sushi' },
    { subProductId: pour.subProductId, sizeId: pour.sizeId, published: true, pourMl: 50 },
  ] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu(menu) });
  await require('../models/OpenedBottle').create({ tenant, location: args.locationId, source: { subProduct: pour.subProductId, size: pour.sizeId }, contentsMl: 750, remainingMl: 750, openedBy: args.actor.userId });

  const visit = await freshVisit(args, 'routed');
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, quantity: 1 },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1 },
    { subProductId: mystery.subProductId, sizeId: mystery.sizeId, quantity: 1 },
    { subProductId: pour.subProductId, sizeId: pour.sizeId, quantity: 1 },
  ], idempotencyKey: 'accept' });
  const fired = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });

  const items = await require('../models/VenuePreparationItem').find({ tenant }).lean();
  assert.equal(items.length, 4, 'an item per fired round item — including pour lines');
  const byLine = new Map(items.map(item => [item.lineId, item]));
  assert.equal(String(byLine.get(accepted.lines.find(l => l.subProductId === grilled.subProductId).lineId).stationId), String(grill._id), 'category owner wins');
  // no-category and unmapped-category items fall back to the default station
  const fallback = await require('../models/PreparationStation').findOne({ tenant, name: 'Pass' }).lean();
  assert.equal(String(byLine.get(accepted.lines.find(l => l.subProductId === plain.subProductId).lineId).stationId), String(fallback._id));
  assert.equal(String(byLine.get(accepted.lines.find(l => l.subProductId === mystery.subProductId).lineId).stationId), String(fallback._id));
  // round snapshot carries the routing result too, joined by roundId
  const persistedRound = (await require('../models/Order').findById(accepted.heldOrderId).lean()).holdMetadata.firedRounds[0];
  assert.equal(persistedRound.items.find(i => i.lineId === accepted.lines.find(l => l.subProductId === grilled.subProductId).lineId).stationId.toString(), String(grill._id));
  for (const item of items) assert.equal(String(item.roundId), String(persistedRound.roundId), 'items join the round by id');
  assert.equal(await require('../models/VenueConsumptionEvent').countDocuments({ tenant }), 1, 'exactly the pour line consumed');
});

test('advancement: station ownership, manager fallback, strict chain, append-only history, zero stock effect', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'preparation_advance');
  await indexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const preparation = require('../services/venue/preparation');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);

  const grilled = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const other = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const pour = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });

  const grillStaff = new mongoose.Types.ObjectId();
  await require('../models/User').collection.insertOne({ _id: grillStaff, tenant, role: 'tenant_staff', status: 'active', posPermissions: ['pos:sell'], venueDeniedActions: [] });
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $push: { venueStaff: grillStaff } });
  const grill = await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Grill', categories: ['grill'], staffIds: [String(grillStaff)] });
  await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Pass', isDefault: true, staffIds: [] });

  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, published: true, category: 'grill' },
    { subProductId: other.subProductId, sizeId: other.sizeId, published: true },
    { subProductId: pour.subProductId, sizeId: pour.sizeId, published: true, pourMl: 50 },
  ] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu(menu) });
  await require('../models/OpenedBottle').create({ tenant, location: args.locationId, source: { subProduct: pour.subProductId, size: pour.sizeId }, contentsMl: 750, remainingMl: 750, openedBy: args.actor.userId });

  const visit = await freshVisit(args, 'advance');
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, quantity: 1 },
    { subProductId: other.subProductId, sizeId: other.sizeId, quantity: 1 },
    { subProductId: pour.subProductId, sizeId: pour.sizeId, quantity: 1 },
  ], idempotencyKey: 'accept' });
  await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });
  const items = await require('../models/VenuePreparationItem').find({ tenant }).lean();
  const grillItem = items.find(i => i.lineId === accepted.lines.find(l => l.subProductId === grilled.subProductId).lineId);
  const otherItem = items.find(i => i.lineId === accepted.lines.find(l => l.subProductId === other.subProductId).lineId);
  const eventsBefore = await require('../models/VenueConsumptionEvent').countDocuments({ tenant });
  const bottleBefore = await require('../models/OpenedBottle').findOne({ tenant }).lean();

  const staffActor = { userId: String(grillStaff), tenantId: args.tenantId, role: 'tenant_staff', permissions: ['pos:sell'], venueDeniedActions: [] };
  const prep = item => ({ tenantId: args.tenantId, itemId: String(item._id), actor: staffActor });

  // owning station staff advances their own item
  const first = await preparation.advance({ ...prep(grillItem), to: 'preparing', idempotencyKey: 'adv-1' });
  assert.equal(first.state, 'preparing');
  assert.equal(first.stateHistory.length, 1);
  assert.equal(first.stateHistory[0].from, 'pending');
  assert.equal(first.stateHistory[0].to, 'preparing');
  assert.equal(first.stateHistory[0].actor, String(grillStaff));
  assert.ok(first.stateHistory[0].at instanceof Date);

  // one station cannot complete another's work
  await assertFails(preparation.advance({ ...prep(otherItem), to: 'preparing', idempotencyKey: 'adv-2' }), 'VENUE_PERMISSION_DENIED');
  // location-manager fallback advances any station's item
  const mgr = await preparation.advance({ tenantId: args.tenantId, itemId: String(otherItem._id), to: 'preparing', actor: args.actor, idempotencyKey: 'adv-3' });
  assert.equal(mgr.state, 'preparing');

  // replay of the same operation key returns the recorded result — history untouched
  const replay = await preparation.advance({ ...prep(grillItem), to: 'preparing', idempotencyKey: 'adv-1' });
  assert.equal(replay.state, 'preparing');
  assert.equal(replay.stateHistory.length, 1);

  // strict chain: skip is invalid; served is terminal; corrections ride reason/ref
  await assertFails(preparation.advance({ ...prep(grillItem), to: 'served', idempotencyKey: 'adv-skip' }), 'INVALID_INPUT');
  await preparation.advance({ ...prep(grillItem), to: 'ready', idempotencyKey: 'adv-4' });
  await assertFails(preparation.advance({ ...prep(grillItem), to: 'preparing', idempotencyKey: 'adv-back' }), 'INVALID_INPUT');
  const served = await preparation.advance({ ...prep(grillItem), to: 'served', reason: 'handed to guest', ref: 'waste:abc123', idempotencyKey: 'adv-5' });
  assert.equal(served.state, 'served');
  assert.equal(served.stateHistory.length, 3);
  assert.equal(served.stateHistory[2].ref, 'waste:abc123', 'correction/remake ref recorded verbatim');
  assert.equal(served.stateHistory[2].reason, 'handed to guest');
  await assertFails(preparation.advance({ ...prep(grillItem), to: 'ready', idempotencyKey: 'adv-terminal' }), 'INVALID_INPUT', 'served is terminal');
  await assertFails(preparation.advance({ ...prep(otherItem), to: 'burnt', idempotencyKey: 'adv-bogus' }), 'INVALID_INPUT');

  // advancement NEVER touches stock or consumption — S2 events identical
  assert.equal(await require('../models/VenueConsumptionEvent').countDocuments({ tenant }), eventsBefore, 'no consumption event was added or removed by advancement');
  const bottleAfter = await require('../models/OpenedBottle').findById(bottleBefore._id).lean();
  assert.equal(bottleAfter.remainingMl, bottleBefore.remainingMl, 'no bottle was drained by advancement');

  // ===== unrouted items: no default station → staff denied, manager advances =====
  await require('../models/PreparationStation').deleteOne({ _id: grill._id });
  await require('../models/PreparationStation').deleteOne({ _id: otherItem.stationId });
  const visit2 = await freshVisit(args, 'unrouted');
  const accepted2 = await linesService.setSessionLines({ ...args, sessionId: visit2.id, expectedVersion: visit2.version, lines: [
    { subProductId: other.subProductId, sizeId: other.sizeId, quantity: 1 },
  ], idempotencyKey: 'accept2' });
  await linesService.fireSessionRound({ ...args, sessionId: visit2.id, expectedVersion: accepted2.version, idempotencyKey: 'fire2' });
  const unrouted = await require('../models/VenuePreparationItem').findOne({ tenant, session: new mongoose.Types.ObjectId(visit2.id) }).lean();
  assert.equal(unrouted.stationId, undefined, 'unmapped category with no default station stays unrouted');
  await assertFails(preparation.advance({ ...prep(unrouted), to: 'preparing', idempotencyKey: 'adv-unrouted-staff' }), 'VENUE_PERMISSION_DENIED');
  const mgrUnrouted = await preparation.advance({ tenantId: args.tenantId, itemId: String(unrouted._id), to: 'preparing', actor: args.actor, idempotencyKey: 'adv-unrouted-mgr' });
  assert.equal(mgrUnrouted.state, 'preparing');
});

test('preparation advance route: auth, idempotency and denial wiring', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'preparation_http');
  await indexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const item = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [{ subProductId: item.subProductId, sizeId: item.sizeId, published: true }] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu(menu) });

  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'prep-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });

  const visit = await freshVisit(args, 'http');
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [{ subProductId: item.subProductId, sizeId: item.sizeId, quantity: 1 }], idempotencyKey: 'accept' });
  await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });
  const prep = await require('../models/VenuePreparationItem').findOne({ tenant }).lean();

  const advance = (extra = {}) => fetch(`${root}/preparation/${prep._id}/advance`, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'http-adv-1', ...extra }, body: JSON.stringify({ to: 'preparing' }) });
  const missingKey = await fetch(`${root}/preparation/${prep._id}/advance`, { method: 'POST', headers: headers(), body: JSON.stringify({ to: 'preparing' }) });
  assert.equal(missingKey.status, 400);
  const ok = await advance();
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal((await ok.json()).data.state, 'preparing');
  const replay = await advance();
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).data.stateHistory.length, 1, 'replay appends nothing');
});
