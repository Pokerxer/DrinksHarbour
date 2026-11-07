'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose'), express = require('express');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test('public product suggestions honor market eligibility before limiting while keeping global metadata and disabled legacy reads', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'market_suggestions');
  const old = process.env.MARKET_FOUNDATIONS_ENABLED;
  process.env.MARKET_FOUNDATIONS_ENABLED = 'true';
  t.after(() => { if (old === undefined) delete process.env.MARKET_FOUNDATIONS_ENABLED; else process.env.MARKET_FOUNDATIONS_ENABLED = old; });
  const oid = () => new mongoose.Types.ObjectId();
  const allowed = oid(), restricted = oid(), good = oid(), bad = oid(), unpublished = oid();
  const Product = require('../models/Product');
  await Product.collection.createIndex({ name: 'text' });
  await Product.collection.insertMany([
    { _id: good, name: 'Bottle eligible', type: 'beer', status: 'approved', isPublished: true, averageRating: 1 },
    { _id: bad, name: 'Bottle restricted', type: 'beer', status: 'approved', isPublished: true, averageRating: 5 },
    { _id: unpublished, name: 'Bottle unpublished', type: 'beer', status: 'approved', isPublished: false, averageRating: 5 },
  ]);
  await require('../models/Tenant').collection.insertMany([allowed, restricted].map(_id => ({ _id, status: 'approved', isActive: true, subscriptionStatus: 'active' })));
  await require('../models/SubProduct').collection.insertMany([[good,allowed],[bad,restricted],[unpublished,allowed]].map(([product,tenant]) => ({ product,tenant,isPublished:true,status:'active',visibleInOnlineStore:true })));
  await require('../models/CountryConfiguration').collection.insertMany([
    { code: 'NG', active: true, version: 1, currency: 'NGN', capabilities: { marketplace: true } },
    { code: 'GB', active: false, version: 1, currency: 'GBP', capabilities: { marketplace: true } },
  ]);
  const term = { effectiveFrom: new Date('2020-01-01'), effectiveUntil: new Date('2090-01-01') };
  await require('../models/MarketCategoryPolicy').collection.insertOne({ market: 'NG', category: 'beverage', channel: 'marketplace', version: 1, mode: 'open', ...term });
  await require('../models/MarketEnrollment').collection.insertOne({ tenant: allowed, market: 'NG', category: 'beverage', channel: 'marketplace', version: 1, status: 'approved', ...term });
  await require('../models/Brand').collection.insertOne({ name: 'Bottle global brand' });
  await require('../models/Category').collection.insertOne({ name: 'Bottle global category', status: 'published' });
  const app = express(); app.use('/products', require('../routes/product.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async (market, limit = 8) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/products/suggestions?q=Bottle&limit=${limit}`, { headers: { 'x-market-code': market } });
    return { status: response.status, body: await response.json(), vary: response.headers.get('vary') };
  };
  await t.test('eligible product names only, with market context and pre-limit filtering', async () => {
    const result = await call('NG'); assert.equal(result.status, 200);
    assert.ok(result.body.data.includes('Bottle eligible'));
    assert.equal(result.body.data.includes('Bottle restricted'), false);
    assert.equal(result.body.data.includes('Bottle unpublished'), false);
    assert.match(result.vary || '', /x-market-code/i);
    assert.deepEqual((await call('NG', 1)).body.data, ['Bottle eligible']);
  });
  await t.test('inactive and unknown markets expose no product suggestions; metadata stays global', async () => {
    for (const market of ['GB', 'CA']) {
      const result = await call(market); assert.equal(result.status, 200);
      assert.deepEqual([...result.body.data].sort(), ['Bottle global brand', 'Bottle global category']);
    }
  });
  await t.test('disabled enforcement preserves legacy approved-product names', async () => {
    delete process.env.MARKET_FOUNDATIONS_ENABLED;
    const result = await call('GB');
    assert.ok(result.body.data.includes('Bottle restricted'));
    assert.ok(result.body.data.includes('Bottle unpublished'));
  });
});
