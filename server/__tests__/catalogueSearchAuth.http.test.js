'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startRouter, mockAuthUser, mockTenantContext, ROLE_USERS } = require('./helpers/routeAuthHarness');
const router = require('../routes/product.routes');
const search = require('../services/catalogue-search.service');
const Tenant = require('../models/Tenant');

// Removing tenant resolution from this route would deny valid tenant callers.
for (const role of ['tenant_admin', 'tenant_owner', 'super_admin']) {
  test(`catalogue search allows an authenticated ${role} with resolved tenant authority`, async (t) => {
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    mockTenantContext(t);
    t.mock.method(search, 'searchCatalogueProducts', async () => ({ products: [{ _id: 'catalog-id', name: 'Monte' }] }));
    const app = await startRouter(router, '/api/products');
    try {
      const response = await fetch(app.url('/api/products/catalogue-search?q=monte&matchMode=smart'), {
        headers: { authorization, 'x-tenant-slug': 'another-tenant' },
      });
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      assert.equal((await response.json()).data.products[0].name, 'Monte');
    } finally { await app.close(); }
  });
}

test('catalogue search still denies a tenant user whose tenant cannot be resolved', async (t) => {
  const authorization = mockAuthUser(t, ROLE_USERS.tenant_admin);
  t.mock.method(Tenant, 'findById', () => ({ select: () => ({ lean: async () => null }) }));
  const app = await startRouter(router, '/api/products');
  try {
    const response = await fetch(app.url('/api/products/catalogue-search?q=monte&matchMode=smart'), { headers: { authorization } });
    assert.equal(response.status, 403);
  } finally { await app.close(); }
});

test('catalogue search keeps anonymous and customer callers out', async (t) => {
  const authorization = mockAuthUser(t, ROLE_USERS.customer);
  mockTenantContext(t);
  const app = await startRouter(router, '/api/products');
  try {
    for (const headers of [{}, { authorization }]) {
      const response = await fetch(app.url('/api/products/catalogue-search?q=monte&matchMode=smart'), { headers });
      assert.equal(response.status, headers.authorization ? 403 : 401);
    }
  } finally { await app.close(); }
});
