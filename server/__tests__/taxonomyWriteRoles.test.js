// Brand, Category and SubCategory are platform-wide: Brand has no `tenant`
// field at all, and Category/SubCategory carry only `tenantPresenceCount`, a
// denormalised counter rather than ownership. Their admin write routes were
// nonetheless open to tenant_owner and tenant_admin, so one tenant's admin
// could delete a global brand the storefront and every other tenant depend on.
//
// Banner is the deliberate exception: it has a real `tenant` ref, a
// {tenant, placement, isActive} index and a per-plan gate, so tenant writes are
// legitimate there. banner.routes.js:8 merely forgot tenant_owner.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.2

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');

const { startRouter, mockAuthUser, ROLE_USERS } = require('./helpers/routeAuthHarness');

const ABSENT_ID = '000000000000000000000000';

const PLATFORM_ONLY = ['super_admin', 'admin'];
const TENANT_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

/**
 * Fires one request at `path` as `role` and reports the status. The route's
 * controller is never expected to run for a denied role; for an allowed role it
 * may run and fail on a missing document, which is fine — this test only ever
 * asserts on the 401/403 boundary, never on 2xx.
 */
async function statusAs(t, router, basePath, method, path, role) {
  const app = await startRouter(router, basePath);
  try {
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    const res = await fetch(app.url(path), {
      method,
      headers: { 'content-type': 'application/json', authorization },
      body: method === 'DELETE' ? undefined : '{}',
    });
    return res.status;
  } finally {
    await app.close();
  }
}

const TAXONOMY_WRITES = [
  ['brand', '../routes/brand.routes', '/api/brands', 'POST', '/api/brands/admin'],
  ['brand', '../routes/brand.routes', '/api/brands', 'PUT', `/api/brands/admin/${ABSENT_ID}`],
  ['brand', '../routes/brand.routes', '/api/brands', 'DELETE', `/api/brands/admin/${ABSENT_ID}`],
  ['category', '../routes/category.routes', '/api/categories', 'POST', '/api/categories/admin'],
  ['category', '../routes/category.routes', '/api/categories', 'DELETE', `/api/categories/admin/${ABSENT_ID}`],
  ['subcategory', '../routes/subcategory.routes', '/api/subcategories', 'POST', '/api/subcategories/admin'],
  ['subcategory', '../routes/subcategory.routes', '/api/subcategories', 'DELETE', `/api/subcategories/admin/${ABSENT_ID}`],
];

for (const [label, modulePath, basePath, method, path] of TAXONOMY_WRITES) {
  for (const role of TENANT_ROLES) {
    test(`${method} ${path} denies ${role} (${label} is platform-wide)`, async (t) => {
      const router = require(modulePath);
      const status = await statusAs(t, router, basePath, method, path, role);
      assert.strictEqual(status, 403, `${role} must not write platform ${label} data`);
    });
  }

  for (const role of PLATFORM_ONLY) {
    test(`${method} ${path} still admits ${role}`, async (t) => {
      const router = require(modulePath);
      const status = await statusAs(t, router, basePath, method, path, role);
      assert.notStrictEqual(status, 401, `${role} must authenticate`);
      assert.notStrictEqual(status, 403, `${role} must pass authorization`);
    });
  }
}

// ── Banners: tenant-scoped and plan-gated, so tenants keep write access ───────

test('POST /api/banners admits tenant_owner (the role that owns the tenant)', async (t) => {
  const router = require('../routes/banner.routes');
  const status = await statusAs(t, router, '/api/banners', 'POST', '/api/banners', 'tenant_owner');
  assert.notStrictEqual(status, 403, 'tenant_owner owns the tenant its banners belong to');
  assert.notStrictEqual(status, 401);
});

test('POST /api/banners still admits tenant_admin', async (t) => {
  const router = require('../routes/banner.routes');
  const status = await statusAs(t, router, '/api/banners', 'POST', '/api/banners', 'tenant_admin');
  assert.notStrictEqual(status, 403);
  assert.notStrictEqual(status, 401);
});

test('POST /api/banners still denies customer', async (t) => {
  const router = require('../routes/banner.routes');
  const status = await statusAs(t, router, '/api/banners', 'POST', '/api/banners', 'customer');
  assert.strictEqual(status, 403);
});
