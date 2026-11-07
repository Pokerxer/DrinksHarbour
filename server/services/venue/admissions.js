'use strict';
// services/venue/admissions.js — Phase-4 E2 Task 2: admission entitlements + the
// shared-cap redemption ledger.
//
// ONE CAPACITY LEDGER (umbrella invariant 1): occurrence.guestsAdmitted is the atomic
// shared counter. EVERY admission mode — guest list ('guestlist'), flagged VIP
// ('vip'), and the later E4/E5 kinds ('table_inclusion', 'ticket') — consumes the
// SAME counter under a $expr guard against capacity.maxGuests, inside the SAME
// transaction as the per-entitlement usedCount guard and the redemption row insert.
// There is no second stock pool.
//
// Documented counter semantics (guestsAdmitted):
// - `guestsAdmitted` counts guests admitted THROUGH the door; a redemption carries
//   `guests` = the EXACT number present (partial-party arrival: any 1..partySize —
//   the door admits who is there, not the whole allowance).
// - ENTRY is once per token: kind 'entry' rows are unique per {tenant, token}
//   (partial unique index). A reused token fails TOKEN_ALREADY_USED — under two
//   concurrent scans of one token exactly ONE commits (the loser's transaction
//   rolls back, counter untouched).
// - RE-ENTRY never touches the counter: guests who exit and return re-enter within
//   their ORIGINAL entry count, so the entry row's admission still stands — a
//   re-entry row (kind 're-entry', reEntryOf = the entry row) is the audit record.
//   There are no exit scans in E2, so capacity is never freed; the per-token
//   re-entry cap is occurrence.admissionPolicy.maxReEntries (0/absent = re-entry
//   not permitted; limit reached → ADMISSION_POLICY_REFUSED).
// - The cap counts ADMITTANCES, not scans: re-entry scans cannot inflate or release
//   it; the $expr guard makes the last guest slots first-committed-first-served
//   (cap race: exactly one loser, CAPACITY_UNAVAILABLE).
//
// Door surfaces carry MINIMUM details only: name + partySize + result (no spend, no
// notes, no guest history — umbrella invariant 4). Age policy: when the occurrence
// publishes a minimumAge, the scan must attest `ageVerified: true`; refusal is
// ADMISSION_POLICY_REFUSED with the DISCLOSED admission terms in the message.
//
// Fail codes: INVALID_INPUT (400); NOT_FOUND (404) unknown/misrouted token or tenancy;
// STATE_CHANGED (409); EVENT_CLOSED (409) cancelled/past occurrence or expired
// entitlement; TOKEN_ALREADY_USED (409); PARTY_SIZE_EXCEEDED (409);
// ADMISSION_POLICY_REFUSED (409); CAPACITY_UNAVAILABLE (409) shared cap exhausted.
// issueEntitlement rides 'guestlists.write' (approval gates issuance), scans ride
// 'door.scan' (assigned occurrence only, see door.js). All mutations are
// runVenueOperation-idempotent with AuditLog rows.

const crypto = require('node:crypto');
const Occurrence = require('../../models/VenueEventOccurrence');
const Entitlement = require('../../models/VenueAdmissionEntitlement');
const Redemption = require('../../models/VenueAdmissionRedemption');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { assertDoorAssigned } = require('./door');
const { assertNotClosed } = require('./events');

function entitlementDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), locationId: id(row.location), occurrenceId: id(row.occurrence),
    kind: row.kind, sourceRef: row.sourceRef ? id(row.sourceRef) : null, label: row.label || null,
    issuedCount: row.issuedCount, usedCount: row.usedCount,
    tokens: (row.tokens || []).map(token => ({ token: token.token, partySize: token.partySize })),
    agePolicySnapshot: row.agePolicySnapshot ? {
      version: row.agePolicySnapshot.version,
      ...(row.agePolicySnapshot.minimumAge == null ? {} : { minimumAge: row.agePolicySnapshot.minimumAge }),
      admissionTerms: row.agePolicySnapshot.admissionTerms,
    } : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

function redemptionDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), occurrenceId: id(row.occurrence), entitlementId: id(row.entitlement),
    token: row.token, guests: row.guests, kind: row.kind,
    reEntryOf: row.reEntryOf ? id(row.reEntryOf) : null,
    at: row.at ? new Date(row.at).toISOString() : null,
    by: row.by ? id(row.by) : null, deviceId: row.deviceId || null,
  };
}

// DOOR RESULT — MINIMUM details only. Nothing else may leak through a scan response
// (no spend, no notes, no phone, no guest history — asserted by key set in tests).
function doorResultDTO(entitlement, token, result) {
  return { name: entitlement.label || 'Guest', partySize: token.partySize, result };
}

// The occurrence a door/issuance command runs against, with its gates applied.
// Draft occurrences are NOT_FOUND (never announced); cancelled/past → EVENT_CLOSED.
async function doorOccurrence(tenantId, locationId, occurrenceId, location, mongoSession) {
  const occurrence = await Occurrence.findOne({ _id: occurrenceId, tenant: tenantId, location }).session(mongoSession);
  if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
  if (occurrence.publication === 'draft') fail('NOT_FOUND', 'Event occurrence not found', 404);
  assertNotClosed(occurrence.occurrenceDate, location);
  if (occurrence.publication === 'cancelled') fail('EVENT_CLOSED', 'This occurrence has been cancelled', 409);
  return occurrence;
}

async function issueEntitlement(args) {
  requireId(args.guestListId);
  const context = await loadVenueContext({ ...args, action: 'guestlists.write' });
  return runVenueOperation({
    targetType: 'VenueAdmissionEntitlement', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'entitlement.issue', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId, guestListId: args.guestListId },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, action: 'guestlists.write', mongoSession });
      const occurrence = await doorOccurrence(args.tenantId, args.locationId, requireId(args.occurrenceId), fresh.location, mongoSession);
      const guestList = await require('../../models/VenueEventGuestList').findOne({ _id: args.guestListId, tenant: args.tenantId, location: args.locationId, occurrence: occurrence._id }).session(mongoSession);
      if (!guestList) fail('NOT_FOUND', 'Guest list entry not found', 404);
      if (guestList.state !== 'approved') fail('INVALID_INPUT', 'Only approved guest lists can issue admission entitlements', 400);
      if (!guestList.cutoffAt || guestList.cutoffAt.getTime() < Date.now()) fail('INVALID_INPUT', 'The guest list cutoff has passed; no further entitlements can be issued', 400);
      const existing = await Entitlement.findOne({ tenant: args.tenantId, occurrence: occurrence._id, sourceRef: guestList._id }).session(mongoSession).lean();
      if (existing) fail('INVALID_INPUT', 'An admission entitlement was already issued for this guest list', 400);
      const [row] = await Entitlement.create([{
        tenant: args.tenantId, location: args.locationId, occurrence: occurrence._id,
        kind: guestList.vip?.flagged ? 'vip' : 'guestlist', sourceRef: guestList._id, label: guestList.name,
        issuedCount: guestList.allowedCount, usedCount: 0,
        tokens: [{ token: `gl-${crypto.randomBytes(16).toString('hex')}`, partySize: guestList.allowedCount }],
        agePolicySnapshot: {
          version: occurrence.version,
          ...(occurrence.agePolicy?.minimumAge == null ? {} : { minimumAge: occurrence.agePolicy.minimumAge }),
          admissionTerms: occurrence.agePolicy?.admissionTerms || '',
        },
        expiresAt: occurrence.endAt,
      }], { session: mongoSession });
      return entitlementDTO(row);
    },
  });
}

// The token → entitlement resolution for a scan: tokens are unique per tenant; a
// token that exists but belongs to ANOTHER occurrence is a routing error → NOT_FOUND.
async function resolveToken(tenantId, occurrenceId, token, mongoSession) {
  if (typeof token !== 'string' || token.length < 8 || token.length > 64) fail('NOT_FOUND', 'Unknown admission token', 404);
  const entitlement = await Entitlement.findOne({ tenant: tenantId, 'tokens.token': token }).session(mongoSession);
  if (!entitlement || id(entitlement.occurrence) !== occurrenceId) fail('NOT_FOUND', 'Unknown admission token', 404);
  return entitlement;
}

async function redeem(args) {
  requireId(args.occurrenceId);
  if (args.ageVerified !== undefined && typeof args.ageVerified !== 'boolean') fail('INVALID_INPUT', 'ageVerified is a boolean', 400);
  const context = await loadVenueContext({ ...args, action: 'door.scan' });
  const result = await runVenueOperation({
    targetType: 'VenueAdmissionRedemption', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'admission.redeem', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId, token: args.token, guests: args.guests, ageVerified: args.ageVerified === true, deviceId: args.deviceId },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, action: 'door.scan', mongoSession });
      const occurrence = await doorOccurrence(args.tenantId, args.locationId, args.occurrenceId, fresh.location, mongoSession);
      assertDoorAssigned(occurrence, fresh.actor);
      const entitlement = await resolveToken(args.tenantId, args.occurrenceId, args.token, mongoSession);
      // A token that already has its entry row is DONE — check BEFORE the cap and
      // allowance guards so a reused token (sequential, or the losing transaction of
      // a concurrent scan retried by withTransaction) is always TOKEN_ALREADY_USED.
      const used = await Redemption.findOne({ tenant: args.tenantId, token: args.token, kind: 'entry' }).session(mongoSession);
      if (used) fail('TOKEN_ALREADY_USED', 'This admission token has already been used', 409);
      if (entitlement.expiresAt && entitlement.expiresAt.getTime() < Date.now()) fail('EVENT_CLOSED', 'This admission entitlement has expired', 409);
      const token = entitlement.tokens.find(row => row.token === args.token);
      const guests = args.guests;
      if (!Number.isInteger(guests) || guests < 1 || guests > token.partySize) fail('PARTY_SIZE_EXCEEDED', `A scan admits 1 to ${token.partySize} guests`, 409);
      // Age/admission policy: an unverified age never admits; refusal discloses the
      // published terms (the policy itself is snapshotted on the entitlement).
      if (occurrence.agePolicy?.minimumAge != null && args.ageVerified !== true) {
        fail('ADMISSION_POLICY_REFUSED', `Admission policy refused: ${occurrence.agePolicy.admissionTerms || `Guests must be ${occurrence.agePolicy.minimumAge}+ with valid ID.`}`, 409);
      }
      // 1/3 — the SHARED CAP: atomic increment guarded by $expr (last slots are
      // first-committed-first-served; a lost race is CAPACITY_UNAVAILABLE).
      const capped = await Occurrence.findOneAndUpdate(
        { _id: occurrence._id, tenant: args.tenantId, $expr: { $lte: [{ $add: ['$guestsAdmitted', guests] }, '$capacity.maxGuests'] } },
        { $inc: { guestsAdmitted: guests } }, { session: mongoSession },
      );
      if (!capped) fail('CAPACITY_UNAVAILABLE', 'This occurrence is at capacity', 409);
      // 2/3 — per-entitlement ledger guard: usedCount + guests <= issuedCount.
      const counted = await Entitlement.updateOne(
        { _id: entitlement._id, tenant: args.tenantId, usedCount: { $lte: entitlement.issuedCount - guests } },
        { $inc: { usedCount: guests } }, { session: mongoSession },
      );
      if (!counted.modifiedCount) fail('PARTY_SIZE_EXCEEDED', 'The party allowance is exhausted for this entitlement', 409);
      // 3/3 — the redemption row: unique {tenant, token} for kind 'entry' — a reused
      // token (sequential or concurrent) fails here and ROLLS BACK steps 1–2.
      try {
        await Redemption.create([{
          tenant: args.tenantId, location: args.locationId, occurrence: occurrence._id,
          entitlement: entitlement._id, token: token.token, guests, kind: 'entry', reEntryOf: null,
          by: context.actor.userId, deviceId: typeof args.deviceId === 'string' ? args.deviceId.slice(0, 100) : null,
        }], { session: mongoSession });
      } catch (error) {
        if (error.code === 11000) fail('TOKEN_ALREADY_USED', 'This admission token has already been used', 409);
        throw error;
      }
      return doorResultDTO(entitlement, token, 'admitted');
    },
  });
  // Post-commit VIP host alert (persist + emit, idempotent per redemption row, best
  // effort — see host-alerts.js): the redemption is already committed, so an alert
  // failure must never fail the scan response.
  await require('./host-alerts').afterRedeem({ tenantId: args.tenantId, locationId: args.locationId, occurrenceId: args.occurrenceId, token: args.token, req: args.req });
  return result;
}

async function redeemReEntry(args) {
  requireId(args.occurrenceId);
  const context = await loadVenueContext({ ...args, action: 'door.scan' });
  return runVenueOperation({
    targetType: 'VenueAdmissionRedemption', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'admission.reentry', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId, token: args.token, guests: args.guests, deviceId: args.deviceId },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, action: 'door.scan', mongoSession });
      const occurrence = await doorOccurrence(args.tenantId, args.locationId, args.occurrenceId, fresh.location, mongoSession);
      assertDoorAssigned(occurrence, fresh.actor);
      const entitlement = await resolveToken(args.tenantId, args.occurrenceId, args.token, mongoSession);
      const token = entitlement.tokens.find(row => row.token === args.token);
      const guests = args.guests;
      const entry = await Redemption.findOne({ tenant: args.tenantId, token: args.token, kind: 'entry' }).session(mongoSession);
      if (!entry) fail('INVALID_INPUT', 'No entry redemption exists for this token; re-entry requires an admitted party', 400);
      // re-entering guests fit within their ORIGINAL entry count (counter semantics above)
      if (!Number.isInteger(guests) || guests < 1 || guests > entry.guests) fail('PARTY_SIZE_EXCEEDED', `Re-entry admits 1 to ${entry.guests} guests (the party's original count)`, 409);
      const maxReEntries = occurrence.admissionPolicy?.maxReEntries ?? 0;
      const previous = await Redemption.countDocuments({ tenant: args.tenantId, token: args.token, kind: 're-entry' }).session(mongoSession);
      if (previous >= maxReEntries) fail('ADMISSION_POLICY_REFUSED', maxReEntries === 0 ? 'Re-entry is not permitted for this event' : 'The re-entry limit has been reached for this token', 409);
      await Redemption.create([{
        tenant: args.tenantId, location: args.locationId, occurrence: occurrence._id,
        entitlement: entitlement._id, token: token.token, guests, kind: 're-entry', reEntryOf: entry._id,
        by: context.actor.userId, deviceId: typeof args.deviceId === 'string' ? args.deviceId.slice(0, 100) : null,
      }], { session: mongoSession });
      // NO cap change, NO usedCount change — exiting guests re-enter within their
      // original count; the entry row's admission still stands.
      return doorResultDTO(entitlement, token, 're_entered');
    },
  });
}

async function listRedemptions(args) {
  requireId(args.occurrenceId);
  const context = await loadVenueContext({ ...args, action: 'door.scan' });
  const occurrence = await Occurrence.findOne({ _id: args.occurrenceId, tenant: args.tenantId, location: args.locationId }).lean();
  if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
  assertDoorAssigned(occurrence, context.actor);
  if (args.after) requireId(args.after);
  const rows = await Redemption.find({ tenant: args.tenantId, occurrence: args.occurrenceId, ...(args.after ? { _id: { $lt: requireId(args.after) } } : {}) }).sort({ _id: -1 }).limit(51).lean();
  return { items: rows.slice(0, 50).map(redemptionDTO), next: rows.length > 50 ? id(rows[49]) : null };
}

module.exports = { entitlementDTO, redemptionDTO, doorResultDTO, issueEntitlement, redeem, redeemReEntry, listRedemptions };
