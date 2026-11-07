'use strict';
// services/venue/waitlist.js — Phase-4 E3: waitlist entries + expiring offers.
//
// A waitlist entry is a REQUEST for a table — never a booking, admission or
// charge (11 §3: "Waitlist invitation is not an automatic confirmed booking").
//
// Scope: occurrence-scoped when occurrenceId is given (the occurrence must
// belong to the tenant/location and not be closed — EVENT_CLOSED for past/
// cancelled, mirroring guestlists.staffOccurrence), otherwise location-scoped.
//
// Uniqueness: compound unique {tenant, location, occurrence, phone} NON-sparse
// (occurrence defaults to null, so location-scoped rows group together) — the
// same phone is unique per scope; a duplicate (11000) is caught INSIDE the
// operation and surfaced as INVALID_INPUT (a client validation matter, never
// the device-conflict STATE_CHANGED) — the guestlists idiom.
//
// window {earliestAt, latestAt}: explicit UTC offsets (the
// experience-validation validateRequest bookingAt rule — offset suffix required,
// parseable, latestAt future and within 180 days and after earliestAt;
// earliestAt MAY be in the past — a guest already waiting names a window that
// started when they arrived).
//
// verifiedContactRoute (sms|email|in_app): RECORDED, NOT SENT — the staff uses
// their existing channels; E3 sends no messages (provider messaging is out of
// scope, umbrella design §3).
//
// Lifecycle: waiting → offered → accepted | declined | expired; waiting|offered
// → cancelled (patch cancel). Editing is allowed ONLY while waiting (an offered
// entry's partySize/window are frozen against its live capacity hold).
//
// Fail codes (documented per plan): INVALID_INPUT (400) shape/enum/offset/
// duplicate phone; NOT_FOUND (404) tenancy/foreign occurrence; STATE_CHANGED
// (409) version drift or a lifecycle-command state violation; EVENT_CLOSED
// (409) closed occurrence; WAITLIST_NOT_OFFERED / WAITLIST_OFFER_EXPIRED (409)
// — defined with the offer commands in waitlist-offers.js. All mutations are
// runVenueOperation-idempotent with AuditLog rows; eligibility rides
// loadVenueContext('waitlists.read'/'waitlists.write') — laddered to the
// location's 'tables' capability (a waitlist offer is a table promise).

const Entry = require('../../models/VenueWaitlistEntry');
const Occurrence = require('../../models/VenueEventOccurrence');
const { loadVenueContext } = require('./context');
const { publicLocation } = require('./public-experience');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { keys, text, list: boundedList } = require('./experience-validation');
const { assertNotClosed } = require('./events');

function waitlistDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), locationId: id(row.location), occurrenceId: row.occurrence == null ? null : id(row.occurrence),
    name: row.name, phone: row.phone, verifiedContactRoute: row.verifiedContactRoute, partySize: row.partySize,
    window: { earliestAt: row.window?.earliestAt ? new Date(row.window.earliestAt).toISOString() : null, latestAt: row.window?.latestAt ? new Date(row.window.latestAt).toISOString() : null },
    acceptableZones: [...(row.acceptableZones || [])],
    state: row.state,
    offer: row.offer ? { at: new Date(row.offer.at).toISOString(), expiresAt: new Date(row.offer.expiresAt).toISOString(), claimRef: id(row.offer.claimRef), bookingRef: id(row.offer.bookingRef) } : null,
    version: row.version,
    createdBy: row.createdBy == null ? null : id(row.createdBy),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

// Normalized phone (mirrors guestlists.normalizePhone): digits with an optional
// leading +, separators stripped — stored normalized so the unique index bites
// on formatting variants of the same number.
function normalizePhone(value) {
  if (typeof value !== 'string') fail('INVALID_INPUT', 'Invalid phone', 400);
  const phone = value.trim().replace(/[ ()\-.]/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) fail('INVALID_INPUT', 'Invalid phone', 400);
  return phone;
}

function instant(value, name) {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value)) fail('INVALID_INPUT', `${name} needs an explicit UTC offset`, 400);
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) fail('INVALID_INPUT', `Invalid ${name}`, 400);
  return at;
}

// The requested seating window: explicit UTC offsets (validateRequest rule);
// latestAt must be future and within 180 days and after earliestAt; earliestAt
// may be in the past (the guest is already waiting).
function validateWindow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'window is required', 400);
  keys(raw, ['earliestAt', 'latestAt']);
  const earliestAt = instant(raw.earliestAt, 'window.earliestAt');
  const latestAt = instant(raw.latestAt, 'window.latestAt');
  if (latestAt <= earliestAt) fail('INVALID_INPUT', 'window.latestAt must be after window.earliestAt', 400);
  if (latestAt <= new Date()) fail('INVALID_INPUT', 'window.latestAt must be in the future', 400);
  if (latestAt.getTime() > Date.now() + 180 * 86400000) fail('INVALID_INPUT', 'Choose a window within 180 days', 400);
  return { earliestAt, latestAt };
}

function waitlistInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Waitlist input is required', 400);
  keys(raw, ['name', 'phone', 'partySize', 'window', 'acceptableZones', 'verifiedContactRoute']);
  if (!['sms', 'email', 'in_app'].includes(raw.verifiedContactRoute)) fail('INVALID_INPUT', 'verifiedContactRoute is sms, email or in_app', 400);
  if (!Number.isInteger(raw.partySize) || raw.partySize < 1 || raw.partySize > 100) fail('INVALID_INPUT', 'partySize is a whole number between 1 and 100', 400);
  const acceptableZones = [...new Set(boundedList(raw.acceptableZones === undefined || raw.acceptableZones === null ? [] : raw.acceptableZones, 30).map(zone => text(zone, 'zone', 50)))];
  return { name: text(raw.name, 'guest name', 120), phone: normalizePhone(raw.phone), partySize: raw.partySize, window: validateWindow(raw.window), acceptableZones, verifiedContactRoute: raw.verifiedContactRoute };
}

// Any staff-visible occurrence of this tenant/location; refuses closed
// (past-service-date or cancelled) occurrences for waitlist mutations.
async function staffOccurrence(tenantId, locationId, occurrenceId, location, mongoSession) {
  const occurrence = await Occurrence.findOne({ _id: occurrenceId, tenant: tenantId, location: locationId }).session(mongoSession).lean();
  if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
  assertNotClosed(occurrence.occurrenceDate, location);
  if (occurrence.publication === 'cancelled') fail('EVENT_CLOSED', 'Cancelled occurrences take no waitlist entries', 409);
  return occurrence;
}

// A published, current-or-future occurrence for PUBLIC joins (404 discipline:
// no existence or state detail leaks on the public surface).
async function publicOccurrence(context, occurrenceId, mongoSession) {
  const services = context.location.venueServices || {};
  const today = require('./clock').businessDate(new Date(), services.timezone, services.businessDayStartMinutes == null ? 240 : services.businessDayStartMinutes);
  const occurrence = await Occurrence.findOne({ _id: occurrenceId, tenant: context.tenant._id, location: context.location._id, publication: 'published', occurrenceDate: { $gte: today } }).session(mongoSession).lean();
  if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
  return occurrence;
}

async function createStaff(args) {
  const input = waitlistInput(args.input);
  if (args.occurrenceId !== undefined && args.occurrenceId !== null) requireId(args.occurrenceId);
  const context = await loadVenueContext({ ...args, action: 'waitlists.write' });
  return runVenueOperation({
    targetType: 'VenueWaitlistEntry', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'waitlist.add', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId || null, input },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, action: 'waitlists.write', mongoSession });
      if (args.occurrenceId) await staffOccurrence(args.tenantId, args.locationId, args.occurrenceId, fresh.location, mongoSession);
      try {
        const [row] = await Entry.create([{
          tenant: args.tenantId, location: args.locationId, ...(args.occurrenceId ? { occurrence: args.occurrenceId } : {}),
          ...input, state: 'waiting', version: 0, createdBy: context.actor.userId,
        }], { session: mongoSession });
        return waitlistDTO(row);
      } catch (error) {
        if (error.code === 11000) fail('INVALID_INPUT', 'A waitlist entry with this phone already exists for this scope', 400);
        throw error;
      }
    },
  });
}

async function submitPublic(args) {
  requireId(args.customerId);
  if (args.occurrenceId !== undefined && args.occurrenceId !== null) requireId(args.occurrenceId); // occurrence joins validate the E1 row; otherwise the join is location-scoped
  const input = waitlistInput(args.input);
  const context = await publicLocation({ ...args, request: true });
  const actor = { userId: args.customerId, tenantId: id(context.tenant), role: 'customer' };
  const customer = await require('../../models/User').findOne({ _id: args.customerId, status: 'active', role: 'customer' }).select('_id').lean();
  if (!customer) fail('NOT_FOUND', 'Customer not found', 404);
  return runVenueOperation({
    targetType: 'VenueWaitlistEntry', tenantId: id(context.tenant), locationId: id(context.location), actor,
    operation: 'waitlist.join', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId || null, input },
    execute: async ({ mongoSession }) => {
      const fresh = await publicLocation({ ...args, request: true, mongoSession });
      if (args.occurrenceId) await publicOccurrence(fresh, args.occurrenceId, mongoSession);
      try {
        const [row] = await Entry.create([{
          tenant: fresh.tenant._id, location: fresh.location._id, ...(args.occurrenceId ? { occurrence: args.occurrenceId } : {}),
          ...input, state: 'waiting', version: 0, createdBy: customer._id,
        }], { session: mongoSession });
        return waitlistDTO(row);
      } catch (error) {
        if (error.code === 11000) fail('INVALID_INPUT', 'A waitlist request with this phone already exists for this scope', 400);
        throw error;
      }
    },
  });
}

async function list(args) {
  await loadVenueContext({ ...args, action: 'waitlists.read' });
  const query = { tenant: args.tenantId, location: args.locationId, ...(args.occurrenceId ? { occurrence: requireId(args.occurrenceId) } : {}), ...(args.state ? { state: args.state } : {}) };
  if (args.after) requireId(args.after);
  const rows = await Entry.find(query).sort({ _id: 1 }).limit(51).lean();
  return { items: rows.slice(0, 50).map(waitlistDTO), next: rows.length > 50 ? id(rows[49]) : null };
}

async function loadRow(args, mongoSession) {
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Waitlist version required; reload before saving');
  const row = await Entry.findOne({ _id: requireId(args.entryId), tenant: args.tenantId, location: args.locationId }).session(mongoSession);
  if (!row) fail('NOT_FOUND', 'Waitlist entry not found', 404);
  if (row.version !== args.expectedVersion) fail('STATE_CHANGED', 'Waitlist entry changed elsewhere; reload before saving');
  return row;
}

// patch = edit (full replacement, waiting only) or cancel (waiting|offered; an
// offered cancel releases its capacity hold through the EXISTING release path
// inside the same transaction).
async function patch(args) {
  requireId(args.entryId);
  if (args.cancel && args.input) fail('INVALID_INPUT', 'Edit and cancel are separate commands', 400);
  const input = args.cancel ? null : waitlistInput(args.input);
  const context = await loadVenueContext({ ...args, action: 'waitlists.write' });
  return runVenueOperation({
    targetType: 'VenueWaitlistEntry', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: args.cancel ? 'waitlist.cancel' : 'waitlist.edit', key: args.idempotencyKey,
    payload: { entryId: args.entryId, expectedVersion: args.expectedVersion, cancel: !!args.cancel, input },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, action: 'waitlists.write', mongoSession });
      const row = await loadRow(args, mongoSession);
      if (args.cancel) {
        if (!['waiting', 'offered'].includes(row.state)) fail('STATE_CHANGED', 'Waitlist entry changed; reload before cancelling');
        if (row.state === 'offered') await require('./capacity').releaseClaim({ ...args, bookingId: id(row.offer.bookingRef) }, mongoSession);
        row.state = 'cancelled';
      } else {
        if (row.state !== 'waiting') fail('STATE_CHANGED', 'An offered or closed waitlist entry is frozen; cancel instead');
        Object.assign(row, { name: input.name, phone: input.phone, partySize: input.partySize, window: input.window, acceptableZones: input.acceptableZones, verifiedContactRoute: input.verifiedContactRoute });
      }
      row.version += 1;
      await row.save({ session: mongoSession });
      return waitlistDTO(row);
    },
  });
}

module.exports = { waitlistDTO, waitlistInput, validateWindow, normalizePhone, instant, staffOccurrence, publicOccurrence, createStaff, submitPublic, list, patch };
// Phase-4 E3 Task 2: the offer/accept/decline commands live in waitlist-offers.js
// (the <300-line discipline); the public module surface stays THIS module.
Object.assign(module.exports, require('./waitlist-offers'));
