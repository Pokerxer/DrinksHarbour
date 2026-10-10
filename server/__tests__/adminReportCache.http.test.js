const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdminReportMiddleware, reportContext } = require('../middleware/adminReportCache');
let server, base, loads = 0, guards = 0;
const reports = new Map(); let invalidated = false;
const cache = {
  isEnabled: () => true,
  async read(context, load, { fresh }) {
    const key = JSON.stringify(context);
    if (!fresh && reports.has(key)) return reports.get(key);
    const result = await load(); if (result.status === 200) reports.set(key, result); return result;
  },
  async invalidate() { await new Promise(resolve => setTimeout(resolve, 5)); reports.clear(); invalidated = true; },
};
test.before(async () => {
  const app = express();
  const { cacheReport, invalidateReports } = createAdminReportMiddleware(cache);
  app.use(invalidateReports);
  app.use((req, res, next) => {
    guards++;
    if (!req.headers.authorization) return res.status(401).json({ success: false });
    req.user = { _id: req.headers.authorization, role: 'tenant_admin', tenant: 'A' };
    req.tenant = { _id: 'A' }; next();
  });
  app.get('/report', cacheReport('report', { tenantRequired: true }), (req, res) => res.json({ success: true, data: ++loads }));
  app.post('/write', (req, res) => res.json({ success: true }));
  app.get('/failure', cacheReport('failure'), (req, res) => res.status(422).json({ success: false, message: 'Invalid period' }));
  app.get('/throw', cacheReport('throw'), (req, res, next) => next(new Error('Report failed')));
  app.use((err, req, res, next) => res.status(500).json({ success: false, message: err.message }));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise(resolve => server.close(resolve)));
const read = path => fetch(base + path, { headers: { Authorization: 'user' } });
test('cache hits still run authentication and stay private', async () => {
  const first = await read('/report'); const body = await first.json();
  const second = await read('/report'); assert.deepEqual(await second.json(), body); assert.equal(loads, 1);
  assert.match(second.headers.get('cache-control'), /private.*no-store/);
  assert.equal((await fetch(base + '/report')).status, 401); assert.equal(guards, 3);
});
test('fresh bypass and successful writes are visible before their response completes', async () => {
  assert.equal((await (await read('/report?refresh=true')).json()).data, 2);
  await fetch(base + '/write', { method: 'POST', headers: { Authorization: 'user' } });
  assert.equal(invalidated, true);
  assert.equal((await (await read('/report')).json()).data, 3);
});
test('JSON failures and thrown controller errors retain their status and body', async () => {
  const failure = await read('/failure'); assert.equal(failure.status, 422); assert.equal((await failure.json()).message, 'Invalid period');
  const thrown = await read('/throw'); assert.equal(thrown.status, 500); assert.equal((await thrown.json()).message, 'Report failed');
});
test('scope derives from trusted tenant and current permissions, never query tenant', () => {
  const req = { user: { _id: 'u', role: 'tenant_admin', tenant: 'A', customPermissions: ['inventory:read'] }, tenant: { _id: 'A' }, query: { tenant: 'B' } };
  assert.equal(reportContext(req, 'inventory', { tenantRequired: true }).scope, 'tenant:A');
  assert.equal(reportContext({ user: { _id: 'u', role: 'tenant_admin' } }, 'inventory'), null);
});

test('sub-product generations invalidate when report caching is disabled', async t => {
  const { subProductPageCache } = require('../services/subProductPageCache');
  let scopes;
  t.mock.method(cache, 'isEnabled', () => false);
  t.mock.method(subProductPageCache, 'isEnabled', () => true);
  t.mock.method(subProductPageCache, 'invalidate', async value => { scopes = value; });
  await fetch(base + '/write', { method: 'POST', headers: { Authorization: 'user' } });
  assert.deepEqual(scopes, ['tenant:A', 'platform']);
});
