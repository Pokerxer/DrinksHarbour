'use strict';
// Task 1 (E3) — waitlist entries: staff + public join lifecycle over the E1
// occurrence (occurrence-scoped when given, location-scoped otherwise). Covers:
// the waiting-entry lifecycle (create/edit/cancel), the UNIQUE phone per scope
// (non-sparse compound {tenant, location, occurrence, phone}: location-scoped rows
// group under occurrence null; occurrence-scoped rows are unique per occurrence),
// window validation with explicit UTC offsets (mirrors validateRequest), the
// verifiedContactRoute enum recorded NOT sent, foreign-occurrence tenancy 404s,
// the waitlists.read/write eligibility ladder ('tables' capability — a waitlist
// offer is a table promise), and the public join route riding the existing public
// request pattern (customer JWT + 10/hour limiter + channel HMAC).
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const { businessDate } = require('../services/venue/clock');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const at = n => new Date(Date.now() + n * 60000).toISOString();

async function boot(t, suffix) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC', 'venueServices.businessDayStartMinutes': 240 } });
  await require('../models/VenueWaitlistEntry').createIndexes();
  await require('../models/VenueOperation').createIndexes();
  const occurrence = await require('../models/VenueEventOccurrence').create({
    tenant: args.tenantId, location: args.locationId, eventSlug: 'afro-night', name: 'Afro Night',
    occurrenceDate: businessDate(new Date(Date.now() + 7 * 86400000), 'UTC', 240),
    startAt: new Date(Date.now() + 7 * 86400000), endAt: new Date(Date.now() + 7 * 86400000 + 4 * 3600000),
    capacity: { maxGuests: 50 }, agePolicy: { minimumAge: 18, admissionTerms: '18+ with valid ID at the door.' },
    publication: 'published', version: 0,
  });
  // public join surface: tenant slug + public listing + reviewed location profile
  await require('../models/Tenant').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.tenantId) }, { $set: { slug: 'tenant-slug', 'venueSettings.publicListed': true, 'venueSettings.requestBookingsEnabled': true } });
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $addToSet: { 'venueServices.capabilities': 'request_bookings' } });
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, slug: 'bar', version: 1, profileVersion: 1, reviewedProfileVersion: 1, reviewedBy: args.actor.userId, reviewedAt: new Date(), profile: { slug: 'bar', name: 'Bar', types: ['lounge'], timezone: 'UTC', policies: 'Request only', hours: [], exceptions: [], address: 'Abuja' } });
  const customerId = new mongoose.Types.ObjectId();
  await require('../models/User').collection.insertOne({ _id: customerId, role: 'customer', status: 'active' });
  return { ...args, occurrenceId: String(occurrence._id), customerId: String(customerId) };
}

const input = over => ({
  name: 'Ada Obi', phone: '+234 801-234-5678', partySize: 4, verifiedContactRoute: 'sms',
  window: { earliestAt: at(20), latestAt: at(300) }, ...over,
});

test('waitlist lifecycle: staff + public join, unique phone per scope, edit/cancel, tenancy', { skip: !uri }, async t => {
  const args = await boot(t, 'waitlist_ops');
  const waitlist = require('../services/venue/waitlist');
  const Entry = require('../models/VenueWaitlistEntry');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });

  // staff join: location-scoped (no occurrence) — state waiting, contact route recorded
  const latest = at(300);
  const loc = await waitlist.createStaff(base({ idempotencyKey: 'wl-1', input: input({ window: { earliestAt: at(20), latestAt: latest } }) }));
  assert.equal(loc.state, 'waiting');
  assert.equal(loc.occurrenceId, null);
  assert.equal(loc.verifiedContactRoute, 'sms');
  assert.equal(loc.offer, null);
  assert.equal(new Date(loc.window.latestAt).toISOString(), latest);

  // staff join: occurrence-scoped
  const occ = await waitlist.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'wl-2', input: input({ phone: '0802 345 6789' }) }));
  assert.equal(occ.occurrenceId, args.occurrenceId);
  assert.equal(occ.phone, '08023456789'); // normalized phone (guestlists idiom: separators stripped)

  // unique phone per scope: same occurrence + phone refused; same phone on a DIFFERENT occurrence allowed
  await assertFails(waitlist.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'wl-3', input: input({ phone: '0802 345 6789' }) })), 'INVALID_INPUT', 400);
  const second = await require('../models/VenueEventOccurrence').create({
    tenant: args.tenantId, location: args.locationId, eventSlug: 'afro-night', name: 'Afro Night II',
    occurrenceDate: businessDate(new Date(Date.now() + 8 * 86400000), 'UTC', 240),
    startAt: new Date(Date.now() + 8 * 86400000), endAt: new Date(Date.now() + 8 * 86400000 + 4 * 3600000),
    capacity: { maxGuests: 50 }, agePolicy: { admissionTerms: 'Doors at the venue.' }, publication: 'published',
  });
  const rejoin = await waitlist.createStaff(base({ occurrenceId: String(second._id), idempotencyKey: 'wl-4', input: input({}) }));
  assert.equal(rejoin.occurrenceId, String(second._id));

  // location-scoped uniqueness: two occurrence-null rows with the same phone collide (index groups nulls)
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wl-5', input: input({}) })), 'INVALID_INPUT', 400);
  const distinct = await waitlist.createStaff(base({ idempotencyKey: 'wl-6', input: input({ phone: '+2348055550000' }) }));
  assert.equal(distinct.state, 'waiting');

  // window validation: explicit offsets (validateRequest rule), ordering, future horizon
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wl-7', input: input({ window: { earliestAt: new Date(Date.now() + 3600000).toISOString(), latestAt: new Date(Date.now() + 7200000).toISOString() } }) })), 'INVALID_INPUT', 400); // offset-less instants
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wl-8', input: input({ window: { earliestAt: at(300), latestAt: at(20) } }) })), 'INVALID_INPUT', 400); // latest before earliest
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wl-9', input: input({ window: { earliestAt: at(20), latestAt: new Date(Date.now() + 200 * 86400000).toISOString() } }) })), 'INVALID_INPUT', 400); // beyond 180 days
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wl-10', input: input({ verifiedContactRoute: 'whatsapp' }) })), 'INVALID_INPUT', 400); // enum
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wl-11', input: input({ partySize: 0 }) })), 'INVALID_INPUT', 400);

  // edit (waiting only, version-checked) and cancel
  const edited = await waitlist.patch(base({ entryId: loc.id, expectedVersion: 0, idempotencyKey: 'wl-12', input: input({ partySize: 6, phone: '+2348012345678' }) }));
  assert.equal(edited.partySize, 6);
  assert.equal(edited.version, 1);
  await assertFails(waitlist.patch(base({ entryId: loc.id, expectedVersion: 0, idempotencyKey: 'wl-13', input: input({}) })), 'STATE_CHANGED', 409);
  const cancelled = await waitlist.patch(base({ entryId: loc.id, expectedVersion: 1, cancel: true, idempotencyKey: 'wl-14' }));
  assert.equal(cancelled.state, 'cancelled');
  await assertFails(waitlist.patch(base({ entryId: loc.id, expectedVersion: 2, cancel: true, idempotencyKey: 'wl-15' })), 'STATE_CHANGED', 409); // cancel is one-way

  // foreign occurrence (another location/tenant) refused; tenancy 404s
  await assertFails(waitlist.createStaff(base({ occurrenceId: String(new mongoose.Types.ObjectId()), idempotencyKey: 'wl-16', input: input({}) })), 'NOT_FOUND', 404);
  const other = await fixture();
  const foreignList = await waitlist.list({ tenantId: other.tenantId, locationId: other.locationId, actor: { ...other.actor }, occurrenceId: args.occurrenceId });
  assert.deepEqual(foreignList.items, []);
  await assertFails(waitlist.patch({ tenantId: other.tenantId, locationId: other.locationId, actor: { ...other.actor }, entryId: occ.id, expectedVersion: 0, idempotencyKey: 'wl-17', cancel: true }), 'NOT_FOUND', 404);
  assert.equal(await Entry.findOne({ _id: occ.id, tenant: other.tenantId }).lean(), null);

  // listing scoped by tenant/location (+ optional occurrence & state filters, cursor page)
  const listed = await waitlist.list(base({}));
  assert.equal(listed.items.length, 4); // occ + rejoin + distinct + cancelled loc (all states listed)
  const waitingOnly = await waitlist.list(base({ state: 'waiting' }));
  assert.equal(waitingOnly.items.length, 3);
  const occOnly = await waitlist.list(base({ occurrenceId: String(second._id) }));
  assert.deepEqual(occOnly.items.map(row => row.name), ['Ada Obi']);
  // public join rides the public request pattern (service level; route covered below)
  const joined = await waitlist.submitPublic({ slug: 'tenant-slug', locationSlug: 'bar', occurrenceId: args.occurrenceId, customerId: args.customerId, idempotencyKey: 'wl-18', input: input({ phone: '+2348077770000' }) });
  assert.equal(joined.state, 'waiting');
  assert.equal(joined.occurrenceId, args.occurrenceId);
  assert.equal(joined.createdBy, args.customerId); // the joining customer, never a staff attribution
  await assertFails(waitlist.submitPublic({ slug: 'tenant-slug', locationSlug: 'bar', occurrenceId: args.occurrenceId, customerId: args.customerId, idempotencyKey: 'wl-19', input: input({ phone: '+2348077770000' }) }), 'INVALID_INPUT', 400);
});

test('waitlist eligibility ladder: tables capability + denied actions', { skip: !uri }, async t => {
  const args = await boot(t, 'waitlist_ops_elig');
  const waitlist = require('../services/venue/waitlist');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $pull: { 'venueServices.capabilities': 'tables' } });
  await assertFails(waitlist.list(base({})), 'VENUE_NOT_CONFIGURED', 403);
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wle-1', input: input({}) })), 'VENUE_NOT_CONFIGURED', 403);
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $addToSet: { 'venueServices.capabilities': 'tables' } });
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['waitlists.write'] } });
  await assertFails(waitlist.createStaff(base({ idempotencyKey: 'wle-2', input: input({}) })), 'VENUE_PERMISSION_DENIED', 403);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['waitlists.read'] } });
  await assertFails(waitlist.list(base({})), 'VENUE_PERMISSION_DENIED', 403);
});

test('waitlist HTTP: staff routes idempotent; public join rides auth + channel + limiter', { skip: !uri }, async t => {
  const args = await boot(t, 'waitlist_ops_http');
  const previous = { JWT_SECRET: process.env.JWT_SECRET, VENUE_EXPERIENCE_ENABLED: process.env.VENUE_EXPERIENCE_ENABLED, VENUE_CHANNEL_SECRET: process.env.VENUE_CHANNEL_SECRET };
  process.env.JWT_SECRET = 'waitlist-http-test-only';
  process.env.VENUE_CHANNEL_SECRET = 'waitlist-channel-test-only';
  process.env.VENUE_EXPERIENCE_ENABLED = 'true';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json());
  app.use('/api/venue-experience', require('../routes/venue-experience.routes'));
  app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const staffHeaders = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });

  // staff create: 401 anonymous, Idempotency-Key required, 201 + replay.
  // The create/replay pair shares ONE body — the window instants must be
  // byte-identical for the idempotency replay hash (the E1 lesson).
  const createBody = JSON.stringify({ input: input({}) });
  const staffUrl = `${root}/api/venue-ops/locations/${args.locationId}/waitlist`;
  assert.equal((await fetch(staffUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: createBody })).status, 401);
  const missingKey = await fetch(staffUrl, { method: 'POST', headers: staffHeaders(), body: JSON.stringify({ input: input({}) }) });
  assert.equal(missingKey.status, 400); assert.equal((await missingKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');
  const created = await fetch(staffUrl, { method: 'POST', headers: { ...staffHeaders(), 'Idempotency-Key': 'wl-http-1' }, body: createBody });
  assert.equal(created.status, 201);
  const row = (await created.json()).data;
  assert.equal(row.state, 'waiting');
  const replay = await fetch(staffUrl, { method: 'POST', headers: { ...staffHeaders(), 'Idempotency-Key': 'wl-http-1' }, body: createBody });
  assert.equal(replay.status, 201); assert.equal((await replay.json()).data.id, row.id);

  // PATCH edit + listing (no-store, scoped)
  const patched = await fetch(`${staffUrl}/${row.id}`, { method: 'PATCH', headers: { ...staffHeaders(), 'Idempotency-Key': 'wl-http-2' }, body: JSON.stringify({ expectedVersion: 0, input: input({ partySize: 2 }) }) });
  assert.equal(patched.status, 200); assert.equal((await patched.json()).data.partySize, 2);
  const listed = await fetch(`${staffUrl}?state=waiting`, { headers: staffHeaders() });
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal((await listed.json()).data.items.length, 1);

  // public join: 401 anonymous; channel HMAC + customer JWT on the happy path; duplicate → 400
  const publicUrl = `${root}/api/venue-experience/public/tenant-slug/bar/waitlist`;
  const anon = await fetch(publicUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: input({}) }) });
  assert.equal(anon.status, 401);
  const crypto = require('node:crypto');
  const body = JSON.stringify({ input: input({ phone: '+2348090000000' }) });
  const channelHeaders = () => { const issued = String(Math.floor(Date.now() / 1000)); return { 'x-venue-channel': 'direct', 'x-venue-issued': issued, 'x-venue-signature': crypto.createHmac('sha256', process.env.VENUE_CHANNEL_SECRET).update(['direct', 'tenant-slug', 'bar', issued, body].join('\n')).digest('hex') }; };
  const customerToken = require('jsonwebtoken').sign({ userId: args.customerId }, process.env.JWT_SECRET);
  const missingKey2 = await fetch(publicUrl, { method: 'POST', headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json', ...channelHeaders() }, body });
  assert.equal(missingKey2.status, 400); assert.equal((await missingKey2.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');
  const joined = await fetch(publicUrl, { method: 'POST', headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'wl-http-3', ...channelHeaders() }, body });
  assert.equal(joined.status, 201);
  const joinedRow = (await joined.json()).data;
  assert.equal(joinedRow.state, 'waiting');
  assert.equal(joinedRow.occurrenceId, null); // the minimal public route joins the LOCATION scope (occurrence optional in the body)

  // cross-tenant location addressing fails NOT_FOUND at eligibility
  const other = await fixture();
  const foreign = await fetch(`${root}/api/venue-ops/locations/${other.locationId}/waitlist`, { headers: staffHeaders() });
  assert.equal(foreign.status, 404); assert.equal((await foreign.json()).code, 'NOT_FOUND');
});
