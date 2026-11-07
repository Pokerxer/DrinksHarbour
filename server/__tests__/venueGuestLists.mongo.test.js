'use strict';
// Task 1 (E2) — guest lists: public request→staff approval lifecycle over the E1
// occurrence. Covers: request→approve→entitlement-ready state machine, approval past
// cutoff refused, duplicate phone per occurrence (unique {tenant, occurrence, phone}),
// VIP provenance triple (flagged requires reason/by/at), promoter/staff assignment
// (opaque attribution, never ownership), tenancy 404s, the guestlists.read/write
// eligibility ladder ('events' capability, S3 stations.* precedent), and the public
// submit route riding the existing public request pattern (protect + 10/hour limiter).
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const { businessDate } = require('../services/venue/clock');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const plusDays = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };
const inDays = (n, hours = 20) => new Date(`${businessDate(plusDays(n), 'UTC', 240)}T${String(hours).padStart(2, '0')}:00:00.000Z`).toISOString();

async function boot(t, suffix) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC', 'venueServices.businessDayStartMinutes': 240 }, $addToSet: { 'venueServices.capabilities': 'events' } });
  await require('../models/VenueEventOccurrence').createIndexes();
  await require('../models/VenueEventGuestList').createIndexes();
  await require('../models/VenueOperation').createIndexes();
  const occurrence = await require('../models/VenueEventOccurrence').create({
    tenant: args.tenantId, location: args.locationId, eventSlug: 'afro-night', name: 'Afro Night',
    occurrenceDate: businessDate(plusDays(7), 'UTC', 240),
    startAt: plusDays(7), endAt: new Date(plusDays(7).getTime() + 4 * 3600000),
    capacity: { maxGuests: 50 }, agePolicy: { minimumAge: 18, admissionTerms: '18+ with valid ID at the door.' },
    publication: 'published', version: 0,
  });
  // public submit surface: tenant slug + public listing + reviewed location profile
  await require('../models/Tenant').collection.updateOne({ _id: new mongoose.Types.ObjectId(args.tenantId) }, { $set: { slug: 'tenant-slug', 'venueSettings.publicListed': true, 'venueSettings.requestBookingsEnabled': true } });
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $addToSet: { 'venueServices.capabilities': 'request_bookings' } });
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, slug: 'bar', version: 1, profileVersion: 1, reviewedProfileVersion: 1, reviewedBy: args.actor.userId, reviewedAt: new Date(), profile: { slug: 'bar', name: 'Bar', types: ['lounge'], timezone: 'UTC', policies: 'Request only', hours: [], exceptions: [], address: 'Abuja' } });
  const customerId = new mongoose.Types.ObjectId();
  await require('../models/User').collection.insertOne({ _id: customerId, role: 'customer', status: 'active' });
  return { ...args, occurrenceId: String(occurrence._id), customerId: String(customerId) };
}

const input = over => ({ name: 'Ada Obi', phone: '+234 801-234-5678', partySize: 4, ...over });

test('guest list lifecycle: public request → approve (cutoff, allowedCount, vip provenance) → deny/cancel; duplicates; tenancy', { skip: !uri }, async t => {
  const args = await boot(t, 'guest_lists');
  const guestlists = require('../services/venue/guestlists');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });

  // public submit: normalized phone, state 'requested', cutoff not yet set
  const submitted = await guestlists.submitPublic({ slug: 'tenant-slug', locationSlug: 'bar', occurrenceId: args.occurrenceId, customerId: args.customerId, idempotencyKey: 'gl-1', input: input({}) });
  assert.equal(submitted.state, 'requested');
  assert.equal(submitted.phone, '+2348012345678');
  assert.equal(submitted.cutoffAt, null);
  assert.equal(submitted.occurrenceId, args.occurrenceId);
  assert.equal(submitted.allowedCount, null);

  // approve: cutoff required and must be in the future; allowedCount defaults to partySize
  await assertFails(guestlists.approve(base({ guestListId: submitted.id, expectedVersion: 0, idempotencyKey: 'gl-2', input: {} })), 'INVALID_INPUT', 400);
  await assertFails(guestlists.approve(base({ guestListId: submitted.id, expectedVersion: 0, idempotencyKey: 'gl-3', input: { cutoffAt: inDays(0, 0) } })), 'INVALID_INPUT', 400); // cutoff in the past
  const approved = await guestlists.approve(base({ guestListId: submitted.id, expectedVersion: 0, idempotencyKey: 'gl-4', input: { cutoffAt: inDays(6) } }));
  assert.equal(approved.state, 'approved');
  assert.equal(approved.allowedCount, 4);
  assert.equal(new Date(approved.cutoffAt).toISOString(), inDays(6));
  // allowedCount above partySize refused; version drift → STATE_CHANGED
  await assertFails(guestlists.approve(base({ guestListId: submitted.id, expectedVersion: 1, idempotencyKey: 'gl-5', input: { cutoffAt: inDays(6), allowedCount: 5 } })), 'INVALID_INPUT', 400);
  // approving an already-approved row refuses (approval is a one-way gate)
  await assertFails(guestlists.approve(base({ guestListId: submitted.id, expectedVersion: 1, idempotencyKey: 'gl-6', input: { cutoffAt: inDays(6) } })), 'STATE_CHANGED', 409);

  // duplicate phone per occurrence refused (different occurrence is a new list)
  await assertFails(guestlists.submitPublic({ slug: 'tenant-slug', locationSlug: 'bar', occurrenceId: args.occurrenceId, customerId: args.customerId, idempotencyKey: 'gl-7', input: input({ name: 'Ada Again' }) }), 'INVALID_INPUT', 400);

  // deny and cancel transitions with version checks
  const second = await guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'gl-8', input: input({ name: 'Bola', phone: '0802 345 6789', partySize: 2 }) }));
  assert.equal(second.state, 'requested');
  await assertFails(guestlists.deny(base({ guestListId: second.id, expectedVersion: 9, idempotencyKey: 'gl-9' })), 'STATE_CHANGED', 409);
  const denied = await guestlists.deny(base({ guestListId: second.id, expectedVersion: 0, idempotencyKey: 'gl-10' }));
  assert.equal(denied.state, 'denied');
  const third = await guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'gl-11', input: input({ name: 'Chidi', phone: '+2348033456789', partySize: 2 }) }));
  const cancelled = await guestlists.cancel(base({ guestListId: third.id, expectedVersion: 0, idempotencyKey: 'gl-12' }));
  assert.equal(cancelled.state, 'cancelled');

  // vip provenance triple: flagging requires reason/by/at (model-level)
  const fourth = await guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'gl-13', input: input({ name: 'Derin', phone: '+2348044567890', partySize: 6 }) }));
  const flagged = await guestlists.flagVip(base({ guestListId: fourth.id, expectedVersion: 0, idempotencyKey: 'gl-14', flagged: true, reason: 'Birthday table host' }));
  assert.equal(flagged.vip.flagged, true);
  assert.equal(flagged.vip.reason, 'Birthday table host');
  assert.ok(flagged.vip.by);
  assert.ok(flagged.vip.at);
  const GuestList = require('../models/VenueEventGuestList');
  await assert.rejects(GuestList.create({ tenant: new mongoose.Types.ObjectId(args.tenantId), location: args.locationId, occurrence: args.occurrenceId, name: 'Zed', phone: '+2348099999999', partySize: 2, state: 'approved', cutoffAt: new Date(), vip: { flagged: true } }), error => error.name === 'ValidationError' && !!error.errors['vip.reason']);
  const unflagged = await guestlists.flagVip(base({ guestListId: fourth.id, expectedVersion: 1, idempotencyKey: 'gl-15', flagged: false }));
  assert.equal(unflagged.vip.flagged, false);

  // assignments: staff + opaque promoter attribution (never ownership/commission)
  const staffed = await guestlists.assignStaff(base({ guestListId: fourth.id, expectedVersion: 2, idempotencyKey: 'gl-16', staffId: args.actor.userId }));
  assert.equal(staffed.assignedStaffId, args.actor.userId);
  const promoted = await guestlists.assignPromoter(base({ guestListId: fourth.id, expectedVersion: 3, idempotencyKey: 'gl-17', promoterRef: { id: 'promo:twelve', name: 'Twelve Promotions' } }));
  assert.deepEqual(promoted.promoterRef, { id: 'promo:twelve', name: 'Twelve Promotions' });
  await assertFails(guestlists.assignPromoter(base({ guestListId: fourth.id, expectedVersion: 4, idempotencyKey: 'gl-18', promoterRef: { id: 'x'.repeat(101), name: 'P' } })), 'INVALID_INPUT', 400);

  // listing scoped by tenant/location (+ optional occurrence & state filters)
  const listed = await guestlists.list(base({ occurrenceId: args.occurrenceId }));
  assert.equal(listed.items.length, 4);
  const approvedOnly = await guestlists.list(base({ occurrenceId: args.occurrenceId, state: 'approved' }));
  assert.deepEqual(approvedOnly.items.map(row => row.name), ['Ada Obi']);
  const other = await fixture();
  // the foreign location carries the events capability too, so the denials below are
  // service-level tenancy 404s (not eligibility configuration denials) — E1 discipline
  await require('../models/Warehouse').updateOne({ _id: other.locationId }, { $addToSet: { 'venueServices.capabilities': 'events' } });
  const foreignList = await guestlists.list({ tenantId: other.tenantId, locationId: other.locationId, actor: { ...other.actor }, occurrenceId: args.occurrenceId });
  assert.deepEqual(foreignList.items, []); // tenant-scoped: the other tenant sees none of tenant A's lists
  await assertFails(guestlists.approve({ tenantId: other.tenantId, locationId: other.locationId, actor: { ...other.actor }, guestListId: submitted.id, expectedVersion: 1, idempotencyKey: 'gl-19', input: { cutoffAt: inDays(6) } }), 'NOT_FOUND', 404);
});

test('guest list eligibility ladder: events capability + denied actions', { skip: !uri }, async t => {
  const args = await boot(t, 'guest_lists_elig');
  const guestlists = require('../services/venue/guestlists');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $pull: { 'venueServices.capabilities': 'events' } });
  await assertFails(guestlists.list(base({ occurrenceId: args.occurrenceId })), 'VENUE_NOT_CONFIGURED', 403);
  await assertFails(guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'gle-1', input: input({}) })), 'VENUE_NOT_CONFIGURED', 403);
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $addToSet: { 'venueServices.capabilities': 'events' } });
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['guestlists.write'] } });
  await assertFails(guestlists.createStaff(base({ occurrenceId: args.occurrenceId, idempotencyKey: 'gle-2', input: input({}) })), 'VENUE_PERMISSION_DENIED', 403);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['guestlists.read'] } });
  await assertFails(guestlists.list(base({ occurrenceId: args.occurrenceId })), 'VENUE_PERMISSION_DENIED', 403);
});

test('guest list HTTP: public submit rides the public request pattern (auth + limiter); staff routes idempotent', { skip: !uri }, async t => {
  const args = await boot(t, 'guest_lists_http');
  const previous = { JWT_SECRET: process.env.JWT_SECRET, VENUE_EXPERIENCE_ENABLED: process.env.VENUE_EXPERIENCE_ENABLED, VENUE_CHANNEL_SECRET: process.env.VENUE_CHANNEL_SECRET };
  process.env.JWT_SECRET = 'guestlists-http-test-only';
  process.env.VENUE_CHANNEL_SECRET = 'guestlists-channel-test-only';
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

  // public submit needs a customer token (401 anonymous) and the request pattern's
  // channel HMAC + 10/hour limiter (exactly the booking-requests shape)
  const publicUrl = `${root}/api/venue-experience/public/tenant-slug/bar/events/${args.occurrenceId}/guest-lists`;
  const crypto = require('node:crypto');
  const anon = await fetch(publicUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: input({}) }) });
  assert.equal(anon.status, 401);
  const body = JSON.stringify({ input: input({}) });
  const issued = String(Math.floor(Date.now() / 1000));
  const channelHeaders = () => ({ 'x-venue-channel': 'direct', 'x-venue-issued': issued, 'x-venue-signature': crypto.createHmac('sha256', process.env.VENUE_CHANNEL_SECRET).update(['direct', 'tenant-slug', 'bar', issued, body].join('\n')).digest('hex') });
  const customerToken = require('jsonwebtoken').sign({ userId: args.customerId }, process.env.JWT_SECRET);
  const missingKey = await fetch(publicUrl, { method: 'POST', headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json', ...channelHeaders() }, body });
  assert.equal(missingKey.status, 400); assert.equal((await missingKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');
  const created = await fetch(publicUrl, { method: 'POST', headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'gl-http-1', ...channelHeaders() }, body });
  assert.equal(created.status, 201);
  const row = (await created.json()).data;
  assert.equal(row.state, 'requested');

  // staff approve over the venue-ops route; replay is idempotent
  const approveUrl = `${root}/api/venue-ops/locations/${args.locationId}/guest-lists/${row.id}/approve`;
  const approved = await fetch(approveUrl, { method: 'POST', headers: { ...staffHeaders(), 'Idempotency-Key': 'gl-http-2' }, body: JSON.stringify({ expectedVersion: 0, input: { cutoffAt: inDays(6) } }) });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).data.state, 'approved');
  const replay = await fetch(approveUrl, { method: 'POST', headers: { ...staffHeaders(), 'Idempotency-Key': 'gl-http-2' }, body: JSON.stringify({ expectedVersion: 0, input: { cutoffAt: inDays(6) } }) });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).data.id, row.id);

  // staff listing is no-store, scoped, and filters by state
  const listed = await fetch(`${root}/api/venue-ops/locations/${args.locationId}/guest-lists?occurrenceId=${args.occurrenceId}`, { headers: staffHeaders() });
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal((await listed.json()).data.items.length, 1);
});
