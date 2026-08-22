// Custom-role CRUD at /api/roles — guards, scoping and isolation.
//
// Boots the real router over real HTTP with the routeAuthHarness (mocked
// protect/attachTenant, no Mongo) and mocks only the Role/User statics the
// service is allowed to call. The contract pinned here:
//
//   GET  /api/roles                     caller-scoped (platform | own tenant)
//   GET  /api/roles/permissions/catalog any admin-dashboard role
//   POST /api/roles                     tenant callers force scope+tenant; platform
//                                       scope is admin-only; unknown or
//                                       platform-only permissions rejected
//   PUT  /api/roles/:id                 ownership enforced, cross-tenant = 404
//   DELETE /api/roles/:id               404 cross-tenant, 409 while assigned
//
// Isolation follows the platform rule: a miss on another tenant's role is 404,
// never 403 — 403 would confirm the id exists.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Role = require('../models/Role');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const roleRouter = require('../routes/role.routes');
const {
  startRouter,
  mockAuthUser,
  mockTenantContext,
  ROLE_USERS,
  TENANT_ID,
} = require('./helpers/routeAuthHarness');

const OTHER_TENANT_ID = new mongoose.Types.ObjectId();

function makeRole(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: 'Shift Lead',
    scope: 'tenant',
    tenant: TENANT_ID,
    description: '',
    color: '',
    isActive: true,
    permissions: ['orders:read', 'inventory:read'],
    ...overrides,
  };
}

/** Silences fire-and-forget audit writes so output stays pristine. */
function mockAudit(t) {
  t.mock.method(AuditLog, 'create', async () => ({ _id: 'audit' }));
}

async function withApp(fn) {
  const app = await startRouter(roleRouter, '/api/roles');
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

const jsonFetch = (url, method, token, body) =>
  fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

// ─── Audience & auth ──────────────────────────────────────────────────────────

test('GET /api/roles refuses an anonymous caller', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const res = await fetch(app.url('/api/roles'));
    assert.strictEqual(res.status, 401);
  });
});

test('GET /api/roles refuses tenant_staff and customers', async (t) => {
  mockAudit(t);
  for (const role of ['tenant_staff', 'customer']) {
    await withApp(async (app) => {
      const token = mockAuthUser(t, ROLE_USERS[role]);
      const res = await fetch(app.url('/api/roles'), { headers: { authorization: token } });
      assert.strictEqual(res.status, 403, `${role} must not list roles`);
    });
  }
});

// ─── List ─────────────────────────────────────────────────────────────────────

test('a platform admin lists PLATFORM-scoped roles with assignment counts', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.super_admin);

    let seenFilter;
    t.mock.method(Role, 'find', (filter) => {
      seenFilter = filter;
      return Promise.resolve([makeRole({ scope: 'platform', tenant: null })]);
    });
    t.mock.method(User, 'countDocuments', async () => 2);

    const res = await fetch(app.url('/api/roles'), { headers: { authorization: token } });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.roles.length, 1);
    assert.strictEqual(body.data.roles[0].assignedCount, 2);
    assert.deepStrictEqual(seenFilter, { scope: 'platform' }, 'platform caller sees platform roles only');
  });
});

test('a tenant admin lists ONLY their own tenant roles', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    let seenFilter;
    t.mock.method(Role, 'find', (filter) => {
      seenFilter = filter;
      return Promise.resolve([makeRole()]);
    });
    t.mock.method(User, 'countDocuments', async () => 1);

    const res = await fetch(app.url('/api/roles'), { headers: { authorization: token } });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      seenFilter,
      { scope: 'tenant', tenant: TENANT_ID },
      'tenant caller is scoped to their own tenant'
    );
    const body = await res.json();
    assert.strictEqual(body.data.roles[0].assignedCount, 1);
  });
});

// ─── Create ───────────────────────────────────────────────────────────────────

test('POST tenant-scope forces scope and tenant from req.tenant, ignoring client-supplied ids', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    t.mock.method(Role, 'findOne', async () => null); // no name conflict
    const created = makeRole({ name: 'Floor Runner' });
    let createPayload;
    t.mock.method(Role, 'create', (payload) => {
      createPayload = payload;
      return Promise.resolve(created);
    });

    const res = await jsonFetch(app.url('/api/roles'), 'POST', token, {
      name: 'Floor Runner',
      scope: 'tenant',
      // Smuggled values that must be overwritten by server authority:
      tenant: OTHER_TENANT_ID.toString(),
      permissions: ['orders:read'],
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(createPayload.scope, 'tenant');
    assert.strictEqual(String(createPayload.tenant), String(TENANT_ID));
  });
});

test('POST platform-scope as super_admin creates a platform role', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.super_admin);

    t.mock.method(Role, 'findOne', async () => null);
    let createPayload;
    t.mock.method(Role, 'create', (payload) => {
      createPayload = payload;
      return Promise.resolve(makeRole({ scope: 'platform', tenant: null }));
    });

    const res = await jsonFetch(app.url('/api/roles'), 'POST', token, {
      name: 'Support Desk',
      scope: 'platform',
      permissions: ['users:read', 'billing:read'],
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(createPayload.scope, 'platform');
    assert.strictEqual(createPayload.tenant, null);
  });
});

test('POST platform-scope is refused for a tenant admin', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const res = await jsonFetch(app.url('/api/roles'), 'POST', token, {
      name: 'Sneaky Platform Role',
      scope: 'platform',
      permissions: ['users:read'],
    });
    assert.strictEqual(res.status, 403);
  });
});

test('POST rejects an unknown permission key', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const res = await jsonFetch(app.url('/api/roles'), 'POST', token, {
      name: 'Bad Perms',
      scope: 'tenant',
      permissions: ['madeup:thing'],
    });
    assert.strictEqual(res.status, 400);
  });
});

test('POST tenant-scope rejects a platform-only permission', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const res = await jsonFetch(app.url('/api/roles'), 'POST', token, {
      name: 'Escalating Role',
      scope: 'tenant',
      permissions: ['orders:read', 'billing:write'],
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /billing:write/);
  });
});

test('POST reports a duplicate name within the same scope as 409', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    t.mock.method(Role, 'findOne', async () => makeRole()); // conflict found
    const res = await jsonFetch(app.url('/api/roles'), 'POST', token, {
      name: 'Shift Lead',
      scope: 'tenant',
      permissions: ['orders:read'],
    });
    assert.strictEqual(res.status, 409);
  });
});

// ─── Update ───────────────────────────────────────────────────────────────────

test("PUT another tenant's role answers 404, not 403", async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    t.mock.method(Role, 'findById', async () =>
      makeRole({ tenant: OTHER_TENANT_ID })
    );

    const id = new mongoose.Types.ObjectId().toString();
    const res = await jsonFetch(app.url(`/api/roles/${id}`), 'PUT', token, {
      name: 'Renamed',
    });
    assert.strictEqual(res.status, 404, 'cross-tenant hits must not confirm existence');
  });
});

test('PUT renames and re-permissions an own-tenant role', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const existing = makeRole();
    t.mock.method(Role, 'findById', async () => existing);
    t.mock.method(Role, 'findOne', async () => null); // no rename conflict

    let updateArg;
    const updated = makeRole({ name: 'Shift Supervisor' });
    t.mock.method(Role, 'findByIdAndUpdate', (id, update) => {
      updateArg = update;
      return Promise.resolve(updated);
    });

    const res = await jsonFetch(app.url(`/api/roles/${existing._id}`), 'PUT', token, {
      name: 'Shift Supervisor',
      permissions: ['orders:read'],
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(updateArg.$set.name, 'Shift Supervisor');
    assert.deepStrictEqual(updateArg.$set.permissions, ['orders:read']);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

test("DELETE another tenant's role answers 404", async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    t.mock.method(Role, 'findById', async () =>
      makeRole({ tenant: OTHER_TENANT_ID })
    );

    const res = await jsonFetch(app.url(`/api/roles/${new mongoose.Types.ObjectId()}`), 'DELETE', token);
    assert.strictEqual(res.status, 404);
  });
});

test('DELETE refuses while users still hold the role (409 with the count)', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const existing = makeRole();
    t.mock.method(Role, 'findById', async () => existing);
    t.mock.method(User, 'countDocuments', async () => 4);

    const res = await jsonFetch(app.url(`/api/roles/${existing._id}`), 'DELETE', token);
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.match(body.message, /4/);
  });
});

test('DELETE removes an unassigned role', async (t) => {
  mockAudit(t);
  await withApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const existing = makeRole();
    t.mock.method(Role, 'findById', async () => existing);
    t.mock.method(User, 'countDocuments', async () => 0);
    const del = t.mock.method(Role, 'findByIdAndDelete', async () => existing);

    const res = await jsonFetch(app.url(`/api/roles/${existing._id}`), 'DELETE', token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(del.mock.callCount(), 1);
  });
});

// ─── Catalog ──────────────────────────────────────────────────────────────────

test('GET /permissions/catalog serves any admin-dashboard role', async (t) => {
  mockAudit(t);
  for (const role of ['super_admin', 'admin', 'tenant_owner', 'tenant_admin']) {
    await withApp(async (app) => {
      const token = mockAuthUser(t, ROLE_USERS[role]);
      mockTenantContext(t);
      const res = await fetch(app.url('/api/roles/permissions/catalog'), {
        headers: { authorization: token },
      });
      assert.strictEqual(res.status, 200, `${role} may read the catalog`);
      const body = await res.json();
      assert.ok(Array.isArray(body.data.catalog) && body.data.catalog.length > 0);
      assert.ok(Array.isArray(body.data.platformOnly));
    });
  }
});
