'use strict';
// Local disposable Mongo/Redis fixture. Never loads .env or production data.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createClient } = require('redis');
process.env.REDIS_NAMESPACE = `drinks-admin-report-test:${process.pid}`;
const { key } = require('../../config/redis');
const { createAdminReportCache, canonical } = require('../../services/adminReportCache');
const { reportContext } = require('../../middleware/adminReportCache');
const { getDashboard } = require('../../controllers/analytics.controller');
const redis = createClient({ url: 'redis://127.0.0.1:6379', socket: { connectTimeout: 1000, reconnectStrategy: false } });
redis.on('error', () => {});
const scopes = ['all', 'platform']; const contexts = [];
const dbName = `drinks_admin_report_test_${process.pid}`;
let connected = false, loads = 0;
async function main() {
  await redis.connect();
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, { serverSelectionTimeoutMS: 2000, autoIndex: false });
  connected = true;
  const db = mongoose.connection.db;
  const tenants = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  await db.collection('tenants').insertMany(tenants.map((id, i) => ({ _id: id, name: `Shop ${i}`, slug: `shop-${i}`, revenueModel: 'commission' })));
  const now = Date.now();
  await db.collection('orders').insertMany(Array.from({ length: 5000 }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(), orderNumber: `T-${i}`, source: 'web', status: 'delivered', paymentStatus: 'paid', totalAmount: i % 2 ? 8000 : 5000,
    placedAt: new Date(now - (i % 20) * 86400000), createdAt: new Date(now - (i % 20) * 86400000),
    items: [{ tenant: tenants[i % 2], quantity: 1, subtotal: i % 2 ? 8000 : 5000, tenantRevenueShare: 4350, platformCommission: 650 }],
  })));
  await db.collection('orders').createIndex({ 'items.tenant': 1, source: 1, placedAt: 1 });
  const reqFor = tenant => ({ user: { _id: `user-${tenant}`, tenant, role: 'tenant_admin' }, tenant: { _id: tenant }, query: { period: 'month' } });
  const load = req => new Promise((resolve, reject) => {
    loads++;
    getDashboard(req, { json(body) { resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) }); } }, reject);
  });
  const run = fn => fn(redis);
  const cache = createAdminReportCache({ run, isEnabled: () => true });
  const req = reqFor(tenants[0]); const context = reportContext(req, 'dashboard'); contexts.push(context);
  scopes.push(`tenant:${tenants[0]}`, `tenant:${tenants[1]}`);
  const original = await load(req);
  assert.deepEqual(await cache.read(context, () => load(req)), original);
  const otherInstance = createAdminReportCache({ run, isEnabled: () => true });
  const before = loads;
  assert.deepEqual(await otherInstance.read(context, () => load(req)), original);
  assert.equal(loads, before);
  const contextB = reportContext(reqFor(tenants[1]), 'dashboard'); contexts.push(contextB);
  const otherTenant = await cache.read(contextB, () => load(reqFor(tenants[1])));
  assert.notEqual(otherTenant.body.data.statCards.period.revenue, original.body.data.statCards.period.revenue);
  const measure = async fn => { const started = performance.now(); for (let i = 0; i < 10; i++) await fn(); return (performance.now() - started) / 10; };
  const directMs = await measure(() => load(req));
  const warmMs = await measure(() => cache.read(context, () => load(req)));
  const ttl = await redis.ttl(key('admin-report-v1', canonical(context)));
  assert.ok(ttl > 0 && ttl <= 30);
  const readCount = loads;
  await cache.invalidate([`tenant:${tenants[0]}`, 'platform']);
  await otherInstance.read(context, () => load(req)); assert.equal(loads, readCount + 1);
  console.log(JSON.stringify({ fixtureOrders: 5000, repetitions: 10, directReportMs: directMs, warmRedisReportMs: warmMs, ttl, tenantIsolation: true, sharedAcrossInstances: true, invalidation: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (redis.isReady) {
    await redis.del([...scopes.map(scope => key('admin-report-revision', scope)), ...contexts.map(context => key('admin-report-v1', canonical(context)))]);
    await redis.quit();
  }
  if (connected) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
