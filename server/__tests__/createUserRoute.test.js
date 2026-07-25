// Controller-level tests for POST /api/users (authenticated admin user creation).
//
// The route is guarded by protect + authorize('admin','super_admin'), but the
// controller must pass the acting user through to the service so the
// "only a super admin creates a super admin" rule can be applied, and must
// record the action in the audit log.
//
// See docs/superpowers/specs/2026-07-25-admin-auth-overhaul-design.md §0.2

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const userService = require('../services/user.service');
const auditLog = require('../utils/auditLog');
const userController = require('../controllers/user.controller');

function mockRes() {
  const res = {};
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  return res;
}

function mockReq(body, actor) {
  return {
    body,
    user: actor,
    headers: {},
    get: () => undefined,
    ip: '127.0.0.1',
  };
}

const SUPER_ADMIN = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };

test('createUser: forwards the acting user to the service', async (t) => {
  let receivedActor = null;
  t.mock.method(userService, 'createUserAsAdmin', async (_data, actor) => {
    receivedActor = actor;
    return { user: { _id: 'u1', role: 'admin' } };
  });
  t.mock.method(auditLog, 'logPrivilegedAction', async () => {});

  const req = mockReq(
    { email: 'a@b.com', password: 'Str0ng!Pass', firstName: 'A', lastName: 'B', role: 'admin' },
    SUPER_ADMIN
  );
  const res = mockRes();

  await userController.createUser(req, res, () => {});

  assert.ok(receivedActor, 'service must receive the acting user');
  assert.strictEqual(receivedActor.role, 'super_admin');
});

test('createUser: responds 201 with the created user', async (t) => {
  t.mock.method(userService, 'createUserAsAdmin', async () => ({
    user: { _id: 'u1', role: 'admin', email: 'a@b.com' },
  }));
  t.mock.method(auditLog, 'logPrivilegedAction', async () => {});

  const req = mockReq(
    { email: 'a@b.com', password: 'Str0ng!Pass', firstName: 'A', lastName: 'B', role: 'admin' },
    SUPER_ADMIN
  );
  const res = mockRes();

  await userController.createUser(req, res, () => {});

  assert.strictEqual(res._status, 201);
  assert.strictEqual(res._body.success, true);
  assert.strictEqual(res._body.data.user.role, 'admin');
});

test('createUser: never returns a session token for the new account', async (t) => {
  t.mock.method(userService, 'createUserAsAdmin', async () => ({
    user: { _id: 'u1', role: 'super_admin' },
  }));
  t.mock.method(auditLog, 'logPrivilegedAction', async () => {});

  const req = mockReq(
    { email: 'a@b.com', password: 'Str0ng!Pass', firstName: 'A', lastName: 'B', role: 'super_admin' },
    SUPER_ADMIN
  );
  const res = mockRes();

  await userController.createUser(req, res, () => {});

  assert.strictEqual(res._body.data.token, undefined);
});

test('createUser: writes an audit entry naming the created role', async (t) => {
  const entries = [];
  t.mock.method(userService, 'createUserAsAdmin', async () => ({
    user: { _id: 'u1', role: 'super_admin' },
  }));
  t.mock.method(auditLog, 'logPrivilegedAction', async (_req, action, category, target) => {
    entries.push({ action, category, target });
  });

  const req = mockReq(
    { email: 'a@b.com', password: 'Str0ng!Pass', firstName: 'A', lastName: 'B', role: 'super_admin' },
    SUPER_ADMIN
  );
  const res = mockRes();

  await userController.createUser(req, res, () => {});

  assert.strictEqual(entries.length, 1, 'admin user creation must be audited');
  assert.strictEqual(entries[0].action, 'USER_CREATE');
  assert.strictEqual(entries[0].category, 'create');
  assert.match(
    JSON.stringify(entries[0].target),
    /super_admin/,
    'the audit entry must record which role was granted'
  );
});
