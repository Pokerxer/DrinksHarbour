'use strict';
// Explicit local-only fixture. Never loads .env or touches an application DB.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createClient } = require('redis');
const mongoose = require('mongoose');
process.env.REDIS_NAMESPACE = `drinksharbour:navigation-test:${process.pid}`;
delete process.env.REDIS_NAVIGATION_COUNTS_CACHE;
const { key } = require('../../config/redis');
const { createNavigationCountsCache } = require('../../services/navigationCountsCache');
const redis = createClient({ url: 'redis://127.0.0.1:6379', socket: { connectTimeout: 1000, reconnectStrategy: false } });
redis.on('error', () => {});
const dbName = `drinks_navigation_perf_test_${process.pid}`;
let connection;
async function main() {
  await redis.connect();
  connection = await mongoose.createConnection(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 2000 }).asPromise();
  const products = connection.collection('products');
  const categories = Array.from({ length: 30 }, () => new mongoose.Types.ObjectId());
  await products.insertMany(Array.from({ length: 3000 }, (_, i) => ({ category: categories[i % 30], status: i % 10 ? 'approved' : 'pending' })));
  await products.createIndex({ status: 1, category: 1 });
  const cache = createNavigationCountsCache({ run: fn => fn(redis), isEnabled: () => true });
  let aggregations = 0;
  const load = async () => {
    aggregations++;
    const rows = await products.aggregate([{ $match: { status: 'approved', category: { $ne: null } } }, { $group: { _id: '$category', count: { $sum: 1 } } }]).toArray();
    return Object.fromEntries(rows.map(row => [String(row._id), row.count]));
  };
  const baseline = async () => Object.fromEntries(await Promise.all(categories.map(async id => [String(id), await products.countDocuments({ category: id, status: 'approved' })])));
  const check = counts => Object.fromEntries(categories.map(id => [String(id), counts[String(id)] ?? 0]));
  const expected = await baseline();
  assert.deepEqual(check(await cache.read('category', load)), expected);
  const otherInstance = createNavigationCountsCache({ run: fn => fn(redis), isEnabled: () => true });
  assert.deepEqual(check(await otherInstance.read('category', load)), expected);
  assert.equal(aggregations, 1);
  const ttl = await redis.ttl(key('navigation-counts-v1', 'central-catalog', 'category'));
  assert.ok(ttl > 0 && ttl <= 60);
  const measure = async fn => { const start = performance.now(); for (let i = 0; i < 30; i++) await fn(); return (performance.now() - start) / 30; };
  const baselineMs = await measure(baseline);
  const cachedMs = await measure(() => cache.read('category', load));
  await redis.del(key('navigation-counts-v1', 'central-catalog', 'category'));
  await cache.read('category', load); assert.equal(aggregations, 2);
  console.log(JSON.stringify({ fixtureProducts: 3000, categories: 30, repeatedReads: 30, baselineMs, cachedMs, sharedCache: true, ttl, aggregations }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (redis.isReady) { await redis.del(key('navigation-counts-v1', 'central-catalog', 'category')); await redis.quit(); }
  if (connection) { await connection.dropDatabase(); await connection.close(); }
});
