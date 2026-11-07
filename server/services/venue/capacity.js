'use strict';
const Policy = require('../../models/VenueCapacityPolicy');
const Claim = require('../../models/VenueCapacityClaim');
const Table = require('../../models/POSTable');
const { active, savePolicy } = require('./capacity-policy');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { requireId, fail } = require('./errors');
const { id } = require('./eligibility');
function interval(policy, bookingAt) {
  if (typeof bookingAt !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(bookingAt)) fail('INVALID_INPUT', 'Time requires an explicit UTC offset', 400);
  const at = new Date(bookingAt), start = new Date(at.getTime() - policy.bufferBeforeMinutes * 60000);
  const end = new Date(at.getTime() + (policy.durationMinutes + policy.bufferAfterMinutes) * 60000);
  if (!Number.isFinite(at.getTime()) || at <= new Date() || !policy.windows.some(w => start >= w.start && end <= w.end)) fail('CAPACITY_UNAVAILABLE', 'Outside configured service intervals');
  return { bookingAt: at, start, end };
}
function options(policy) { return [...policy.resources.map(r => [String(r)]), ...policy.combinations.map(c => c.map(String))]; }
function selection(policy, resourceIds) {
  if (!Array.isArray(resourceIds) || !resourceIds.length || new Set(resourceIds).size !== resourceIds.length) fail('INVALID_INPUT', 'Choose distinct tables', 400);
  resourceIds.forEach(requireId);
  const selected = [...resourceIds].sort();
  if (!options(policy).some(o => o.length === selected.length && o.sort().every((r, i) => r === selected[i]))) fail('CAPACITY_UNAVAILABLE', 'Combination is not configured');
  return selected;
}
async function policyFor(args, mongoSession) {
  const policy = await Policy.findOne({ tenant: args.tenantId, location: args.locationId, enabled: true }).session(mongoSession);
  if (!policy) fail('CAPACITY_NOT_CONFIGURED', 'Capacity is not enabled');
  return policy;
}
const dto = row => ({ id: id(row), bookingId: id(row.booking), state: row.state, version: row.version, resourceIds: row.resources.map(String), start: row.start.toISOString(), end: row.end.toISOString(), expiresAt: row.expiresAt?.toISOString() || null, policyVersion: row.policyVersion });
async function lockTables(args, resources, mongoSession, { occupied = false } = {}) {
  for (const resource of [...new Set(resources)].sort()) {
    const changed = await Table.updateOne({ _id: resource, tenant: args.tenantId, location: args.locationId, ...(occupied ? {} : { status: 'available', currentTabId: null }) }, { $inc: { venueVersion: 1 } }, { session: mongoSession });
    if (!changed.modifiedCount) fail('CAPACITY_UNAVAILABLE', 'Table is unavailable');
  }
}
async function acquire(args, mongoSession) {
  const policy = await policyFor(args, mongoSession);
  if (args.policyVersion !== policy.version) fail('STATE_CHANGED', 'Capacity configuration changed');
  const resources = selection(policy, args.resourceIds), times = interval(policy, args.bookingAt);
  if (!Number.isInteger(args.partySize) || args.partySize < 1 || args.partySize > 100) fail('INVALID_INPUT', 'Invalid party size', 400);
  const previous = await Claim.findOne({ tenant: args.tenantId, booking: args.bookingId }).session(mongoSession);
  if (previous && id(previous.location) !== args.locationId) fail('NOT_FOUND', 'Claim not found', 404);
  if (previous && previous.state !== 'released' && !(previous.state === 'held' && previous.expiresAt <= new Date()) && args.expectedVersion !== previous.version) fail('STATE_CHANGED', 'Claim changed');
  if (previous?.state === 'arrived') fail('STATE_CHANGED', 'Arrived claims cannot be amended');
  await Policy.updateOne({ _id: policy._id, tenant: args.tenantId, version: policy.version }, { $inc: { lockVersion: 1 } }, { session: mongoSession });
  await lockTables(args, [...resources, ...(previous?.resources || []).map(String)], mongoSession);
  const tables = await Table.find({ tenant: args.tenantId, location: args.locationId, _id: { $in: resources } }).session(mongoSession).lean();
  if (tables.length !== resources.length || tables.reduce((n, t) => n + t.seats, 0) < args.partySize) fail('CAPACITY_UNAVAILABLE', 'Insufficient seats');
  const overlap = await Claim.exists({ tenant: args.tenantId, location: args.locationId, booking: { $ne: args.bookingId }, resources: { $in: resources }, start: { $lt: times.end }, end: { $gt: times.start }, ...active() }).session(mongoSession);
  if (overlap) fail('CAPACITY_UNAVAILABLE', 'These tables are already committed');
  const state = args.state || 'confirmed';
  if (!['held', 'confirmed'].includes(state)) fail('INVALID_INPUT', 'Invalid claim state', 400);
  const row = previous || new Claim({ tenant: args.tenantId, location: args.locationId, booking: args.bookingId });
  Object.assign(row, times, { resources, state, expiresAt: state === 'held' ? new Date(Date.now() + policy.holdSeconds * 1000) : null, policyVersion: policy.version,
    policySnapshot: { durationMinutes: policy.durationMinutes, bufferBeforeMinutes: policy.bufferBeforeMinutes, bufferAfterMinutes: policy.bufferAfterMinutes, timezone: policy.timezone }, version: (previous?.version || 0) + 1 });
  await row.save({ session: mongoSession });
  return row;
}
async function claim(args) {
  requireId(args.bookingId);
  const context = await loadVenueContext({ ...args, action: 'requests.review' });
  return runVenueOperation({ ...args, actor: context.actor, operation: 'capacity.claim', key: args.idempotencyKey, targetType: 'Booking', payload: { bookingId: args.bookingId, resourceIds: args.resourceIds, bookingAt: args.bookingAt, partySize: args.partySize, policyVersion: args.policyVersion, expectedVersion: args.expectedVersion, state: args.state }, execute: async ({ mongoSession }) => {
    await loadVenueContext({ ...args, action: 'requests.review', mongoSession });
    const booking=await require('../../models/Booking').findOne({_id:args.bookingId,tenant:args.tenantId,location:args.locationId}).session(mongoSession);
    if(!booking)fail('NOT_FOUND','Booking not found',404);
    if(!['pending','confirmed'].includes(booking.status)||booking.serviceSession)fail('STATE_CHANGED','Booking no longer accepts a capacity amendment');
    return dto(await acquire(args, mongoSession));
  } });
}
async function releaseClaim(args, mongoSession) {
  const row = await Claim.findOne({ tenant: args.tenantId, location: args.locationId, booking: args.bookingId }).session(mongoSession);
  if (!row || row.state === 'released') return;
  if (row.state === 'arrived') fail('STATE_CHANGED', 'Arrived visit requires canonical completion');
  await lockTables(args, row.resources.map(String), mongoSession, { occupied: true });
  row.state = 'released'; row.version++; await row.save({ session: mongoSession });
}
async function release(args) {
  const context = await loadVenueContext({ ...args, action: 'requests.review' });
  return runVenueOperation({ ...args, actor: context.actor, operation: 'capacity.release', key: args.idempotencyKey, payload: { bookingId: requireId(args.bookingId) }, targetType: 'Booking', execute: async ({ mongoSession }) => {
    await loadVenueContext({ ...args, action: 'requests.review', mongoSession });
    await releaseClaim(args, mongoSession); return { id: args.bookingId, version: 0 };
  } });
}
async function readAvailability(args, mongoSession = null) {
  const policy = await policyFor(args, mongoSession), times = interval(policy, args.bookingAt);
  if (!Number.isInteger(args.partySize) || args.partySize < 1 || args.partySize > 100) fail('INVALID_INPUT', 'Invalid party size', 400);
  const tables = await Table.find({ tenant: args.tenantId, location: args.locationId, _id: { $in: policy.resources }, status: 'available', currentTabId: null }).session(mongoSession).lean();
  const claims = await Claim.find({ tenant: args.tenantId, location: args.locationId, start: { $lt: times.end }, end: { $gt: times.start }, ...active() }).session(mongoSession).select('resources').lean();
  const busy = new Set(claims.flatMap(c => c.resources.map(String)));
  return { policyVersion: policy.version, timezone: policy.timezone, durationMinutes: policy.durationMinutes, asOf: new Date().toISOString(), options: options(policy).filter(o => o.every(r => !busy.has(r) && tables.some(t => id(t) === r)) && tables.filter(t => o.includes(id(t))).reduce((n, t) => n + t.seats, 0) >= args.partySize).map(resourceIds => ({ resourceIds })) };
}
async function availability(args) { await loadVenueContext({ ...args, action: 'experience.read' }); return readAvailability(args); }
async function ensureIndexes() { for (const Model of [Policy, Claim, require('../../models/VenueOperation')]) await Model.createIndexes(); await require('../../models/AuditLog').createCollection(); }
module.exports = { savePolicy, claim, release, acquire, releaseClaim, availability, readAvailability, interval, lockTables, ensureIndexes, dto };
