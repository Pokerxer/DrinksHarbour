'use strict';
// Task 6 (S3) — station config CRUD: GET/POST/PATCH /locations/:locationId/stations
// in the batch-2 (presets) pattern — runVenueOperation idempotency, optimistic
// expectedVersion, unique {tenant, location, name}, and the spec §3 single-default
// invariant (setting a default clears the location's sibling defaults). Eligibility
// rides the S3 'stations.read'/'stations.write' ACTIONS. Suffix: stations.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const baseInput = over => ({ name: 'Grill', categories: ['grill'], staffIds: [], deviceIds: [], alertThresholdMins: 15, isDefault: false, ...over });

test('station CRUD: versions, single default, validation, tenancy (service level)', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'stations');
  const args = await fixture();
  const stations = require('../services/venue/stations');
  const Station = require('../models/PreparationStation');
  await Station.createIndexes();
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });

  // create round-trip: version 0, config stored verbatim
  const created = await stations.createStation(base({ idempotencyKey: 'station-1', input: baseInput({ staffIds: ['staff-1'], deviceIds: ['kds-1'], alertThresholdMins: 8 }) }));
  assert.equal(created.version, 0);
  assert.deepEqual(created.categories, ['grill']);
  assert.deepEqual(created.staffIds, ['staff-1']);
  assert.deepEqual(created.deviceIds, ['kds-1']);
  assert.equal(created.alertThresholdMins, 8);
  assert.equal(created.isDefault, false);

  // duplicate name at the same location rejected; another location may reuse it
  await assertFails(stations.createStation(base({ idempotencyKey: 'station-2', input: baseInput({}) })), 'INVALID_INPUT', 400);
  const userId = new mongoose.Types.ObjectId(args.actor.userId);
  const second = await require('../models/Warehouse').create({ tenant: args.tenantId, name: 'Bar 2', code: 'BAR2', isActive: true, venueStaff: [userId], venueServices: { enabled: true, reviewedAt: new Date(), canonicalCheckoutEnabled: true, capabilities: ['tables', 'tabs', 'preparation'] } });
  const elsewhere = await stations.createStation(base({ idempotencyKey: 'station-3', locationId: String(second._id), input: baseInput({}) }));
  assert.equal(elsewhere.locationId, String(second._id));

  // idempotent replay: same key + same payload returns the recorded result
  const replay = await stations.createStation(base({ idempotencyKey: 'station-1', input: baseInput({ staffIds: ['staff-1'], deviceIds: ['kds-1'], alertThresholdMins: 8 }) }));
  assert.equal(replay.id, created.id);

  // update bumps the version; stale expectedVersion → STATE_CHANGED
  const updated = await stations.updateStation(base({ stationId: created.id, expectedVersion: 0, idempotencyKey: 'station-4', input: baseInput({ name: 'Grill v2', alertThresholdMins: 4 }) }));
  assert.equal(updated.version, 1);
  assert.equal(updated.alertThresholdMins, 4);
  await assertFails(stations.updateStation(base({ stationId: created.id, expectedVersion: 0, idempotencyKey: 'station-5', input: baseInput({}) })), 'STATE_CHANGED');

  // unknown station → NOT_FOUND
  await assertFails(stations.updateStation(base({ stationId: String(new mongoose.Types.ObjectId()), expectedVersion: 0, idempotencyKey: 'station-6', input: baseInput({}) })), 'NOT_FOUND', 404);

  // listing is location-scoped
  const listing = await stations.listStations(base({}));
  assert.equal(listing.items.length, 1);
  assert.equal(listing.items[0].id, created.id);

  // single default: making one station default clears its siblings at the location
  const bar = await stations.createStation(base({ idempotencyKey: 'station-7', input: baseInput({ name: 'Bar', isDefault: true }) }));
  assert.equal(bar.isDefault, true);
  const pass = await stations.createStation(base({ idempotencyKey: 'station-8', input: baseInput({ name: 'Pass', isDefault: true }) }));
  assert.equal(pass.isDefault, true);
  assert.equal((await Station.findById(bar.id)).isDefault, false, 'the previous default was cleared');
  const defaults = await Station.countDocuments({ tenant: args.tenantId, location: args.locationId, isDefault: true });
  assert.equal(defaults, 1, 'the location keeps exactly one default station');
  // unsetting a default leaves none — routing then treats unmapped categories as unrouted
  const unset = await stations.updateStation(base({ stationId: pass.id, expectedVersion: pass.version, idempotencyKey: 'station-9', input: baseInput({ name: 'Pass', isDefault: false }) }));
  assert.equal(unset.isDefault, false);
  assert.equal(await Station.countDocuments({ tenant: args.tenantId, location: args.locationId, isDefault: true }), 0);

  // input validation rides the shared experience-validation semantics
  await assertFails(stations.createStation(base({ idempotencyKey: 'station-10', input: baseInput({ alertThresholdMins: 0 }) })), 'INVALID_INPUT', 400);
  await assertFails(stations.createStation(base({ idempotencyKey: 'station-11', input: baseInput({ alertThresholdMins: 1.5 }) })), 'INVALID_INPUT', 400);
  await assertFails(stations.createStation(base({ idempotencyKey: 'station-12', input: baseInput({ categories: ['grill', 'grill'] }) })), 'INVALID_INPUT', 400);
  await assertFails(stations.createStation(base({ idempotencyKey: 'station-13', input: baseInput({ staffIds: [''] }) })), 'INVALID_INPUT', 400);
  await assertFails(stations.createStation(base({ idempotencyKey: 'station-14', input: baseInput({ isDefault: 'yes' }) })), 'INVALID_INPUT', 400);
  await assertFails(stations.createStation(base({ idempotencyKey: 'station-15', input: { name: 'Grill', surprise: 1 } })), 'INVALID_INPUT', 400);

  // tenancy: another tenant cannot see or update tenant A's station
  const other = await fixture();
  await assertFails(stations.updateStation({ tenantId: other.tenantId, locationId: other.locationId, actor: other.actor, stationId: created.id, expectedVersion: 1, idempotencyKey: 'station-16', input: baseInput({}) }), 'NOT_FOUND', 404);
  assert.equal(await Station.findOne({ _id: created.id, tenant: other.tenantId }).lean(), null);
});

test('station routes: auth, idempotency, versions and eligibility denial', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'stations_http');
  const args = await fixture();
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'stations-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  await require('../models/PreparationStation').createIndexes();

  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });
  const url = `${root}/locations/${args.locationId}/stations`;
  const post = (body, extra = {}) => fetch(url, { method: 'POST', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });
  const patch = (stationId, body, extra = {}) => fetch(`${url}/${stationId}`, { method: 'PATCH', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });

  assert.equal((await fetch(url, {})).status, 401); // no token
  const missingKey = await post({ input: baseInput({}) });
  assert.equal(missingKey.status, 400); assert.equal((await missingKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');

  const created = await post({ input: baseInput({}) }, { 'Idempotency-Key': 'station-http-1' });
  assert.equal(created.status, 201);
  const station = (await created.json()).data;
  assert.equal(station.version, 0);
  const replay = await post({ input: baseInput({}) }, { 'Idempotency-Key': 'station-http-1' });
  assert.equal(replay.status, 201); assert.equal((await replay.json()).data.id, station.id);

  const updated = await patch(station.id, { expectedVersion: 0, input: baseInput({ name: 'Grill v2', alertThresholdMins: 6 }) }, { 'Idempotency-Key': 'station-http-2' });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.version, 1);
  const stale = await patch(station.id, { expectedVersion: 0, input: baseInput({}) }, { 'Idempotency-Key': 'station-http-3' });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'STATE_CHANGED');

  const listed = await fetch(url, { headers: headers() });
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal((await listed.json()).data.items.length, 1);

  // cross-tenant location addressing fails NOT_FOUND at eligibility
  const other = await fixture();
  const foreign = await fetch(`${root}/locations/${other.locationId}/stations`, { headers: headers() });
  assert.equal(foreign.status, 404); assert.equal((await foreign.json()).code, 'NOT_FOUND');

  // an actor whose venueDeniedActions suppress stations.write is denied
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['stations.write'] } });
  const denied = await post({ input: baseInput({ name: 'Blocked' }) }, { 'Idempotency-Key': 'station-http-4' });
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'VENUE_PERMISSION_DENIED');
});
