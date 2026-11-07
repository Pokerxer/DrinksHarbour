'use strict';
const Booking = require('../../models/Booking');
const Claim = require('../../models/VenueCapacityClaim');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { keys, validateRequest } = require('./experience-validation');
const { id } = require('./eligibility');
function enabled() { if (process.env.VENUE_CAPACITY_ENABLED !== 'true') fail('CAPACITY_NOT_ENABLED', 'Capacity booking is not enabled', 404); }
async function acceptRequest(args) {
  enabled(); requireId(args.bookingId);
  if (!Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED');
  keys(args.input, ['resourceIds', 'policyVersion', 'amendment']);
  const input = args.input.amendment ? validateRequest(args.input.amendment) : null;
  const context = await loadVenueContext({ ...args, action: 'requests.review' });
  return runVenueOperation({ ...args, actor: context.actor, operation: 'request.accept', key: args.idempotencyKey, payload: { bookingId: args.bookingId, expectedVersion: args.expectedVersion, input: args.input }, targetType: 'Booking', execute: async ({ mongoSession }) => {
    await loadVenueContext({ ...args, action: 'requests.review', mongoSession });
    const row = await Booking.findOne({ _id: args.bookingId, tenant: args.tenantId, location: args.locationId, requestMode: 'request_only' }).session(mongoSession);
    if (!row) fail('NOT_FOUND', 'Request not found', 404);
    if (row.requestVersion !== args.expectedVersion || !['pending', 'confirmed'].includes(row.status) || row.serviceSession || row.acquisitionAuthority !== 'server') fail('STATE_CHANGED', 'Request changed; refresh');
    const previous = await Claim.findOne({ tenant: args.tenantId, location: args.locationId, booking: row._id }).session(mongoSession).lean();
    const config = await require('../../models/VenueCapacityPolicy').findOne({ tenant: args.tenantId, location: args.locationId, enabled: true }).session(mongoSession).lean();
    const financial = row.financialPolicy || (config?.financialPolicyVersion ? await require('./financial-policy').approvedSnapshot({ tenantId: args.tenantId, locationId: args.locationId, version: config.financialPolicyVersion, mongoSession }) : null);
    if (financial && process.env.VENUE_MONEY_ENABLED !== 'true') fail('VENUE_MONEY_NOT_ENABLED', 'Financial booking commitments are paused');
    const deadline = financial ? row.depositDeadline || new Date(Date.now() + financial.paymentWindowSeconds * 1000) : null;
    const claim = await require('./capacity').acquire({ ...args, bookingId: id(row), resourceIds: args.input.resourceIds, policyVersion: args.input.policyVersion,
      bookingAt: input?.bookingAt || row.bookingAt.toISOString(), partySize: input?.partySize || row.partySize, expectedVersion: previous?.version, state: financial?.depositMinor > 0 && row.moneyState !== 'deposit_received' ? 'held' : 'confirmed' }, mongoSession);
    if (claim.state === 'held') { claim.expiresAt = deadline; await claim.save({ session: mongoSession }); }
    if (financial) { row.financialPolicy = financial; row.depositDeadline = deadline; }
    if (input) { row.bookingAt = input.bookingAt; row.partySize = input.partySize; row.guest = input.guest; }
    row.capacityClaim = claim._id; row.capacitySnapshot = require('./capacity').dto(claim);
    row.durationMin = claim.policySnapshot.durationMinutes; row.status = 'confirmed'; row.requestState = 'reviewed'; row.requestVersion++;
    await row.save({ session: mongoSession });
    return require('./reservations').requestDTO(row);
  } });
}
async function arriveClaim({ booking, tableIds, tenantId, locationId, now, mongoSession }) {
  if (!booking?.capacityClaim) return;
  const claim = await Claim.findOne({ _id: booking.capacityClaim, tenant: tenantId, location: locationId, booking: booking._id }).session(mongoSession);
  if (!claim || claim.state !== 'confirmed' || now < claim.start || now >= claim.end || tableIds.length !== claim.resources.length || tableIds.some(r => !claim.resources.some(c => id(c) === r))) fail('CAPACITY_UNAVAILABLE', 'Accepted capacity or arrival interval changed; contact the host');
  claim.state = 'arrived'; claim.version++; await claim.save({ session: mongoSession });
  booking.capacitySnapshot = require('./capacity').dto(claim);
}
async function assertWalkInCapacity(args, mongoSession) {
  // A walk-in must not consume a table promised during the configured seating interval.
  const policy = await require('../../models/VenueCapacityPolicy').findOne({ tenant: args.tenantId, location: args.locationId, enabled: true }).session(mongoSession).lean();
  if (!policy) return;
  const end = new Date(args.now.getTime() + (policy.durationMinutes + policy.bufferAfterMinutes) * 60000);
  const conflict = await Claim.exists({ tenant: args.tenantId, location: args.locationId, resources: { $in: args.tableIds },
    ...(args.bookingId ? { booking: { $ne: args.bookingId } } : {}), start: { $lt: end }, end: { $gt: args.now }, ...require('./capacity-policy').active(args.now) }).session(mongoSession);
  if (conflict) fail('CAPACITY_UNAVAILABLE', 'Table is committed to another booking during this visit');
}
module.exports = { enabled, acceptRequest, arriveClaim, assertWalkInCapacity };
