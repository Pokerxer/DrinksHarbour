'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startRouter,
  mockAuthUser,
  mockTenantContext,
  ROLE_USERS,
} = require('./helpers/routeAuthHarness');
const router = require('../routes/product.routes');
const stock = require('../services/product-sales.service');
const path = '/api/products/admin/aaaaaaaaaaaaaaaaaaaaaaaa/sales';
test('anonymous and customer requests cannot read sales historys', async (t) => {
  const authorization = mockAuthUser(t, ROLE_USERS.customer);
  let called = false;
  t.mock.method(stock, 'getProductSalesHistory', async () => {
    called = true;
    return {};
  });
  const app = await startRouter(router, '/api/products');
  try {
    assert.equal((await fetch(app.url(path))).status, 401);
    assert.equal(
      (await fetch(app.url(path), { headers: { authorization } })).status,
      403
    );
    assert.equal(called, false);
  } finally {
    await app.close();
  }
});
for (const role of ['tenant_owner', 'tenant_admin'])
  test(`${role} sales history reads use JWT tenant, ignoring query/header tenant spoofing`, async (t) => {
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    mockTenantContext(t);
    let tenant;
    t.mock.method(stock, 'getProductSalesHistory', async (_id, scope) => {
      tenant = scope;
      return { rows: [], totals: { net: 0 }, complete: true };
    });
    const app = await startRouter(router, '/api/products');
    try {
      const response = await fetch(app.url(path + '?tenant=foreign'), {
        headers: { authorization, 'x-tenant-slug': 'foreign' },
      });
      assert.equal(response.status, 200, await response.clone().text());
      assert.equal(tenant, String(ROLE_USERS[role].tenant));
      assert.match(response.headers.get('cache-control'), /private, no-store/);
    } finally {
      await app.close();
    }
  });
test('platform admin without a tenant can read all sales; tenant users without a tenant cannot', async (t) => {
  let scope = 'not-called';
  t.mock.method(stock, 'getProductSalesHistory', async (_id, tenant) => {
    scope = tenant;
    return { rows: [], totals: { net: 0 }, complete: true };
  });
  let authorization = mockAuthUser(t, {
    ...ROLE_USERS.super_admin,
    tenant: null,
  });
  const app = await startRouter(router, '/api/products');
  try {
    assert.equal(
      (await fetch(app.url(path), { headers: { authorization } })).status,
      200
    );
    assert.equal(scope, null);
  } finally {
    await app.close();
  }
});
test('tenant users without tenant authority are denied', async (t) => {
  const authorization = mockAuthUser(t, {
    ...ROLE_USERS.tenant_owner,
    tenant: null,
  });
  let called = false;
  t.mock.method(stock, 'getProductSalesHistory', async () => {
    called = true;
    return {};
  });
  const app = await startRouter(router, '/api/products');
  try {
    assert.equal(
      (await fetch(app.url(path), { headers: { authorization } })).status,
      403
    );
    assert.equal(called, false);
  } finally {
    await app.close();
  }
});
