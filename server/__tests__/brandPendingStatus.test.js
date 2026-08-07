// Task 2 restricted the platform taxonomy to platform admins. The one tenant
// workflow that would have broken is the inline "create brand" modal in the
// product and sub-product flows, so POST /api/brands stays open to tenant roles
// and yields a *pending* brand instead of an active one. A platform admin then
// approves it by flipping status through the guarded PUT /api/brands/admin/:id.
//
// The status is forced, never defaulted: a tenant posting {"status":"active"}
// must still get "pending", otherwise the whole branch is decorative.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.3

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');

const brandService = require('../services/brand.service');
const brandRouter = require('../routes/brand.routes');
const { startRouter, mockAuthUser, ROLE_USERS } = require('./helpers/routeAuthHarness');

/**
 * Posts `body` as `role` and returns the brandData object the controller handed
 * to brandService.createBrand, so the persisted status can be asserted without
 * a database.
 */
async function createBrandAs(t, role, body) {
  let received = null;
  t.mock.method(brandService, 'createBrand', async (brandData) => {
    received = brandData;
    return { _id: '000000000000000000000000', ...brandData };
  });

  const app = await startRouter(brandRouter, '/api/brands');
  try {
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    const res = await fetch(app.url('/api/brands'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify(body),
    });
    return { status: res.status, received };
  } finally {
    await app.close();
  }
}

for (const role of ['tenant_owner', 'tenant_admin', 'tenant_staff']) {
  test(`${role} creates a pending brand`, async (t) => {
    const { status, received } = await createBrandAs(t, role, { name: 'Proposed Brand' });
    assert.strictEqual(status, 201);
    assert.strictEqual(received.status, 'pending', `${role} may only propose a brand`);
  });

  test(`${role} cannot self-approve by posting status: 'active'`, async (t) => {
    const { received } = await createBrandAs(t, role, { name: 'Sneaky Brand', status: 'active' });
    assert.strictEqual(received.status, 'pending', 'the caller-supplied status must be overridden');
  });
}

for (const role of ['super_admin', 'admin']) {
  test(`${role} creates an active brand`, async (t) => {
    const { status, received } = await createBrandAs(t, role, { name: 'Platform Brand' });
    assert.strictEqual(status, 201);
    assert.strictEqual(received.status, 'active');
  });

  test(`${role} may still create a brand in an explicit non-active status`, async (t) => {
    // Platform admins keep full control of the field — e.g. staging a brand as
    // pending on purpose. Only tenant roles are pinned.
    const { received } = await createBrandAs(t, role, { name: 'Staged Brand', status: 'pending' });
    assert.strictEqual(received.status, 'pending');
  });
}

test('customer is refused outright', async (t) => {
  const { status } = await createBrandAs(t, 'customer', { name: 'Nope' });
  assert.strictEqual(status, 403, 'a customer may not create brands at all');
});
