// subproduct.routes.js was concatenated from three drafts, and the seam showed
// in its guards: 13 endpoints used `tenantAdminOrSuperAdmin`
// (super_admin, admin, tenant_owner, tenant_admin) while 23 comparable ones used
// `protect, authorize('tenant_admin','super_admin')` — excluding tenant_owner,
// the role that owns the tenant, and `admin`, the lesser platform tier.
//
// The split was never designed. Three independent sources say the wider set is
// the intent:
//   1. ROLE_PERMISSIONS grants tenant_owner and tenant_admin *identical* sets,
//      including subproducts:write/delete, inventory:write/adjust, reports:read
//      and analytics:read — exactly what the 23 endpoints do.
//   2. The tenant sidebar (tenant-menu-items.tsx) puts Add Product, Inventory
//      (Adjustments, Stock) and Analytics behind no minRole at all, so they
//      render for tenant_owner.
//   3. The handlers themselves: bulk-promote and bulk-unpromote open with
//      `['super_admin','admin'].includes(req.user.role)`, a branch that could
//      never be true under a guard that excludes `admin`.
//
// Tenant scoping in this module comes from the JWT via getTenantId/attachTenant,
// never from the role guard, so widening the guard grants no cross-tenant reach:
// bulkCreateSubProducts and transferSubProduct each independently require the
// caller to be the tenant's own admin, and cross-tenant transfer stays gated on
// `role === 'super_admin'` inside the service.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');

const auth = require('../middleware/auth.middleware');
const subproductRouter = require('../routes/subproduct.routes');
const {
  startRouter,
  mockAuthUser,
  mockTenantContext,
  ROLE_USERS,
} = require('./helpers/routeAuthHarness');

const ID = '000000000000000000000000';

// The 23 endpoints that carried the narrow guard. Paths are concrete so they can
// be requested over HTTP; the ids are deliberately non-existent, because these
// tests only ever assert on the 401/403 boundary and never on a 2xx.
const PREVIOUSLY_NARROW = [
  ['POST', `/api/subproducts/bulk`],
  ['POST', `/api/subproducts/${ID}/transfer`],
  ['PATCH', `/api/subproducts/${ID}/pricing`],
  ['POST', `/api/subproducts/discount/apply`],
  ['POST', `/api/subproducts/discount/remove`],
  ['PATCH', `/api/subproducts/bulk-promote`],
  ['PATCH', `/api/subproducts/bulk-unpromote`],
  ['GET', `/api/subproducts/${ID}/price-history`],
  ['POST', `/api/subproducts/${ID}/sizes`],
  ['PATCH', `/api/subproducts/${ID}/sizes/${ID}`],
  ['DELETE', `/api/subproducts/${ID}/sizes/${ID}`],
  ['PATCH', `/api/subproducts/${ID}/stock`],
  ['GET', `/api/subproducts/${ID}/inventory`],
  ['POST', `/api/subproducts/${ID}/sizes/${ID}/adjust-stock`],
  ['GET', `/api/subproducts/${ID}/stock-movements`],
  ['GET', `/api/subproducts/tenant/${ID}/low-stock`],
  ['GET', `/api/subproducts/tenant/${ID}/out-of-stock`],
  ['POST', `/api/subproducts/${ID}/reorder-points`],
  ['GET', `/api/subproducts/${ID}/sales`],
  ['GET', `/api/subproducts/${ID}/revenue`],
  ['GET', `/api/subproducts/tenant/${ID}/top-selling`],
  ['GET', `/api/subproducts/${ID}/conversion-rate`],
  ['GET', `/api/subproducts/${ID}/average-order-value`],
];

/**
 * Fires every endpoint in `PREVIOUSLY_NARROW` as `role` against one app and
 * returns `[method path → status]` for those whose status is in `statuses`.
 * Reporting the whole set at once makes a partial regression obvious — a single
 * per-endpoint assertion would stop at the first failure and hide the other 22.
 */
async function statusesFor(t, role, statuses) {
  mockTenantContext(t);
  const authorization = mockAuthUser(t, ROLE_USERS[role]);
  const app = await startRouter(subproductRouter, '/api/subproducts');
  const hits = [];
  try {
    for (const [method, path] of PREVIOUSLY_NARROW) {
      const res = await fetch(app.url(path), {
        method,
        headers: { 'content-type': 'application/json', authorization },
        body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
      });
      if (statuses.includes(res.status)) hits.push(`${method} ${path} → ${res.status}`);
    }
  } finally {
    await app.close();
  }
  return hits;
}

for (const role of ['tenant_owner', 'admin']) {
  test(`${role} passes authorization on all 23 previously-narrow endpoints`, async (t) => {
    const denied = await statusesFor(t, role, [401, 403]);
    assert.deepStrictEqual(
      denied,
      [],
      `${role} must reach these endpoints — it already may create, update, ` +
        `archive and delete a sub-product through the sibling routes:\n  ${denied.join('\n  ')}`
    );
  });
}

for (const role of ['tenant_staff', 'customer']) {
  test(`${role} is still refused on all 23 previously-narrow endpoints`, async (t) => {
    const reached = await statusesFor(t, role, [200, 201, 400, 404, 500]);
    assert.deepStrictEqual(
      reached,
      [],
      `widening the guard must not let ${role} through:\n  ${reached.join('\n  ')}`
    );
  });
}

// ─── Group C: the five endpoints that carried no role guard at all ───────────
//
// These were never unauthenticated — router.use(authenticate) sits at the top of
// the file — but any authenticated role passed, `customer` included, so a logged
// in shopper could enumerate any tenant's catalog by id.
//
// They were left that way on the theory that they are storefront reads, and the
// data backs that: every one filters to `isPublished: true, status: 'active'`
// and projects through PRIVATE_SUBPRODUCT_FIELDS/PRIVATE_SIZE_FIELDS, which
// strip costPrice, supplierPrice, vendor contacts, margins and reorder points.
// The tenant markup/commission fields they populate are already served to
// anonymous callers by /api/products/*, so nothing here is secret.
//
// The theory still fails on callers: the storefront (client/apps/platform) does
// not call a single one, and across both client apps the only live caller is
// product-subproducts.tsx — the platform-admin listing-review panel. Two of the
// five have a service method with no component behind it; three have no caller
// at all. Their `@access Public` docblocks have been false since authenticate
// was mounted. So they are admin reads wearing a storefront label, and they get
// the same guard as everything else in the file.
const PREVIOUSLY_UNGUARDED = [
  ['GET', `/api/subproducts/${ID}/sizes/${ID}/effective-price`],
  ['GET', `/api/subproducts/tenant/${ID}`],
  ['GET', `/api/subproducts/product/${ID}`],
  ['GET', `/api/subproducts/sku/ABC-123`],
  ['GET', `/api/subproducts/${ID}/stock-status`],
];

/** As statusesFor, over PREVIOUSLY_UNGUARDED. */
async function groupCStatusesFor(t, role, statuses) {
  mockTenantContext(t);
  const authorization = mockAuthUser(t, ROLE_USERS[role]);
  const app = await startRouter(subproductRouter, '/api/subproducts');
  const hits = [];
  try {
    for (const [method, path] of PREVIOUSLY_UNGUARDED) {
      const res = await fetch(app.url(path), {
        method,
        headers: { 'content-type': 'application/json', authorization },
      });
      if (statuses.includes(res.status)) hits.push(`${method} ${path} → ${res.status}`);
    }
  } finally {
    await app.close();
  }
  return hits;
}

for (const role of ['customer', 'tenant_staff']) {
  test(`${role} cannot read the five previously-unguarded endpoints`, async (t) => {
    const reached = await groupCStatusesFor(t, role, [200, 400, 404, 500]);
    assert.deepStrictEqual(
      reached,
      [],
      `${role} reached these — GET /tenant/:tenantId alone lets any logged-in ` +
        `shopper enumerate a tenant's catalog:\n  ${reached.join('\n  ')}`
    );
  });
}

test('the platform admin listing-review panel still reaches GET /product/:productId', async (t) => {
  // product-subproducts.tsx is the one live caller of any Group C endpoint.
  const denied = await groupCStatusesFor(t, 'super_admin', [401, 403]);
  assert.deepStrictEqual(denied, [], `super_admin must keep these reads:\n  ${denied.join('\n  ')}`);
});

test('tenant_owner still reaches the five previously-unguarded endpoints', async (t) => {
  const denied = await groupCStatusesFor(t, 'tenant_owner', [401, 403]);
  assert.deepStrictEqual(denied, [], `tenant_owner must keep these reads:\n  ${denied.join('\n  ')}`);
});

// ─── Structural pins, so the seam cannot reopen ──────────────────────────────

/** Every route layer in the router, with its recognised guard chain. */
function routeLayers() {
  return subproductRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      label: `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`,
      handlers: layer.route.stack.map((sub) => sub.handle),
    }));
}

test('every role-guarded endpoint uses tenantAdminOrSuperAdmin, not a narrower authorize()', () => {
  const offenders = routeLayers()
    .filter(({ handlers }) =>
      handlers.some((h) => h.authorizedRoles && h !== auth.tenantAdminOrSuperAdmin)
    )
    .map(({ label }) => label);

  assert.deepStrictEqual(
    offenders,
    [],
    'One guard shape for the whole file. These carry a different one:\n  ' +
      offenders.join('\n  ')
  );
});

test('no endpoint is left without a role guard', () => {
  const unguarded = routeLayers()
    .filter(({ handlers }) => !handlers.some((h) => h.authorizedRoles))
    .map(({ label }) => label);

  assert.deepStrictEqual(
    unguarded,
    [],
    'router.use(authenticate) only proves a token exists — these accept any ' +
      'authenticated role, customer included:\n  ' +
      unguarded.join('\n  ')
  );
});

test('no endpoint re-runs the router-level authenticate', () => {
  // `router.use(authenticate)` already ran for every request, and
  // `protect === authenticate`, so a second `protect` in a handler chain is a
  // duplicated JWT verify plus a duplicated User.findById on every call.
  const repeats = routeLayers()
    .filter(({ handlers }) => handlers.includes(auth.authenticate))
    .map(({ label }) => label);

  assert.deepStrictEqual(
    repeats,
    [],
    'These repeat authenticate/protect on top of router.use(authenticate):\n  ' +
      repeats.join('\n  ')
  );
});
