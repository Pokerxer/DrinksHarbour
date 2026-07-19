// server/__tests__/product.isFeatured.model.test.js
const test = require('node:test');
const assert = require('node:assert');
const Product = require('../models/Product');

test('Product defaults isFeatured to false', () => {
  const doc = new Product({ name: 'Test', slug: 'test', type: 'wine' });
  assert.strictEqual(doc.isFeatured, false);
});

test('Product accepts isFeatured = true and keeps it', () => {
  const doc = new Product({ name: 'Test', slug: 'test', type: 'wine', isFeatured: true });
  assert.strictEqual(doc.isFeatured, true);
});
