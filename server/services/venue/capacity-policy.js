'use strict';
const Policy = require('../../models/VenueCapacityPolicy');
const Claim = require('../../models/VenueCapacityClaim');
const Table = require('../../models/POSTable');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { keys } = require('./experience-validation');
const { requireId, fail } = require('./errors');
const { id } = require('./eligibility');
const active = (now = new Date()) => ({ $or: [{ state: { $in: ['confirmed', 'arrived'] } }, { state: 'held', expiresAt: { $gt: now } }] });
function validatePolicy(input) {
  keys(input, ['enabled', 'timezone', 'resources', 'combinations', 'windows', 'durationMinutes', 'bufferBeforeMinutes', 'bufferAfterMinutes', 'holdSeconds', 'financialPolicyVersion']);
  if (typeof input.enabled !== 'boolean') fail('INVALID_INPUT', 'Choose capacity state', 400);
  try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format(); } catch { fail('INVALID_INPUT', 'Invalid timezone', 400); }
  if (typeof input.timezone !== 'string' || !Array.isArray(input.resources) || !input.resources.length || input.resources.length > 300 || new Set(input.resources).size !== input.resources.length) fail('INVALID_INPUT', 'Choose distinct resources', 400);
  input.resources.forEach(requireId);
  const integer = (key, min, max) => { if (!Number.isInteger(input[key]) || input[key] < min || input[key] > max) fail('INVALID_INPUT', `Invalid ${key}`, 400); };
  integer('durationMinutes', 15, 480); integer('bufferBeforeMinutes', 0, 120); integer('bufferAfterMinutes', 0, 120); integer('holdSeconds', 30, 1800);
  if (!Array.isArray(input.combinations) || input.combinations.length > 300 || input.combinations.some(c => !Array.isArray(c) || c.length < 2 || c.length > 20 || new Set(c).size !== c.length || c.some(r => !input.resources.includes(r)))) fail('INVALID_INPUT', 'Invalid table combinations', 400);
  if (!Array.isArray(input.windows) || !input.windows.length || input.windows.length > 366) fail('INVALID_INPUT', 'Configure dated service windows', 400);
  if (input.financialPolicyVersion != null && (!Number.isSafeInteger(input.financialPolicyVersion) || input.financialPolicyVersion < 1)) fail('INVALID_INPUT', 'Invalid financial policy version', 400);
  const windows = input.windows.map(w => {
    keys(w, ['start', 'end']);
    if (![w.start, w.end].every(s => typeof s === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(s))) fail('INVALID_INPUT', 'Service windows require explicit UTC offsets', 400);
    const start = new Date(w.start), end = new Date(w.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end - start > 2 * 86400000) fail('INVALID_INPUT', 'Invalid service window', 400);
    return { start, end };
  });
  return { ...input, windows };
}
async function savePolicy(args) {
  const input = validatePolicy(args.input);
  if (!Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED');
  const context = await loadVenueContext({ ...args, action: 'experience.manage' });
  return runVenueOperation({ ...args, actor: context.actor, operation: 'capacity.configure', key: args.idempotencyKey, payload: { input, expectedVersion: args.expectedVersion }, targetType: 'Warehouse', execute: async ({ mongoSession }) => {
    const fresh = await loadVenueContext({ ...args, action: 'experience.manage', mongoSession });
    if (input.timezone !== fresh.location.venueServices.timezone) fail('INVALID_INPUT', 'Use the operational location timezone', 400);
    let policy = await Policy.findOne({ tenant: args.tenantId, location: args.locationId }).session(mongoSession);
    if ((policy?.version || 0) !== args.expectedVersion) fail('STATE_CHANGED');
    // Writers touch the policy and physical tables, serializing against new claims.
    if (policy) { policy.lockVersion++; await policy.save({ session: mongoSession }); }
    if (await Claim.exists({ tenant: args.tenantId, location: args.locationId, ...active(), end: { $gt: new Date() } }).session(mongoSession)) fail('CAPACITY_COMMITMENTS_EXIST', 'Resolve live commitments before changing capacity');
    const union = [...new Set([...(policy?.resources || []).map(String), ...input.resources])].sort();
    for (const tableId of union) {
      const changed = await Table.updateOne({ _id: tableId, tenant: args.tenantId, location: args.locationId, currentTabId: null, status: 'available' }, { $set: { capacityManaged: input.enabled && input.resources.includes(tableId) }, $inc: { venueVersion: 1, __v: 1 } }, { session: mongoSession });
      if (!changed.modifiedCount) fail('CAPACITY_UNAVAILABLE', 'Resource unavailable or outside this location');
    }
    if (!policy) policy = new Policy({ tenant: args.tenantId, location: args.locationId });
    Object.assign(policy, input, { version: args.expectedVersion + 1 });
    await policy.save({ session: mongoSession });
    return { id: id(fresh.location), version: policy.version };
  } });
}
module.exports = { active, validatePolicy, savePolicy };
