'use strict';
// services/venue/door.js — Phase-4 E2: the DOOR ROLE surface.
//
// Assignment rule (uniform — managers included): a door actor may only work
// occurrences where their userId is in occurrence.doorStaffIds; anyone else —
// including a tenant manager — is VENUE_PERMISSION_DENIED (403). This is enforced
// HERE (the eligibility ladder cannot see occurrence-level assignments; the ladder
// supplies the door.scan/events.write action checks and the 'events' capability).
//
// - assignDoorStaff (events.write): replaces the occurrence's doorStaffIds with the
//   supplied list (each an active tenant user). Occurrence configuration, so it rides
//   the events.write action / staffConfigurations limiter.
// - listDoorOccurrences (door.scan): the door picker — ONLY assigned occurrences,
//   with the shared-cap readout (guestsAdmitted / capacity.maxGuests).
// - redeem/redeemReEntry live in admissions.js and call assertDoorAssigned with the
//   occurrence they loaded — the same rule, applied at every door touch point.

const Occurrence = require('../../models/VenueEventOccurrence');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { assertNotClosed } = require('./events');

function assertDoorAssigned(occurrence, actor) {
  const assigned = (occurrence.doorStaffIds || []).some(staffId => id(staffId) === id(actor.userId));
  if (!assigned) fail('VENUE_PERMISSION_DENIED', 'Door work is limited to the staff assigned to this occurrence', 403);
}

function doorOccurrenceDTO(row) {
  return {
    id: id(row), locationId: id(row.location), eventSlug: row.eventSlug, name: row.name,
    occurrenceDate: row.occurrenceDate,
    startAt: row.startAt ? new Date(row.startAt).toISOString() : null,
    endAt: row.endAt ? new Date(row.endAt).toISOString() : null,
    capacity: row.capacity ? { maxGuests: row.capacity.maxGuests } : null,
    guestsAdmitted: row.guestsAdmitted ?? 0,
    agePolicy: row.agePolicy ? { ...(row.agePolicy.minimumAge == null ? {} : { minimumAge: row.agePolicy.minimumAge }), admissionTerms: row.agePolicy.admissionTerms } : null,
    admissionPolicy: { maxReEntries: row.admissionPolicy?.maxReEntries ?? 0 },
  };
}

async function assignDoorStaff(args) {
  requireId(args.occurrenceId);
  if (!Array.isArray(args.staffIds) || args.staffIds.length > 50) fail('INVALID_INPUT', 'staffIds is a list of at most 50 staff ids', 400);
  const staffIds = [...new Set(args.staffIds.map(requireId))];
  const context = await loadVenueContext({ ...args, action: 'events.write' });
  return runVenueOperation({
    targetType: 'VenueEventOccurrence', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'event.door_assign', key: args.idempotencyKey, payload: { occurrenceId: args.occurrenceId, staffIds },
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({ ...args, action: 'events.write', mongoSession });
      const occurrence = await Occurrence.findOne({ _id: args.occurrenceId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
      assertNotClosed(occurrence.occurrenceDate, fresh.location);
      if (occurrence.publication === 'cancelled') fail('EVENT_CLOSED', 'Cancelled occurrences take no door assignments', 409);
      if (staffIds.length) {
        const staff = await require('../../models/User').countDocuments({ _id: { $in: staffIds }, tenant: args.tenantId, status: 'active' }).session(mongoSession);
        if (staff !== staffIds.length) fail('NOT_FOUND', 'Staff member not found', 404);
      }
      occurrence.doorStaffIds = staffIds;
      occurrence.version += 1;
      await occurrence.save({ session: mongoSession });
      return require('./events').occurrenceDTO(occurrence);
    },
  });
}

async function listDoorOccurrences(args) {
  const context = await loadVenueContext({ ...args, action: 'door.scan' });
  const rows = await Occurrence.find({ tenant: args.tenantId, location: args.locationId, doorStaffIds: context.actor.userId }).sort({ occurrenceDate: 1, startAt: 1 }).limit(50).lean();
  return { items: rows.map(doorOccurrenceDTO) };
}

module.exports = { assertDoorAssigned, doorOccurrenceDTO, assignDoorStaff, listDoorOccurrences };
