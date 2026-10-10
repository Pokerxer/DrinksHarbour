'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createNavigationCountsCache } = require('../services/navigationCountsCache');
function fixture() {
  const entries = new Map();
  const run = async fn => fn({ get: async key => entries.get(key), set: async (key, value, options) => {
    assert.equal(options.EX, 60); entries.set(key, value);
  } });
  return { entries, cache: createNavigationCountsCache({ run, isEnabled: () => true }) };
}
test('repeated navigation reads reuse counts and separate category from subcategory', async () => {
  const { cache } = fixture(); let loads = 0;
  const load = async () => { loads++; return { a: 12 }; };
  assert.deepEqual(await cache.read('category', load), { a: 12 });
  await cache.read('category', load);
  assert.equal(loads, 1);
  await cache.read('subCategory', load);
  assert.equal(loads, 2);
});
test('concurrent navigation cache misses share one aggregation', async () => {
  const { cache } = fixture(); let loads = 0;
  const load = async () => { loads++; await new Promise(resolve => setImmediate(resolve)); return { a: 2 }; };
  const results = await Promise.all(Array.from({ length: 12 }, () => cache.read('category', load)));
  assert.equal(loads, 1); assert.equal(results[11].a, 2);
});
test('Redis outage and malformed data fall back to live counts', async () => {
  for (const run of [async () => { throw new Error('offline'); }, async fn => fn({ get: async () => '{bad', set: async () => {} })]) {
    assert.deepEqual(await createNavigationCountsCache({ run, isEnabled: () => true }).read('category', async () => ({ a: 3 })), { a: 3 });
  }
});
test('disabled Redis never contacts cache and unsupported operational fields are rejected', async () => {
  const cache = createNavigationCountsCache({ run: async () => assert.fail('Redis disabled'), isEnabled: () => false });
  assert.deepEqual(await cache.read('category', async () => ({ a: 1 })), { a: 1 });
  await assert.rejects(cache.read('sellingPrice', async () => ({})), /Unsupported/);
});
