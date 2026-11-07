'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { protect, optionalProtect } = require('../middleware/auth.middleware');
const { protectPOSOrAdmin } = require('../middleware/pos.middleware');

const secret = 'synthetic-access-purpose-test-secret';
const userId = '507f1f77bcf86cd799439011';
const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = secret;
test.after(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

function setup(t, overrides = {}) {
  const user = { _id: userId, role: 'tenant_staff', tenant: 'tenant-a', status: 'active', ...overrides };
  t.mock.method(Tenant, 'findById', async () => ({ isActive: true }));
  const lookup = t.mock.method(User, 'findById', () => ({
    select: () => ({ lean: async () => ({ ...user }), then: (resolve) => resolve({ ...user }) }),
  }));
  return lookup;
}

function request(type, cookie = false, issuedAt) {
  const payload = { userId };
  if (issuedAt !== undefined) payload.iat = issuedAt;
  if (type !== undefined) payload.type = type;
  if (type === 'pos') payload.tenantId = 'tenant-a';
  const token = jwt.sign(payload, secret, { expiresIn: '5m' });
  return { headers: cookie ? {} : { authorization: `Bearer ${token}` },
    cookies: cookie ? { dh_access: token } : {} };
}

test('POS reporting rejects an admin access token issued before a password reset', async (t) => {
  setup(t, { passwordChangedAt: new Date() });
  const req = request(undefined, false, Math.floor(Date.now() / 1000) - 60);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
  let nextCalled = false;
  await protectPOSOrAdmin(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(req.user, undefined);
});

test('POS reporting accepts an access token issued after the password change', async (t) => {
  setup(t, { passwordChangedAt: new Date(Date.now() - 120_000) });
  const req = request('access');
  let calls = 0;
  await protectPOSOrAdmin(req, {}, (err) => { assert.equal(err, undefined); calls++; });
  assert.equal(calls, 1);
  assert.equal(req.user._id, userId);
});

for (const type of ['pending_mfa', 'mfa', 'refresh', 'reset_password', '', null]) {
  test(`POS admin access rejects ${JSON.stringify(type)} tokens`, async (t) => {
    const lookup = setup(t);
    const req = request(type);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
    let nextCalled = false;
    await protectPOSOrAdmin(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.equal(req.user, undefined);
    assert.equal(lookup.mock.callCount(), 0);
  });
  for (const cookie of [false, true]) {
    test(`protect rejects ${JSON.stringify(type)} tokens via ${cookie ? 'cookie' : 'bearer'}`, async (t) => {
      const lookup = setup(t);
      const req = request(type, cookie);
      let error;
      await protect(req, {}, (err) => { error = err; });
      assert.equal(error?.statusCode, 401, 'must require an access token');
      assert.equal(req.user, undefined);
      assert.equal(lookup.mock.callCount(), 0, 'reject token purpose before user lookup');
    });
    test(`optionalProtect treats ${JSON.stringify(type)} tokens as guest via ${cookie ? 'cookie' : 'bearer'}`, async (t) => {
      const lookup = setup(t);
      const req = request(type, cookie);
      let calls = 0;
      await optionalProtect(req, {}, (err) => { assert.equal(err, undefined); calls++; });
      assert.equal(req.user, null);
      assert.equal(calls, 1);
      assert.equal(lookup.mock.callCount(), 0);
    });
  }
}

for (const type of [undefined, 'access']) {
  for (const middleware of [protect, optionalProtect]) {
    test(`${middleware === protect ? 'protect' : 'optionalProtect'} accepts ${type ?? 'legacy'} access tokens`, async (t) => {
      setup(t);
      const req = request(type);
      let calls = 0;
      await middleware(req, {}, (err) => { assert.equal(err, undefined); calls++; });
      assert.equal(calls, 1);
      assert.equal(req.user._id, userId);
    });
  }
}

for (const type of [undefined, 'access', 'pos']) {
  test(`POS reporting accepts ${type ?? 'legacy'} session tokens`, async (t) => {
    setup(t);
    const req = request(type);
    const res = { status() { assert.fail('valid session rejected'); } };
    let calls = 0;
    await protectPOSOrAdmin(req, res, (err) => { assert.equal(err, undefined); calls++; });
    assert.equal(calls, 1);
    assert.equal(req.user._id, userId);
  });
}
