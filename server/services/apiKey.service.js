'use strict';
const crypto = require('node:crypto');
const ApiKey = require('../models/ApiKey');
const Tenant = require('../models/Tenant');
const { resolveEntitlements } = require('./entitlements.service');
const { ValidationError, UnauthorizedError, ForbiddenError } = require('../utils/errors');

const SCOPES = ['inventory:read', 'bookings:read'];
const PUBLIC_FIELDS = '_id name prefix scopes createdAt expiresAt revokedAt';
const hashSecret = secret => crypto.createHash('sha256').update(secret).digest('hex');

async function issueKey(tenant, actor, body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const scopes = body.scopes;
  if (!name || name.length > 80 || !Array.isArray(scopes) || !scopes.length ||
      scopes.some(scope => !SCOPES.includes(scope))) throw new ValidationError('Provide a name and valid scopes');
  const days = body.expiresInDays ?? 90;
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new ValidationError('Expiry must be 1–365 days');
  if (scopes.includes('bookings:read') && !resolveEntitlements(tenant).capabilities.includes('table_management')) {
    throw new ForbiddenError('Booking scope requires table management');
  }
  const secret = `dhk_${crypto.randomBytes(32).toString('hex')}`;
  const key = await ApiKey.create({ tenant: tenant._id, createdBy: actor,
    name, scopes: [...new Set(scopes)], prefix: secret.slice(0, 12), hash: hashSecret(secret),
    expiresAt: new Date(Date.now() + days * 86400000) });
  return { secret, key: { _id: key._id, name, prefix: key.prefix, scopes: key.scopes,
    createdAt: key.createdAt, expiresAt: key.expiresAt, revokedAt: null } };
}

async function authenticateKey(secret, scope, now = new Date()) {
  if (typeof secret !== 'string' || !/^dhk_[a-f0-9]{64}$/.test(secret)) throw new UnauthorizedError('Invalid API key');
  const filter = { hash: hashSecret(secret), revokedAt: null, expiresAt: { $gt: now } };
  const key = await ApiKey.findOne(filter).lean();
  if (!key) throw new UnauthorizedError('Invalid API key');
  if (!key.scopes.includes(scope)) throw new ForbiddenError('API key scope denied');
  const tenant = await Tenant.findById(key.tenant).lean();
  const entitlements = resolveEntitlements(tenant, now);
  if (!tenant || tenant.status !== 'approved' || tenant.subscriptionStatus !== 'active' ||
      !entitlements.capabilities.includes('api_access')) throw new ForbiddenError('Tenant API access is inactive');
  if (scope === 'bookings:read' && !entitlements.capabilities.includes('table_management')) {
    throw new ForbiddenError('Table management is unavailable');
  }
  // Shared across processes; never cache revocation or tenant status. Reset and
  // consume atomically so concurrent requests cannot exceed 60 per UTC minute.
  const window = Math.floor(now.getTime() / 60000);
  await ApiKey.updateOne({ ...filter, rateWindow: { $lt: window } },
    { $set: { rateWindow: window, rateCount: 0 } });
  const consumed = await ApiKey.updateOne({ ...filter, rateWindow: window, rateCount: { $lt: 60 } },
    { $inc: { rateCount: 1 } });
  if (!consumed.modifiedCount) {
    const error = new ForbiddenError('API key rate limit exceeded or key revoked');
    error.statusCode = 429;
    throw error;
  }
  return { key, tenant };
}
module.exports = { SCOPES, PUBLIC_FIELDS, hashSecret, issueKey, authenticateKey };
