'use strict';
const crypto = require('node:crypto'); const mongoose = require('mongoose');
const Operation = require('../../models/VenueOperation'); const { fail } = require('./errors');
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    if (value._bsontype === 'ObjectId') return String(value);
    if (Array.isArray(value)) return value.map(canonical);
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  }
  return value;
}
function fingerprint(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function validateKey(key) { if (typeof key !== 'string' || !key.trim() || key.length > 128) fail('IDEMPOTENCY_KEY_REQUIRED', 'A request key of 1–128 characters is required', 400); return key; }
async function runVenueOperation({ tenantId, locationId, actor, operation, key, payload, execute, targetType = 'VenueServiceSession' }) {
  validateKey(key);
  const filter = { tenant: tenantId, operation, key };
  const hash = fingerprint({ actor: actor.userId, locationId, payload });
  const replay = row => { if (row.requestHash !== hash) fail('IDEMPOTENCY_CONFLICT', 'Request key was already used with different contents'); return row.result; };
  const mongoSession = await mongoose.startSession();
  try {
    return await mongoSession.withTransaction(async () => {
      const previous = await Operation.findOne(filter).session(mongoSession).lean();
      if (previous) return replay(previous);
      const result = await execute({ mongoSession });
      await Operation.create([{ ...filter, actor: actor.userId, location: locationId, requestHash: hash, result }], { session: mongoSession });
      await require('../../models/AuditLog').create([{ actorUserId: actor.userId, actorRole: actor.role, action: `VENUE_${operation.toUpperCase().replaceAll('.', '_')}`, actionCategory: 'update', targetType, targetId: result.id || result.sessionId, targetTenantId: tenantId, changes: { after: { locationId, operationKey: key, version: result.version } } }], { session: mongoSession });
      return result;
    }, { maxCommitTimeMS: 10000 });
  } catch (error) {
    if (error.code === 11000) {
      const previous = await Operation.findOne(filter).lean();
      if (previous) return replay(previous);
      fail('STATE_CHANGED', 'Another device changed this visit; refresh');
    }
    throw error;
  } finally { await mongoSession.endSession(); }
}
module.exports = { fingerprint, validateKey, runVenueOperation };
