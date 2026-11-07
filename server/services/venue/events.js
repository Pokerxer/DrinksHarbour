'use strict';
// services/venue/events.js — Phase-4 E1 occurrence service (plan Task 2).
//
// A VenueEventOccurrence is one dated instance of an event slug at a location.
// Dates/times: occurrenceDate is the VENUE-LOCAL service date derived via
// clock.businessDate(startAt, location timezone, businessDayStartMinutes) — never
// trusted from the client; a supplied occurrenceDate must MATCH the derived one
// (INVALID_INPUT otherwise). A Friday-night start ending after midnight keeps the
// ORIGINAL Friday service date (startAt decides; endAt spilling past midnight never
// moves the date). startAt/endAt are UTC instants carried as strings with an EXPLICIT
// offset — the same rule as experience-validation.validateRequest's bookingAt.
//
// capacity {maxGuests, maxTables?} is a LIMIT DEFINITION ONLY (umbrella invariant 1):
// it never bypasses or replaces table capacity and no consumption/redemption happens
// in E1 — later slices' admission commands consume these limits atomically.
//
// Publication: draft→published through a versioned update (input.publication
// === 'published'); published→cancelled ONLY through the explicit cancel operation
// (sets cancelledAt); there is no unpublish and no cancelled-from-draft. Cancel of an
// already-cancelled occurrence returns the stored state unchanged (idempotent).
//
// Fail codes (documented per plan):
// - EVENT_CLOSED (409): ANY mutation against a closed occurrence — the venue-local
//   service date has elapsed, OR the occurrence is cancelled.
// - INVALID_INPUT (400): shape/enum/offset/interval violations, duplicate
//   slug+service-date at the location, publication regressions (use cancel), cancelling
//   a draft, supplied occurrenceDate mismatching the derived service date.
// - NOT_FOUND (404): occurrence/room unknown in this tenant/location.
// - STATE_CHANGED (409): expectedVersion drift (optimistic, like venue presets).
//
// Eligibility: mutations ride loadVenueContext(events.write), reads ride
// events.read — both require the location's 'events' capability (ladder mapping in
// eligibility.js). All mutations are runVenueOperation-idempotent with AuditLog rows.

const Occurrence = require('../../models/VenueEventOccurrence');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { keys, text } = require('./experience-validation');
const { businessDate } = require('./clock');

function occurrenceDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), locationId: id(row.location), eventSlug: row.eventSlug, name: row.name,
    occurrenceDate: row.occurrenceDate,
    startAt: row.startAt ? new Date(row.startAt).toISOString() : null,
    endAt: row.endAt ? new Date(row.endAt).toISOString() : null,
    room: row.room == null ? null : id(row.room),
    capacity: row.capacity ? { maxGuests: row.capacity.maxGuests, ...(row.capacity.maxTables == null ? {} : { maxTables: row.capacity.maxTables }) } : null,
    agePolicy: row.agePolicy ? { ...(row.agePolicy.minimumAge == null ? {} : { minimumAge: row.agePolicy.minimumAge }), admissionTerms: row.agePolicy.admissionTerms } : null,
    // E2: the shared-cap ledger counter, door-staff assignments and the re-entry policy
    guestsAdmitted: row.guestsAdmitted ?? 0,
    doorStaffIds: (row.doorStaffIds || []).map(id),
    admissionPolicy: { maxReEntries: row.admissionPolicy?.maxReEntries ?? 0 },
    publication: row.publication, version: row.version,
    cancelledAt: row.cancelledAt ? new Date(row.cancelledAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

function slug(value) {
  const value2 = text(value, 'event slug', 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value2)) fail('INVALID_INPUT', 'Invalid event slug', 400);
  return value2;
}

function instant(value, name) {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value)) fail('INVALID_INPUT', `${name} needs an explicit UTC offset`, 400);
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) fail('INVALID_INPUT', `Invalid ${name}`, 400);
  return at.toISOString();
}

function capacity(input) {
  if (input == null) fail('INVALID_INPUT', 'Occurrence capacity is required', 400);
  keys(input, ['maxGuests', 'maxTables']);
  if (!Number.isInteger(input.maxGuests) || input.maxGuests < 1 || input.maxGuests > 100000) fail('INVALID_INPUT', 'capacity.maxGuests is a whole number >= 1', 400);
  if (input.maxTables !== undefined && (!Number.isInteger(input.maxTables) || input.maxTables < 1 || input.maxTables > 100000)) fail('INVALID_INPUT', 'capacity.maxTables is a whole number >= 1', 400);
  return { maxGuests: input.maxGuests, ...(input.maxTables === undefined ? {} : { maxTables: input.maxTables }) };
}

function agePolicy(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INPUT', 'Occurrence age policy is required', 400);
  keys(input, ['minimumAge', 'admissionTerms']);
  if (input.minimumAge !== undefined && ![16, 18, 21].includes(input.minimumAge)) fail('INVALID_INPUT', 'minimumAge is 16, 18 or 21', 400);
  return { ...(input.minimumAge === undefined ? {} : { minimumAge: input.minimumAge }), admissionTerms: text(input.admissionTerms, 'admission terms', 2000) };
}

// E2: the per-token re-entry policy (absent = 0 = re-entry not permitted).
function admissionPolicy(input) {
  if (input === undefined || input === null) return undefined;
  keys(input, ['maxReEntries']);
  if (!Number.isInteger(input.maxReEntries) || input.maxReEntries < 0 || input.maxReEntries > 10) fail('INVALID_INPUT', 'admissionPolicy.maxReEntries is a whole number between 0 and 10', 400);
  return { maxReEntries: input.maxReEntries };
}

// occurrenceDate is an optional convenience field that must agree with the derived
// venue-local service date; the derived value is always authoritative.
function occurrenceInput(raw, { forUpdate = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Occurrence input is required', 400);
  keys(raw, forUpdate
    ? ['eventSlug', 'name', 'occurrenceDate', 'startAt', 'endAt', 'room', 'capacity', 'agePolicy', 'admissionPolicy', 'publication']
    : ['eventSlug', 'name', 'occurrenceDate', 'startAt', 'endAt', 'room', 'capacity', 'agePolicy', 'admissionPolicy']);
  if (raw.occurrenceDate !== undefined) {
    if (typeof raw.occurrenceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.occurrenceDate) || new Date(`${raw.occurrenceDate}T00:00:00Z`).toISOString().slice(0, 10) !== raw.occurrenceDate) fail('INVALID_INPUT', 'Invalid occurrenceDate', 400);
  }
  const startAt = instant(raw.startAt, 'startAt');
  const endAt = instant(raw.endAt, 'endAt');
  if (new Date(endAt) <= new Date(startAt)) fail('INVALID_INPUT', 'endAt must be after startAt', 400);
  let room = null;
  if (raw.room !== undefined && raw.room !== null) room = requireId(raw.room);
  if (raw.publication !== undefined && typeof raw.publication !== 'string') fail('INVALID_INPUT', 'Invalid publication', 400);
  return {
    eventSlug: slug(raw.eventSlug), name: text(raw.name, 'event name', 120), occurrenceDate: raw.occurrenceDate,
    startAt, endAt, room,
    capacity: capacity(raw.capacity), agePolicy: agePolicy(raw.agePolicy), admissionPolicy: admissionPolicy(raw.admissionPolicy),
    publication: raw.publication,
  };
}

function serviceWindow(location) {
  const services = location.venueServices || {};
  return { timezone: services.timezone, cutoff: services.businessDayStartMinutes == null ? 240 : services.businessDayStartMinutes };
}

// The venue-local service date of an occurrence: derived from startAt under the
// location's clock (a Friday 22:00–Sat 02:00 night service stays Friday).
function deriveOccurrenceDate(location, startAtIso) {
  const { timezone, cutoff } = serviceWindow(location);
  return businessDate(new Date(startAtIso), timezone, cutoff);
}

function assertNotClosed(occurrenceDate, location, now = new Date()) {
  const { timezone, cutoff } = serviceWindow(location);
  if (occurrenceDate < businessDate(now, timezone, cutoff)) fail('EVENT_CLOSED', 'This event date has passed; occurrences can no longer be changed', 409);
}

async function assertUniqueOccurrence(tenantId, locationId, eventSlug, occurrenceDate, excludeId, mongoSession) {
  const query = { tenant: tenantId, location: locationId, eventSlug, occurrenceDate };
  if (excludeId) query._id = { $ne: excludeId };
  const duplicate = await Occurrence.findOne(query).session(mongoSession).lean();
  if (duplicate) fail('INVALID_INPUT', 'An occurrence of this event already exists on that service date', 400);
}

async function assertValidRoom(tenantId, roomId, mongoSession) {
  const room = await require('../../models/Warehouse').findOne({ _id: roomId, tenant: tenantId, isActive: true }).session(mongoSession).lean();
  if (!room) fail('NOT_FOUND', 'Room not found at this tenant', 404);
}

async function createOccurrence(args) {
  const input = occurrenceInput(args.input);
  await loadVenueContext({ ...args, action: 'events.write' });
  return runVenueOperation({
    targetType: 'VenueEventOccurrence', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'event.create', key: args.idempotencyKey, payload: { input },
    execute: async ({ mongoSession }) => {
      const context = await loadVenueContext({ ...args, action: 'events.write', mongoSession });
      const occurrenceDate = deriveOccurrenceDate(context.location, input.startAt);
      if (input.occurrenceDate != null && input.occurrenceDate !== occurrenceDate) fail('INVALID_INPUT', 'occurrenceDate must be the venue-local service date of startAt', 400);
      assertNotClosed(occurrenceDate, context.location);
      if (input.room) await assertValidRoom(args.tenantId, input.room, mongoSession);
      await assertUniqueOccurrence(args.tenantId, args.locationId, input.eventSlug, occurrenceDate, null, mongoSession);
      const [row] = await Occurrence.create([{
        tenant: args.tenantId, location: args.locationId, createdBy: context.actor.userId, version: 0,
        eventSlug: input.eventSlug, name: input.name, occurrenceDate,
        startAt: new Date(input.startAt), endAt: new Date(input.endAt), room: input.room,
        capacity: input.capacity, agePolicy: input.agePolicy,
        ...(input.admissionPolicy === undefined ? {} : { admissionPolicy: input.admissionPolicy }),
      }], { session: mongoSession });
      return occurrenceDTO(row);
    },
  });
}

async function updateOccurrence(args) {
  requireId(args.occurrenceId);
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Occurrence version required; reload before saving');
  const input = occurrenceInput(args.input, { forUpdate: true });
  await loadVenueContext({ ...args, action: 'events.write' });
  return runVenueOperation({
    targetType: 'VenueEventOccurrence', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'event.update', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId, expectedVersion: args.expectedVersion, input },
    execute: async ({ mongoSession }) => {
      const context = await loadVenueContext({ ...args, action: 'events.write', mongoSession });
      const occurrence = await Occurrence.findOne({ _id: args.occurrenceId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
      assertNotClosed(occurrence.occurrenceDate, context.location);
      if (occurrence.publication === 'cancelled') fail('EVENT_CLOSED', 'Cancelled occurrences are immutable', 409);
      if (occurrence.version !== args.expectedVersion) fail('STATE_CHANGED', 'Occurrence changed elsewhere; reload before saving');
      // publication: only the forward draft→published transition rides an update; the
      // reverse and 'cancelled' always fail (cancel rides the explicit cancel operation)
      if (input.publication != null && input.publication !== 'published') fail('INVALID_INPUT', 'Use the cancel operation to cancel an occurrence; publication cannot go backwards', 400);
      if (input.publication === 'published' && occurrence.publication === 'draft') occurrence.publication = 'published';
      // the service date is re-derived from the (possibly moved) startAt; a supplied
      // occurrenceDate must still agree, and the new date must not be in the past
      const occurrenceDate = deriveOccurrenceDate(context.location, input.startAt);
      if (input.occurrenceDate != null && input.occurrenceDate !== occurrenceDate) fail('INVALID_INPUT', 'occurrenceDate must be the venue-local service date of startAt', 400);
      assertNotClosed(occurrenceDate, context.location);
      if (input.room) await assertValidRoom(args.tenantId, input.room, mongoSession);
      await assertUniqueOccurrence(args.tenantId, args.locationId, input.eventSlug, occurrenceDate, occurrence._id, mongoSession);
      Object.assign(occurrence, {
        eventSlug: input.eventSlug, name: input.name, startAt: new Date(input.startAt), endAt: new Date(input.endAt),
        room: input.room, capacity: input.capacity, agePolicy: input.agePolicy, occurrenceDate, version: args.expectedVersion + 1,
      });
      if (input.admissionPolicy !== undefined) occurrence.admissionPolicy = input.admissionPolicy;
      await occurrence.save({ session: mongoSession });
      return occurrenceDTO(occurrence);
    },
  });
}

// Explicit cancel: published→cancelled with cancelledAt; already-cancelled occurrences
// return their stored state unchanged (idempotent for retries with a fresh key); draft
// occurrences are refused (nothing was ever announced). Closed (past-date) occurrences
// refuse with EVENT_CLOSED like every other mutation.
async function cancelOccurrence(args) {
  requireId(args.occurrenceId);
  await loadVenueContext({ ...args, action: 'events.write' });
  return runVenueOperation({
    targetType: 'VenueEventOccurrence', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'event.cancel', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId },
    execute: async ({ mongoSession }) => {
      const context = await loadVenueContext({ ...args, action: 'events.write', mongoSession });
      const occurrence = await Occurrence.findOne({ _id: args.occurrenceId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
      if (occurrence.publication === 'cancelled') return occurrenceDTO(occurrence);
      assertNotClosed(occurrence.occurrenceDate, context.location);
      if (occurrence.publication !== 'published') fail('INVALID_INPUT', 'Only published occurrences can be cancelled', 400);
      occurrence.publication = 'cancelled';
      occurrence.cancelledAt = new Date();
      occurrence.version += 1;
      await occurrence.save({ session: mongoSession });
      return occurrenceDTO(occurrence);
    },
  });
}

async function getOccurrence(args) {
  await loadVenueContext({ ...args, action: 'events.read' });
  requireId(args.occurrenceId);
  const row = await Occurrence.findOne({ _id: args.occurrenceId, tenant: args.tenantId, location: args.locationId }).lean();
  if (!row) fail('NOT_FOUND', 'Event occurrence not found', 404);
  return occurrenceDTO(row);
}

async function listOccurrences(args) {
  await loadVenueContext({ ...args, action: 'events.read' });
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (args.from !== undefined && !validDate(args.from)) fail('INVALID_INPUT', 'Invalid from date', 400);
  if (args.to !== undefined && !validDate(args.to)) fail('INVALID_INPUT', 'Invalid to date', 400);
  if (args.from && args.to && args.from > args.to) fail('INVALID_INPUT', 'from must not be after to', 400);
  const rows = await Occurrence.find({ tenant: args.tenantId, location: args.locationId, ...(args.from || args.to ? { occurrenceDate: { ...(args.from ? { $gte: args.from } : {}), ...(args.to ? { $lte: args.to } : {}) } } : {}) }).sort({ occurrenceDate: 1, startAt: 1 }).lean();
  return { items: rows.map(occurrenceDTO) };
}

module.exports = { createOccurrence, updateOccurrence, cancelOccurrence, getOccurrence, listOccurrences, occurrenceDTO, deriveOccurrenceDate, assertNotClosed };
