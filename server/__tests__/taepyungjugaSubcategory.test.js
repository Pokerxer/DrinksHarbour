const { test } = require('node:test');
const assert = require('node:assert/strict');
const { entries, classifyProduct, productName } = require('../data/taepyungjuga-subcategory');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');

test('the named product maps to ginseng liquor rather than fortified grape wine', () => {
  assert.deepEqual(classifyProduct(productName), { parent: 'liqueurs', slug: 'ginseng-liqueur', type: 'liqueur' });
  assert.ok(Product.schema.path('type').enumValues.includes(classifyProduct(productName).type));
});
test('other ginseng products cannot be reclassified by this migration', () => {
  assert.throws(() => classifyProduct('Baylis & Harding Black Pepper & Ginseng Signature Collection Gift Set'), /Unreviewed/);
  assert.throws(() => classifyProduct('Korean Ginseng Rice Wine'), /Unreviewed/);
});
test('taxonomy copy validates and does not assign a bottle strength or medical benefit', async () => {
  const entry = entries[0];
  const doc = new SubCategory({ name: entry.name, slug: entry.slug,
    parent: '69d1f1970aef5189677bf16d', shortDescription: entry.blurb, status: 'published' });
  await doc.validate();
  assert.equal(entries.length, 1);
  assert.doesNotMatch(entry.blurb, /\d+%|health|wellness|medicine|tonic|energy support/i);
  assert.equal(classifyProduct(productName).abv, undefined);
});
