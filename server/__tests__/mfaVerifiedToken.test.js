// Controller-level tests for issuing the MFA-verified token.
//
// `requireMfa` (middleware/mfa.middleware.js) rejects privileged requests from
// MFA-enabled users unless they carry an x-mfa-token header or dh_mfa cookie.
// `mfaService.generateMfaVerifiedToken()` existed to mint that token but was
// never called by anything, so the middleware could not be satisfied at all:
// every route behind `router.use(requireMfa)` — including POST /api/users —
// answered 403 for exactly the users who had enabled MFA.
//
// Two things must issue it: completing the login challenge, and re-proving
// mid-session once the 10-minute window has lapsed (step-up).

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const mfaService = require('../services/mfa.service');
const userService = require('../services/user.service');
const mfaController = require('../controllers/mfa.controller');

function mockRes() {
  const res = { _cookies: {} };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  res.cookie = (name, value, options) => {
    res._cookies[name] = { value, options };
    return res;
  };
  return res;
}

const USER_ID = new mongoose.Types.ObjectId().toString();

function pendingMfaToken(userId = USER_ID) {
  return jwt.sign({ userId, type: 'pending_mfa' }, process.env.JWT_SECRET, {
    expiresIn: '5m',
  });
}

function stubLoginPlumbing(t) {
  t.mock.method(mfaService, 'verifyLoginMfa', async () => ({ method: 'totp' }));
  t.mock.method(userService, 'completeMfaLogin', async () => ({
    user: { _id: USER_ID, role: 'super_admin' },
    token: 'access-token',
    refreshToken: 'refresh-token',
  }));
}

test('verifyLoginMfa: returns an mfa-verified token the middleware accepts', async (t) => {
  stubLoginPlumbing(t);

  const req = {
    body: { pendingMfaToken: pendingMfaToken(), code: '123456' },
    ip: '127.0.0.1',
    get: () => undefined,
  };
  const res = mockRes();

  await mfaController.verifyLoginMfa(req, res, () => {});

  const issued = res._body.data.mfaToken;
  assert.ok(issued, 'no mfaToken in the response');
  const decoded = mfaService.verifyMfaVerifiedToken(issued);
  assert.ok(decoded, 'the issued token does not verify');
  assert.strictEqual(decoded.userId, USER_ID);
});

test('verifyLoginMfa: also sets the dh_mfa cookie', async (t) => {
  stubLoginPlumbing(t);

  const req = {
    body: { pendingMfaToken: pendingMfaToken(), code: '123456' },
    ip: '127.0.0.1',
    get: () => undefined,
  };
  const res = mockRes();

  await mfaController.verifyLoginMfa(req, res, () => {});

  assert.ok(res._cookies.dh_mfa, 'dh_mfa cookie was not set');
  assert.strictEqual(res._cookies.dh_mfa.value, res._body.data.mfaToken);
  assert.strictEqual(res._cookies.dh_mfa.options.httpOnly, true);
});

test('stepUpMfa: re-proving mid-session issues a fresh token', async (t) => {
  // The token lasts 10 minutes by design — it is proof of a recent challenge,
  // not a session flag. Without a way to re-prove, a privileged action taken
  // 11 minutes after signing in is refused with no way forward.
  t.mock.method(mfaService, 'verifyLoginMfa', async () => ({ method: 'totp' }));

  const req = {
    body: { code: '123456' },
    user: { _id: USER_ID, role: 'super_admin', mfaEnabled: true },
  };
  const res = mockRes();

  await mfaController.stepUpMfa(req, res, () => {});

  const decoded = mfaService.verifyMfaVerifiedToken(res._body.data.mfaToken);
  assert.ok(decoded);
  assert.strictEqual(decoded.userId, USER_ID);
  assert.ok(res._cookies.dh_mfa, 'dh_mfa cookie was not set');
});

test('stepUpMfa: verifies the code against the authenticated user, not the body', async (t) => {
  let checkedUserId = null;
  t.mock.method(mfaService, 'verifyLoginMfa', async (userId) => {
    checkedUserId = userId;
    return { method: 'totp' };
  });

  const req = {
    body: { code: '123456', userId: 'someone-else' },
    user: { _id: USER_ID, role: 'admin', mfaEnabled: true },
  };
  await mfaController.stepUpMfa(req, mockRes(), () => {});

  assert.strictEqual(String(checkedUserId), USER_ID);
});

test('stepUpMfa: rejects a missing code without touching the service', async (t) => {
  let called = false;
  t.mock.method(mfaService, 'verifyLoginMfa', async () => {
    called = true;
    return { method: 'totp' };
  });

  const res = mockRes();
  await mfaController.stepUpMfa(
    { body: {}, user: { _id: USER_ID, mfaEnabled: true } },
    res,
    () => {}
  );

  assert.strictEqual(res._status, 400);
  assert.strictEqual(called, false);
});

test('stepUpMfa: refuses when the account has no MFA enabled', async (t) => {
  // Nothing to prove, and issuing a token here would let a non-MFA account
  // manufacture the very proof requireMfa exists to demand.
  let called = false;
  t.mock.method(mfaService, 'verifyLoginMfa', async () => {
    called = true;
    return { method: 'totp' };
  });

  const res = mockRes();
  await mfaController.stepUpMfa(
    { body: { code: '123456' }, user: { _id: USER_ID, mfaEnabled: false } },
    res,
    () => {}
  );

  assert.strictEqual(res._status, 400);
  assert.strictEqual(called, false);
});
