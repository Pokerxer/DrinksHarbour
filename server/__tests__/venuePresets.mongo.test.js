'use strict';
// Task 2 (S3) — service presets: versioned location-policy CRUD (refs only, no price/tax
// math) and the session-create snapshot {presetId, version, serviceMode}: location match,
// mode ∈ allowedModes (delivery forbidden), hours-window open (profile-hours semantics),
// required guest fields, snapshot immutability, and the new PRESET_CLOSED fail code.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const ALWAYS_OPEN = [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, opens: '00:00', closes: '23:59' }));
const baseInput = over => ({ name: 'Dinner', allowedModes: ['dine-in', 'counter_pickup'], hours: ALWAYS_OPEN, exceptions: [], requiredGuestFields: [], paymentTiming: 'deferred', ...over });

test('preset CRUD: versions, tenancy, validation errors (service level)', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'presets');
  const args = await fixture();
  const presets = require('../services/venue/presets');
  const Preset = require('../models/VenueServicePreset');
  await Preset.createIndexes();
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });

  // create round-trip: version 0, refs stored verbatim (no math)
  const created = await presets.createPreset(base({ idempotencyKey: 'preset-1', input: baseInput({ priceListRef: 'pricelist:main', taxContextRef: 'tax:lagos', prepSlotPolicy: { maxConcurrent: 4, leadMins: 30 } }) }));
  assert.equal(created.version, 0);
  assert.deepEqual(created.allowedModes, ['dine-in', 'counter_pickup']);
  assert.equal(created.priceListRef, 'pricelist:main');
  assert.equal(created.taxContextRef, 'tax:lagos');
  assert.deepEqual(created.prepSlotPolicy, { maxConcurrent: 4, leadMins: 30 });
  assert.deepEqual(created.requiredGuestFields, []);

  // duplicate name at the same location rejected; another location may reuse the name
  await assertFails(presets.createPreset(base({ idempotencyKey: 'preset-2', input: baseInput({}) })), 'INVALID_INPUT', 400);
  const userId = new mongoose.Types.ObjectId(args.actor.userId);
  const second = await require('../models/Warehouse').create({ tenant: args.tenantId, name: 'Bar 2', code: 'BAR2', isActive: true, venueStaff: [userId] });
  await presets.createPreset(base({ idempotencyKey: 'preset-3', input: baseInput({}), locationId: String(second._id) }));

  // idempotent replay: same key + same payload returns the recorded result
  const replay = await presets.createPreset(base({ idempotencyKey: 'preset-1', input: baseInput({ priceListRef: 'pricelist:main', taxContextRef: 'tax:lagos', prepSlotPolicy: { maxConcurrent: 4, leadMins: 30 } }) }));
  assert.equal(replay.id, created.id);

  // update bumps the version; stale expectedVersion → STATE_CHANGED
  const updated = await presets.updatePreset(base({ presetId: created.id, expectedVersion: 0, idempotencyKey: 'preset-4', input: baseInput({ name: 'Dinner', paymentTiming: 'per_order' }) }));
  assert.equal(updated.version, 1);
  assert.equal(updated.paymentTiming, 'per_order');
  await assertFails(presets.updatePreset(base({ presetId: created.id, expectedVersion: 0, idempotencyKey: 'preset-5', input: baseInput({}) })), 'STATE_CHANGED');

  // unknown preset → NOT_FOUND
  await assertFails(presets.updatePreset(base({ presetId: String(new mongoose.Types.ObjectId()), expectedVersion: 0, idempotencyKey: 'preset-6', input: baseInput({}) })), 'NOT_FOUND', 404);

  // listing is location-scoped
  const listing = await presets.listPresets(base({}));
  assert.equal(listing.items.length, 1);
  assert.equal(listing.items[0].id, created.id);

  // input validation rides the shared experience-validation semantics
  await assertFails(presets.createPreset(base({ idempotencyKey: 'preset-7', input: baseInput({ allowedModes: ['delivery'] }) })), 'INVALID_INPUT', 400);
  await assertFails(presets.createPreset(base({ idempotencyKey: 'preset-8', input: baseInput({ paymentTiming: 'on_receipt' }) })), 'INVALID_INPUT', 400);
  await assertFails(presets.createPreset(base({ idempotencyKey: 'preset-9', input: baseInput({ requiredGuestFields: ['email'] }) })), 'INVALID_INPUT', 400);
  await assertFails(presets.createPreset(base({ idempotencyKey: 'preset-10', input: baseInput({ hours: [{ day: 5, opens: '18:00', closes: '02:00' }] }) })), 'INVALID_INPUT', 400);
  // tenancy: another tenant cannot see or update tenant A's preset
  const other = await fixture();
  await assertFails(presets.updatePreset({ tenantId: other.tenantId, locationId: other.locationId, actor: other.actor, presetId: created.id, expectedVersion: 1, idempotencyKey: 'preset-11', input: baseInput({}) }), 'NOT_FOUND', 404);
  assert.equal(await Preset.findOne({ _id: created.id, tenant: other.tenantId }).lean(), null);
});

test('preset hours window: overnight semantics and exceptions (openAt unit)', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'presets_openat');
  const { assertPresetOpen } = require('../services/venue/presets');
  const hours = [{ day: 0, opens: '18:00', closes: '02:00', overnight: true }]; // Sunday 18:00 → Monday 02:00
  // 2026-10-25 is a Sunday; timezone pinned to UTC for determinism
  assert.doesNotThrow(() => assertPresetOpen(hours, [], new Date('2026-10-25T20:00:00Z'), 'UTC'));
  assert.doesNotThrow(() => assertPresetOpen(hours, [], new Date('2026-10-25T18:00:00Z'), 'UTC')); // opens inclusive
  assert.doesNotThrow(() => assertPresetOpen(hours, [], new Date('2026-10-26T01:59:00Z'), 'UTC')); // past midnight from Sunday's row
  assertFailsSync(() => assertPresetOpen(hours, [], new Date('2026-10-26T03:00:00Z'), 'UTC'), 'PRESET_CLOSED');
  assertFailsSync(() => assertPresetOpen(hours, [], new Date('2026-10-25T17:00:00Z'), 'UTC'), 'PRESET_CLOSED');
  // a closed exception for the local date overrides the weekday row
  assertFailsSync(() => assertPresetOpen(hours, [{ date: '2026-10-25', closed: true }], new Date('2026-10-25T20:00:00Z'), 'UTC'), 'PRESET_CLOSED');
  // an open exception replaces the weekday hours for that date
  assert.doesNotThrow(() => assertPresetOpen(hours, [{ date: '2026-10-26', opens: '00:00', closes: '23:59' }], new Date('2026-10-26T03:00:00Z'), 'UTC'));
  // no published hours = the preset never opens
  assertFailsSync(() => assertPresetOpen([], [], new Date('2026-10-25T20:00:00Z'), 'UTC'), 'PRESET_CLOSED');
});
function assertFailsSync(fn, code) { assert.throws(fn, error => codeOf(error) === code && error.statusCode === 409); }

test('session snapshot: preset/location/mode/hours/guests, immutability, no presets = unchanged', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'presets_sessions');
  const args = await fixture();
  const presets = require('../services/venue/presets');
  const service = require('../services/venue/service-sessions');
  const Preset = require('../models/VenueServicePreset');
  const Session = require('../models/VenueServiceSession');
  await Preset.createIndexes();
  const now = new Date('2026-10-27T12:00:00Z');
  const base = over => ({ ...args, actor: { ...args.actor }, idempotencyKey: 'visit-1', now, ...over });

  const preset = await presets.createPreset({ tenantId: args.tenantId, locationId: args.locationId, actor: args.actor, idempotencyKey: 'preset-s1', input: baseInput({ requiredGuestFields: ['name', 'partySize'] }) });

  // snapshot failure #1: unknown preset → NOT_FOUND
  await assertFails(service.ensureServiceSession(base({ presetId: String(new mongoose.Types.ObjectId()), serviceMode: 'dine-in', idempotencyKey: 'visit-2' })), 'NOT_FOUND', 404);
  // snapshot failure #2: delivery mode forbidden in S3 → INVALID_INPUT
  await assertFails(service.ensureServiceSession(base({ presetId: preset.id, serviceMode: 'delivery', idempotencyKey: 'visit-3' })), 'INVALID_INPUT', 400);
  // snapshot failure #3: presetId/serviceMode must travel together
  await assertFails(service.ensureServiceSession(base({ presetId: preset.id, idempotencyKey: 'visit-4' })), 'INVALID_INPUT', 400);
  await assertFails(service.ensureServiceSession(base({ serviceMode: 'dine-in', idempotencyKey: 'visit-5' })), 'INVALID_INPUT', 400);
  // snapshot failure #4: required guest fields missing → INVALID_INPUT
  await assertFails(service.ensureServiceSession(base({ presetId: preset.id, serviceMode: 'dine-in', idempotencyKey: 'visit-6' })), 'INVALID_INPUT', 400);
  // snapshot failure #5: closed hours → PRESET_CLOSED and NO visit row
  const closed = await presets.createPreset({ tenantId: args.tenantId, locationId: args.locationId, actor: args.actor, idempotencyKey: 'preset-s2', input: baseInput({ name: 'Closed all day', hours: [] }) });
  await assertFails(service.ensureServiceSession(base({ presetId: closed.id, serviceMode: 'dine-in', idempotencyKey: 'visit-7' })), 'PRESET_CLOSED', 409);
  assert.equal(await Session.countDocuments({ tenant: args.tenantId }), 0);

  // happy path: guests satisfy the required fields, snapshot written once.
  // Each successful open claims its own table (opening occupies the tables).
  const POSTable = require('../models/POSTable');
  const freshTable = async name => ({ tableIds: [String((await POSTable.create({ tenant: args.tenantId, location: args.locationId, name }))._id)], expectedTableVersions: [0] });
  const visit = await service.ensureServiceSession(base({ ...await freshTable('P1'), presetId: preset.id, serviceMode: 'dine-in', guest: { name: 'Ada', partySize: 4 }, idempotencyKey: 'visit-8' }));
  assert.equal(visit.serviceMode, 'dine-in');
  assert.equal(visit.presetId, preset.id);
  assert.equal(visit.presetVersion, 0);
  const doc = await Session.findOne({ tenant: args.tenantId }).lean();
  assert.equal(String(doc.presetRef.presetId), preset.id);
  assert.equal(doc.presetRef.version, 0);

  // snapshot immutability: later mutation attempts never take effect
  const live = await Session.findById(doc._id);
  const otherPreset = await Preset.create({ tenant: args.tenantId, location: args.locationId, name: 'Mutant', allowedModes: ['counter_pickup'], paymentTiming: 'per_order' });
  live.serviceMode = 'counter_pickup'; live.presetRef = { presetId: otherPreset._id, version: 9 };
  await live.save();
  const reloaded = await Session.findById(doc._id).lean();
  assert.equal(reloaded.serviceMode, 'dine-in');
  assert.equal(String(reloaded.presetRef.presetId), preset.id);
  assert.equal(reloaded.presetRef.version, 0);

  // a visit opened WITHOUT a preset keeps the legacy shape (existing callers unchanged)
  const legacyVisit = await service.ensureServiceSession(base({ ...await freshTable('P2'), idempotencyKey: 'visit-9' }));
  assert.equal(legacyVisit.serviceMode, undefined);
  assert.equal(legacyVisit.presetId, undefined);
  assert.equal(legacyVisit.presetVersion, undefined);
  // a preset without required guest fields needs no guest at all
  const open = await presets.createPreset({ tenantId: args.tenantId, locationId: args.locationId, actor: args.actor, idempotencyKey: 'preset-s3', input: baseInput({ name: 'Bar counter' }) });
  await service.ensureServiceSession(base({ ...await freshTable('P3'), presetId: open.id, serviceMode: 'counter_pickup', idempotencyKey: 'visit-10' }));
});

test('preset routes: auth, idempotency, versions and eligibility denial', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'presets_http');
  const args = await fixture();
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'presets-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  await require('../models/VenueServicePreset').createIndexes();

  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });
  const url = `${root}/locations/${args.locationId}/service-presets`;
  const post = (body, extra = {}) => fetch(url, { method: 'POST', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });
  const patch = (presetId, body, extra = {}) => fetch(`${url}/${presetId}`, { method: 'PATCH', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });

  assert.equal((await fetch(url, {})).status, 401); // no token
  const missingKey = await post({ input: baseInput({}) });
  assert.equal(missingKey.status, 400); assert.equal((await missingKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');

  const created = await post({ input: baseInput({}) }, { 'Idempotency-Key': 'preset-http-1' });
  assert.equal(created.status, 201);
  const preset = (await created.json()).data;
  assert.equal(preset.version, 0);
  const replay = await post({ input: baseInput({}) }, { 'Idempotency-Key': 'preset-http-1' });
  assert.equal(replay.status, 201); assert.equal((await replay.json()).data.id, preset.id);

  const updated = await patch(preset.id, { expectedVersion: 0, input: baseInput({ name: 'Dinner v2', paymentTiming: 'per_order' }) }, { 'Idempotency-Key': 'preset-http-2' });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.version, 1);
  const stale = await patch(preset.id, { expectedVersion: 0, input: baseInput({}) }, { 'Idempotency-Key': 'preset-http-3' });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'STATE_CHANGED');

  const listed = await fetch(url, { headers: headers() });
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal((await listed.json()).data.items.length, 1);

  // cross-tenant location addressing fails NOT_FOUND at eligibility
  const other = await fixture();
  const foreign = await fetch(`${root}/locations/${other.locationId}/service-presets`, { headers: headers() });
  assert.equal(foreign.status, 404); assert.equal((await foreign.json()).code, 'NOT_FOUND');

  // an actor whose venueDeniedActions suppress experience.manage is denied
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['experience.manage'] } });
  const denied = await post({ input: baseInput({ name: 'Blocked' }) }, { 'Idempotency-Key': 'preset-http-4' });
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'VENUE_PERMISSION_DENIED');
});
