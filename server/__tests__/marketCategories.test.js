// server/__tests__/marketCategories.test.js
//
// Market/category registry (docs/audits/general-saas-evolution):
// the platform sells tenants' offers through marketplace or storefront
// channels, and enrollment/policy is scoped by supply category. This mapping
// used to be hard-coded in services/marketIngress.js — a general-ecommerce
// (all tenants' canonical offers on one surface) and per-category vertical
// systems need the SAME catalogue identity mechanics with a configurable
// category map behind them. Behavior must be identical: the pinned cases in
// marketFoundation.test.js keep passing; the beverage fallback covers every
// unlisted product type until a new vertical is actually registered here.

const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../config/marketCategories');
const ingress = require('../services/marketIngress');

test('the registry owns the supply categories with explicit fallback', () => {
  assert.equal(registry.FALLBACK_CATEGORY, 'beverage');
  assert.ok(registry.categories.length >= 3, 'beverage + the currently registered verticals');
  assert.ok(registry.categories.includes('beverage'));
});

test('registered verticals resolve by product type; unlisted types stay beverage', () => {
  assert.equal(registry.categoryForType('gift_set'), 'gift');
  assert.equal(registry.categoryForType('prepared_food'), 'food');
  assert.equal(registry.categoryForType('wine'), 'beverage');
  assert.equal(regression_categoryForType_viaIngressFallback(), 'beverage');
  function regression_categoryForType_viaIngressFallback() {
    return ingress.categoryFor({ type: 'womens_dress' }); // not registered anywhere
  }
});

test('a type may only belong to one category and beverage is not overreach-able', () => {
  const seen = new Map();
  for (const [category, types] of Object.entries(registry.typesByCategory)) {
    for (const type of types) {
      assert.ok(!seen.has(type), `${type} registered twice (${seen.get(type)}, ${category})`);
      seen.set(type, category);
    }
  }
  assert.equal(registry.typesByCategory.beverage, undefined, 'beverage is the fallback, never an enumerated list');
});

test('the registry and its arrays are frozen (require-time captures in ingress stay valid)', () => {
  assert.ok(Object.isFrozen(registry));
  assert.ok(Object.isFrozen(registry.typesByCategory));
  for (const types of Object.values(registry.typesByCategory)) {
    assert.ok(Object.isFrozen(types));
  }
  assert.ok(Object.isFrozen(registry.categories));
});

test('marketIngress exports identity with the registry (marketCatalog consumers rely on both)', () => {
  assert.deepStrictEqual(ingress.giftTypes, registry.typesByCategory.gift);
  assert.deepStrictEqual(ingress.foodTypes, registry.typesByCategory.food);
});

test('ingress.categoryFor delegates to the registry (pinned behavior intact)', () => {
  assert.equal(ingress.categoryFor({ type: 'gift' }), 'gift');
  assert.equal(ingress.categoryFor({ type: 'snack' }), 'food');
  assert.equal(ingress.categoryFor({ type: 'beer' }), 'beverage');
  assert.throws(() => ingress.categoryFor(null), /catalogue/i);
});
