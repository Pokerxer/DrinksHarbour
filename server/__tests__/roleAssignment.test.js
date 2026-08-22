// Custom-role ASSIGNMENT guards, on both surfaces that can set User.customRole:
//
//   1. Tenant: PATCH /api/employees/:id — tenant-scoped roles only, never the
//      tenant owner. DB-level existence/scope/tenant checks live in the
//      controller; shape + owner protection live in buildUpdateChanges.
//   2. Platform: PUT /api/users/:id (userService.updateUser) — platform-scoped
//      roles only, admin targets only, super_admin excluded.
//
// The settled policy being pinned: `User.role` stays the authority; a customRole
// refines permissions ADDITIVELY and can never weaken JWT tenant scoping.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const User = require('../models/User');
const Role = require('../models/Role');
const roleRouter = require('../routes/role.routes'); // ensures models registered
const { startRouter, mockAuthUser, mockTenantContext, ROLE_USERS, TENANT_ID } = require('./helpers/routeAuthHarness');
const employeeRouter = require('../routes/employee.routes');

const OTHER_TENANT_ID = new mongoose.Types.ObjectId();

async function withEmployeeApp(fn) {
  const app = await startRouter(employeeRouter, '/api/employees');
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

function fakeEmployeeDoc(overrides = {}) {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    firstName: 'Ada',
    lastName: 'Okoye',
    email: 'ada@tenant.test',
    phone: '',
    avatar: {},
    role: 'tenant_staff',
    status: 'active',
    posAccess: false,
    posName: 'Ada',
    posPermissions: [],
    posPinHash: undefined,
    employeeProfile: {},
    customRole: null,
    createdAt: new Date(),
    markModified() {},
    async save() {},
    // Mimics doc.populate({ path:'customRole' }): swaps a raw id for the
    // populated shape the controller then projects.
    async populate() {
      if (typeof doc.customRole === 'string') {
        doc.customRole = { _id: doc.customRole, name: 'Shift Lead', color: '' };
      }
      return doc;
    },
    ...overrides,
  };
  return doc;
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

// ─── Tenant surface: PATCH /api/employees/:id ─────────────────────────────────

test('the tenant owner cannot be assigned a custom role', async (t) => {
  await withEmployeeApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const owner = fakeEmployeeDoc({ role: 'tenant_owner' });
    t.mock.method(User, 'findOne', () => ({ select: () => owner }));

    const res = await jsonFetch(app.url(`/api/employees/${owner._id}`), 'PATCH', token, {
      customRole: new mongoose.Types.ObjectId().toString(),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(owner.customRole, null, 'nothing may be written for an owner');
  });
});

test('a cross-tenant or platform customRole is rejected on employee PATCH', async (t) => {
  await withEmployeeApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const staff = fakeEmployeeDoc();
    t.mock.method(User, 'findOne', () => ({ select: () => staff }));
    // Role exists but belongs to ANOTHER tenant:
    t.mock.method(Role, 'findById', async () => ({
      _id: new mongoose.Types.ObjectId(),
      name: 'Foreign Role',
      scope: 'tenant',
      tenant: OTHER_TENANT_ID,
    }));

    const res = await jsonFetch(app.url(`/api/employees/${staff._id}`), 'PATCH', token, {
      customRole: new mongoose.Types.ObjectId().toString(),
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(staff.customRole, null);
  });
});

test('a valid own-tenant customRole assigns and is returned in present()', async (t) => {
  await withEmployeeApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const roleId = new mongoose.Types.ObjectId();
    const staff = fakeEmployeeDoc({
      customRole: { _id: roleId, name: 'Shift Lead', color: '#3898ec' }, // as populate() delivers it
    });
    t.mock.method(User, 'findOne', () => ({ select: () => staff }));
    t.mock.method(Role, 'findById', async () => ({
      _id: roleId,
      name: 'Shift Lead',
      scope: 'tenant',
      tenant: TENANT_ID,
    }));

    const res = await jsonFetch(app.url(`/api/employees/${staff._id}`), 'PATCH', token, {
      customRole: roleId.toString(),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // After save+populate the doc carries the {_id,name,color} shape:
    assert.strictEqual(String(staff.customRole._id ?? staff.customRole), roleId.toString());
    assert.strictEqual(body.data.employee.customRole.name, 'Shift Lead');
  });
});

test('customRole:null clears an assignment on employee PATCH', async (t) => {
  await withEmployeeApp(async (app) => {
    const token = mockAuthUser(t, ROLE_USERS.tenant_admin);
    mockTenantContext(t);

    const staff = fakeEmployeeDoc();
    t.mock.method(User, 'findOne', () => ({ select: () => staff }));
    const roleLookup = t.mock.method(Role, 'findById', async () => ({ scope: 'tenant' }));

    const res = await jsonFetch(app.url(`/api/employees/${staff._id}`), 'PATCH', token, {
      customRole: null,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(staff.customRole, null);
    assert.strictEqual(roleLookup.mock.callCount(), 0, 'clearing needs no role lookup');
  });
});

// ─── Platform surface: userService.updateUser ────────────────────────────────

function fakePlatformUser(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    email: 'admin@platform.test',
    firstName: 'Plat',
    lastName: 'Admin',
    role: 'admin',
    status: 'active',
    customRole: null,
    async save() {},
    async populate() {},
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

const svc = () => require('../services/user.service');

test('updateUser refuses a customRole for a super_admin target', async (t) => {
  const userService = svc();
  const target = fakePlatformUser({ role: 'super_admin' });
  t.mock.method(User, 'findById', async () => target);

  await assert.rejects(
    () =>
      userService.updateUser(
        String(target._id),
        { customRole: new mongoose.Types.ObjectId().toString() },
        new mongoose.Types.ObjectId().toString(),
        'super_admin'
      ),
    /Custom roles can only be assigned/
  );
});

test('updateUser accepts a platform-scope role for an admin target', async (t) => {
  const userService = svc();
  const target = fakePlatformUser();
  t.mock.method(User, 'findById', async () => target);

  const roleId = new mongoose.Types.ObjectId();
  t.mock.method(Role, 'findById', async () => ({
    _id: roleId,
    name: 'Support Desk',
    scope: 'platform',
  }));
  const saved = t.mock.method(target, 'save', async () => {});

  const result = await userService.updateUser(
    String(target._id),
    { customRole: roleId.toString() },
    new mongoose.Types.ObjectId().toString(),
    'super_admin'
  );

  assert.strictEqual(saved.mock.callCount(), 1);
  assert.strictEqual(String(result.customRole), roleId.toString());
});

test('updateUser rejects a tenant-scope role on the platform surface', async (t) => {
  const userService = svc();
  const target = fakePlatformUser();
  t.mock.method(User, 'findById', async () => target);

  t.mock.method(Role, 'findById', async () => ({
    _id: new mongoose.Types.ObjectId(),
    scope: 'tenant',
  }));

  await assert.rejects(
    () =>
      userService.updateUser(
        String(target._id),
        { customRole: new mongoose.Types.ObjectId().toString() },
        new mongoose.Types.ObjectId().toString(),
        'super_admin'
      ),
    /platform/
  );
});

test("updateUser silently strips a non-admin caller's customRole", async (t) => {
  const userService = svc();
  // Same-tenant self-update by a tenant_admin-style caller (the service's
  // pre-existing tenancy check needs both sides in one tenant).
  const target = fakePlatformUser({ tenant: TENANT_ID });
  t.mock.method(User, 'findById', async () => target);
  const roleLookup = t.mock.method(Role, 'findById', async () => ({ scope: 'platform' }));

  await userService.updateUser(
    String(target._id),
    { displayName: 'Renamed', customRole: new mongoose.Types.ObjectId().toString() },
    String(target._id), // self-update by a tenant_admin-style caller
    'tenant_admin'
  );

  assert.strictEqual(roleLookup.mock.callCount(), 0, 'stripped before any validation');
  assert.strictEqual(target.displayName, 'Renamed', 'other fields still apply');
});
