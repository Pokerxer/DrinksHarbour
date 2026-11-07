'use strict';
// Task 2 (E1) — occurrence service + routes: versioned CRUD over
// VenueEventOccurrence with clock.businessDate venue-local service dates (midnight-
// spilling ends keep the ORIGINAL service date), publication gates (draft→published on
// update; published→cancelled ONLY via explicit cancel; cancelled/past occurrences
// refuse mutation with EVENT_CLOSED), runVenueOperation idempotency, date-range
// listing, and the events.read/events.write eligibility ladder ('events' location
// capability, like S3's stations.* → preparation mapping). HTTP coverage follows the
// venuePresets.mongo.test.js pattern. Fail codes: EVENT_CLOSED (409) = any mutation
// against a closed occurrence (service date elapsed OR cancelled); INVALID_INPUT
// (400); NOT_FOUND (404); STATE_CHANGED (409) on version drift.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const { businessDate } = require('../services/venue/clock');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));
const plusDays = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };
const dateOf = d => d.toISOString().slice(0, 10);
// Deterministic base window: the SAME startAt/endAt strings on every call, so
// runVenueOperation replays (key + payload hash) actually match.
const WINDOW = { startAt: plusDays(7).toISOString(), endAt: new Date(plusDays(7).getTime() + 3 * 3600000).toISOString() };
const input = over => ({ eventSlug: 'afro-night', name: 'Afro Night', startAt: WINDOW.startAt, endAt: WINDOW.endAt, capacity: { maxGuests: 200, maxTables: 10 }, agePolicy: { minimumAge: 18, admissionTerms: '18+ with valid ID at the door.' }, ...over });
const TERMS = '18+ with valid ID at the door.';

async function boot(t, suffix) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  // deterministic business-date math: UTC venue with the 04:00 night-service cutoff
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC', 'venueServices.businessDayStartMinutes': 240 }, $addToSet: { 'venueServices.capabilities': 'events' } });
  await require('../models/VenueEventOccurrence').createIndexes();
  await require('../models/VenueOperation').createIndexes();
  return args;
}

test('occurrence CRUD: business dates, versioning, publication gates, EVENT_CLOSED, cancel idempotency, tenancy, date-range list', { skip: !uri }, async t => {
  const args = await boot(t, 'events_ops');
  const events = require('../services/venue/events');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });

  // create round-trip: version 0 draft; occurrenceDate derived from startAt under UTC + 04:00 cutoff
  const startAt = plusDays(7);
  const created = await events.createOccurrence(base({ idempotencyKey: 'ev-1', input: input({ startAt: startAt.toISOString() }) }));
  assert.equal(created.version, 0);
  assert.equal(created.publication, 'draft');
  assert.equal(created.occurrenceDate, businessDate(startAt, 'UTC', 240));
  assert.deepEqual(created.capacity, { maxGuests: 200, maxTables: 10 });
  assert.deepEqual(created.agePolicy, { minimumAge: 18, admissionTerms: TERMS });

  // duplicate slug+service-date refused; the next date is a NEW occurrence
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-2', input: input({ startAt: startAt.toISOString() }) })), 'INVALID_INPUT', 400);
  await events.createOccurrence(base({ idempotencyKey: 'ev-3', input: input({ eventSlug: 'afro-night-2', startAt: plusDays(14).toISOString(), endAt: new Date(plusDays(14).getTime() + 3 * 3600000).toISOString() }) }));

  // idempotent replay: same key + payload returns the recorded result
  const replay = await events.createOccurrence(base({ idempotencyKey: 'ev-1', input: input({ startAt: startAt.toISOString() }) }));
  assert.equal(replay.id, created.id);

  // validation: offset rule, interval, mismatched supplied date, unknown room
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-4', input: input({ startAt: plusDays(7).toISOString().replace(/Z$/, '') }) })), 'INVALID_INPUT', 400);
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-5', input: input({ endAt: plusDays(7).toISOString() }) })), 'INVALID_INPUT', 400);
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-6', input: input({ occurrenceDate: '2099-01-01' }) })), 'INVALID_INPUT', 400);
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-7', input: input({ room: String(new mongoose.Types.ObjectId()) }) })), 'NOT_FOUND', 404);
  // past service date → EVENT_CLOSED at creation
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-8', input: input({ startAt: plusDays(-5).toISOString(), endAt: new Date(plusDays(-5).getTime() + 3600000).toISOString() }) })), 'EVENT_CLOSED', 409);

  // FRIDAY-NIGHT ACCEPTANCE: a Friday 22:00 start ending Saturday 02:00 (past midnight)
  // keeps the ORIGINAL Friday venue-local service date.
  const friday = plusDays(1); while (friday.getUTCDay() !== 5) friday.setUTCDate(friday.getUTCDate() + 1);
  const fridayStart = new Date(friday); fridayStart.setUTCHours(22, 0, 0, 0);
  const saturdayEnd = new Date(fridayStart.getTime() + 4 * 3600000);
  assert.ok(dateOf(saturdayEnd) !== dateOf(fridayStart)); // the end really spills past midnight
  const late = await events.createOccurrence(base({ idempotencyKey: 'ev-9', input: input({ eventSlug: 'friday-late', name: 'Friday Late', startAt: fridayStart.toISOString(), endAt: saturdayEnd.toISOString() }) }));
  assert.equal(late.occurrenceDate, dateOf(friday));
  // a start INSIDE the cutoff window (Saturday 02:30, cutoff 04:00) also rolls back to Friday
  const insideCutoff = await events.createOccurrence(base({ idempotencyKey: 'ev-10', input: input({ eventSlug: 'friday-after-hours', startAt: saturdayEnd.toISOString(), endAt: new Date(saturdayEnd.getTime() + 3600000).toISOString() }) }));
  assert.equal(insideCutoff.occurrenceDate, dateOf(friday));
  // ...but a supplied occurrenceDate of the SATURDAY calendar date is refused (must be the derived service date)
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-11', input: input({ eventSlug: 'friday-mislabeled', startAt: fridayStart.toISOString(), endAt: saturdayEnd.toISOString(), occurrenceDate: dateOf(saturdayEnd) }) })), 'INVALID_INPUT', 400);

  // publication gates: draft→published via update; unpublish forbidden; cancelled only via cancel
  const published = await events.updateOccurrence(base({ occurrenceId: created.id, expectedVersion: 0, idempotencyKey: 'ev-12', input: input({ publication: 'published' }) }));
  assert.equal(published.version, 1);
  assert.equal(published.publication, 'published');
  await assertFails(events.updateOccurrence(base({ occurrenceId: created.id, expectedVersion: 1, idempotencyKey: 'ev-13', input: input({ publication: 'draft' }) })), 'INVALID_INPUT', 400);
  await assertFails(events.updateOccurrence(base({ occurrenceId: created.id, expectedVersion: 1, idempotencyKey: 'ev-14', input: input({ publication: 'cancelled' }) })), 'INVALID_INPUT', 400);
  const bumped = await events.updateOccurrence(base({ occurrenceId: created.id, expectedVersion: 1, idempotencyKey: 'ev-15', input: input({ name: 'Afro Night Deluxe', publication: 'published' }) }));
  assert.equal(bumped.version, 2);
  assert.equal(bumped.name, 'Afro Night Deluxe');
  // version drift → STATE_CHANGED
  await assertFails(events.updateOccurrence(base({ occurrenceId: created.id, expectedVersion: 0, idempotencyKey: 'ev-16', input: input({}) })), 'STATE_CHANGED');

  // cancel: sets cancelledAt, bumps version; re-cancel is idempotent (no second bump)
  const cancelled = await events.cancelOccurrence(base({ occurrenceId: created.id, idempotencyKey: 'ev-17' }));
  assert.equal(cancelled.publication, 'cancelled');
  assert.equal(cancelled.version, 3);
  assert.ok(cancelled.cancelledAt);
  const again = await events.cancelOccurrence(base({ occurrenceId: created.id, idempotencyKey: 'ev-18' }));
  assert.equal(again.version, 3);
  assert.equal(new Date(again.cancelledAt).getTime(), new Date(cancelled.cancelledAt).getTime());
  const replayed = await events.cancelOccurrence(base({ occurrenceId: created.id, idempotencyKey: 'ev-17' }));
  assert.equal(replayed.id, created.id);
  // cancelled occurrences are immutable
  await assertFails(events.updateOccurrence(base({ occurrenceId: created.id, expectedVersion: 3, idempotencyKey: 'ev-19', input: input({}) })), 'EVENT_CLOSED', 409);
  // cancel of a DRAFT is refused
  await assertFails(events.cancelOccurrence(base({ occurrenceId: late.id, idempotencyKey: 'ev-20' })), 'INVALID_INPUT', 400);

  // past-date occurrences refuse EVERY mutation with EVENT_CLOSED
  const Occurrence = require('../models/VenueEventOccurrence');
  const pastDate = businessDate(new Date(Date.now() - 5 * 86400000), 'UTC', 240);
  const past = await Occurrence.create({ tenant: args.tenantId, location: args.locationId, eventSlug: 'old-night', name: 'Old Night', occurrenceDate: pastDate, startAt: plusDays(-5), endAt: new Date(plusDays(-5).getTime() + 3600000), capacity: { maxGuests: 50 }, agePolicy: { admissionTerms: '18+' }, publication: 'published', version: 0 });
  await assertFails(events.updateOccurrence(base({ occurrenceId: String(past._id), expectedVersion: 0, idempotencyKey: 'ev-21', input: input({ eventSlug: 'old-night' }) })), 'EVENT_CLOSED', 409);
  await assertFails(events.cancelOccurrence(base({ occurrenceId: String(past._id), idempotencyKey: 'ev-22' })), 'EVENT_CLOSED', 409);

  // get + date-range listing are tenant/location scoped
  const got = await events.getOccurrence(base({ occurrenceId: created.id }));
  assert.equal(got.id, created.id);
  await assertFails(events.getOccurrence(base({ occurrenceId: String(new mongoose.Types.ObjectId()) })), 'NOT_FOUND', 404);
  const other = await fixture();
  // the foreign location carries the events capability too, so the denial below is the
  // service-level tenancy 404 (not an eligibility configuration denial) — presets discipline
  await require('../models/Warehouse').updateOne({ _id: other.locationId }, { $addToSet: { 'venueServices.capabilities': 'events' } });
  await assertFails(events.getOccurrence({ tenantId: other.tenantId, locationId: other.locationId, actor: { ...other.actor }, occurrenceId: created.id }), 'NOT_FOUND', 404);
  await assertFails(events.updateOccurrence({ tenantId: other.tenantId, locationId: other.locationId, actor: { ...other.actor }, occurrenceId: created.id, expectedVersion: 3, idempotencyKey: 'ev-23', input: input({}) }), 'NOT_FOUND', 404);

  const listed = await events.listOccurrences(base({ from: dateOf(plusDays(1)), to: dateOf(plusDays(30)) }));
  // Chronological by service date then time. On Fridays the +7d fixture
  // precedes next Friday night, so the expected order must use fixture dates.
  assert.deepEqual(listed.items.map(row => row.eventSlug), [created, late, insideCutoff].sort((a,b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || new Date(a.startAt) - new Date(b.startAt)).map(row => row.eventSlug).concat('afro-night-2'));
  assert.equal(listed.items.some(row => row.id === created.id && row.publication === 'cancelled'), true);
  const windowed = await events.listOccurrences(base({ from: dateOf(plusDays(1)), to: dateOf(plusDays(8)) }));
  assert.deepEqual(windowed.items.map(row => row.eventSlug), [created, late, insideCutoff].sort((a,b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || new Date(a.startAt) - new Date(b.startAt)).map(row => row.eventSlug));
  const empty = await events.listOccurrences(base({ from: '1990-01-01', to: '1990-12-31' }));
  assert.deepEqual(empty.items, []);
});

test('occurrence eligibility: events capability ladder and denial codes', { skip: !uri }, async t => {
  const args = await boot(t, 'events_elig');
  const events = require('../services/venue/events');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  // a location WITHOUT the 'events' capability is not configured for event work
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC' }, $pull: { 'venueServices.capabilities': 'events' } });
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-e1', input: input({}) })), 'VENUE_NOT_CONFIGURED', 403);
  await assertFails(events.listOccurrences(base({})), 'VENUE_NOT_CONFIGURED', 403);
  // denied actions suppress the write (and read) for this actor
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $addToSet: { 'venueServices.capabilities': 'events' } });
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['events.write'] } });
  await assertFails(events.createOccurrence(base({ idempotencyKey: 'ev-e2', input: input({}) })), 'VENUE_PERMISSION_DENIED', 403);
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['events.read'] } });
  await assertFails(events.listOccurrences(base({})), 'VENUE_PERMISSION_DENIED', 403);
});

test('event routes: auth, idempotency, versions, cancel and eligibility denial', { skip: !uri }, async t => {
  const args = await boot(t, 'events_http');
  const previous = { JWT_SECRET: process.env.JWT_SECRET };
  process.env.JWT_SECRET = 'events-http-test-only';
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const express = require('express');
  const app = express(); app.use(express.json()); app.use('/api/venue-ops', require('../routes/venue-ops.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}/api/venue-ops`;
  const headers = () => ({ Authorization: `Bearer ${require('jsonwebtoken').sign({ userId: args.actor.userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' });
  const url = `${root}/locations/${args.locationId}/events`;
  const post = (body, extra = {}) => fetch(url, { method: 'POST', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });
  const patch = (occurrenceId, body, extra = {}) => fetch(`${url}/${occurrenceId}`, { method: 'PATCH', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });

  assert.equal((await fetch(url, {})).status, 401); // no token
  const missingKey = await post({ input: input({}) });
  assert.equal(missingKey.status, 400); assert.equal((await missingKey.json()).code, 'IDEMPOTENCY_KEY_REQUIRED');

  const created = await post({ input: input({}) }, { 'Idempotency-Key': 'ev-http-1' });
  assert.equal(created.status, 201);
  const occurrence = (await created.json()).data;
  assert.equal(occurrence.version, 0);
  const replay = await post({ input: input({}) }, { 'Idempotency-Key': 'ev-http-1' });
  assert.equal(replay.status, 201); assert.equal((await replay.json()).data.id, occurrence.id);

  const published = await patch(occurrence.id, { expectedVersion: 0, input: input({ publication: 'published' }) }, { 'Idempotency-Key': 'ev-http-2' });
  assert.equal(published.status, 200);
  assert.equal((await published.json()).data.version, 1);
  const stale = await patch(occurrence.id, { expectedVersion: 0, input: input({}) }, { 'Idempotency-Key': 'ev-http-3' });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'STATE_CHANGED');

  const cancel = await fetch(`${url}/${occurrence.id}/cancel`, { method: 'POST', headers: { ...headers(), 'Idempotency-Key': 'ev-http-4' }, body: JSON.stringify({}) });
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json()).data.publication, 'cancelled');

  const listed = await fetch(url, { headers: headers() });
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store');
  assert.equal((await listed.json()).data.items.length, 1);
  const single = await fetch(`${url}/${occurrence.id}`, { headers: headers() });
  assert.equal(single.status, 200); assert.equal((await single.json()).data.id, occurrence.id);

  // cross-tenant location addressing fails NOT_FOUND at eligibility (foreign location
  // carries the events capability so the denial is the tenancy 404, like presets)
  const other = await fixture();
  await require('../models/Warehouse').updateOne({ _id: other.locationId }, { $addToSet: { 'venueServices.capabilities': 'events' } });
  const foreign = await fetch(`${root}/locations/${other.locationId}/events`, { headers: headers() });
  assert.equal(foreign.status, 404); assert.equal((await foreign.json()).code, 'NOT_FOUND');

  // an actor whose venueDeniedActions suppress events.write is denied
  await require('../models/User').updateOne({ _id: args.actor.userId }, { $set: { venueDeniedActions: ['events.write'] } });
  const denied = await post({ input: input({ eventSlug: 'blocked-night' }) }, { 'Idempotency-Key': 'ev-http-5' });
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'VENUE_PERMISSION_DENIED');
});
