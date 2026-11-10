'use strict';
// Task 5 (S3) — kitchen read surface: GET /service-sessions/:id/preparation?stationId=
// extends (never forks) the POS kitchen endpoints. Returns the session's preparation
// items joined with the station alertThresholdMins; each item carries the derived
// `stale` (now - firedAt > threshold, STRICTLY greater) and `waitingMs`; unrouted
// items are included and flagged (stationId absent, thresholdMins null, stale false).
// Read eligibility is the 'preparation.read' action (staff viewing), and the read
// carries no rate limiter — exactly like the other staff reads (bill/recipes/presets).
// Realtime follows the existing pos realtime idiom: a location-scoped room receiving
// only safe itemDTO-shaped payloads. Suffix: prep_read.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../models/OpenedBottle').createIndexes();
  await require('../models/PreparationStation').createIndexes();
  await require('../models/VenuePreparationItem').createIndexes();
}

async function freshVisit(args, name) {
  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name });
  return require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: `visit-${name}` });
}

test('preparation read: staleness math (injected now), station filter, unrouted flagged, tenant isolation', { skip: !uri, timeout: 240000 }, async t => {
  await connectVenueMongo(t, 'prep_read_math');
  await indexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const preparation = require('../services/venue/preparation');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);

  const grilled = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const plain = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const mystery = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });

  const grill = await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Grill', categories: ['grill'], alertThresholdMins: 5 });
  const pass = await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Pass', isDefault: true, alertThresholdMins: 15 });

  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, published: true, category: 'grill' },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, published: true },
    { subProductId: mystery.subProductId, sizeId: mystery.sizeId, published: true, category: 'sushi' },
  ] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu(menu) });

  const visit = await freshVisit(args, 'read');
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, quantity: 1 },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1 },
    { subProductId: mystery.subProductId, sizeId: mystery.sizeId, quantity: 1 },
  ], idempotencyKey: 'accept' });
  const fired = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });
  const firedAtMs = new Date(fired.round.firedAt).getTime();

  const list = (over = {}) => preparation.listSessionPreparation({ tenantId: args.tenantId, sessionId: visit.id, actor: args.actor, ...over });

  // fresh read at the fired instant: nothing stale, waitingMs 0, full itemDTO shape
  const fresh = await list({ now: new Date(firedAtMs) });
  assert.equal(fresh.sessionId, visit.id);
  assert.equal(fresh.locationId, args.locationId);
  assert.equal(new Date(fresh.now).getTime(), firedAtMs);
  assert.equal(fresh.items.length, 3);
  const byLine = new Map(fresh.items.map(item => [item.lineId, item]));
  const grillItem = byLine.get(accepted.lines.find(l => l.subProductId === grilled.subProductId).lineId);
  const plainItem = byLine.get(accepted.lines.find(l => l.subProductId === plain.subProductId).lineId);
  const mysteryItem = byLine.get(accepted.lines.find(l => l.subProductId === mystery.subProductId).lineId);
  for (const item of [grillItem, plainItem, mysteryItem]) {
    assert.equal(item.waitingMs, 0);
    assert.equal(item.stale, false);
    assert.equal(item.state, 'pending');
    assert.equal(item.unrouted, false);
    assert.equal(item.roundId, String(fired.round.roundId));
  }
  assert.equal(grillItem.stationId, String(grill._id));
  assert.equal(grillItem.thresholdMins, 5);
  assert.equal(plainItem.stationId, String(pass._id));
  assert.equal(plainItem.thresholdMins, 15);
  assert.equal(mysteryItem.stationId, String(pass._id), 'unmapped category falls back to the default station');

  // boundary: exactly threshold minutes elapsed is NOT stale (strictly greater)
  const atThreshold = await list({ now: new Date(firedAtMs + 5 * 60000) });
  assert.equal(atThreshold.items.find(i => i.lineId === grillItem.lineId).stale, false);
  // one millisecond past the threshold is stale; waitingMs is exact
  const past = await list({ now: new Date(firedAtMs + 5 * 60000 + 1) });
  const staleGrill = past.items.find(i => i.lineId === grillItem.lineId);
  assert.equal(staleGrill.stale, true);
  assert.equal(staleGrill.waitingMs, 5 * 60000 + 1);
  // the 15-minute station is not stale at the same instant
  assert.equal(past.items.find(i => i.lineId === plainItem.lineId).stale, false);
  // 15 minutes and 1ms flips the Pass items too
  const later = await list({ now: new Date(firedAtMs + 15 * 60000 + 1) });
  assert.equal(later.items.find(i => i.lineId === plainItem.lineId).stale, true);

  // station filter: only the asked station's items come back
  const grillOnly = await list({ stationId: String(grill._id) });
  assert.equal(grillOnly.items.length, 1);
  assert.equal(grillOnly.items[0].lineId, grillItem.lineId);

  // unrouted items: a location with NO stations still lists its items, flagged
  const bare = await fixture();
  const bareItem = await beverage(bare, { currentQuantity: 5, reservedQuantity: 0 });
  const bareMenu = { sections: [{ id: 'drinks', name: 'Drinks', items: [{ subProductId: bareItem.subProductId, sizeId: bareItem.sizeId, published: true, category: 'grill' }] }] };
  await require('../models/VenueLocationProfile').create({ tenant: bare.tenantId, location: bare.locationId, menu: require('../services/venue/experience').validateMenu(bareMenu) });
  const bareVisit = await freshVisit(bare, 'bare');
  const bareAccepted = await linesService.setSessionLines({ ...bare, sessionId: bareVisit.id, expectedVersion: bareVisit.version, lines: [{ subProductId: bareItem.subProductId, sizeId: bareItem.sizeId, quantity: 1 }], idempotencyKey: 'accept' });
  await linesService.fireSessionRound({ ...bare, sessionId: bareVisit.id, expectedVersion: bareAccepted.version, idempotencyKey: 'fire' });
  const bareList = await preparation.listSessionPreparation({ tenantId: bare.tenantId, sessionId: bareVisit.id, actor: bare.actor });
  assert.equal(bareList.items.length, 1);
  assert.equal(bareList.items[0].unrouted, true);
  assert.equal(bareList.items[0].stationId, undefined);
  assert.equal(bareList.items[0].thresholdMins, null);
  assert.equal(bareList.items[0].stale, false, 'no station means no threshold — staleness is never guessed');

  // tenant isolation: another tenant's session is NOT_FOUND, never leaked
  const other = await fixture();
  await assertFails(preparation.listSessionPreparation({ tenantId: other.tenantId, sessionId: visit.id, actor: other.actor }), 'NOT_FOUND', 404);
});

test('preparation read route: auth, no-store, station filter, eligibility, isolation, unthrottled staff read', { skip: !uri, timeout: 240000 }, async t => {
  await connectVenueMongo(t, 'prep_read_http');
  await indexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);

  const grilled = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const plain = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const grill = await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Grill', categories: ['grill'], alertThresholdMins: 5 });
  await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Pass', isDefault: true });

  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, published: true, category: 'grill' },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, published: true },
  ] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu(menu) });

  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'prep-read-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const sign = actor => require('jsonwebtoken').sign({ userId: actor.userId }, process.env.JWT_SECRET);
  const headers = () => ({ Authorization: `Bearer ${sign(args.actor)}`, 'Content-Type': 'application/json' });

  const visit = await freshVisit(args, 'http');
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, quantity: 1 },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1 },
  ], idempotencyKey: 'accept' });
  await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });

  const url = `${root}/service-sessions/${visit.id}/preparation`;
  assert.equal((await fetch(url, {})).status, 401, 'no token → 401');

  const listed = await fetch(url, { headers: headers() });
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  const body = await listed.json();
  assert.equal(body.data.items.length, 2);
  assert.ok(body.data.items.every(item => typeof item.waitingMs === 'number' && item.stale === false));

  const grillOnly = await fetch(`${url}?stationId=${grill._id}`, { headers: headers() });
  assert.equal(grillOnly.status, 200);
  const grillBody = await grillOnly.json();
  assert.equal(grillBody.data.items.length, 1);
  assert.equal(grillBody.data.items[0].stationId, String(grill._id));

  // an actor whose venueDeniedActions suppress preparation.read is denied (staff viewing action)
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['preparation.read'] } });
  const denied = await fetch(url, { headers: headers() });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'VENUE_PERMISSION_DENIED');
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: [] } });

  // tenant isolation over HTTP: another tenant's token cannot read this session
  const other = await fixture();
  const foreign = await fetch(url, { headers: { Authorization: `Bearer ${sign(other.actor)}` } });
  assert.equal(foreign.status, 404);
  assert.equal((await foreign.json()).code, 'NOT_FOUND');

  // staff reads carry no command limiter — repeated reads stay 200 like bill/presets reads
  for (let i = 0; i < 8; i++) {
    const read = await fetch(url, { headers: headers() });
    assert.equal(read.status, 200);
  }
});

test('roundChangedPayload carries only safe itemDTO-shaped fields (no guest PII)', async () => {
  const { roundChangedPayload } = require('../services/venue/preparation');
  const round = { roundId: 'r1', firedAt: new Date('2026-10-27T12:00:00Z'), firedBy: 'staff', status: 'pending',
    items: [{ key: 'k', lineId: 'l1', revision: 1, name: 'Grilled', subProductId: 'sub', quantity: 2, unitPriceMinor: 1000, stationId: 'st1', note: 'no ice', choices: [{ groupId: 'g', optionId: 'o' }] },
      { key: 'k2', lineId: 'l2', revision: 1, name: 'Plain', subProductId: 'sub2', quantity: 1, unitPriceMinor: 500 }] };
  const payload = roundChangedPayload('sess', round);
  assert.deepEqual(payload, { sessionId: 'sess', roundId: 'r1', firedAt: round.firedAt, items: [
    { lineId: 'l1', revision: 1, name: 'Grilled', quantity: 2, stationId: 'st1' },
    { lineId: 'l2', revision: 1, name: 'Plain', quantity: 1 },
  ] });
});
