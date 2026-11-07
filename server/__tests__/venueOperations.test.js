'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { fingerprint, validateKey } = require('../services/venue/operations');
const { businessDate } = require('../services/venue/clock');
test('hash_ignores_object_key_order_but_detects_payload_change', () => {
  assert.equal(fingerprint({ a: 1, b: { c: 2 } }), fingerprint({ b: { c: 2 }, a: 1 }));
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
});
test('idempotency_key_is_required_and_bounded', () => {
  for (const value of ['', undefined, 'x'.repeat(129)]) assert.throws(() => validateKey(value));
  assert.equal(validateKey('first-request'), 'first-request');
});
test('business_date_uses_local_service_cutoff', () => {
  assert.equal(businessDate(new Date('2026-10-17T00:30:00Z'), 'Africa/Lagos', 240), '2026-10-16');
  assert.equal(businessDate(new Date('2026-10-17T03:00:00Z'), 'Africa/Lagos', 240), '2026-10-17');
});
