'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startRouter, mockAuthUser, ROLE_USERS } = require('./helpers/routeAuthHarness');
const router = require('../routes/product.routes');
const service = require('../services/product.service');

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const path = `/api/products/admin/${id}/details`;

for (const role of ['tenant_admin', 'super_admin']) {
  test(`catalog detail access for ${role}`, async t => {
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    const read = t.mock.method(service, 'getProductById', async () => ({ _id: id }));
    const app = await startRouter(router, '/api/products');
    try {
      assert.equal((await fetch(app.url(path))).status, 401);
      const response = await fetch(app.url(path), { headers: { authorization } });
      if (role === 'tenant_admin') {
        assert.equal(response.status, 403);
        assert.equal(read.mock.callCount(), 0);
      } else {
        assert.equal(response.status, 200);
        assert.equal((await response.json()).data.product._id, id);
        assert.match(response.headers.get('cache-control'), /private, no-store/);
        assert.deepEqual(read.mock.calls[0].arguments, [id, true, { adminDetails: true }]);
      }
    } finally {
      await app.close();
    }
  });
}
