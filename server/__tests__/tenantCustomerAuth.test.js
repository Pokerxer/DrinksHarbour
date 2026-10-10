'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
process.env.JWT_SECRET = 'isolated-test-secret-at-least-thirty-two-characters';
test('customer email uniqueness is per tenant while staff use the platform namespace', async () => {
  const a = new User({
    email: 'a@example.com',
    firstName: 'A',
    role: 'customer',
    tenant: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  });
  await a.validate();
  assert.equal(a.loginScope, 'tenant:aaaaaaaaaaaaaaaaaaaaaaaa');
  const b = new User({
    email: 'a@example.com',
    firstName: 'A',
    role: 'tenant_staff',
    tenant: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  });
  await b.validate();
  assert.equal(b.loginScope, 'platform');
  assert.equal(User.schema.path('email').options.unique, undefined);
  assert.ok(
    User.schema
      .indexes()
      .some(
        ([keys, options]) =>
          keys.email === 1 && keys.loginScope === 1 && options.unique,
      ),
  );
});
test('customer tokens reject foreign tenant, platform JWTs and wrong token types', () => {
  const tokens = require('../services/tenantCustomer.tokens');
  const tenant = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
    foreign = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' };
  const token = tokens.sign(
    tenant,
    'cccccccccccccccccccccccc',
    'access',
    'session',
    '15m',
  );
  assert.equal(
    tokens.verify(tenant, token, 'access').userId,
    'cccccccccccccccccccccccc',
  );
  assert.throws(() => tokens.verify(foreign, token, 'access'));
  assert.throws(() => tokens.verify(tenant, token, 'refresh'));
  const platform = jwt.sign(
    { userId: 'cccccccccccccccccccccccc', tenant: tenant._id },
    process.env.JWT_SECRET,
  );
  assert.throws(() => tokens.verify(tenant, platform, 'access'));
  assert.throws(() => jwt.verify(token, process.env.JWT_SECRET));
});
test('recovery origins allow only the issuing store and explicitly configured websites', () => {
  const { resetOrigin } = require('../services/tenantCustomer.validation');
  process.env.NODE_ENV = 'production';
  process.env.TENANT_CUSTOMER_ORIGINS = JSON.stringify({
    wyncity: ['https://wyncity.example'],
  });
  const tenant = { slug: 'wyncity' };
  assert.equal(resetOrigin(tenant), 'https://wyncity.drinksharbour.com');
  assert.equal(
    resetOrigin(tenant, 'https://wyncity.example'),
    'https://wyncity.example',
  );
  for (const origin of [
    'https://foreign.example',
    'http://wyncity.example',
    'https://wyncity.example/reset',
    'https://evil@wyncity.example',
  ])
    assert.throws(() => resetOrigin(tenant, origin));
});
