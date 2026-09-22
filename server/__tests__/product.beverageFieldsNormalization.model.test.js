// server/__tests__/product.beverageFieldsNormalization.model.test.js
//
// The admin edit form submits the stored value of every form field, including
// the beverage-only ones it hides for non-beverage products (Beverage Info
// step is dropped, but the value still rides in the payload). Products that
// carry a `0` in a min:1-gated field (servingsPerContainer, volumeMl) fail
// Mongoose validation with "less than minimum allowed value (1)" — surfaced to
// the user as "Some of the values submitted are invalid."
//
// The Product schema must normalize those fields so a save never fails for a
// stale zero, and must never let a non-beverage product carry beverage-only
// attributes at all.
const test = require('node:test');
const assert = require('node:assert');
const Product = require('../models/Product');

const build = (overrides = {}) =>
  new Product({
    name: 'Test Product',
    slug: 'test-product',
    type: 'glassware',
    ...overrides,
  });

test('non-beverage product with servingsPerContainer=0 saves without error', async () => {
  const doc = build({ servingsPerContainer: 0, volumeMl: 0 });
  await assert.doesNotReject(doc.validate());
  assert.strictEqual(doc.servingsPerContainer, undefined);
});

test('clamps zero servingsPerContainer on beverage products', async () => {
  const doc = build({ type: 'wine', servingsPerContainer: 0, volumeMl: 750 });
  await assert.doesNotReject(doc.validate());
  assert.strictEqual(doc.servingsPerContainer, undefined);
  assert.strictEqual(doc.volumeMl, 750);
});

test('clamps zero volumeMl on beverage products', async () => {
  const doc = build({ type: 'wine', servingsPerContainer: 6, volumeMl: 0 });
  await assert.doesNotReject(doc.validate());
  assert.strictEqual(doc.servingsPerContainer, 6);
  assert.strictEqual(doc.volumeMl, undefined);
});

test('keeps valid beverage numeric fields', async () => {
  const doc = build({ type: 'wine', servingsPerContainer: 6, volumeMl: 750 });
  await assert.doesNotReject(doc.validate());
  assert.strictEqual(doc.servingsPerContainer, 6);
  assert.strictEqual(doc.volumeMl, 750);
});

test('non-beverage products never carry beverage-only attributes', async () => {
  const doc = build({
    type: 'gift_set',
    servingsPerContainer: 2,
    volumeMl: 200,
    standardSizes: ['75cl'],
    servingSize: '1 glass (150ml)',
    vintage: 2019,
    age: 5,
    ageStatement: '5 years',
    appellation: 'Champagne',
    distilleryName: 'Acme Distillery',
    productionMethod: 'distilled',
    caskType: 'oak',
    finish: 'sherry cask finish',
    tastingNotes: { nose: ['vanilla'] },
    servingSuggestions: { glassware: 'Flute' },
    foodPairings: ['sushi'],
    flavorProfile: ['fruity'],
    originCountry: 'Nigeria',
  });
  await assert.doesNotReject(doc.validate());

  // Assert the persisted shape: every beverage-only field must be gone.
  const persisted = doc.toObject();
  const beverageOnly = [
    'servingsPerContainer',
    'volumeMl',
    'standardSizes',
    'servingSize',
    'vintage',
    'age',
    'ageStatement',
    'appellation',
    'distilleryName',
    'wineryName',
    'breweryName',
    'productionMethod',
    'caskType',
    'finish',
    'tastingNotes',
    'servingSuggestions',
    'foodPairings',
    'flavorProfile',
  ];
  for (const field of beverageOnly) {
    assert.strictEqual(
      persisted[field],
      undefined,
      `expected ${field} to be cleared for non-beverage product`
    );
  }
  assert.strictEqual(persisted.originCountry, 'Nigeria');
});