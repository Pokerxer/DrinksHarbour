'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReadinessHandler } = require('../middleware/readiness');
const response = () => ({ code: 200, headers: {}, status(value) { this.code = value; return this; },
  set(key, value) { this.headers[key] = value; return this; }, json(body) { this.body = body; return this; } });
test('readiness refuses a disconnected database without attempting a query', async () => {
  const res = response();
  await createReadinessHandler({ connection: { readyState: 0 } })({}, res);
  assert.equal(res.code, 503);
  assert.equal(res.body.status, 'not_ready');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('readiness requires a successful database ping, not only a connected flag', async () => {
  const res = response();
  await createReadinessHandler({ connection: { readyState: 1, db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) } } })({}, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.status, 'ready');
});
test('readiness fails closed without publishing database connection diagnostics', async () => {
  const res = response();
  await createReadinessHandler({ connection: { readyState: 1, db: { admin: () => ({ ping: async () => { throw new Error('private-host-and-password'); } }) } } })({}, res);
  assert.equal(res.code, 503);
  assert(!JSON.stringify(res.body).includes('private-host'));
});
test('a stalled dependency cannot hold readiness open indefinitely', async () => {
  const res = response();
  await createReadinessHandler({ timeoutMs: 10, connection: { readyState: 1, db: { admin: () => ({ ping: () => new Promise(() => {}) }) } } })({}, res);
  assert.equal(res.code, 503);
});
