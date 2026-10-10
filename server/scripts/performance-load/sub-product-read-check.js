'use strict';
// Disposable localhost fixture only; does not load .env or production data.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const service = require('../../services/subproduct.service');
const { closeRedis, key } = require('../../config/redis');
const { subProductPageCache } = require('../../services/subProductPageCache');
const { createClient } = require('redis');
process.env.REDIS_NAMESPACE = `drinks_subproduct_read_test:${process.pid}`;
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
const cleanupRedis = createClient({ url: process.env.REDIS_URL });
cleanupRedis.on('error', () => {});
const dbName = `drinks_subproduct_read_test_${process.pid}`;
let connected = false;
async function main() {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { autoIndex: false, serverSelectionTimeoutMS: 2000 });
  connected = true;
  const db = mongoose.connection.db;
  const tenant = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
  const product = new mongoose.Types.ObjectId(), size = new mongoose.Types.ObjectId();
  const brand = new mongoose.Types.ObjectId(), category = new mongoose.Types.ObjectId();
  await db.collection('tenants').insertMany([tenant, other].map(_id => ({ _id, name: 'Fixture shop', revenueModel: 'commission', commissionPercentage: 13 })));
  await db.collection('brands').insertOne({ _id: brand, name: 'Fixture brand', description: 'Presentation' });
  await db.collection('categories').insertOne({ _id: category, name: 'Fixture category' });
  await db.collection('products').insertOne({ _id: product, name: 'Fixture bottle', type: 'spirit', images: [], brand, category });
  await db.collection('sizes').insertOne({ _id: size, size: '750ml', sellingPrice: 5000, costPrice: 3000, stock: 20, availableStock: 20, currency: 'NGN' });
  const docs = Array.from({ length: 500 }, (_, i) => ({ _id: new mongoose.Types.ObjectId(), tenant: i % 2 ? other : tenant, product, sizes: [size], sku: `fixture-${i}`, status: 'active', baseSellingPrice: 5000, costPrice: 3000, shipping: null, warehouse: null, createdAt: new Date() }));
  await db.collection('subproducts').insertMany(docs);
  let baseReads = 0, referenceReads = 0, statReads = 0;
  mongoose.set('debug', (collection, method) => {
    if (collection === 'subproducts' && method === 'findOne') baseReads++;
    if (['brands', 'categories'].includes(collection) && method === 'find') referenceReads++;
    if (collection === 'subproducts' && method === 'countDocuments') statReads++;
  });
  const start = performance.now();
  const detail = await service.getSubProduct(String(docs[0]._id), tenant);
  const detailMs = performance.now() - start;
  assert.equal(baseReads, 1);
  assert.equal(detail.product.name, 'Fixture bottle');
  assert.equal(detail.sizes[0].size, '750ml');
  assert.equal(detail.tenant.name, 'Fixture shop');
  assert.equal(detail.product.brand.name, 'Fixture brand');
  const referencesAfterCold = referenceReads;
  await service.getSubProduct(String(docs[0]._id), tenant);
  assert.equal(referenceReads, referencesAfterCold);
  await assert.rejects(service.getSubProduct(String(docs[1]._id), tenant), /not found/);
  const listStart = performance.now();
  const list = await service.getMySubProducts(tenant, { limit: 50 });
  const listMs = performance.now() - listStart;
  assert.equal(list.pagination.total, 250);
  assert.equal(list.stats.active, 250);
  assert.equal(list.subProducts.length, 50);
  assert.ok(list.subProducts.every(row => String(row.tenant) === String(tenant)));
  const statsAfterCold = statReads;
  await service.getMySubProducts(tenant, { limit: 50 });
  assert.equal(statReads, statsAfterCold + 1); // Only the exact filtered total is live.
  await db.collection('subproducts').updateOne({ _id: docs[0]._id }, { $set: { baseSellingPrice: 6500 } });
  await db.collection('sizes').updateOne({ _id: size }, { $set: { availableStock: 9 } });
  const live = await service.getSubProduct(String(docs[0]._id), tenant);
  assert.equal(live.baseSellingPrice, 6500); assert.equal(live.sizes[0].availableStock, 9);
  await subProductPageCache.invalidate(['platform', `tenant:${tenant}`]);
  await service.getSubProduct(String(docs[0]._id), tenant);
  assert.ok(referenceReads > referencesAfterCold);
  const measure = async fresh => {
    const start = performance.now();
    for (let i = 0; i < 10; i++) await service.getMySubProducts(tenant, { limit: 50, fresh });
    return (performance.now() - start) / 10;
  };
  const freshListMs = await measure(true), warmListMs = await measure(false);
  console.log(JSON.stringify({ fixtureRecords: 500, listPageRows: 50, detailBaseReads: 1, detailMs, listMs, freshListMs, warmListMs,
    tenantIsolation: true, populatedFields: true, livePriceAndStock: true, warmSummaryAndReferences: true, invalidation: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  // Namespace is unique to this disposable fixture. Never flush shared Redis.
  await cleanupRedis.connect().catch(() => {});
  if (cleanupRedis.isReady) {
    for await (const keys of cleanupRedis.scanIterator({ MATCH: `${process.env.REDIS_NAMESPACE}:*`, COUNT: 100 })) {
      if (keys.length) await cleanupRedis.del(keys);
    }
    await cleanupRedis.quit();
  }
  await closeRedis();
  if (connected) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
