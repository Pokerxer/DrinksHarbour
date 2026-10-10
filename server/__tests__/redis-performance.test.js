'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMetadataCache } = require('../services/publicMetadataCache');
const { RedisRateLimitStore } = require('../middleware/redisRateLimitStore');
test('metadata cache shares revision reads but isolates tenants and updates', async () => {
  const values = new Map(); let loads = 0;
  const run = async fn => fn({ mGet: async keys => keys.map(k => values.get(k) || null),
    set: async (k, v) => values.set(k, v) });
  const cache = createMetadataCache(run);
  const row = { _id: 'product', updatedAt: new Date('2026-01-01') };
  const loader = async rows => { loads++; return rows.map(r => ({ ...r, description: 'public' })); };
  assert.equal((await cache.read('tenantA', 'product', [row], loader))[0].description, 'public');
  await cache.read('tenantA', 'product', [row], loader); assert.equal(loads, 1);
  await cache.read('tenantB', 'product', [row], loader); assert.equal(loads, 2);
  await cache.read('tenantA', 'product', [{ ...row, updatedAt: new Date('2026-01-02') }], loader);
  assert.equal(loads, 3);
});
test('missing revisions, corrupt cache and Redis outage use authoritative loader', async () => {
  const loader = async rows => rows.map(row => ({ ...row, description: 'fresh' }));
  const row = { _id: 'product', updatedAt: new Date() };
  for (const run of [async () => { throw new Error('offline'); }, async fn => fn({mGet: async () => ['bad JSON'], set: async () => {}})]) {
    assert.equal((await createMetadataCache(run).read('tenant', 'product', [row], loader))[0].description, 'fresh');
  }
  let accessed = false;
  await createMetadataCache(async () => { accessed = true; }).read('tenant', 'product', [{ _id: 'product' }], loader);
  assert.equal(accessed, false);
});
test('shared rate store uses atomic script, bounded TTL and separate namespaces', async () => {
  let call;
  const store = new RedisRateLimitStore('api', async fn => fn({eval: async (...args) => { call = args; return [2, 999]; }}));
  store.init({ windowMs: 1000 });
  const result = await store.increment('127.0.0.1');
  assert.equal(result.totalHits, 2);
  assert.ok(result.resetTime instanceof Date);
  assert.ok(result.resetTime.getTime() > Date.now());
  assert.ok(call[1].keys[0].includes(':api:'));
  assert.deepEqual(call[1].arguments, ['1000']);
});
test('shared limiter propagates Redis outage instead of resetting to local counters', async () => {
  const store = new RedisRateLimitStore('api', async () => { throw new Error('offline'); });
  store.init({ windowMs: 1000 });
  await assert.rejects(store.increment('ip'), /offline/);
});
test('outage fallback preserves the live sort order', async () => {
  const cache = createMetadataCache(async () => { throw new Error('offline'); });
  const refs = [{_id:'a',updatedAt:new Date()}, {_id:'b',updatedAt:new Date()}];
  assert.deepEqual((await cache.read('tenant','banner',refs,async rows => [...rows].reverse())).map(row=>row._id), ['a','b']);
});
test('a concurrent edit or deletion requests a fresh authoritative query', async () => {
  const cache = createMetadataCache(async fn => fn({mGet:async()=>[null],set:async()=>{throw new Error('must not write');}}));
  const refs = [{_id:'a',updatedAt:new Date('2026-01-01')}];
  assert.equal(await cache.read('tenant','product',refs,async()=>[]),null);
  assert.equal(await cache.read('tenant','product',refs,async()=>[{_id:'a',updatedAt:new Date('2026-01-02')}]),null);
});
test('metadata caching requires explicit opt-in even when shared Redis is configured', () => {
  const { metadataEnabled } = require('../config/redis');
  const url = process.env.REDIS_URL, setting = process.env.REDIS_PUBLIC_METADATA_CACHE;
  try {
    process.env.REDIS_URL = 'redis://localhost:1'; delete process.env.REDIS_PUBLIC_METADATA_CACHE;
    assert.equal(metadataEnabled(), false);
    process.env.REDIS_PUBLIC_METADATA_CACHE = 'true'; assert.equal(metadataEnabled(), true);
    delete process.env.REDIS_URL; assert.equal(metadataEnabled(), false);
  } finally {
    if (url === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = url;
    if (setting === undefined) delete process.env.REDIS_PUBLIC_METADATA_CACHE; else process.env.REDIS_PUBLIC_METADATA_CACHE = setting;
  }
});
test('a revision change during an outage fallback repeats the live query', async () => {
  const cache = createMetadataCache(async () => { throw new Error('offline'); });
  assert.equal(await cache.read('tenant','product',[{_id:'a',updatedAt:new Date('2026-01-01')}],
    async()=>[{_id:'a',updatedAt:new Date('2026-01-02')}]),null);
});
