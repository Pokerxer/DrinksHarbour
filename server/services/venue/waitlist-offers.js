'use strict';
// services/venue/waitlist-offers.js — Phase-4 E3 Task 2: offer → bounded hold →
// acceptance race. Split from waitlist.js purely for the <300-line discipline;
// waitlist.js re-exports every function here, so the public module surface is
// `services/venue/waitlist`.
//
// EXCLUSIVITY RULE (plan-delegated "decide + document"): an offer is exclusive
// at BOTH levels —
//  (a) PER ENTRY: the state machine allows exactly one active offer (waiting →
//      offered; a second offer on an offered entry fails STATE_CHANGED) —
//      invitations are never sent to every waiting guest simultaneously (11 §3).
//  (b) PER RESOURCE: the hold is a REAL VenueCapacityClaim ('held') over
//      specific tables created through the EXISTING capacity.acquire claim path,
//      so the same table can never be promised to two guests — overlapping
//      active claims fail CAPACITY_UNAVAILABLE (Phase-2 serialization, no new
//      hold system, umbrella invariant 1).
//
// EXPIRY RULE: the acceptance deadline is `now + offerMinutes` (the location's
// venueServices.waitlistOfferMinutes, bounded 1..240, default 15 — configurable
// per location). The held claim's expiresAt is SET TO that same deadline (the
// acceptRequest override idiom), so the EXISTING capacity-expiry sweep releases
// the hold exactly at the deadline; the sweep ALSO flips the entry offered →
// expired (additive extension in capacity-expiry.js). A late acceptance AFTER
// the deadline → WAITLIST_OFFER_EXPIRED (409): NO confirmation, NO charge; a
// hold still live at that moment (the sweep has not run yet) is released
// immediately through the existing release path.
//
// ACCEPTANCE: before the deadline the offer converts into the NORMAL acceptance
// flow — `capacity-bookings.acceptRequest` on the offer's pending Booking (the
// same command the staff request queue uses), which acquires capacity there and
// routes deposit-required policies into a PAYMENT HOLD (claim stays 'held' on
// the financial payment window — never an unconditional confirmation, 11 §3).
// Two-phase by construction (nested venue operations cannot share one
// transaction, the host-alerts precedent): phase 1 = the acceptance operation
// (`.booking` key suffix), phase 2 = the entry's offered→accepted transition
// (`.entry` suffix); a retry with the same key replays phase 1 and heals phase 2.
// Accept/decline/offer are STAFF commands: the verifiedContactRoute is
// recorded-not-sent, so no guest-facing offer link exists to accept — the guest
// responds through their own channel and staff record the outcome (the N04
// staff response queue; the existing request-acceptance auth pattern:
// manager, or venue-assigned staff with pos:sell via the eligibility ladder).
//
// Fail codes (documented per plan): WAITLIST_NOT_OFFERED (409) accept/decline
// without an active offer; WAITLIST_OFFER_EXPIRED (409) after the deadline
// (also for already-swept entries); reused: INVALID_INPUT, NOT_FOUND,
// STATE_CHANGED, CAPACITY_NOT_CONFIGURED, CAPACITY_UNAVAILABLE,
// CAPACITY_NOT_ENABLED, EVENT_CLOSED, plus every acceptRequest code.

const crypto = require('node:crypto');
const Entry = require('../../models/VenueWaitlistEntry');
const Policy = require('../../models/VenueCapacityPolicy');
const Booking = require('../../models/Booking');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { keys } = require('./experience-validation');
const { id } = require('./eligibility');

const DEFAULT_OFFER_MINUTES = 15;
// The acceptance deadline, configurable per location (venueServices.
// waitlistOfferMinutes); anything unbounded/invalid falls back to 15 minutes.
function offerMinutes(location) {
  const minutes = Number(location.venueServices && location.venueServices.waitlistOfferMinutes);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 240 ? minutes : DEFAULT_OFFER_MINUTES;
}

function offerInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Offer input is required', 400);
  keys(raw, ['bookingAt', 'resourceIds']);
  const bookingAt = require('./waitlist').instant(raw.bookingAt, 'bookingAt'); // lazy require: waitlist.js re-exports this module
  let resourceIds = null;
  if (raw.resourceIds !== undefined && raw.resourceIds !== null) {
    if (!Array.isArray(raw.resourceIds) || !raw.resourceIds.length || raw.resourceIds.length > 20) fail('INVALID_INPUT', 'resourceIds is a list of 1..20 tables', 400);
    resourceIds = raw.resourceIds.map(requireId);
  }
  return { bookingAt, resourceIds };
}

// Resolve the offer's tables: staff-chosen resourceIds (validated against the
// guest's acceptable zones) or an automatic first-fit pick from the EXISTING
// availability read (filtered by acceptable zones when the entry names any).
async function chooseResources({ args, row, input, mongoSession }) {
  const zoneOf = new Map();
  if (row.acceptableZones.length) {
    const profile = await require('../../models/VenueLocationProfile').findOne({ tenant: args.tenantId, location: args.locationId }).select('floor').session(mongoSession).lean();
    for (const table of (profile && profile.floor && profile.floor.tables) || []) zoneOf.set(String(table.tableId), table.zone);
  }
  const inZone = tableId => !row.acceptableZones.length || row.acceptableZones.includes(zoneOf.get(tableId));
  if (input.resourceIds) {
    if (new Set(input.resourceIds).size !== input.resourceIds.length) fail('INVALID_INPUT', 'Choose distinct tables', 400);
    if (input.resourceIds.some(tableId => !inZone(tableId))) fail('INVALID_INPUT', 'The selected table is outside the guest\'s acceptable zones', 400);
    return input.resourceIds;
  }
  const availability = await require('./capacity').readAvailability({ tenantId: args.tenantId, locationId: args.locationId, bookingAt: input.bookingAt.toISOString(), partySize: row.partySize }, mongoSession);
  const fit = availability.options.find(option => option.resourceIds.every(inZone));
  if (!fit) fail('CAPACITY_UNAVAILABLE', 'No table matching the party and acceptable zones is available in the window', 409);
  return fit.resourceIds;
}

async function offer(args) {
  requireId(args.entryId);
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Waitlist version required; reload before offering');
  const input = offerInput(args.input);
  const original = await Entry.findOne({ _id: args.entryId, tenant: args.tenantId }).lean();
  if (!original) fail('NOT_FOUND', 'Waitlist entry not found', 404);
  const locationId = id(original.location);
  const context = await loadVenueContext({ ...args, locationId, action: 'waitlists.write' });
  return runVenueOperation({
    targetType: 'VenueWaitlistEntry', tenantId: args.tenantId, locationId, actor: context.actor,
    operation: 'waitlist.offer', key: args.idempotencyKey, payload: { entryId: args.entryId, expectedVersion: args.expectedVersion, input },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, locationId, action: 'waitlists.write', mongoSession });
      const row = await Entry.findOne({ _id: args.entryId, tenant: args.tenantId, location: locationId }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Waitlist entry not found', 404);
      if (row.state !== 'waiting') fail('STATE_CHANGED', 'Waitlist entry changed; reload before offering'); // one active offer per entry
      if (row.version !== args.expectedVersion) fail('STATE_CHANGED', 'Waitlist entry changed elsewhere; reload before offering');
      const at = input.bookingAt;
      if (at < row.window.earliestAt || at > row.window.latestAt) fail('INVALID_INPUT', 'bookingAt must fall inside the entry\'s requested window', 400);
      const policy = await Policy.findOne({ tenant: args.tenantId, location: locationId, enabled: true }).session(mongoSession).lean();
      if (!policy) fail('CAPACITY_NOT_CONFIGURED', 'Capacity is not enabled');
      const resourceIds = await chooseResources({ args: { ...args, locationId }, row, input, mongoSession });
      // The offer booking: a pending request-only Booking the hold rides — it is
      // NEVER confirmed by the offer itself (it confirms only through accept).
      const [booking] = await Booking.create([{ tenant: args.tenantId, location: locationId, createdBy: fresh.actor.userId,
        guest: { name: row.name, phone: row.phone }, partySize: row.partySize, bookingAt: at, status: 'pending', source: 'admin',
        acquisitionAuthority: 'server', requestMode: 'request_only', requestReference: `VR-${crypto.randomUUID()}`,
        requestState: 'submitted', requestVersion: 0, requestPolicy: { timezone: policy.timezone, policies: 'Waitlist offer: a table is held until the acceptance deadline; acceptance is required and an expired offer never confirms or charges.', locationName: fresh.location.name, venueName: fresh.tenant.name } }], { session: mongoSession });
      const claim = await require('./capacity').acquire({ tenantId: args.tenantId, locationId, bookingId: id(booking),
        resourceIds, bookingAt: at.toISOString(), partySize: row.partySize, policyVersion: policy.version, state: 'held' }, mongoSession);
      const expiresAt = new Date(Date.now() + offerMinutes(fresh.location) * 60000);
      claim.expiresAt = expiresAt; // the offer deadline replaces policy.holdSeconds — the existing sweep releases exactly there
      await claim.save({ session: mongoSession });
      row.state = 'offered';
      row.offer = { at: new Date(), expiresAt, claimRef: claim._id, bookingRef: booking._id };
      row.version = args.expectedVersion + 1;
      await row.save({ session: mongoSession });
      return require('./waitlist').waitlistDTO(row);
    },
  });
}

// The expiry gate shared by accept/decline: a deadline that has passed — whether
// or not the sweep has already run — is WAITLIST_OFFER_EXPIRED, and a hold the
// sweep has not reached yet is released immediately via the existing path.
async function expiredGate(entry, args) {
  const swept = entry.state === 'expired';
  const live = entry.state === 'offered' && entry.offer && entry.offer.expiresAt > new Date();
  if (live) return false;
  if (swept || entry.state === 'offered') {
    const claim = await require('../../models/VenueCapacityClaim').findOne({ _id: entry.offer.claimRef, tenant: args.tenantId }).lean();
    if (claim && claim.state === 'held') await require('./capacity').release({ tenantId: args.tenantId, locationId: id(entry.location), bookingId: id(entry.offer.bookingRef), actor: args.actor, idempotencyKey: `${args.idempotencyKey}.release` });
    fail('WAITLIST_OFFER_EXPIRED', 'The waitlist offer expired; the held table was released and nothing was confirmed or charged', 409);
  }
  return true;
}

async function accept(args) {
  requireId(args.entryId);
  const original = await Entry.findOne({ _id: args.entryId, tenant: args.tenantId }).lean();
  if (!original) fail('NOT_FOUND', 'Waitlist entry not found', 404);
  const locationId = id(original.location);
  if (!original.offer || !['offered', 'expired'].includes(original.state)) fail('WAITLIST_NOT_OFFERED', 'This waitlist entry has no active offer', 409);
  await expiredGate(original, args);
  const context = await loadVenueContext({ ...args, locationId, action: 'waitlists.write' });
  // Phase 1 — the NORMAL acceptance flow: capacity is acquired inside
  // acceptRequest (the same command the staff request queue uses), which turns
  // a deposit-required policy into a PAYMENT HOLD rather than confirming.
  const booking = await Booking.findOne({ _id: original.offer.bookingRef, tenant: args.tenantId, location: locationId, requestMode: 'request_only' }).lean();
  if (!booking || !['pending', 'confirmed'].includes(booking.status)) fail('STATE_CHANGED', 'The offered booking changed; reload the waitlist');
  const claim = await require('../../models/VenueCapacityClaim').findOne({ _id: original.offer.claimRef, tenant: args.tenantId, booking: booking._id }).lean();
  if (!claim) fail('STATE_CHANGED', 'The offered capacity hold changed; reload the waitlist');
  const requestDTO = await require('./capacity-bookings').acceptRequest({
    tenantId: args.tenantId, locationId, actor: context.actor, bookingId: id(booking), expectedVersion: booking.requestVersion,
    input: { resourceIds: claim.resources.map(String), policyVersion: claim.policyVersion }, idempotencyKey: `${args.idempotencyKey}.booking`,
  });
  // Phase 2 — the entry's offered→accepted transition (post-commit phase).
  return runVenueOperation({
    targetType: 'VenueWaitlistEntry', tenantId: args.tenantId, locationId, actor: context.actor,
    operation: 'waitlist.accept', key: `${args.idempotencyKey}.entry`, payload: { entryId: args.entryId, expectedVersion: original.version, bookingId: id(booking) },
    execute: async ({ mongoSession }) => {
      const row = await Entry.findOne({ _id: args.entryId, tenant: args.tenantId, location: locationId }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Waitlist entry not found', 404);
      if (row.state === 'offered') { row.state = 'accepted'; row.version += 1; await row.save({ session: mongoSession }); }
      else if (row.state !== 'accepted') fail('STATE_CHANGED', 'Waitlist entry changed; reload before accepting');
      return { ...require('./waitlist').waitlistDTO(row), acceptedBooking: { id: requestDTO.id, reference: requestDTO.reference, status: requestDTO.status } };
    },
  });
}

async function decline(args) {
  requireId(args.entryId);
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Waitlist version required; reload before declining');
  const original = await Entry.findOne({ _id: args.entryId, tenant: args.tenantId }).lean();
  if (!original) fail('NOT_FOUND', 'Waitlist entry not found', 404);
  const locationId = id(original.location);
  const context = await loadVenueContext({ ...args, locationId, action: 'waitlists.write' });
  return runVenueOperation({
    targetType: 'VenueWaitlistEntry', tenantId: args.tenantId, locationId, actor: context.actor,
    operation: 'waitlist.decline', key: args.idempotencyKey, payload: { entryId: args.entryId, expectedVersion: args.expectedVersion },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, locationId, action: 'waitlists.write', mongoSession });
      const row = await Entry.findOne({ _id: args.entryId, tenant: args.tenantId, location: locationId }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Waitlist entry not found', 404);
      if (row.state === 'expired') fail('WAITLIST_OFFER_EXPIRED', 'The waitlist offer already expired', 409);
      if (row.state !== 'offered') fail('WAITLIST_NOT_OFFERED', 'This waitlist entry has no active offer to decline', 409);
      if (row.offer.expiresAt <= new Date()) fail('WAITLIST_OFFER_EXPIRED', 'The waitlist offer already expired', 409);
      // release the hold through the EXISTING release path (same transaction)
      await require('./capacity').releaseClaim({ ...args, locationId, bookingId: id(row.offer.bookingRef) }, mongoSession);
      row.state = 'declined';
      row.version += 1;
      await row.save({ session: mongoSession });
      return require('./waitlist').waitlistDTO(row);
    },
  });
}

module.exports = { offer, accept, decline, offerMinutes };
