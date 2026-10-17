const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startRouter,
  mockAuthUser,
  mockTenantContext,
  ROLE_USERS,
} = require('./helpers/routeAuthHarness');
const router = require('../routes/subproduct.routes');
const service = require('../services/subproduct.service');
const path = '/api/subproducts/aaaaaaaaaaaaaaaaaaaaaaaa';
test('a platform reviewer without tenant membership can read a listing with fresh pricing', async (t) => {
  const authorization = mockAuthUser(t, { ...ROLE_USERS.super_admin, tenant: null });
  let seen;
  t.mock.method(service, 'getSubProduct', async (id, tenant, options) => {
    seen = { tenant, options };
    return { _id: id };
  });
  const app = await startRouter(router, '/api/subproducts');
  try {
    const response = await fetch(app.url(path + '?refresh=true'), {
      headers: { authorization },
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(seen.tenant, null);
    assert.equal(seen.options.anyTenant, true);
    assert.equal(seen.options.fresh, true);
  } finally {
    await app.close();
  }
});
test('tenant reviewers cannot opt into another tenant through the review read query', async (t) => {
  const authorization = mockAuthUser(t, ROLE_USERS.tenant_admin);
  mockTenantContext(t);
  let seen;
  t.mock.method(service, 'getSubProduct', async (id, tenant, options) => {
    seen = { tenant, options };
    return { _id: id };
  });
  const app = await startRouter(router, '/api/subproducts');
  try {
    const response = await fetch(app.url(path + '?anyTenant=true&tenant=foreign'), {
      headers: { authorization, 'x-tenant-slug': 'foreign' },
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(String(seen.tenant), String(ROLE_USERS.tenant_admin.tenant));
    assert.equal(seen.options.anyTenant, false);
  } finally {
    await app.close();
  }
});
