'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const keys = require('../services/apiKey.service');
const ApiKey = require('../models/ApiKey');
const Tenant = require('../models/Tenant');
const uri = process.env.DRINKSHARBOUR_PERF_TEST_MONGO_URI;
test('real Mongo concurrency and tenant index plans', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:27918\/drinks_perf_test_[\w]+\?replicaSet=dhperf$/);
  await mongoose.connect(uri, { autoIndex: false, maxPoolSize: 20, monitorCommands: true, serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const tenantId = new mongoose.Types.ObjectId();
  await Tenant.collection.insertOne({ _id: tenantId, status: 'approved', plan: 'pro', subscriptionStatus: 'active' });
  const secret = `dhk_${'e'.repeat(64)}`;
  const keyId = new mongoose.Types.ObjectId();
  const now = new Date('2026-10-08T10:00:20Z');
  await ApiKey.collection.insertOne({ _id: keyId, tenant: tenantId, hash: keys.hashSecret(secret), scopes: ['storefront:read'],
    revokedAt: null, expiresAt: new Date('2026-10-09T00:00:00Z'), rateWindow: 0, rateCount: 0 });
  await t.test('100 concurrent requests admit exactly 60 with one shared database limit', async () => {
    const results = await Promise.allSettled(Array.from({ length: 100 }, () => keys.authenticateKey(secret, 'storefront:read', now)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 60);
    assert.equal(results.filter(r => r.status === 'rejected' && r.reason.statusCode === 429).length, 40);
    assert.equal((await ApiKey.collection.findOne({ _id: keyId })).rateCount, 60);
  });
  await t.test('next minute rolls over without permitting old-minute requests to reset it', async () => {
    await keys.authenticateKey(secret, 'storefront:read', new Date('2026-10-08T10:01:00Z'));
    await assert.rejects(keys.authenticateKey(secret, 'storefront:read', now), e => e.statusCode === 429);
    assert.equal((await ApiKey.collection.findOne({ _id: keyId })).rateCount, 1);
  });
  await t.test('revoked keys and suspended tenants are immediately denied', async () => {
    await ApiKey.collection.updateOne({ _id: keyId }, { $set: { revokedAt: now } });
    await assert.rejects(keys.authenticateKey(secret, 'storefront:read', now), e => e.statusCode === 401);
    await ApiKey.collection.updateOne({ _id: keyId }, { $set: { revokedAt: null } });
    await Tenant.collection.updateOne({ _id: tenantId }, { $set: { status: 'suspended' } });
    await assert.rejects(keys.authenticateKey(secret, 'storefront:read', now), e => e.statusCode === 403);
  });
  await t.test('additive indexes restrict tenant reads to matching offer/variant keys', async () => {
    const { ensurePerformanceIndexes } = require('../config/performanceIndexes');
    const offers = mongoose.connection.collection('subproducts');
    const sizes = mongoose.connection.collection('sizes');
    await offers.createIndex({ sku: 1 }, { name: 'existing_sku' });
    const other = new mongoose.Types.ObjectId(), product = new mongoose.Types.ObjectId();
    await offers.insertMany(Array.from({ length: 2000 }, (_, i) => ({ tenant: i < 10 ? tenantId : other, isPublished: true, status: 'active', product, sku: String(i) })));
    await sizes.insertMany(Array.from({ length: 2000 }, (_, i) => ({ tenant: i < 10 ? tenantId : other, subproduct: product, status: 'active', availability: 'available' })));
    const before = await offers.find({ tenant: tenantId, isPublished: true, status: 'active' }).explain('executionStats');
    assert.equal(before.executionStats.totalDocsExamined, 2000);
    await ensurePerformanceIndexes(mongoose.connection);
    await ensurePerformanceIndexes(mongoose.connection);
    assert.ok((await offers.indexes()).some(index => index.name === 'existing_sku'));
    const offerPlan = await offers.find({ tenant: tenantId, isPublished: true, status: 'active' }).explain('executionStats');
    assert.equal(offerPlan.executionStats.nReturned, 10);
    assert.equal(offerPlan.executionStats.totalDocsExamined, 10);
    const sizePlan = await sizes.find({ tenant: tenantId, subproduct: product, status: 'active', availability: { $in: ['available', 'low_stock'] } }).explain('executionStats');
    assert.equal(sizePlan.executionStats.nReturned, 10);
    assert.equal(sizePlan.executionStats.totalDocsExamined, 10);
  });
  await t.test('real concurrent catalogue reads share one aggregate and keep variant ownership and freshness', async () => {
    const catalog = require('../services/storefrontCatalog.service');
    const product = new mongoose.Types.ObjectId(), offer = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('products').insertOne({ _id: product, name: 'Performance drink', status: 'approved', isPublished: true });
    await mongoose.connection.collection('subproducts').insertOne({ _id: offer, tenant: tenantId, product, isPublished: true, status: 'active', availableStock: 12, sellWithoutSizeVariants: false });
    const variant = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('sizes').insertOne({ _id: variant, tenant: tenantId, subproduct: offer, status: 'active', availability: 'available', sellingPrice: 1500, availableStock: 12, size: '75cl' });
    let aggregates = 0;
    const client = mongoose.connection.getClient();
    const observe = event => { if (event.commandName === 'aggregate' && event.command.aggregate === 'subproducts') aggregates++; };
    client.on('commandStarted', observe);
    try {
      const results = await Promise.all(Array.from({ length: 100 }, () => catalog.listProducts({ _id: tenantId }, {})));
      assert.equal(aggregates, 1);
      assert.equal(results[0].data.length, 1);
      assert.equal(results[0].data[0].variants[0].id, String(variant));
      assert.equal(results[0].data[0].sellingPrice, 1500);
      await mongoose.connection.collection('sizes').updateOne({ _id: variant }, { $set: { sellingPrice: 2000 } });
      const refreshed = await catalog.listProducts({ _id: tenantId }, {});
      assert.equal(refreshed.data[0].sellingPrice, 2000);
      assert.equal(aggregates, 2);
    } finally { client.off('commandStarted', observe); }
  });

});
