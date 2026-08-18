// Public registration used to return an access token and nothing else. On the
// mobile app that is a lone 7-day token with no renewal path, and apiFetch
// short-circuits on a null refreshToken, so the eventual 401 is returned raw
// and the session never signals expiry. The web storefront had the same gap
// from the other end: user.controller.js:44 sets an EMPTY refresh cookie.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const emailService = require('../services/email.service');
const verificationService = require('../services/verification.service');
const userService = require('../services/user.service');

const VALID_PASSWORD = 'Str0ng!Pass';

function stubRegistration(t) {
  const stored = [];
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(User, 'create', async (data) => ({
    ...data,
    _id: new mongoose.Types.ObjectId(),
    toObject: () => ({ ...data, _id: new mongoose.Types.ObjectId() }),
  }));
  t.mock.method(RefreshToken, 'store', async (doc) => {
    stored.push(doc);
    return doc;
  });
  t.mock.method(emailService, 'sendEmailVerificationEmail', async () => true);
  // verification.service.js:33 arms a 10-minute setTimeout per registration and
  // never unrefs it, so a real call here keeps this runner alive for ten minutes
  // after the assertions finish. Stubbed rather than fixed: unref'ing that timer
  // is a production change, and nothing in this test cares about the code store.
  t.mock.method(verificationService, 'storeVerificationCode', () => undefined);
  return stored;
}

function payload(overrides = {}) {
  return {
    email: `new${Math.random().toString(36).slice(2)}@example.com`,
    password: VALID_PASSWORD,
    firstName: 'New',
    lastName: 'Customer',
    ...overrides,
  };
}

test('registerUser returns a refresh token alongside the access token', async (t) => {
  stubRegistration(t);

  const result = await userService.registerUser(payload());

  assert.ok(result.token, 'expected an access token');
  assert.ok(
    typeof result.refreshToken === 'string' && result.refreshToken.length > 0,
    'expected a non-empty refreshToken'
  );
});

test('registerUser persists the refresh token so it can be revoked and rotated', async (t) => {
  const stored = stubRegistration(t);

  await userService.registerUser(payload());

  assert.strictEqual(stored.length, 1, 'expected exactly one RefreshToken.store call');
  assert.ok(stored[0].jti, 'expected a jti for revocation');
  assert.ok(stored[0].tokenHash, 'expected the token to be stored hashed, never in the clear');
  assert.ok(stored[0].userId, 'expected the owning user id');
  assert.ok(stored[0].expiresAt instanceof Date, 'expected an expiry');
});

test('registerUser records the ip and user agent it was handed', async (t) => {
  const stored = stubRegistration(t);

  await userService.registerUser(payload(), {
    ipAddress: '10.0.0.7',
    userAgent: 'DrinksHarbour/0.0.1 (iOS)',
  });

  assert.strictEqual(stored[0].ipAddress, '10.0.0.7');
  assert.strictEqual(stored[0].userAgent, 'DrinksHarbour/0.0.1 (iOS)');
});
