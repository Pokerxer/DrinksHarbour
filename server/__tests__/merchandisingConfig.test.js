// server/__tests__/merchandisingConfig.test.js
// The family map is the backbone of cross-sell/upsell ranking. It must cover
// EVERY value of Product.type's enum (the enum is the single source of truth;
// an unmapped type silently degrades to OTHER and poisons recommendations),
// and every pairing must point at a family that actually has types.

const test = require('node:test');
const assert = require('node:assert/strict');

const Product = require('../models/Product');
const {
  typeFamilies,
  familyPairings,
  familyForType,
  complementFamilies,
  typesForFamilies,
} = require('../config/merchandising');

const enumValues = () => Product.schema.path('type').enumValues.filter(Boolean);

test('every Product.type enum value maps to a family', () => {
  const values = enumValues();
  assert.ok(values.length > 100, 'sanity: the beverage taxonomy is large');
  const unmapped = values.filter((v) => !typeFamilies[v]);
  assert.deepEqual(unmapped, [], `unmapped types: ${unmapped.join(', ')}`);
});

test('every family referenced in pairings exists and has members', () => {
  const members = {};
  for (const [type, family] of Object.entries(typeFamilies)) {
    (members[family] ??= []).push(type);
  }
  const problems = [];
  for (const [family, complements] of Object.entries(familyPairings)) {
    assert.ok(familyPairings[family] !== undefined, `unknown source family ${family}`);
    for (const complement of complements) {
      if (!familyPairings[complement]) problems.push(`${family} → missing family ${complement}`);
      if (!members[complement]?.length) problems.push(`${family} → empty family ${complement}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('familyForType and complementFamilies agree with the raw maps', () => {
  assert.equal(familyForType('whiskey'), 'SPIRITS');
  assert.equal(familyForType('tonic_water'), 'SOFT_DRINKS');
  assert.equal(familyForType('champagne'), 'WINE');
  assert.equal(familyForType('totally_unknown_type'), 'OTHER');
  assert.ok(complementFamilies('whiskey').includes('MIXERS'));
  assert.deepEqual(complementFamilies('totally_unknown_type'), []);
});

test('typesForFamilies returns enum members only', () => {
  const spiritTypes = typesForFamilies(['SPIRITS']);
  assert.ok(spiritTypes.includes('whiskey'));
  assert.ok(spiritTypes.includes('gin'));
  assert.ok(!spiritTypes.includes('cola'));
});
