'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseVenueMapping } = require('../services/venue/migration');
const oid = '000000000000000000000001';
const text = `---\ntenantId: ${oid}\nlocationId: ${oid}\nexpectedTenantVersion: 0\nexpectedLocationVersion: 0\ntimezone: Africa/Lagos\nbusinessDayStartMinutes: 240\ntermsVersion: 1\nreviewedBy: ${oid}\ncanonicalCheckoutEnabled: false\n---\nHuman review notes.\n`;
test('mapping_has_explicit_scalar_reviewed_identity_and_clock', () => {
  const parsed = parseVenueMapping(text); assert.equal(parsed.businessDayStartMinutes, 240); assert.equal(parsed.canonicalCheckoutEnabled, false);
});
test('nested_unknown_duplicate_or_malformed_mapping_is_rejected', () => {
  for (const invalid of [text.replace('termsVersion: 1', 'termsVersion: 1\ntermsVersion: 2'), text.replace('termsVersion: 1', 'mystery: true'), text.replace('Africa/Lagos', '{ nested: yes }'), text.replace('240', '1440')]) assert.throws(() => parseVenueMapping(invalid));
});
test('every_required_unique_index_must_be_present_with_its_partial_filter', () => {
  const { requiredIndexesPresent } = require('../services/venue/migration');
  const Model = { schema: { indexes: () => [[{ tenant: 1, bill: 1 }, { unique: true, partialFilterExpression: { bill: { $type: 'objectId' } } }], [{ tenant: 1, reference: 1 }, { unique: true }]] } };
  assert.equal(requiredIndexesPresent(Model, [{ key: { tenant: 1, reference: 1 }, unique: true }]), false);
  assert.equal(requiredIndexesPresent(Model, [{ key: { tenant: 1, reference: 1 }, unique: true }, { key: { tenant: 1, bill: 1 }, unique: true }]), false);
  assert.equal(requiredIndexesPresent(Model, [{ key: { tenant: 1, reference: 1 }, unique: true }, { key: { tenant: 1, bill: 1 }, unique: true, partialFilterExpression: { bill: { $type: 'objectId' } } }]), true);
});
