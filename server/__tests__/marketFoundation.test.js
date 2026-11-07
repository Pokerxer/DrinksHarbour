'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const context = require('../services/marketContext');
const ingress = require('../services/marketIngress');
test('shopping market contexts stay isolated across concurrent requests and default to Nigeria', async () => {
  assert.equal(context.currentMarket(), 'NG');
  const values = await Promise.all(['NG', 'GB'].map(code => context.runMarket(code, async () => {
    await new Promise(resolve => setImmediate(resolve)); return context.currentMarket();
  })));
  assert.deepEqual(values, ['NG', 'GB']); assert.equal(context.currentMarket(), 'NG');
  assert.throws(() => context.runMarket('not-a-country', () => {}), /market/i);
});
test('market category derives from catalogue type rather than supplied category or origin country', () => {
  assert.equal(ingress.categoryFor({ type: 'beer', marketCategory: 'gift', originCountry: 'GB' }), 'beverage');
  assert.equal(ingress.categoryFor({ type: 'gift_set' }), 'gift');
  assert.equal(ingress.categoryFor({ type: 'snack' }), 'food');
  assert.equal(ingress.categoryFor({ type: 'prepared_food' }), 'food');
  assert.throws(() => ingress.categoryFor(null), /catalogue/i);
});
test('disabled foundation gate preserves legacy callers without querying commercial configuration', async () => {
  const old = process.env.MARKET_FOUNDATIONS_ENABLED; delete process.env.MARKET_FOUNDATIONS_ENABLED;
  try { assert.deepEqual(await ingress.assertOffer({ tenant: 'legacy', product: { type: 'beer' } }), { legacy: true }); }
  finally { if (old !== undefined) process.env.MARKET_FOUNDATIONS_ENABLED = old; }
});
test('policy constraints run before product pagination and leave input pipeline reusable', async t => {
  const catalog = require('../services/marketCatalog');
  const id = new (require('mongoose').Types.ObjectId)();
  const pipeline = [{ $match: { status: 'approved' } }, { $lookup: { from: 'subproducts', localField: '_id', foreignField: 'product', as: 'offers' } }, { $limit: 1 }];
  const copy = JSON.stringify(pipeline);
  const result = catalog.productPipeline(pipeline, { beverage: [id], gift: [], food: [] });
  assert.equal(result.at(-1).$limit, 1);
  assert.equal(JSON.stringify(pipeline), copy);
  assert.equal(result[0].$lookup.from, 'subproducts');
  assert.ok(result.find(s => s.$lookup?.as === 'offers').$lookup.pipeline.length > 0);
});
