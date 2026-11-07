'use strict';
// S6 Task 1 — visit moves & table release (docs/superpowers/plans/2026-10-28-venue-phase-3-s6.md).
// moveVisit swaps visit.tableIds + any arrived VenueCapacityClaim table binding +
// the held tab's table metadata in ONE transaction, reusing the capacity services'
// availability guard style; line/consumption/preparation/bill references key on
// the visit id and must stay byte-stable. releaseTable ends the table/claim/tab
// commitment only when the visit's unresolved commitments are empty (the precise
// predicate is documented in services/venue/transfers.js) and never touches
// Booking documents. Suffix: transfers_ops.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const json = value => JSON.stringify(value);
const Table = () => require('../models/POSTable');

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
}
async function freshVisit(args, name) {
  const table = await Table().create({ tenant: args.tenantId, location: args.locationId, name: `${name}-${Date.now()}` });
  return require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: `visit-${name}-${Date.now()}` });
}
async function recipeFor(args, bev) {
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const profile = await require('../models/IngredientProfile').create({ tenant, subProduct: bev.subProductId, dimension: 'count', createdBy: args.actor.userId });
  await require('../models/RecipeVersion').create({ tenant, output: { subProduct: bev.subProductId, size: bev.sizeId }, version: 1, components: [{ profile: profile._id, quantity: 1, unit: 'count' }], createdBy: args.actor.userId });
}
const linesBytes = async (tenantId, sessionId) => json((await require('../models/VenueServiceSession').findOne({ _id: sessionId, tenant: tenantId }).lean()).acceptedLines);
async function menuFor(args, bev) {
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu({ sections: [{ id: 'd', name: 'Drinks', items: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, published: true }] }] }) });
}

test('move visit swaps tableIds, claim binding and hold metadata atomically; frozen references stay byte-stable', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'transfers_ops_move');
  await indexes();
  const args = await fixture();
  const transfers = require('../services/venue/transfers'); const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  await menuFor(args, bev); await recipeFor(args, bev);
  const table2 = await Table().create({ tenant: args.tenantId, location: args.locationId, name: `M2-${Date.now()}` });
  const visit = await freshVisit(args, 'move');
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 2 }], idempotencyKey: 'accept' });
  const fired = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });
  const Event = require('../models/VenueConsumptionEvent'); const Prep = require('../models/VenuePreparationItem');
  const holdBefore = await require('../models/Order').findOne({ venueServiceSession: visit.id, status: 'hold' }).lean();
  const before = {
    lines: await linesBytes(args.tenantId, visit.id),
    events: (await Event.find({ tenant: args.tenantId, session: visit.id }).lean()).map(json),
    preps: (await Prep.find({ tenant: args.tenantId, session: visit.id }).lean()).map(json),
    effects: await require('../models/VenueStockEffect').countDocuments({ tenant: args.tenantId, session: visit.id }),
    receipts: await require('../models/VenuePaymentReceipt').countDocuments({ tenant: args.tenantId, session: visit.id }),
    rounds: json(holdBefore.holdMetadata.firedRounds), items: json(holdBefore.items),
  };
  assert.equal(before.events.length, 1, 'recipe consumption event exists before the move');
  assert.equal(before.preps.length, 1, 'preparation item exists before the move');

  const moved = await transfers.moveVisit({ ...args, sessionId: visit.id, targetTableIds: [String(table2._id)], expectedVersion: fired.version, idempotencyKey: 'move-1' });
  assert.deepEqual(moved.tableIds, [String(table2._id)], 'DTO echoes the swapped tables');
  const oldRow = await Table().findById(visit.tableIds[0]).lean();
  const newRow = await Table().findById(table2._id).lean();
  assert.equal(oldRow.status, 'available'); assert.equal(oldRow.currentTabId, null, 'old table released');
  assert.equal(newRow.status, 'occupied'); assert.equal(String(newRow.currentTabId), moved.heldOrderId, 'new table bound to the same held tab');
  const hold = await require('../models/Order').findOne({ venueServiceSession: visit.id, status: 'hold' }).lean();
  assert.equal(hold.holdMetadata.tableId, String(table2._id), 'held-order table metadata retargeted');
  assert.equal(json(hold.holdMetadata.firedRounds), before.rounds, 'fired rounds untouched');
  assert.equal(json(hold.items), before.items, 'held tab items byte-stable');
  assert.deepEqual((await Event.find({ tenant: args.tenantId, session: visit.id }).lean()).map(json), before.events, 'consumption events byte-stable');
  assert.deepEqual((await Prep.find({ tenant: args.tenantId, session: visit.id }).lean()).map(json), before.preps, 'preparation items byte-stable');
  assert.equal(await linesBytes(args.tenantId, visit.id), before.lines, 'accepted lines byte-stable');
  assert.equal(await require('../models/VenueStockEffect').countDocuments({ tenant: args.tenantId, session: visit.id }), before.effects, 'no stock effects created by a move');
  assert.equal(await require('../models/VenuePaymentReceipt').countDocuments({ tenant: args.tenantId, session: visit.id }), before.receipts, 'no receipts touched by a move');

  const noop = await transfers.moveVisit({ ...args, sessionId: visit.id, targetTableIds: [String(table2._id)], expectedVersion: moved.version, idempotencyKey: 'move-same' });
  assert.equal(noop.version, moved.version, 'same-source move is an idempotent no-op');
  const visit2 = await freshVisit(args, 'move2');
  await assertFails(transfers.moveVisit({ ...args, sessionId: visit2.id, targetTableIds: [String(table2._id)], expectedVersion: visit2.version, idempotencyKey: 'move-occupied' }), 'STATE_CHANGED', 409);
  await assertFails(transfers.moveVisit({ ...args, sessionId: visit.id, targetTableIds: [String(table2._id)], expectedVersion: 0, idempotencyKey: 'move-stale' }), 'STATE_CHANGED', 409);
  const other = await fixture();
  const foreignTable = await Table().create({ tenant: args.tenantId, location: other.locationId, name: `Elsewhere-${Date.now()}` });
  await assertFails(transfers.moveVisit({ ...args, sessionId: visit.id, targetTableIds: [String(foreignTable._id)], expectedVersion: moved.version, idempotencyKey: 'move-location' }), 'NOT_FOUND', 404);
  await require('../models/VenueServiceSession').updateOne({ _id: visit.id }, { $set: { state: 'closed' } });
  await assertFails(transfers.moveVisit({ ...args, sessionId: visit.id, targetTableIds: [String(table2._id)], expectedVersion: moved.version + 1, idempotencyKey: 'move-closed' }), 'STATE_CHANGED', 409);
});

test('two concurrent moves onto the same free table: exactly one claimant commits', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'transfers_ops_race');
  await indexes();
  const args = await fixture();
  const transfers = require('../services/venue/transfers');
  const free = await Table().create({ tenant: args.tenantId, location: args.locationId, name: `R-Free-${Date.now()}` });
  const a = await freshVisit(args, 'race-a'); const b = await freshVisit(args, 'race-b');
  const results = await Promise.allSettled([
    transfers.moveVisit({ ...args, sessionId: a.id, targetTableIds: [String(free._id)], expectedVersion: a.version, idempotencyKey: `race-a-${Date.now()}` }),
    transfers.moveVisit({ ...args, sessionId: b.id, targetTableIds: [String(free._id)], expectedVersion: b.version, idempotencyKey: `race-b-${Date.now()}` }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, 'exactly one move commits');
  assert.equal(results.filter(r => r.status === 'rejected' && codeOf(r.reason) === 'STATE_CHANGED').length, 1, 'the loser fails STATE_CHANGED');
  const row = await Table().findById(free._id).lean();
  assert.equal(row.status, 'occupied');
  const winner = results[0].status === 'fulfilled' ? a : b;
  assert.equal(String(row.currentTabId), winner.heldOrderId);
});

test('move swaps the arrived capacity claim binding in the same transaction and never touches the Booking', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'transfers_ops_claim');
  await indexes();
  const args = await fixture();
  const transfers = require('../services/venue/transfers');
  const table2 = await Table().create({ tenant: args.tenantId, location: args.locationId, name: `C2-${Date.now()}` });
  const visit = await freshVisit(args, 'claim');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const claim = await require('../models/VenueCapacityClaim').create({ tenant, location: args.locationId, booking: new mongoose.Types.ObjectId(), resources: [new mongoose.Types.ObjectId(visit.tableIds[0])], start: new Date(Date.now() - 3600000), end: new Date(Date.now() + 3 * 3600000), bookingAt: new Date(), state: 'arrived', version: 1, policyVersion: 1, policySnapshot: { durationMinutes: 120, bufferBeforeMinutes: 15, bufferAfterMinutes: 30, timezone: 'Africa/Lagos' } });
  const booking = await require('../models/Booking').create({ tenant, createdBy: args.actor.userId, guest: { name: 'G', phone: '08000000000' }, partySize: 2, bookingAt: new Date(), status: 'checked_in', location: args.locationId, serviceSession: new mongoose.Types.ObjectId(visit.id), capacityClaim: claim._id, acquisitionAuthority: 'server' });
  await require('../models/VenueCapacityClaim').updateOne({ _id: claim._id }, { $set: { booking: booking._id } });
  await require('../models/VenueServiceSession').updateOne({ _id: visit.id }, { $set: { booking: booking._id } });
  const bookingBefore = json(await require('../models/Booking').findById(booking._id).lean());
  const moved = await transfers.moveVisit({ ...args, sessionId: visit.id, targetTableIds: [String(table2._id)], expectedVersion: visit.version, idempotencyKey: 'claim-move' });
  const after = await require('../models/VenueCapacityClaim').findById(claim._id).lean();
  assert.deepEqual(after.resources.map(String), [String(table2._id)], 'claim table binding swapped with the visit');
  assert.equal(after.state, 'arrived'); assert.equal(after.version, 2);
  assert.equal(json(await require('../models/Booking').findById(booking._id).lean()), bookingBefore, 'Booking document byte-stable');
  assert.deepEqual(moved.tableIds, [String(table2._id)]);
});

test('release table: unresolved commitments refuse; cleared empty visit ends tab+claim binding, Booking untouched, idempotent', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'transfers_ops_release');
  await indexes();
  const args = await fixture();
  const transfers = require('../services/venue/transfers'); const linesService = require('../services/venue/lines');
  const bev = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  await menuFor(args, bev);
  const SessionM = require('../models/VenueServiceSession');
  const line = [{ subProductId: bev.subProductId, sizeId: bev.sizeId, quantity: 1 }];

  const withLines = await freshVisit(args, 'rel-lines');
  const acc1 = await linesService.setSessionLines({ ...args, sessionId: withLines.id, expectedVersion: withLines.version, lines: line, idempotencyKey: 'rel-accept' });
  await assertFails(transfers.releaseTable({ ...args, sessionId: withLines.id, outcome: 'cleared', expectedVersion: acc1.version, idempotencyKey: 'rel-lines' }), 'BLOCK_RELEASE', 409);
  const firedVisit = await freshVisit(args, 'rel-fired');
  const acc2 = await linesService.setSessionLines({ ...args, sessionId: firedVisit.id, expectedVersion: firedVisit.version, lines: line, idempotencyKey: 'rel-fired-accept' });
  await linesService.fireSessionRound({ ...args, sessionId: firedVisit.id, expectedVersion: acc2.version, idempotencyKey: 'rel-fired-fire' });
  await assertFails(transfers.releaseTable({ ...args, sessionId: firedVisit.id, outcome: 'cleared', expectedVersion: acc2.version + 1, idempotencyKey: 'rel-fired' }), 'FIRED_LINES_LOCKED', 409);
  const frozen = await freshVisit(args, 'rel-frozen');
  await SessionM.updateOne({ _id: frozen.id }, { $set: { state: 'closing', billOrder: new mongoose.Types.ObjectId() } });
  await assertFails(transfers.releaseTable({ ...args, sessionId: frozen.id, outcome: 'cleared', expectedVersion: 0, idempotencyKey: 'rel-frozen' }), 'BLOCK_RELEASE', 409);
  const attemptVisit = await freshVisit(args, 'rel-attempt');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../models/VenuePaymentAttempt').create({ tenant, location: args.locationId, session: attemptVisit.id, billOrder: new mongoose.Types.ObjectId(), method: 'paystack', amountMinor: 100, reference: `rel-${Date.now()}`, state: 'pending', key: 'k', requestHash: 'h' });
  await assertFails(transfers.releaseTable({ ...args, sessionId: attemptVisit.id, outcome: 'cleared', expectedVersion: 0, idempotencyKey: 'rel-attempt' }), 'BLOCK_RELEASE', 409);
  const grouped = await freshVisit(args, 'rel-group');
  await SessionM.updateOne({ _id: grouped.id }, { $set: { partyGroup: { groupId: 'g1', joinedAt: new Date() } } });
  await assertFails(transfers.releaseTable({ ...args, sessionId: grouped.id, outcome: 'cleared', expectedVersion: 0, idempotencyKey: 'rel-group' }), 'BLOCK_RELEASE', 409);
  const empty = await freshVisit(args, 'rel-empty');
  await assertFails(transfers.releaseTable({ ...args, sessionId: empty.id, outcome: 'abandoned', expectedVersion: empty.version, idempotencyKey: 'rel-bad' }), 'INVALID_INPUT', 400);

  const released = await transfers.releaseTable({ ...args, sessionId: empty.id, outcome: 'cleared', expectedVersion: empty.version, idempotencyKey: 'rel-ok' });
  assert.equal(released.state, 'closed'); assert.deepEqual(released.tableIds, []);
  const row = await Table().findById(empty.tableIds[0]).lean();
  assert.equal(row.status, 'available'); assert.equal(row.currentTabId, null, 'table released');
  assert.equal((await require('../models/Order').findById(empty.heldOrderId).lean()).status, 'cancelled', 'empty held tab cancelled');
  const again = await transfers.releaseTable({ ...args, sessionId: empty.id, outcome: 'cleared', expectedVersion: released.version, idempotencyKey: 'rel-ok-2' });
  assert.equal(again.state, 'closed'); assert.equal(again.version, released.version, 'release is idempotent on an already-released visit');

  const booked = await freshVisit(args, 'rel-booking');
  const claim = await require('../models/VenueCapacityClaim').create({ tenant, location: args.locationId, booking: new mongoose.Types.ObjectId(), resources: [new mongoose.Types.ObjectId(booked.tableIds[0])], start: new Date(Date.now() - 3600000), end: new Date(Date.now() + 3 * 3600000), bookingAt: new Date(), state: 'arrived', version: 1, policyVersion: 1, policySnapshot: { durationMinutes: 120, bufferBeforeMinutes: 15, bufferAfterMinutes: 30, timezone: 'Africa/Lagos' } });
  const booking = await require('../models/Booking').create({ tenant, createdBy: args.actor.userId, guest: { name: 'G', phone: '08000000000' }, partySize: 2, bookingAt: new Date(), status: 'checked_in', location: args.locationId, serviceSession: new mongoose.Types.ObjectId(booked.id), capacityClaim: claim._id, acquisitionAuthority: 'server' });
  await require('../models/VenueCapacityClaim').updateOne({ _id: claim._id }, { $set: { booking: booking._id } });
  await SessionM.updateOne({ _id: booked.id }, { $set: { booking: booking._id } });
  const bookingBefore = json(await require('../models/Booking').findById(booking._id).lean());
  const relBooked = await transfers.releaseTable({ ...args, sessionId: booked.id, outcome: 'transferred_away', expectedVersion: booked.version, idempotencyKey: 'rel-booked' });
  assert.equal(relBooked.state, 'closed');
  assert.equal((await require('../models/VenueCapacityClaim').findById(claim._id).lean()).state, 'released', 'claim binding ended');
  assert.equal(json(await require('../models/Booking').findById(booking._id).lean()), bookingBefore, 'checked-in booking untouched by release');
});

test('move/release routes: auth, eligibility action, Idempotency-Key, no-store', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'transfers_ops_http');
  await indexes();
  const args = await fixture();
  const table2 = await Table().create({ tenant: args.tenantId, location: args.locationId, name: `H2-${Date.now()}` });
  const visit = await freshVisit(args, 'http');
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'transfers-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const sign = actor => require('jsonwebtoken').sign({ userId: actor.userId }, process.env.JWT_SECRET);
  const headers = () => ({ Authorization: `Bearer ${sign(args.actor)}`, 'Content-Type': 'application/json', 'Idempotency-Key': `mk-${Date.now()}-${Math.random()}` });
  const moveUrl = `${root}/service-sessions/${visit.id}/move`;
  assert.equal((await fetch(moveUrl, { method: 'POST' })).status, 401, 'no token → 401');
  const noKey = await fetch(moveUrl, { method: 'POST', headers: { Authorization: `Bearer ${sign(args.actor)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetTableIds: [String(table2._id)], expectedVersion: visit.version }) });
  assert.equal(noKey.status, 400); assert.equal((await noKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');
  const moved = await fetch(moveUrl, { method: 'POST', headers: headers(), body: JSON.stringify({ targetTableIds: [String(table2._id)], expectedVersion: visit.version }) });
  assert.equal(moved.status, 200); assert.equal(moved.headers.get('cache-control'), 'no-store');
  const dto = (await moved.json()).data;
  assert.deepEqual(dto.tableIds, [String(table2._id)]);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['transfers.write'] } });
  const denied = await fetch(moveUrl, { method: 'POST', headers: headers(), body: JSON.stringify({ targetTableIds: [String(table2._id)], expectedVersion: dto.version }) });
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'VENUE_PERMISSION_DENIED');
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: [] } });
  const released = await fetch(`${root}/service-sessions/${visit.id}/release-table`, { method: 'POST', headers: headers(), body: JSON.stringify({ outcome: 'cleared', expectedVersion: dto.version }) });
  assert.equal(released.status, 200);
  assert.equal((await released.json()).data.state, 'closed');
});
