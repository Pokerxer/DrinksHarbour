'use strict';
// services/venue/guestlists.js — Phase-4 E2 Task 1: occurrence-scoped guest lists.
//
// Lifecycle: requested → approved | denied; requested|approved → cancelled.
// - submitPublic: the PUBLIC request path (routes/venue-experience.routes.js) —
//   rides the existing public request pattern (publicLocation with request:true →
//   the 'public.request' eligibility + the request_bookings capability + the
//   customer JWT + 10/hour limiter on the route). Public discipline: a closed
//   (past/cancelled) or draft occurrence is NOT_FOUND (404) — never a detail leak.
// - createStaff: staff-added names (walk-ins) — same 'requested' start state.
// - approve: sets allowedCount (≤ partySize, default partySize) + cutoffAt (staff
//   input, explicit-offset instant, ≥ now). Approval is the ENTITLEMENT-ISSUANCE
//   gate ONLY (admissions.issueEntitlement) — never a guarantee of admission;
//   the shared cap is enforced at redemption. Approve may flag vip inline
//   (provenance by/at = approving actor/time).
// - deny/cancel: version-checked one-way transitions.
// - flagVip: provenance triple (reason/by/at) required when flagging; unflagging
//   flips the flag and KEEPS the last provenance for audit.
// - assignStaff/assignPromoter: promoterRef is OPAQUE attribution ({id, name}) —
//   it never changes ownership or commission (umbrella invariant 4).
//
// Closed-occurrence discipline (E1 EVENT_CLOSED semantics): staff mutations
// against a past-service-date or cancelled occurrence fail EVENT_CLOSED (409).
//
// Fail codes: INVALID_INPUT (400) shape/validation/duplicate phone; NOT_FOUND
// (404) tenancy; STATE_CHANGED (409) expectedVersion drift or non-requested
// state on a lifecycle command; EVENT_CLOSED (409) closed occurrence. All
// mutations are runVenueOperation-idempotent with AuditLog rows; eligibility
// rides loadVenueContext('guestlists.write'/'guestlists.read').

const GuestList = require('../../models/VenueEventGuestList');
const Occurrence = require('../../models/VenueEventOccurrence');
const { loadVenueContext } = require('./context');
const { publicLocation } = require('./public-experience');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { keys, text } = require('./experience-validation');
const { assertNotClosed } = require('./events');

function guestListDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), locationId: id(row.location), occurrenceId: id(row.occurrence),
    name: row.name, phone: row.phone, partySize: row.partySize,
    state: row.state, allowedCount: row.allowedCount == null ? null : row.allowedCount,
    cutoffAt: row.cutoffAt ? new Date(row.cutoffAt).toISOString() : null,
    promoterRef: row.promoterRef ? { id: row.promoterRef.id, name: row.promoterRef.name } : null,
    assignedStaffId: row.assignedStaffId ? id(row.assignedStaffId) : null,
    vip: row.vip ? { flagged: !!row.vip.flagged, reason: row.vip.reason || null, by: row.vip.by ? id(row.vip.by) : null, at: row.vip.at ? new Date(row.vip.at).toISOString() : null } : { flagged: false, reason: null, by: null, at: null },
    restrictedNote: row.restrictedNote == null ? null : row.restrictedNote,
    version: row.version,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

// Normalized phone: digits with an optional leading +, separators stripped —
// stored normalized so the unique {tenant, occurrence, phone} index bites on
// formatting variants of the same number.
function normalizePhone(value) {
  if (typeof value !== 'string') fail('INVALID_INPUT', 'Invalid phone', 400);
  const phone = value.trim().replace(/[ ()\-.]/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) fail('INVALID_INPUT', 'Invalid phone', 400);
  return phone;
}

function guestListInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Guest list input is required', 400);
  keys(raw, ['name', 'phone', 'partySize', 'promoterRef']);
  let promoterRef = null;
  if (raw.promoterRef !== undefined && raw.promoterRef !== null) {
    keys(raw.promoterRef, ['id', 'name']);
    promoterRef = { id: text(raw.promoterRef.id, 'promoter id', 100), name: text(raw.promoterRef.name, 'promoter name', 120) };
  }
  if (!Number.isInteger(raw.partySize) || raw.partySize < 1 || raw.partySize > 50) fail('INVALID_INPUT', 'partySize is a whole number between 1 and 50', 400);
  return { name: text(raw.name, 'guest name', 120), phone: normalizePhone(raw.phone), partySize: raw.partySize, promoterRef };
}

function instant(value, name) {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value)) fail('INVALID_INPUT', `${name} needs an explicit UTC offset`, 400);
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) fail('INVALID_INPUT', `Invalid ${name}`, 400);
  return at;
}

// A published, current-or-future occurrence for PUBLIC submission (404 discipline:
// no existence or state detail leaks on the public surface).
async function publicOccurrence(context, occurrenceId, mongoSession) {
  const services = context.location.venueServices || {};
  const today = require('./clock').businessDate(new Date(), services.timezone, services.businessDayStartMinutes == null ? 240 : services.businessDayStartMinutes);
  const occurrence = await Occurrence.findOne({ _id: occurrenceId, tenant: context.tenant._id, location: context.location._id, publication: 'published', occurrenceDate: { $gte: today } }).session(mongoSession).lean();
  if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
  return occurrence;
}

// Any staff-visible occurrence of this tenant/location; refuses closed (past or
// cancelled) occurrences for guest-list mutations.
async function staffOccurrence(tenantId, locationId, occurrenceId, location, mongoSession) {
  const occurrence = await Occurrence.findOne({ _id: occurrenceId, tenant: tenantId, location }).session(mongoSession).lean();
  if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
  assertNotClosed(occurrence.occurrenceDate, location);
  if (occurrence.publication === 'cancelled') fail('EVENT_CLOSED', 'Cancelled occurrences take no guest lists', 409);
  return occurrence;
}

async function submitPublic(args) {
  requireId(args.customerId);
  requireId(args.occurrenceId);
  const input = guestListInput(args.input);
  const context = await publicLocation({ ...args, request: true });
  const actor = { userId: args.customerId, tenantId: id(context.tenant), role: 'customer' };
  const customer = await require('../../models/User').findOne({ _id: args.customerId, status: 'active', role: 'customer' }).select('_id').lean();
  if (!customer) fail('NOT_FOUND', 'Customer not found', 404);
  return runVenueOperation({
    targetType: 'VenueEventGuestList', tenantId: id(context.tenant), locationId: id(context.location), actor,
    operation: 'guestlist.submit', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId, input },
    execute: async ({ mongoSession }) => {
      const fresh = await publicLocation({ ...args, request: true, mongoSession });
      await publicOccurrence(fresh, args.occurrenceId, mongoSession);
      try {
        const [row] = await GuestList.create([{
          tenant: fresh.tenant._id, location: fresh.location._id, occurrence: args.occurrenceId,
          ...input, state: 'requested', version: 0,
        }], { session: mongoSession });
        return guestListDTO(row);
      } catch (error) {
        // unique {tenant, occurrence, phone} — a duplicate request is a client
        // validation matter on the public surface, never a device-conflict 409.
        if (error.code === 11000) fail('INVALID_INPUT', 'A guest list request with this phone already exists for this occurrence', 400);
        throw error;
      }
    },
  });
}

async function createStaff(args) {
  requireId(args.occurrenceId);
  const input = guestListInput(args.input);
  const context = await loadVenueContext({ ...args, action: 'guestlists.write' });
  return runVenueOperation({
    targetType: 'VenueEventGuestList', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'guestlist.add', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId, input },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, action: 'guestlists.write', mongoSession });
      await staffOccurrence(args.tenantId, args.locationId, args.occurrenceId, fresh.location, mongoSession);
      try {
        const [row] = await GuestList.create([{ tenant: args.tenantId, location: args.locationId, occurrence: args.occurrenceId, ...input, state: 'requested', version: 0 }], { session: mongoSession });
        return guestListDTO(row);
      } catch (error) {
        if (error.code === 11000) fail('INVALID_INPUT', 'A guest list entry with this phone already exists for this occurrence', 400);
        throw error;
      }
    },
  });
}

// Approve input validation happens BEFORE the row load so a bad allowedCount is
// INVALID_INPUT even when the version is also stale (pure-function first).
function approveInput(raw, partySize) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Approval input is required', 400);
  keys(raw, ['allowedCount', 'cutoffAt', 'vip', 'restrictedNote']);
  const cutoffAt = instant(raw.cutoffAt, 'cutoffAt');
  if (cutoffAt.getTime() < Date.now()) fail('INVALID_INPUT', 'cutoffAt must not be in the past', 400);
  let allowedCount = partySize;
  if (raw.allowedCount !== undefined) {
    if (!Number.isInteger(raw.allowedCount) || raw.allowedCount < 1 || raw.allowedCount > partySize) fail('INVALID_INPUT', `allowedCount is a whole number between 1 and ${partySize}`, 400);
    allowedCount = raw.allowedCount;
  }
  const vip = raw.vip === undefined || raw.vip === null ? null : { reason: text(raw.vip.reason, 'vip reason', 300) };
  const restrictedNote = raw.restrictedNote === undefined || raw.restrictedNote === null ? null : text(raw.restrictedNote, 'restricted note', 500);
  return { allowedCount, cutoffAt, vip, restrictedNote };
}

async function loadRow(args, mongoSession) {
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Guest list version required; reload before saving');
  const row = await GuestList.findOne({ _id: requireId(args.guestListId), tenant: args.tenantId, location: args.locationId }).session(mongoSession);
  if (!row) fail('NOT_FOUND', 'Guest list entry not found', 404);
  if (row.version !== args.expectedVersion) fail('STATE_CHANGED', 'Guest list changed elsewhere; reload before saving');
  return row;
}

function lifecycleCommand(operation, transition) {
  return async function (args) {
    requireId(args.guestListId);
    const context = await loadVenueContext({ ...args, action: 'guestlists.write' });
    return runVenueOperation({
      targetType: 'VenueEventGuestList', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
      operation, key: args.idempotencyKey, payload: { guestListId: args.guestListId, expectedVersion: args.expectedVersion, input: args.input || null },
      execute: async ({ mongoSession }) => {
        const fresh = await loadVenueContext({ ...args, action: 'guestlists.write', mongoSession });
        const row = await loadRow(args, mongoSession);
        await staffOccurrence(args.tenantId, args.locationId, id(row.occurrence), fresh.location, mongoSession);
        row.state = transition(row, args.input ? approveInput(args.input, row.partySize) : null, fresh.actor);
        row.version += 1;
        await row.save({ session: mongoSession });
        return guestListDTO(row);
      },
    });
  };
}

async function flagVip(args) {
  requireId(args.guestListId);
  if (typeof args.flagged !== 'boolean') fail('INVALID_INPUT', 'flagged is a boolean', 400);
  const reason = args.flagged ? text(args.reason, 'vip reason', 300) : null;
  const context = await loadVenueContext({ ...args, action: 'guestlists.write' });
  return runVenueOperation({
    targetType: 'VenueEventGuestList', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'guestlist.flag', key: args.idempotencyKey, payload: { guestListId: args.guestListId, expectedVersion: args.expectedVersion, flagged: args.flagged, reason },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'guestlists.write', mongoSession });
      const row = await loadRow(args, mongoSession);
      row.vip.flagged = args.flagged;
      if (args.flagged) { row.vip.reason = reason; row.vip.by = context.actor.userId; row.vip.at = new Date(); }
      row.version += 1;
      await row.save({ session: mongoSession });
      return guestListDTO(row);
    },
  });
}

async function assignStaff(args) {
  requireId(args.guestListId);
  const staffId = args.staffId === undefined || args.staffId === null ? null : requireId(args.staffId);
  const context = await loadVenueContext({ ...args, action: 'guestlists.write' });
  return runVenueOperation({
    targetType: 'VenueEventGuestList', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'guestlist.assign_staff', key: args.idempotencyKey, payload: { guestListId: args.guestListId, expectedVersion: args.expectedVersion, staffId },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'guestlists.write', mongoSession });
      const row = await loadRow(args, mongoSession);
      if (staffId) {
        const staff = await require('../../models/User').findOne({ _id: staffId, tenant: args.tenantId, status: 'active' }).session(mongoSession).lean();
        if (!staff) fail('NOT_FOUND', 'Staff member not found', 404);
        row.assignedStaffId = staffId;
      } else row.assignedStaffId = null;
      row.version += 1;
      await row.save({ session: mongoSession });
      return guestListDTO(row);
    },
  });
}

async function assignPromoter(args) {
  requireId(args.guestListId);
  let promoterRef = null;
  if (args.promoterRef !== undefined && args.promoterRef !== null) {
    keys(args.promoterRef, ['id', 'name']);
    promoterRef = { id: text(args.promoterRef.id, 'promoter id', 100), name: text(args.promoterRef.name, 'promoter name', 120) };
  }
  const context = await loadVenueContext({ ...args, action: 'guestlists.write' });
  return runVenueOperation({
    targetType: 'VenueEventGuestList', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'guestlist.assign_promoter', key: args.idempotencyKey, payload: { guestListId: args.guestListId, expectedVersion: args.expectedVersion, promoterRef },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'guestlists.write', mongoSession });
      const row = await loadRow(args, mongoSession);
      // Opaque attribution ONLY — ownership and commission are untouched.
      row.promoterRef = promoterRef;
      row.version += 1;
      await row.save({ session: mongoSession });
      return guestListDTO(row);
    },
  });
}

async function list(args) {
  await loadVenueContext({ ...args, action: 'guestlists.read' });
  const query = { tenant: args.tenantId, location: args.locationId, ...(args.occurrenceId ? { occurrence: requireId(args.occurrenceId) } : {}), ...(args.state ? { state: args.state } : {}) };
  if (args.after) requireId(args.after);
  const rows = await GuestList.find(query).sort({ _id: 1 }).limit(51).lean();
  return { items: rows.slice(0, 50).map(guestListDTO), next: rows.length > 50 ? id(rows[49]) : null };
}

module.exports = {
  guestListDTO, submitPublic, createStaff, flagVip, assignStaff, assignPromoter, list,
  approve: lifecycleCommand('guestlist.approve', (row, input, actor) => {
    row.allowedCount = input.allowedCount;
    row.cutoffAt = input.cutoffAt;
    if (input.vip) { row.vip.flagged = true; row.vip.reason = input.vip.reason; row.vip.by = actor.userId; row.vip.at = new Date(); }
    if (input.restrictedNote !== null) row.restrictedNote = input.restrictedNote;
    if (row.state !== 'requested') fail('STATE_CHANGED', 'Guest list changed; reload before editing');
    return 'approved';
  }),
  deny: lifecycleCommand('guestlist.deny', row => { if (row.state !== 'requested') fail('STATE_CHANGED', 'Guest list changed; reload before editing'); return 'denied'; }),
  cancel: lifecycleCommand('guestlist.cancel', row => { if (!['requested', 'approved'].includes(row.state)) fail('STATE_CHANGED', 'Guest list changed; reload before editing'); return 'cancelled'; }),
};
