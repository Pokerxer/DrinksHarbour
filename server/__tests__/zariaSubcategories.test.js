const { test } = require('node:test');
const assert = require('node:assert/strict');
const { entries, classifyProduct, reviewedProducts } = require('../data/zaria-subcategories');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
test('both reviewed Zaria flavours map to sparkling wine cocktails', () => {
  assert.equal(reviewedProducts.length, 2);
  for (const p of reviewedProducts) {
    assert.deepEqual(classifyProduct(p.name), {
      parent: 'sparkling-wine', slug: 'sparkling-wine-cocktails', type: 'cocktail_ready_to_drink',
    });
    assert.ok(Product.schema.path('type').enumValues.includes(classifyProduct(p.name).type));
  }
});
test('other 1979 wines cannot enter this migration', () => {
  assert.throws(() => classifyProduct('1979 Raices Argentina Cabernet Sauvignon'), /Unreviewed/);
  assert.throws(() => classifyProduct('1979 Raíces Argentinas Sweet Red Blend'), /Unreviewed/);
});
test('the shared cocktail subcategory validates without invented bottle strength', async () => {
  assert.equal(entries.length, 1);
  const entry = entries[0];
  await new SubCategory({name:entry.name,slug:entry.slug,parent:'69d1f1970aef5189677bf143',shortDescription:entry.blurb,status:'published'}).validate();
  assert.doesNotMatch(entry.blurb, /\d+%/);
  assert.equal(classifyProduct(reviewedProducts[0].name).abv, undefined);
});
