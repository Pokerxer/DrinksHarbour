// server/__tests__/productPendingAccess.test.js
//
// GET /api/products/admin/pending intentionally allows tenant admins/owners
// to browse (their data populates the tenant "pending submissions" journey),
// but tenant-isolation hardening requires that tenant roles see ONLY their
// own submissions: the tenant filter is forced from the validated request
// context (req.user.tenant via getTenantId — never a client query value),
// while platform admins may use the provided filters. Also pins that the
// pending search regexes escape user input (regex-injection hygiene per the
// escape-regex-for-user-input memory).

const test = require('node:test');
const assert = require('node:assert/strict');

// The controller requires express-async-handler wrapped exports; require the
// controller module and pull the raw handler.
const controller = require('../controllers/product.controller');

function makeRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const PENDING_SERVICE_RESULT = { success: true, data: { products: [], pagination: { page: 1, total: 0 } } };

test('tenant roles are forced to their own submittingTenant; super-admin keeps filter authority', async (t) => {
  const calls = [];
  const product = require('../services/product.service');
  t.mock.method(product, 'getPendingProducts', async (filters) => {
    calls.push(filters);
    return PENDING_SERVICE_RESULT;
  });

  // Tenant call: ?tenant=OTHER is IGNORED, own tenant is forced.
  const tenantReq = {
    user: { role: 'tenant_admin', tenant: 'tenant-own-id' },
    query: { tenant: 'other-tenant-id', search: 'coffee' },
  };
  const tenantRes = makeRes();
  await controller.getPendingProducts(tenantReq, tenantRes);
  assert.equal(tenantRes.statusCode, 200);
  assert.ok(calls[0], 'service was called');
  assert.equal(calls[0].submittingTenant, 'tenant-own-id', 'tenant scope must come from req.user.tenant, not the query');
  assert.equal(calls[1] === undefined, true, 'one service call per request');

  // Super-admin call: filters honored as provided.
  const adminReq = {
    user: { role: 'super_admin' },
    query: { tenant: 'other-tenant-id' },
  };
  const adminRes = makeRes();
  await controller.getPendingProducts(adminReq, adminRes);
  assert.equal(calls[1].submittingTenant, 'other-tenant-id', 'super-admin may scope freely');

  // Platform admin role behaves like super-admin for browsing.
  const platReq = { user: { role: 'admin' }, query: { tenant: 'some-tenant' } };
  await controller.getPendingProducts(platReq, makeRes());
  assert.equal(calls[2].submittingTenant, 'some-tenant');

  assert.equal(calls.length, 3);
});

test('pending search terms are regex-escaped; pagination ints are clamped', async (t) => {
  const product = require('../services/product.service');
  const seen = [];
  t.mock.method(product, 'getPendingProducts', async (filters, pagination) => {
    seen.push({ filters, pagination });
    return PENDING_SERVICE_RESULT;
  });
  const req = {
    user: { role: 'super_admin' },
    query: { search: '(lunatic).*[z', page: '0', limit: '99999' },
  };
  await controller.getPendingProducts(req, makeRes());
  // Raw metacharacters must appear escaped (backslashed) in the filters the
  // service receives, so the RegExp built there cannot be manipulated.
  assert.equal(seen[0].filters.search, '\\(lunatic\\)\\.\\*\\[z');
  assert.equal(seen[0].pagination.page, 1, 'parseInt fallback for page 0 is 1');
  assert.equal(seen[0].pagination.limit, 99999, 'raw int passes through — the SERVICE clamps limit to 100 (asserted there)');
});
