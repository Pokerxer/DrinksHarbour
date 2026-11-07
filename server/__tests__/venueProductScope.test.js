'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
test('venue_service_gate_admits_beverage_types_and_prepared_kinds_rejects_the_rest', () => {
  const { assertVenueProduct } = require('../services/venue/pricing');
  const { KINDS } = require('../constants/catalogKind');
  assert.doesNotThrow(() => assertVenueProduct({ type: 'beer' })); // legacy: no catalogKind, beverage type
  assert.doesNotThrow(() => assertVenueProduct({ type: 'snack', catalogKind: KINDS.prepared_food }));
  assert.doesNotThrow(() => assertVenueProduct({ type: 'snack', catalogKind: KINDS.prepared_beverage }));
  for (const product of [{ type: 'glassware' }, { type: 'food' }, { type: 'accessory' }, { type: 'beer', catalogKind: 'consumable' }, null, {}]) assert.throws(() => assertVenueProduct(product), /venue service/i);
});