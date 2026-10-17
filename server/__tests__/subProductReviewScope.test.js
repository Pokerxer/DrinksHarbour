const test = require('node:test');
const assert = require('node:assert/strict');
const SubProduct = require('../models/SubProduct');
const service = require('../services/subproduct.service');
test('tenant review scopes the listing lookup to JWT tenant; missing tenant is denied', async (t) => {
  let query;
  t.mock.method(SubProduct, 'findOne', (q) => {
    query = q;
    const c = {
      populate() {
        return c;
      },
      then(resolve) {
        return Promise.resolve(null).then(resolve);
      },
    };
    return c;
  });
  await assert.rejects(
    service.adminSetSubProductStatus('sp', 'active', {}, null, {
      role: 'tenant_admin',
      tenant: 'a',
    }),
    { statusCode: 404 }
  );
  assert.deepEqual(query, { _id: 'sp', tenant: 'a' });
  await assert.rejects(
    service.adminSetSubProductStatus('sp', 'active', {}, null, {
      role: 'tenant_admin',
    }),
    { statusCode: 403 }
  );
});
