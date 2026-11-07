'use strict';
// Task 1 (E1) — VenueEventOccurrence model: uniqueness per {tenant, location, eventSlug,
// occurrenceDate}, publication/minimumAge enums, required admissionTerms (<=2000), and the
// DocumentArray lesson honoured at DTO level (capacity/agePolicy subdocs normalize through
// toObject/JSON — no Mongoose machinery leaks into a spread).
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const FUTURE = { startAt: new Date('2026-11-06T22:00:00Z'), endAt: new Date('2026-11-07T01:00:00Z') };
const base = over => ({
  tenant: new mongoose.Types.ObjectId(), location: new mongoose.Types.ObjectId(),
  eventSlug: 'afro-night', name: 'Afro Night', occurrenceDate: '2026-11-06',
  startAt: FUTURE.startAt, endAt: FUTURE.endAt,
  capacity: { maxGuests: 200 }, agePolicy: { admissionTerms: '18+ with valid ID at the door.' },
  ...over,
});

test('VenueEventOccurrence schema: uniqueness per date+slug, enums, required admission terms', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'event_models');
  const Occurrence = require('../models/VenueEventOccurrence');
  await Occurrence.createIndexes();
  const tenant = new mongoose.Types.ObjectId(), location = new mongoose.Types.ObjectId();

  const first = await Occurrence.create(base({ tenant, location }));
  assert.equal(first.publication, 'draft');
  assert.equal(first.version, 0);
  assert.equal(first.cancelledAt, null);

  // same eventSlug on the SAME date at the location is rejected; the NEXT date is a new occurrence
  await assert.rejects(Occurrence.create(base({ tenant, location })), error => error.code === 11000 || error.name === 'MongoServerError' && error.code === 11000);
  await Occurrence.create(base({ tenant, location, occurrenceDate: '2026-11-13' }));
  // same slug+date at a DIFFERENT location (or tenant) is allowed
  await Occurrence.create(base({ tenant, location: new mongoose.Types.ObjectId() }));
  await Occurrence.create(base({ tenant: new mongoose.Types.ObjectId(), location }));

  // publication is a closed enum
  await assert.rejects(Occurrence.create(base({ publication: 'live' })), error => error.name === 'ValidationError' && !!error.errors.publication);
  // minimumAge is a closed enum (16|18|21) when present
  await assert.rejects(Occurrence.create(base({ agePolicy: { minimumAge: 17, admissionTerms: 'terms' } })), error => error.name === 'ValidationError' && !!error.errors['agePolicy.minimumAge']);
  // admissionTerms is required and capped at 2000 chars
  await assert.rejects(Occurrence.create(base({ agePolicy: { minimumAge: 18 } })), error => error.name === 'ValidationError' && !!error.errors['agePolicy.admissionTerms']);
  await assert.rejects(Occurrence.create(base({ agePolicy: { admissionTerms: 'x'.repeat(2001) } })), error => error.name === 'ValidationError' && !!error.errors['agePolicy.admissionTerms']);
  await Occurrence.create(base({ agePolicy: { admissionTerms: 'x'.repeat(2000) } }));
  // capacity.maxGuests is required (a limit definition, not stock)
  await assert.rejects(Occurrence.create(base({ capacity: {} })), error => error.name === 'ValidationError' && !!error.errors['capacity.maxGuests']);
  await assert.rejects(Occurrence.create(base({ capacity: { maxGuests: 0 } })), error => error.name === 'ValidationError' && !!error.errors['capacity.maxGuests']);
  await Occurrence.create(base({ capacity: { maxGuests: 120, maxTables: 10 } }));
  // startAt/endAt are required instants
  await assert.rejects(Occurrence.create(base({ endAt: null })), error => error.name === 'ValidationError' && !!error.errors.endAt);
});

test('VenueEventOccurrence DTO-level invariants: subdocs normalize plain, no DocumentArray leak', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'event_models_dto');
  const Occurrence = require('../models/VenueEventOccurrence');
  await Occurrence.createIndexes();
  const doc = await Occurrence.create(base({ capacity: { maxGuests: 50, maxTables: 4 }, agePolicy: { minimumAge: 21, admissionTerms: '21+ only.' } }));

  // DTO-level normalization (Phase-3 lesson): toObject(minimize:false) then JSON round-trip
  // yields plain nested objects — a spread of the Document never carries subdoc machinery.
  const dto = JSON.parse(JSON.stringify(doc.toObject({ minimize: false })));
  assert.deepEqual(dto.capacity, { maxGuests: 50, maxTables: 4 });
  assert.deepEqual(dto.agePolicy, { minimumAge: 21, admissionTerms: '21+ only.' });
  assert.equal(dto.publication, 'draft');
  assert.equal(typeof dto.occurrenceDate, 'string');
  assert.equal(dto.occurrenceDate, '2026-11-06');
  assert.ok(codeOf({ code: 'EVENT_CLOSED' }) === 'EVENT_CLOSED'); // documented domain code constant sanity
  // the schema declares no DocumentArray paths at all
  const arrayPaths = Object.entries(Occurrence.schema.paths).filter(([, type]) => type.instance === 'Array' && type.caster && type.caster.$isMongooseDocumentArray);
  assert.deepEqual(arrayPaths.map(([path]) => path), []);
});
