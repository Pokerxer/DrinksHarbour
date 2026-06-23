// server/__tests__/salesAddress.test.js
// Invoice/delivery address capture: normalizeAddress is a pure helper that
// cleans an inbound address into the 6 known string fields, or undefined when
// the whole thing is blank. No DB (repo convention).
const test = require('node:test');
const assert = require('node:assert');

test('normalizeAddress trims fields and fills missing ones with empty strings', () => {
  const { normalizeAddress } = require('../services/salesOrder.service');
  assert.deepStrictEqual(
    normalizeAddress({ name: '  Ada Lovelace  ', city: 'Abuja' }),
    { name: 'Ada Lovelace', phone: '', street: '', city: 'Abuja', state: '', country: '' }
  );
});

test('normalizeAddress coerces non-strings and ignores unknown keys', () => {
  const { normalizeAddress } = require('../services/salesOrder.service');
  assert.deepStrictEqual(
    normalizeAddress({ phone: 8031234567, country: 'Nigeria', extra: 'drop me' }),
    { name: '', phone: '8031234567', street: '', city: '', state: '', country: 'Nigeria' }
  );
});

test('normalizeAddress returns undefined when every field is blank or whitespace', () => {
  const { normalizeAddress } = require('../services/salesOrder.service');
  assert.strictEqual(normalizeAddress({ name: '   ', phone: '', state: '\t' }), undefined);
  assert.strictEqual(normalizeAddress({}), undefined);
});

test('normalizeAddress returns undefined for null/undefined/non-object input', () => {
  const { normalizeAddress } = require('../services/salesOrder.service');
  assert.strictEqual(normalizeAddress(undefined), undefined);
  assert.strictEqual(normalizeAddress(null), undefined);
  assert.strictEqual(normalizeAddress('123 Main St'), undefined);
});
