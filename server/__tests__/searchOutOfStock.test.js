const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/product.service');
const controller = require('../controllers/product.controller');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');

test('public search parses false as a boolean while preserving publication gates', async () => {
  const original = service.searchProducts;
  let received;
  service.searchProducts = async (params) => { received = params; return {}; };
  try {
    await controller.searchProductsPublic({ query: { q: 'wine', inStock: 'false', status: 'pending' } },
      { status() { return this; }, json() {} }, (error) => { throw error; });
    assert.equal(received.inStock, false);
    assert.equal(received.status, 'approved');
    assert.equal(received.includeUnpublished, false);
  } finally { service.searchProducts = original; }
});

test('search includes active sold-out sizes only when stock filtering is disabled', async () => {
  const original = Product.aggregate;
  const stop = new Error('pipeline captured');
  let pipeline;
  Product.aggregate = (value) => { pipeline = value; throw stop; };
  try {
    for (const inStock of [false, true]) {
      await assert.rejects(service.searchProducts({ inStock, useEmbeddings: false, sortBy: 'newest' }), stop);
      const listings = pipeline.find(stage => stage.$lookup?.as === 'subProducts').$lookup;
      const sizes = listings.pipeline.find(stage => stage.$lookup?.as === 'sizes').$lookup;
      const match = sizes.pipeline[0].$match;
      assert.equal(match.status, 'active');
      assert.equal(match.availability.$in.includes('out_of_stock'), !inStock);
      assert.equal(Boolean(match.$expr), inStock);
      if (inStock) assert.deepEqual(match.$expr, { $gt: [{ $ifNull: ['$availableStock', '$stock'] }, 0] });
    }
  } finally { Product.aggregate = original; }
});

test('detail fetch retains sold-out listings and sizes under active tenant gates', async () => {
  const originalProduct = Product.findOne;
  const originalSubProduct = SubProduct.find;
  const chain = { populate() { return this; }, lean: async () => ({ _id: 'product-id' }) };
  let listingQuery;
  const populates = [];
  const stop = new Error('detail captured');
  Product.findOne = () => chain;
  SubProduct.find = (query) => {
    listingQuery = query;
    return { populate(value) { populates.push(value); return this; }, select() { return this; }, lean() { throw stop; } };
  };
  try {
    await assert.rejects(service.getProductBySlug('sold-out-wine'), stop);
    assert.ok(listingQuery.status?.$in?.includes('out_of_stock'), 'sold-out listing must be included');
    assert.ok(populates.find(value => value.path === 'sizes').match.availability.$in.includes('out_of_stock'));
    assert.deepEqual(populates.find(value => value.path === 'tenant').match.subscriptionStatus, { $in: ['active', 'trialing'] });
  } finally { Product.findOne = originalProduct; SubProduct.find = originalSubProduct; }
});
