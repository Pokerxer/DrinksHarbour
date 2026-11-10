'use strict';
// Task 2 (S4) — HTTP bridge surface. Bridge endpoints GET/POST
// /devices/bridge/:locationId/{pending,ack} are protected by the DEDICATED
// bridge-token middleware (Bearer token minted by the staff register route;
// sha-256 hash on the location profile; timing-safe compare) — deliberately
// NOT the staff JWT chain. 401 for missing/wrong/revoked tokens, 404 for a
// wrong location, 400 for a missing deviceId. Staff routes GET
// /service-sessions/:id/print-jobs (preparation.read) and POST
// /service-sessions/:id/print-jobs/:jobId/reprint (preparation.write) ride
// the established venue-ops JWT router pattern. Suffix: print_bridge.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const crypto = require('node:crypto');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');

async function indexes() {
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../services/venue/audit-indexes').applyPrintModelIndexes(mongoose.connection.db);
  await require('../models/PreparationStation').createIndexes();
  await require('../models/VenuePreparationItem').createIndexes();
}

test('bridge http: token flow, pending delivery flags, ack no-op, staff list/reprint', { skip: !uri, timeout: 240000 }, async t => {
  await connectVenueMongo(t, 'print_bridge_http');
  await indexes();
  const args = await fixture();
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Grill', categories: ['grill'], deviceIds: ['grill-printer'] });
  await require('../models/PreparationStation').create({ tenant, location: args.locationId, name: 'Pass', isDefault: true, deviceIds: ['pass-printer'] });
  const grilled = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const plain = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: require('../services/venue/experience').validateMenu({ sections: [{ id: 'd', name: 'Drinks', items: [
    { subProductId: grilled.subProductId, sizeId: grilled.sizeId, published: true, category: 'grill' },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, published: true },
  ] }] }) });
  const other = await fixture(); // second tenant for isolation checks

  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'print-bridge-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const sign = actor => require('jsonwebtoken').sign({ userId: actor.userId }, process.env.JWT_SECRET);
  const staff = () => ({ Authorization: `Bearer ${sign(args.actor)}`, 'Content-Type': 'application/json' });

  // fire a round at service level (grill printer + pass printer jobs)
  const table = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: 'T1' });
  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table._id)], expectedTableVersions: [0], idempotencyKey: 'visit-http' });
  const lines = require('../services/venue/lines');
  const accepted = await lines.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, idempotencyKey: 'accept',
    lines: [{ subProductId: grilled.subProductId, sizeId: grilled.sizeId, quantity: 1 }, { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 1 }] });
  await lines.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });

  // register the bridge through the STAFF route → raw token shown exactly once
  const registered = await fetch(`${root}/locations/${args.locationId}/device-bridge/register`, { method: 'POST', headers: staff() });
  assert.equal(registered.status, 201);
  const { token } = (await registered.json()).data;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const stored = await require('../models/VenueLocationProfile').findOne({ tenant: args.tenantId, location: args.locationId }).lean();
  assert.equal(stored.deviceBridge.tokenHash, sha256(token), 'only the hash is stored');

  const pending = (over = {}) => fetch(`${root}/devices/bridge/${args.locationId}/pending?deviceId=grill-printer${over.query || ''}`, { headers: over.headers === null ? {} : { Authorization: `Bearer ${over.headers ?? token}` } });
  const ack = body => fetch(`${root}/devices/bridge/${args.locationId}/ack`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // 401: missing / wrong / revoked token
  assert.equal((await pending({ headers: null })).status, 401);
  assert.equal((await pending({ headers: 'nope' })).status, 401);
  // 404: wrong location (unknown id, and a foreign location without a bridge)
  assert.equal((await fetch(`${root}/devices/bridge/${String(new mongoose.Types.ObjectId())}/pending?deviceId=grill-printer`, { headers: { Authorization: `Bearer ${token}` } })).status, 404);
  assert.equal((await fetch(`${root}/devices/bridge/${other.locationId}/pending?deviceId=grill-printer`, { headers: { Authorization: `Bearer ${token}` } })).status, 404);
  // 400: missing deviceId
  assert.equal((await fetch(`${root}/devices/bridge/${args.locationId}/pending`, { headers: { Authorization: `Bearer ${token}` } })).status, 400);

  // happy path: pending returns queued jobs for THIS device and marks delivered
  const first = await pending({});
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  const firstBody = (await first.json()).data;
  assert.equal(firstBody.jobs.length, 1);
  const job = firstBody.jobs[0];
  assert.equal(job.deviceId, 'grill-printer');
  assert.equal(job.deliveryState, 'delivered');
  assert.equal(job.attempts, 1);
  assert.equal(job.recoveryDuplicate, undefined);
  assert.deepEqual(Object.keys(job.payload.items[0]).sort(), ['lineId', 'name', 'quantity', 'revision', 'stationId'], 'safe ticket payload shape');
  // redelivery is flagged as recovery — no new job is ever created
  const second = (await (await pending({})).json()).data.jobs[0];
  assert.equal(second.jobId, job.jobId);
  assert.equal(second.recoveryDuplicate, true);
  assert.equal(second.duplicateOf, job.jobId);
  assert.equal(await require('../models/PreparationPrintJob').countDocuments(), 2, 'recovery never creates a job');

  // ack: acknowledged; double ack no-op; foreign/unknown jobId → 404
  assert.equal((await ack({ jobId: job.jobId })).status, 200);
  const ackedRow = await require('../models/PreparationPrintJob').findOne({ jobId: job.jobId }).lean();
  assert.equal(ackedRow.deliveryState, 'acknowledged');
  assert.ok(ackedRow.ackAt);
  const double = await ack({ jobId: job.jobId });
  assert.equal(double.status, 200);
  const doubleRow = await require('../models/PreparationPrintJob').findOne({ jobId: job.jobId }).lean();
  assert.equal(String(doubleRow.ackAt), String(ackedRow.ackAt));
  assert.equal((await ack({ jobId: 'pj:ffffffffffffffffffff' })).status, 404);
  assert.equal(await require('../models/PreparationPrintJob').countDocuments({ tenant: new mongoose.Types.ObjectId(other.tenantId) }), 0, 'isolation: the other tenant holds no jobs of ours');
  assert.equal((await ack({ jobId: job.jobId })).status, 200, 'ack of an acknowledged job stays a no-op');

  // revoke clears the hash — the old token is then 401
  await fetch(`${root}/locations/${args.locationId}/device-bridge/revoke`, { method: 'POST', headers: staff() });
  assert.equal((await pending({})).status, 401);

  // re-register replaces the hash — old token stays unauthorized, new works
  const again = await fetch(`${root}/locations/${args.locationId}/device-bridge/register`, { method: 'POST', headers: staff() });
  const newToken = (await again.json()).data.token;
  assert.notEqual(newToken, token);
  assert.equal((await pending({ headers: token })).status, 401);
  assert.equal((await pending({ headers: newToken })).status, 200);

  // staff list: newest-first with delivery states; eligibility enforced
  const list = await fetch(`${root}/service-sessions/${visit.id}/print-jobs`, { headers: staff() });
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('cache-control'), 'no-store');
  const listed = (await list.json()).data;
  assert.ok(listed.jobs.length >= 2);
  assert.ok(listed.jobs.every(row => row.deliveryState && typeof row.jobId === 'string'));

  // staff reprint → labelled duplicate; zero new consumption events
  const ConsumptionEvent = require('../models/VenueConsumptionEvent');
  const eventsBefore = await ConsumptionEvent.countDocuments();
  const reprint = await fetch(`${root}/service-sessions/${visit.id}/print-jobs/${job.jobId}/reprint`, { method: 'POST', headers: { ...staff(), 'Idempotency-Key': 'reprint-http-1' } });
  assert.equal(reprint.status, 201);
  const reprinted = (await reprint.json()).data;
  assert.equal(reprinted.actionType, 'reprint');
  assert.equal(reprinted.duplicateOf, job.jobId);
  assert.equal(reprinted.payload.label, 'REPRINT');
  assert.equal(await ConsumptionEvent.countDocuments(), eventsBefore, 'reprint adds no consumption event');
  const reprintReplay = await fetch(`${root}/service-sessions/${visit.id}/print-jobs/${job.jobId}/reprint`, { method: 'POST', headers: { ...staff(), 'Idempotency-Key': 'reprint-http-1' } });
  assert.equal((await reprintReplay.json()).data.jobId, reprinted.jobId, 'idempotent replay returns the recorded reprint');

  // eligibility: suppressed preparation.read / preparation.write are denied
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['preparation.read'] } });
  assert.equal((await fetch(`${root}/service-sessions/${visit.id}/print-jobs`, { headers: staff() })).status, 403);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['preparation.write'] } });
  const deniedReprint = await fetch(`${root}/service-sessions/${visit.id}/print-jobs/${job.jobId}/reprint`, { method: 'POST', headers: { ...staff(), 'Idempotency-Key': 'reprint-http-2' } });
  assert.equal(deniedReprint.status, 403);
  assert.equal((await deniedReprint.json()).code, 'VENUE_PERMISSION_DENIED');
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: [] } });
  // bridge endpoints never accept the staff JWT as a bridge token
  assert.equal((await fetch(`${root}/devices/bridge/${args.locationId}/pending?deviceId=grill-printer`, { headers: staff() })).status, 401);
});
