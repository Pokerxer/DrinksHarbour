'use strict';
// Task 3 (E1) — public occurrence READ surface (public-experience.publicOccurrences +
// GET /api/venue-experience/public/:slug/:locationSlug/events): only PUBLISHED
// occurrences with a CURRENT-or-FUTURE venue-local service date are visible; payload
// is a safe discovery projection (name/slug/date/times/agePolicy.admissionTerms +
// an availability SUMMARY that guarantees nothing — the Phase-1 request-only
// discipline: entry is arranged with the venue, no ordering/payment promise). No
// guest PII (occurrences carry none) and no capacity internals (maxGuests/maxTables/
// room are staff-side limit definitions, never public).
const test = require('node:test'); const assert = require('node:assert/strict'); const express = require('express');
const { uri, connectVenueMongo, fixture } = require('./helpers/venueMongo');
const { businessDate } = require('../services/venue/clock');

const plusDays = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };
const dateOf = d => d.toISOString().slice(0, 10);

async function publishableLocation(t, suffix) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC', 'venueServices.businessDayStartMinutes': 240 }, $addToSet: { 'venueServices.capabilities': 'events' } });
  await require('../models/Tenant').updateOne({ _id: args.tenantId }, { $set: { slug: 'events-lounge', 'venueSettings.publicListed': true, 'venueSettings.requestBookingsEnabled': true } });
  const Config = require('../models/VenueLocationProfile');
  await Config.createIndexes();
  const config = await Config.create({ tenant: args.tenantId, location: args.locationId, slug: 'main', version: 1, profileVersion: 1, profile: { slug: 'main', name: 'Events lounge', types: ['lounge'], timezone: 'UTC', policies: 'Request only', address: 'Abuja', hours: [], exceptions: [] } });
  await Config.updateOne({ _id: config._id }, { $set: { reviewedProfileVersion: 1, reviewedAt: new Date(), reviewedBy: args.actor.userId } });
  const Occurrence = require('../models/VenueEventOccurrence');
  await Occurrence.createIndexes();
  await require('../models/VenueOperation').createIndexes();
  const future = { startAt: new Date(plusDays(7).getTime() + 22 * 3600000), endAt: new Date(plusDays(7).getTime() + 25 * 3600000) };
  return { args, Occurrence, future };
}

test('publicOccurrences: draft/cancelled/past invisible, published future visible, safe payload', { skip: !uri }, async t => {
  const { args, Occurrence, future } = await publishableLocation(t, 'public_events');
  const { publicOccurrences } = require('../services/venue/public-experience');

  const mk = over => ({ tenant: args.tenantId, location: args.locationId, name: 'Afro Night', eventSlug: 'afro-night', occurrenceDate: dateOf(plusDays(7)), startAt: future.startAt, endAt: future.endAt, capacity: { maxGuests: 200, maxTables: 10 }, agePolicy: { minimumAge: 18, admissionTerms: '18+ with valid ID at the door. No re-entry after final entry.' }, ...over });
  const visible = await Occurrence.create(mk({ publication: 'published', version: 1 }));
  assert.equal(String(visible.publication), 'published');
  await Occurrence.create(mk({ eventSlug: 'draft-night', occurrenceDate: dateOf(plusDays(8)), startAt: future.startAt, endAt: future.endAt })); // draft: invisible
  await Occurrence.create(mk({ eventSlug: 'cancelled-night', publication: 'cancelled', cancelledAt: new Date(), version: 2 })); // cancelled: invisible
  await Occurrence.create(mk({ eventSlug: 'past-night', occurrenceDate: businessDate(new Date(Date.now() - 5 * 86400000), 'UTC', 240), startAt: plusDays(-5), endAt: plusDays(-4) })); // past: invisible

  const payload = await publicOccurrences({ slug: 'events-lounge', locationSlug: 'main' });
  assert.equal(payload.items.length, 1);
  const row = payload.items[0];
  assert.equal(row.eventSlug, 'afro-night');
  assert.equal(row.occurrenceDate, dateOf(plusDays(7)));
  assert.equal(row.name, 'Afro Night');
  assert.equal(row.admissionTerms, '18+ with valid ID at the door. No re-entry after final entry.');
  assert.equal(row.minimumAge, 18);
  // availability SUMMARY only — no capacity internals, no guaranteed-availability promise
  assert.ok(row.availability && typeof row.availability.message === 'string' && /may change/i.test(row.availability.message));
  assert.equal(row.availability.status, 'inquire');
  // safe projection: exactly the public keys — no staff-side fields, no PII carriers
  assert.deepEqual(Object.keys(row).sort(), ['admissionTerms', 'availability', 'endAt', 'eventSlug', 'minimumAge', 'name', 'occurrenceDate', 'startAt']);
  assert.deepEqual(payload.items, JSON.parse(JSON.stringify(payload.items))); // DTO-level plain objects

  // a location with no events capability still answers (empty list) — events are optional
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $pull: { 'venueServices.capabilities': 'events' } });
  const bare = await publicOccurrences({ slug: 'events-lounge', locationSlug: 'main' });
  assert.equal(bare.items.length, 1); // visibility does NOT depend on the staff capability flag; content does
  assert.equal(bare.items[0].id, undefined); // and still no internal ids leak
});

test('public events route: gated by VENUE_EXPERIENCE_ENABLED, no-store, 404 discipline', { skip: !uri }, async t => {
  const { args, Occurrence, future } = await publishableLocation(t, 'public_events_http');
  const old = { flag: process.env.VENUE_EXPERIENCE_ENABLED };
  process.env.VENUE_EXPERIENCE_ENABLED = 'true';
  t.after(() => { if (old.flag === undefined) delete process.env.VENUE_EXPERIENCE_ENABLED; else process.env.VENUE_EXPERIENCE_ENABLED = old.flag; });
  const app = express(); app.use(express.json()); app.use('/api/venue-experience', require('../routes/venue-experience.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/venue-experience/public/events-lounge/main/events`;

  await Occurrence.create({ tenant: args.tenantId, location: args.locationId, name: 'Afro Night', eventSlug: 'afro-night', occurrenceDate: dateOf(plusDays(7)), startAt: future.startAt, endAt: future.endAt, capacity: { maxGuests: 200 }, agePolicy: { admissionTerms: '18+ with valid ID.' }, publication: 'published', version: 1 });
  await Occurrence.create({ tenant: args.tenantId, location: args.locationId, name: 'Secret Night', eventSlug: 'secret-night', occurrenceDate: dateOf(plusDays(9)), startAt: future.startAt, endAt: future.endAt, capacity: { maxGuests: 50 }, agePolicy: { admissionTerms: '21+.' }, publication: 'draft' });

  const listed = await fetch(url);
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  const body = (await listed.json()).data;
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].eventSlug, 'afro-night');
  assert.equal(JSON.stringify(body).includes('Secret Night'), false); // drafts never leak
  assert.equal(JSON.stringify(body).includes('maxGuests'), false); // capacity internals never leak

  // unknown location slug → the same NOT_FOUND discipline as the other public reads
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/venue-experience/public/events-lounge/other/events`)).status, 404);
  // flag off → the whole public segment gates off (existing carve-out pattern; events adds no carve-out)
  process.env.VENUE_EXPERIENCE_ENABLED = 'false';
  assert.equal((await fetch(url)).status, 404);
});
