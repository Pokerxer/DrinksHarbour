const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const service = require('../services/product.service');
const Product = require('../models/Product');
const oid = () => new mongoose.Types.ObjectId();
test('real search prices and ranks the complete query before slicing and keeps card metadata', async t => {
  const row = (name, lon) => ({ _id: oid(), name, slug: name, images: [], platformMarkup: 0,
    subProducts: [{ _id: oid(), tenant: { _id: oid(), name, location: { lat: 0, lon }, revenueModel: 'commission', commissionPercentage: 0 },
      sizes: [{ _id: oid(), size: '750ml', sellingPrice: 100, costPrice: 50, stock: 10, availableStock: 10, availability: 'available' }] }] });
  const far = row('far', 2), near = row('near', .1);
  let resultPipeline;
  let redundantCounts = 0;
  t.mock.method(Product, 'aggregate', async pipeline => {
    if (pipeline.some(stage => stage.$count)) { redundantCounts++; return [{ total: 2 }]; }
    if (!pipeline.some(stage => stage.$lookup?.as === 'subProducts')) return [];
    resultPipeline = pipeline;
    return [far, near];
  });
  t.mock.method(Product, 'distinct', async () => []);
  const first = await service.searchProducts({ shoppingLocation: { lat: 0, lon: 0 }, page: 1, limit: 1, fields: 'card', useEmbeddings: false, sortBy: 'nearest' });
  assert.equal(resultPipeline.some(stage => '$skip' in stage || '$limit' in stage), false);
  assert.equal(first.products.length, 1);
  assert.equal(first.products[0].name, 'near');
  assert.equal(first.products[0].shoppingOffer.subProductId, String(near.subProducts[0]._id));
  assert.equal(first.pagination.totalResults, 2);
  assert.equal(redundantCounts, 0, 'full-set personalized resolution already supplies its exact count');
  const second = await service.searchProducts({ shoppingLocation: { lat: 0, lon: 0 }, page: 2, limit: 1, useEmbeddings: false, sortBy: 'nearest' });
  assert.equal(second.products[0].name, 'far');
});
