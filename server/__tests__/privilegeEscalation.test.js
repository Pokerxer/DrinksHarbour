// Regression tests for the two unauthenticated privilege-escalation paths to
// super_admin closed in the 2026-07-25 admin auth overhaul.
//
// Both public entry points used to let an anonymous caller mint a platform
// super admin:
//   V1  POST /api/users/register        — role taken straight from the body
//   V2  POST /api/verification/verify-code — role hard-coded to 'super_admin'
//
// These tests pin the fix: public registration always yields a 'customer',
// whatever the caller asks for. See
// docs/superpowers/specs/2026-07-25-admin-auth-overhaul-design.md §0.5

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const userService = require('../services/user.service');
const emailService = require('../services/email.service');
const verificationService = require('../services/verification.service');

const VALID_PASSWORD = 'Str0ng!Pass';

/**
 * Stub out the collaborators registerUser touches so the test exercises the
 * role logic and nothing else. Returns the object handed to User.create so
 * assertions can inspect the role that was actually persisted.
 */
function stubRegistration(t) {
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
  // Registration now issues a refresh token as well as an access token. Without
  // this stub the write reaches a real, disconnected Mongoose model and buffers
  // for 10s before failing — nothing to do with the role logic under test.
  t.mock.method(RefreshToken, 'store', async (doc) => doc);
  t.mock.method(verificationService, 'generateVerificationCode', () => '123456');
  t.mock.method(verificationService, 'storeVerificationCode', () => {});
  t.mock.method(emailService, 'sendEmailVerificationEmail', async () => ({
    success: true,
  }));

  return created;
}

function registrationPayload(overrides = {}) {
  return {
    email: `user${Math.random().toString(36).slice(2)}@example.com`,
    password: VALID_PASSWORD,
    firstName: 'Mallory',
    lastName: 'Attacker',
    ...overrides,
  };
}

test('registerUser: ignores a caller-supplied super_admin role', async (t) => {
  const created = stubRegistration(t);

  const result = await userService.registerUser(
    registrationPayload({ role: 'super_admin' })
  );

  assert.strictEqual(
    created.role,
    'customer',
    'public registration must never persist a super_admin'
  );
  assert.strictEqual(result.user.role, 'customer');
});

test('registerUser: ignores a caller-supplied admin role', async (t) => {
  const created = stubRegistration(t);

  await userService.registerUser(registrationPayload({ role: 'admin' }));

  assert.strictEqual(created.role, 'customer');
});

test('registerUser: ignores a caller-supplied tenant_admin role', async (t) => {
  const created = stubRegistration(t);

  // tenant_admin previously demanded a tenant; once the role is ignored the
  // call must succeed as a plain customer with no tenant lookup at all.
  await userService.registerUser(registrationPayload({ role: 'tenant_admin' }));

  assert.strictEqual(created.role, 'customer');
  assert.strictEqual(created.tenant, undefined);
});

test('registerUser: still defaults to customer when no role is given', async (t) => {
  const created = stubRegistration(t);

  await userService.registerUser(registrationPayload());

  assert.strictEqual(created.role, 'customer');
});
