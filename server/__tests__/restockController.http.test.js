const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { planningController } = require('../services/restock/controller');
const production = require('../routes/reorder.routes');
let server,
  url,
  calls = [];
before(async () => {
  const app = express(),
    c = planningController(
      async (tenant, options) => {
        calls.push({ tenant, options });
        return {
          generatedAt: 'now',
          lines: [
            {
              key: 'p:s:w',
              productName: 'Drink',
              available: 10,
              units30: 30,
              selected: { unitPrice: 2000 },
              alternatives: [],
            },
          ],
          groups: [],
        };
      },
      async () => {},
    );
  app.use((req, res, next) => {
    const role = req.headers['x-test-role'] || 'tenant_owner';
    req.user = {
      _id: 'u',
      tenant: role === 'admin' ? null : 'jwt-tenant',
      role,
      status: 'active',
      customPermissions: req.headers['x-test-reports'] ? ['reports:read'] : [],
    };
    req.tenant = { _id: 'header-pivot' };
    next();
  });
  app.get('/stock', c.warehouseRisk);
  app.get('/demand', c.demand);
  app.get('/order', c.orderPlan);
  app.use((e, req, res, next) =>
    res.status(e.statusCode || 500).json({ message: e.message }),
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
test('controller uses JWT authority and strips supplier data from reports', async () => {
  const r = await fetch(url + '/demand');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(calls.at(-1).tenant, 'jwt-tenant');
  assert.equal(body.data.lines[0].selected, undefined);
  assert.equal(body.data.groups, undefined);
});
test('staff permission and platform pivots are denied before evidence read', async () => {
  const count = calls.length;
  for (const [path, role] of [
    ['/order', 'tenant_staff'],
    ['/demand', 'tenant_staff'],
    ['/stock', 'admin'],
  ]) {
    const r = await fetch(url + path, { headers: { 'x-test-role': role } });
    assert.equal(r.status, 403);
  }
  assert.equal(calls.length, count);
});
test('unknown query and foreign-id syntax rejected before reads', async () => {
  const count = calls.length;
  for (const path of ['/demand?tenant=foreign', '/stock?warehouseId=foreign']) {
    const r = await fetch(url + path);
    assert.equal(r.status, 400);
  }
  assert.equal(calls.length, count);
});
test('inventory-only view has stock facts and no sales/model metadata', async () => {
  const r = await fetch(url + '/stock', {
    headers: { 'x-test-role': 'tenant_staff' },
  });
  const body = await r.json();
  assert.equal(body.data.lines[0].available, 10);
  assert.equal(body.data.lines[0].units30, undefined);
  assert.equal(calls.at(-1).options.includeSales, false);
});
test('production risk routes precede purchase entitlement while order plan follows it', () => {
  const stack = production.stack,
    at = (p) => stack.findIndex((l) => l.route?.path === p);
  assert.ok(at('/warehouse-risk') >= 0);
  assert.ok(at('/demand') < at('/order-plan'));
  assert.ok(
    stack.slice(at('/demand') + 1, at('/order-plan')).some((l) => !l.route),
  );
});
test('warehouse owners can manage transfers without exposing supplier data', async () => {
  const r = await fetch(url + '/stock');
  const body = await r.json();
  assert.equal(body.data.canManageTransfers, true);
  assert.equal(body.data.canReviewRestock, true);
  assert.equal(body.data.lines[0].selected, undefined);
  assert.equal(body.data.groups, undefined);
  const staff = await (
    await fetch(url + '/stock', { headers: { 'x-test-role': 'tenant_staff' } })
  ).json();
  assert.equal(staff.data.canManageTransfers, false);
  assert.equal(staff.data.canReviewRestock, false);
});
