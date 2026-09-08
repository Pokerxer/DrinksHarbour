'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ApiKey = require('../models/ApiKey');
const Tenant = require('../models/Tenant');
const { issueKey, authenticateKey, hashSecret } = require('../services/apiKey.service');
test('issuance stores only a hash and returns the secret once', async t => {
  let stored;
  t.mock.method(ApiKey, 'create', async data => { stored = data; return { ...data, _id: 'key' }; });
  const result = await issueKey({ _id: 'tenant' }, 'actor', { name: 'Stock sync', scopes: ['inventory:read'] });
  assert.match(result.secret, /^dhk_[a-f0-9]{64}$/);
  assert.equal(stored.hash, hashSecret(result.secret));
  assert.equal(stored.secret, undefined);
  assert.equal(result.key.hash, undefined);
});
test('API auth rejects revocation, scope escalation and suspended tenants', async t => {
  const secret = `dhk_${'a'.repeat(64)}`;
  t.mock.method(ApiKey, 'findOne', filter => {
    assert.equal(filter.revokedAt, null);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    return { lean: async () => null };
  });
  await assert.rejects(authenticateKey(secret, 'inventory:read'), /Invalid API key/);
  ApiKey.findOne = () => ({ lean: async () => ({ tenant: 'own', scopes: ['inventory:read'] }) });
  await assert.rejects(authenticateKey(secret, 'bookings:read'), /scope denied/);
  t.mock.method(Tenant, 'findById', () => ({ lean: async () => ({ status: 'suspended', plan: 'pro', subscriptionStatus: 'active' }) }));
  await assert.rejects(authenticateKey(secret, 'inventory:read'), /inactive/);
});
test('rate limit is consumed against the unrevoked key in the database', async t => {
  t.mock.method(ApiKey, 'findOne', () => ({ lean: async () => ({ tenant: 'own', scopes: ['inventory:read'] }) }));
  t.mock.method(Tenant, 'findById', () => ({ lean: async () => ({ _id: 'own', status: 'approved', plan: 'pro', subscriptionStatus: 'active' }) }));
  t.mock.method(ApiKey, 'updateOne', async (query, update) => {
    assert.equal(query.revokedAt, null);
    if (update.$inc) assert.equal(query.rateCount.$lt, 60);
    return { modifiedCount: 0 };
  });
  await assert.rejects(authenticateKey(`dhk_${'a'.repeat(64)}`, 'inventory:read'), e => e.statusCode === 429);
});
