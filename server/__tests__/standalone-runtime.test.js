'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createNavigationCountsCache } = require('../services/navigationCountsCache');
const { createAdminReportCache } = require('../services/adminReportCache');
const { sharedStore } = require('../middleware/redisRateLimitStore');
const rateLimit = require('express-rate-limit');

test('stale provider credentials cannot load a Redis client or activate caches', async () => {
  const sandbox = { require: name => {
    if (name === 'redis') throw new Error('Redis must not be a runtime dependency');
    return require(name);
  }, process: { env: { REDIS_URL: 'rediss://unused.invalid', REDIS_PUBLIC_METADATA_CACHE: 'true' } }, module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../config/redis'), 'utf8'), sandbox);
  const config = sandbox.module.exports;
  assert.equal(config.enabled(), false);
  assert.equal(config.metadataEnabled(), false);
  let attempted = false;
  await assert.rejects(config.runRedis(() => { attempted = true; }));
  assert.equal(attempted, false);
  await config.closeRedis();
});

test('default caches use fresh authoritative loaders despite leftover Redis credentials', async () => {
  const old = process.env.REDIS_URL;
  process.env.REDIS_URL = 'rediss://unused.invalid';
  try {
    const navigation = createNavigationCountsCache();
    let count = 0;
    assert.deepEqual(await navigation.read('category', async () => ({ drinks: ++count })), { drinks: 1 });
    assert.deepEqual(await navigation.read('category', async () => ({ drinks: ++count })), { drinks: 2 });
    const reports = createAdminReportCache();
    assert.equal(reports.isEnabled(), false);
    assert.equal(await reports.read({ scope: 'tenant:test' }, async () => ++count), 3);
    assert.equal(await reports.read({ scope: 'tenant:test' }, async () => ++count), 4);
  } finally {
    if (old === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = old;
  }
});

test('rate limiting retains local enforcement with no shared provider store', async () => {
  const old = process.env.REDIS_URL;
  process.env.REDIS_URL = 'rediss://unused.invalid';
  let limiter;
  try {
    assert.deepEqual(sharedStore('auth:login'), {});
    limiter = rateLimit({ ...sharedStore('auth:login'), windowMs: 60000, limit: 2, standardHeaders: false, legacyHeaders: false, validate: false });
    const invoke = () => new Promise((resolve, reject) => {
      const req = { ip: '127.0.0.1', app: { get: () => false }, headers: {}, socket: {} };
      const res = { status(code) { this.statusCode = code; return this; }, setHeader() {}, on() {}, send() { resolve(this.statusCode); } };
      limiter(req, res, error => error ? reject(error) : resolve(200));
    });
    assert.equal(await invoke(), 200);
    assert.equal(await invoke(), 200);
    assert.equal(await invoke(), 429);
  } finally {
    if (old === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = old;
  }
});
