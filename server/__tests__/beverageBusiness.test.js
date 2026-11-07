const test = require('node:test');
const assert = require('node:assert/strict');
const { industriesForProductType } = require('../constants/industries');
const { BEVERAGE_TYPES } = require('../constants/productTypes');
test('every registered beverage belongs to the Beverages business', () => {
  for (const type of BEVERAGE_TYPES) assert.deepEqual(industriesForProductType(type), ['beverage'], type);
});
test('other businesses and unknown shared types keep their ownership', () => {
  assert.deepEqual(industriesForProductType('beauty_skincare'), ['beauty']);
  assert.equal(industriesForProductType('other'), null);
});
