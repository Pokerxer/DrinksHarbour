const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const { isBeverageType, isAlcoholicType, getSizesForType } = require('../constants/productTypes');
const { isVenueServiceProduct } = require('../constants/catalogKind');

for (const type of ['lager', 'champagne', 'whisky', 'non_alcoholic_spirit', 'espresso', 'oat_milk']) {
  test(`${type} retains recorded beverage facts during validation`, async () => {
    assert.equal(isBeverageType(type), true);
    const alcoholic = isAlcoholicType(type);
    const abv = alcoholic ? 12 : 0;
    const doc = new Product({ name: 'Legacy beverage', slug: `legacy-${type}`, type, volumeMl: 750, abv, isAlcoholic: alcoholic });
    await doc.validate();
    assert.equal(doc.volumeMl, 750);
    assert.equal(doc.abv, abv);
    assert.equal(doc.isAlcoholic, alcoholic);
    assert.equal(isVenueServiceProduct({ type, catalogKind: 'beverage' }), true);
  });
}
test('legacy alcoholic families and non-alcoholic aliases remain distinct', () => {
  assert.equal(isAlcoholicType('champagne'), true);
  assert.equal(isAlcoholicType('non_alcoholic_spirit'), false);
  assert.equal(isBeverageType('home_lighting'), false);
  assert.equal(isBeverageType('unknown'), false);
});
test('legacy wine, beer and spirit types use beverage family sizes', () => {
  assert.deepEqual(getSizesForType('champagne'), getSizesForType('wine'));
  assert.deepEqual(getSizesForType('lager'), getSizesForType('beer'));
  assert.deepEqual(getSizesForType('whisky'), getSizesForType('spirit'));
});

test('legacy registry covers every original model beverage and only model-valid values', () => {
  const { legacyBeverageTypes } = require('../constants/legacyBeverageTypes');
  const { NON_BEVERAGE_TYPES, BEVERAGE_TYPES, ALCOHOLIC_TYPES, NON_ALCOHOLIC_TYPES } = require('../constants/productTypes');
  const { expandedTypeValues } = require('../constants/expandedProductTypes');
  const excluded = new Set([...NON_BEVERAGE_TYPES, ...expandedTypeValues, 'accessory', 'ice', 'subscription_box', 'other']);
  const modelTypes = Product.schema.path('type').enumValues;
  for (const type of modelTypes.filter(type => !excluded.has(type))) assert.ok(legacyBeverageTypes.includes(type), type);
  for (const type of legacyBeverageTypes) assert.ok(modelTypes.includes(type), type);
  for (const types of [ALCOHOLIC_TYPES, NON_ALCOHOLIC_TYPES]) assert.equal(new Set(types).size, types.length);
  for (const type of legacyBeverageTypes) assert.ok(BEVERAGE_TYPES.includes(type), type);
});

test('legacy drinks belong to category groups used by catalog filters', () => {
  const { getCategoryForType } = require('../constants/productTypes');
  for (const [type, key] of [['lager', 'BEER_AND_CIDER'], ['champagne', 'WINE'], ['whisky', 'SPIRITS'], ['espresso', 'COFFEE'], ['oat_milk', 'MILK']]) {
    assert.equal(getCategoryForType(type)?.key, key, type);
  }
});
