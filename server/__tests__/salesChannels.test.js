'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const target = path.resolve(__dirname, '../services/salesChannels/validation.js');
const load = () => fs.existsSync(target) ? require(target) : {};
const tenant = '507f1f77bcf86cd799439011';
const base = () => ({ tenant, code: 'TEST_WEBSITE', kind: 'storefront', market: 'NG', currency: 'NGN', active: false,
  legalOwner: { type: 'tenant', reference: tenant },
  paymentOwner: { type: 'tenant', reference: tenant, provider: 'paystack', account: 'TEST_ACCOUNT' },
  pricingPolicy: { code: 'TENANT_RETAIL', version: 1, termsReference: 'review/test-only' },
  storefrontChannel: '507f1f77bcf86cd799439012', apiKey: '507f1f77bcf86cd799439013', location: '507f1f77bcf86cd799439014' });
test('reviewed configuration requires explicit legal, account and pricing terms without invented defaults', () => {
  const { validateChannel } = load(); assert.equal(typeof validateChannel, 'function');
  assert.deepEqual(validateChannel(base()), base());
  for (const field of ['legalOwner', 'paymentOwner', 'pricingPolicy']) {
    const input = base(); delete input[field]; assert.throws(() => validateChannel(input), /owner|pricing|terms/i);
  }
});
test('configuration refuses browser-style fee fields and direct mismatched legal ownership', () => {
  const { validateChannel } = load(); assert.equal(typeof validateChannel, 'function');
  assert.throws(() => validateChannel({ ...base(), commissionRate: 13 }), /Unknown/i);
  assert.throws(() => validateChannel({ ...base(), paymentOwner: { ...base().paymentOwner, secret: 'bad' } }), /Unknown/i);
  assert.throws(() => validateChannel({ ...base(), legalOwner: { type: 'tenant', reference: 'another' } }), /owner/i);
});
test('POS and venue retain distinct kinds and marketplace has explicit platform authority', () => {
  const { validateChannel } = load(); assert.equal(typeof validateChannel, 'function');
  for (const kind of ['pos', 'venue']) {
    const input = base(); input.kind = kind; delete input.storefrontChannel; delete input.apiKey;
    assert.equal(validateChannel(input).kind, kind);
  }
  const input = base(); input.kind = 'marketplace'; input.tenant = null;
  input.legalOwner = { type: 'platform', reference: 'synthetic-legal-entity' };
  input.paymentOwner = { type: 'platform', reference: 'synthetic-legal-entity', provider: 'paystack', account: 'TEST_PLATFORM' };
  delete input.storefrontChannel; delete input.apiKey; delete input.location;
  assert.equal(validateChannel(input).tenant, null);
});
module.exports = { base, tenant };
