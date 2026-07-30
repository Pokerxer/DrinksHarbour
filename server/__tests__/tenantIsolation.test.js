// Tenant isolation for the tenant-owned modules: point of sale, sales,
// purchases and inventory.
//
// The rule these pin down: data in those modules belongs to exactly one tenant
// and nobody outside it — including platform admins — may read or write it.
//
// Two concrete holes are covered:
//   1. requireOwnTenant — resolveTenantContext lets an admin with no tenant of
//      their own pick any tenant via `x-tenant-slug` / `?tenant=`, and
//      warehouse.controller read `req.query.tenantId` outright. Both are denied
//      here, so the tenant can only ever come from the verified JWT claim.
//   2. saleService.getAllSales — the tenant scope was written to `filter.$or`,
//      the same key a search term uses. Searching therefore *replaced* the
//      tenant scope and listed every tenant's campaigns.

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const mongoose = require('mongoose');

const { requireOwnTenant } = require('../middleware/tenant.middleware');

// ── helpers ──────────────────────────────────────────────────────────────────

const TENANT_A = new mongoose.Types.ObjectId();
const TENANT_B = new mongoose.Types.ObjectId();

const approvedTenant = (id) => ({
  _id: id,
  status: 'approved',
  subscriptionStatus: 'active',
});

/** Runs the middleware and reports whether next() was called, or what it threw. */
function run(req) {
  let nextCalled = false;
  try {
    requireOwnTenant(req, {}, () => {
      nextCalled = true;
    });
  } catch (err) {
    return { passed: false, error: err };
  }
  return { passed: nextCalled, error: null };
}

// ── requireOwnTenant ─────────────────────────────────────────────────────────

test('tenant user reaches their own tenant', () => {
  const { passed } = run({
    user: { role: 'tenant_owner', tenant: TENANT_A },
    tenant: approvedTenant(TENANT_A),
    query: {},
  });
  assert.strictEqual(passed, true);
});

test('super_admin that owns a tenant is treated like any other tenant user', () => {
  // admin@drinksharbour.com is the Wyn City operator — locking admins out
  // entirely would break their own store, so owning a tenant must still work.
  const { passed } = run({
    user: { role: 'super_admin', tenant: TENANT_A },
    tenant: approvedTenant(TENANT_A),
    query: {},
  });
  assert.strictEqual(passed, true);
});

test('super_admin with no tenant of their own is denied', () => {
  const { passed, error } = run({
    user: { role: 'super_admin', tenant: null },
    tenant: approvedTenant(TENANT_B),
    query: {},
  });
  assert.strictEqual(passed, false);
  assert.match(error.message, /not attached to a tenant/i);
});

test('admin cannot pivot to another tenant via x-tenant-slug / ?tenant=', () => {
  // resolveTenantContext would have resolved req.tenant from the header for an
  // admin. The JWT claim disagrees, so the request is refused.
  const { passed, error } = run({
    user: { role: 'admin', tenant: TENANT_A },
    tenant: approvedTenant(TENANT_B), // resolved from ?tenant=other-tenant
    query: { tenant: 'other-tenant' },
    headers: { 'x-tenant-slug': 'other-tenant' },
  });
  assert.strictEqual(passed, false);
  assert.match(error.message, /do not have access to this tenant/i);
});

test('tenant_staff cannot reach another tenant', () => {
  const { passed, error } = run({
    user: { role: 'tenant_staff', tenant: TENANT_A },
    tenant: approvedTenant(TENANT_B),
    query: {},
  });
  assert.strictEqual(passed, false);
  assert.match(error.message, /do not have access to this tenant/i);
});

test('client-supplied tenantId is stripped from query and body', () => {
  const req = {
    user: { role: 'super_admin', tenant: TENANT_A },
    tenant: approvedTenant(TENANT_A),
    query: { tenantId: String(TENANT_B), page: '2' },
    body: { tenantId: String(TENANT_B), name: 'Main store' },
  };
  const { passed } = run(req);
  assert.strictEqual(passed, true);
  assert.ok(!('tenantId' in req.query), 'query.tenantId must not survive');
  assert.ok(!('tenantId' in req.body), 'body.tenantId must not survive');
  // Unrelated fields are untouched.
  assert.strictEqual(req.query.page, '2');
  assert.strictEqual(req.body.name, 'Main store');
});

test('unresolved tenant fails closed rather than running unscoped', () => {
  const { passed, error } = run({
    user: { role: 'tenant_admin', tenant: TENANT_A },
    tenant: null, // e.g. subscription lapsed, so resolveTenantContext left it unset
    query: {},
  });
  assert.strictEqual(passed, false);
  assert.match(error.message, /tenant context required/i);
});

test('unapproved tenant and lapsed subscription are refused', () => {
  const pending = run({
    user: { role: 'tenant_owner', tenant: TENANT_A },
    tenant: { _id: TENANT_A, status: 'pending', subscriptionStatus: 'active' },
    query: {},
  });
  assert.strictEqual(pending.passed, false);
  assert.match(pending.error.message, /not approved/i);

  const lapsed = run({
    user: { role: 'tenant_owner', tenant: TENANT_A },
    tenant: { _id: TENANT_A, status: 'approved', subscriptionStatus: 'past_due' },
    query: {},
  });
  assert.strictEqual(lapsed.passed, false);
  assert.match(lapsed.error.message, /subscription is not active/i);
});

test('a populated tenant object on the JWT user resolves the same as an id', () => {
  const { passed } = run({
    user: { role: 'tenant_admin', tenant: { _id: TENANT_A, name: 'Wyn City' } },
    tenant: approvedTenant(TENANT_A),
    query: {},
  });
  assert.strictEqual(passed, true);
});

// ── saleService.getAllSales tenant scoping ───────────────────────────────────
//
// The Sale model is swapped for a recorder via require.cache so the filter the
// service builds can be asserted without a database.

function loadSaleServiceWithFakeModel() {
  const modelPath = require.resolve('../models/Sale');
  const servicePath = require.resolve('../services/sale.service');
  const previousModel = require.cache[modelPath];
  const previousService = require.cache[servicePath];

  const calls = [];
  const chain = {
    populate() {
      return chain;
    },
    sort() {
      return chain;
    },
    skip() {
      return chain;
    },
    limit() {
      return chain;
    },
    lean() {
      return chain;
    },
    then(resolve) {
      return Promise.resolve([]).then(resolve);
    },
  };
  const FakeSale = function () {};
  FakeSale.find = (filter) => {
    calls.push(filter);
    return chain;
  };
  FakeSale.countDocuments = async () => 0;

  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: FakeSale };
  delete require.cache[servicePath];
  const service = require('../services/sale.service');

  const restore = () => {
    if (previousModel) require.cache[modelPath] = previousModel;
    else delete require.cache[modelPath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  };

  return { service, calls, restore };
}

test('getAllSales scopes to the caller tenant plus global campaigns', async () => {
  const { service, calls, restore } = loadSaleServiceWithFakeModel();
  try {
    await service.getAllSales({ tenant: TENANT_A });
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].$or, [{ tenant: TENANT_A }, { isGlobal: true }]);
  } finally {
    restore();
  }
});

test('a search term does not drop the tenant scope', async () => {
  const { service, calls, restore } = loadSaleServiceWithFakeModel();
  try {
    await service.getAllSales({ tenant: TENANT_A, search: 'summer' });
    const filter = calls[0];

    // The search must not have taken over $or and evicted the tenant scope.
    assert.ok(Array.isArray(filter.$and), 'search + tenant must compose under $and');
    assert.strictEqual(filter.$or, undefined);

    const scope = filter.$and.find((c) =>
      JSON.stringify(c).includes('isGlobal')
    );
    assert.deepStrictEqual(scope, { $or: [{ tenant: TENANT_A }, { isGlobal: true }] });

    const search = filter.$and.find((c) => JSON.stringify(c).includes('summer'));
    assert.ok(search, 'the search clause is still applied');
  } finally {
    restore();
  }
});

test('getAllSales refuses to run without a tenant', async () => {
  const { service, calls, restore } = loadSaleServiceWithFakeModel();
  try {
    await assert.rejects(
      () => service.getAllSales({}),
      /tenant context required/i
    );
    assert.strictEqual(calls.length, 0, 'no query may be issued unscoped');
  } finally {
    restore();
  }
});
