// Tests for the authenticated admin-creates-user path introduced alongside the
// lockdown of public registration.
//
// Public registration is customer-only, so this is the ONLY way an elevated
// account comes into existence. The privilege rules therefore live in the
// service, not just the route guard, so they survive any later loosening of the
// route. See docs/superpowers/specs/2026-07-25-admin-auth-overhaul-design.md §0.2

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const userService = require('../services/user.service');

const VALID_PASSWORD = 'Str0ng!Pass';

const SUPER_ADMIN = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
const ADMIN = { _id: new mongoose.Types.ObjectId(), role: 'admin' };
const TENANT_ADMIN = { _id: new mongoose.Types.ObjectId(), role: 'tenant_admin' };

function stubCreation(t) {
  const created = {};
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(User, 'create', async (data) => {
    Object.assign(created, data);
    return {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      toObject: () => ({ ...data, _id: new mongoose.Types.ObjectId() }),
    };
  });
  return created;
}

function payload(overrides = {}) {
  return {
    email: `new${Math.random().toString(36).slice(2)}@example.com`,
    password: VALID_PASSWORD,
    firstName: 'New',
    lastName: 'Staff',
    ...overrides,
  };
}

test('createUserAsAdmin: a super_admin can create an admin', async (t) => {
  const created = stubCreation(t);

  const result = await userService.createUserAsAdmin(
    payload({ role: 'admin' }),
    SUPER_ADMIN
  );

  assert.strictEqual(created.role, 'admin');
  assert.strictEqual(result.user.role, 'admin');
});

test('createUserAsAdmin: a super_admin can create another super_admin', async (t) => {
  const created = stubCreation(t);

  await userService.createUserAsAdmin(
    payload({ role: 'super_admin' }),
    SUPER_ADMIN
  );

  assert.strictEqual(created.role, 'super_admin');
});

test('createUserAsAdmin: an admin cannot create a super_admin', async (t) => {
  stubCreation(t);

  await assert.rejects(
    () => userService.createUserAsAdmin(payload({ role: 'super_admin' }), ADMIN),
    /only a super admin can create another super admin/i
  );
});

test('createUserAsAdmin: a tenant_admin cannot create users at all', async (t) => {
  stubCreation(t);

  await assert.rejects(
    () => userService.createUserAsAdmin(payload({ role: 'customer' }), TENANT_ADMIN),
    /not permitted to create users/i
  );
});

test('createUserAsAdmin: rejects an unknown role', async (t) => {
  stubCreation(t);

  await assert.rejects(
    () => userService.createUserAsAdmin(payload({ role: 'wizard' }), SUPER_ADMIN),
    /invalid role/i
  );
});

test('createUserAsAdmin: tenant_admin role requires a tenant', async (t) => {
  stubCreation(t);

  await assert.rejects(
    () => userService.createUserAsAdmin(payload({ role: 'tenant_admin' }), SUPER_ADMIN),
    /tenant is required/i
  );
});

test('createUserAsAdmin: tenant_admin role accepts an approved tenant', async (t) => {
  const created = stubCreation(t);
  const tenantId = new mongoose.Types.ObjectId();
  t.mock.method(Tenant, 'findById', async () => ({
    _id: tenantId,
    status: 'approved',
  }));

  await userService.createUserAsAdmin(
    payload({ role: 'tenant_admin', tenant: tenantId }),
    SUPER_ADMIN
  );

  assert.strictEqual(created.role, 'tenant_admin');
  assert.strictEqual(created.tenant, tenantId);
});

test('createUserAsAdmin: does not issue a login token', async (t) => {
  stubCreation(t);

  const result = await userService.createUserAsAdmin(
    payload({ role: 'admin' }),
    SUPER_ADMIN
  );

  assert.strictEqual(
    result.token,
    undefined,
    'administration must not hand back a session for the created account'
  );
});

test('createUserAsAdmin: rejects a weak password', async (t) => {
  stubCreation(t);

  await assert.rejects(
    () => userService.createUserAsAdmin(
      payload({ role: 'admin', password: 'short' }),
      SUPER_ADMIN
    ),
    /password/i
  );
});
