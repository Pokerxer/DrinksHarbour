// server/__tests__/scan.platform.test.js
//
// Task 2 of the WhatsApp Order Builder v2 plan: desktopMatch must allow
// platform admins (super_admin/admin JWTs, no tenant context) to match across
// ALL tenants' published subproducts, while tenant actors keep the existing
// single-tenant behavior (400 without tenant context).
const test = require('node:test');
const assert = require('node:assert');

test('desktopMatch: platform admin matches cross-tenant; tenant actor unchanged', async (t) => {
  const controller = require('../controllers/scan.controller');
  const scanMatch = require('../services/scanMatch.service');
  const subProductService = require('../services/subproduct.service');

  let capturedArgs = null;
  t.mock.method(scanMatch, 'extractAndMatch', async (input, opts) => {
    capturedArgs = opts;
    return [];
  });
  let getterTenantArg = 'unset';
  t.mock.method(subProductService, 'getMySubProducts', async (tenantId, params) => {
    getterTenantArg = tenantId;
    return { subProducts: [] };
  });

  // Platform admin (no tenant context)
  const res1 = { json: (b) => {}, status() { return { json: () => {} }; } };
  await controller.desktopMatch(
    { tenant: null, user: { role: 'super_admin' }, body: { text: 'hennessy 70cl 2 bottles' } },
    res1,
    (e) => { throw e; },
  );
  assert.strictEqual(capturedArgs.tenantId, null, 'platform matching must be tenant-less');
  assert.ok(capturedArgs.getSubProducts, 'getter injected');
  // The mocked extractAndMatch never calls the getter itself, so invoke the
  // captured getter directly to prove it forwards the platform (null) tenantId
  // through to the catalogue service.
  await capturedArgs.getSubProducts(null);
  assert.strictEqual(getterTenantArg, null, 'catalogue getter must be cross-tenant');

  // Tenant actor without tenant context header → still 400 (unchanged behavior)
  let status2;
  const res2 = { status(c) { status2 = c; return { json: () => {} }; }, json: () => {} };
  await controller.desktopMatch(
    { tenant: null, user: { role: 'tenant_admin' }, body: { text: 'x' } },
    res2,
    () => {},
  );
  assert.strictEqual(status2, 400, 'non-platform actor without tenant context still rejected');
});
