import { beforeEach, describe, expect, test, vi } from 'vitest';

let lastCall = null;

vi.mock('./api-client.ts', () => ({
  apiFetch: vi.fn(async (path, init) => {
    lastCall = { path, init };
    return lastCall.response;
  }),
}));

const { apiFetch } = await import('./api-client.ts');
const authApi = await import('./auth-api.ts');

const res = (status, body = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function reply(status, body) {
  apiFetch.mockImplementationOnce(async (path, init) => {
    lastCall = { path, init };
    return res(status, body);
  });
}

const USER = { _id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Obi', role: 'customer' };

describe('login', () => {
  beforeEach(() => {
    lastCall = null;
    vi.clearAllMocks();
  });

  test('a full session comes back as kind "session"', async () => {
    reply(200, { success: true, data: { user: USER, token: 't1', refreshToken: 'r1' } });

    const result = await authApi.login('ada@example.com', 'Str0ng!Pass');

    expect(result).toEqual({ kind: 'session', user: USER, token: 't1', refreshToken: 'r1' });
    expect(lastCall.path).toBe('/api/users/login');
    expect(JSON.parse(lastCall.init.body)).toEqual({
      email: 'ada@example.com',
      password: 'Str0ng!Pass',
    });
  });

  // MFA at login is gated on user.mfaEnabled alone (user.service.js:317), not
  // on role — the role-gated requireMfa middleware is a different mechanism. A
  // customer who turns on TOTP is challenged, so this branch is live on a
  // storefront app.
  test('an MFA challenge comes back as kind "mfa" with no tokens', async () => {
    reply(200, {
      success: true,
      data: { user: USER, mfaRequired: true, pendingMfaToken: 'pending-1' },
    });

    const result = await authApi.login('ada@example.com', 'Str0ng!Pass');

    expect(result).toEqual({ kind: 'mfa', user: USER, pendingMfaToken: 'pending-1' });
  });

  test('a rejected login comes back as kind "error" with the server message', async () => {
    reply(400, { success: false, message: 'Invalid email or password' });

    const result = await authApi.login('ada@example.com', 'wrong');

    expect(result).toEqual({ kind: 'error', message: 'Invalid email or password' });
  });

  test('a transport failure names the connection', async () => {
    apiFetch.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });

    const result = await authApi.login('ada@example.com', 'Str0ng!Pass');

    expect(result.kind).toBe('error');
    expect(result.message).toMatch(/connection/i);
  });
});

describe('verifyMfa', () => {
  beforeEach(() => vi.clearAllMocks());

  test('posts the pending token and code, and returns a session', async () => {
    reply(200, { success: true, data: { user: USER, token: 't2', refreshToken: 'r2' } });

    const result = await authApi.verifyMfa('pending-1', '483920');

    expect(lastCall.path).toBe('/api/users/mfa/verify');
    expect(JSON.parse(lastCall.init.body)).toEqual({
      pendingMfaToken: 'pending-1',
      code: '483920',
    });
    expect(result).toEqual({ kind: 'session', user: USER, token: 't2', refreshToken: 'r2' });
  });
});

describe('register', () => {
  beforeEach(() => vi.clearAllMocks());

  // Task 1 made this true. Before it, register returned a token with no way to
  // renew it.
  test('a 201 carries a refresh token', async () => {
    reply(201, {
      success: true,
      data: { user: USER, token: 't3', refreshToken: 'r3', requiresEmailVerification: true },
    });

    const result = await authApi.register({
      firstName: 'Ada',
      lastName: 'Obi',
      email: 'ada@example.com',
      password: 'Str0ng!Pass',
      phoneNumber: '',
      dateOfBirth: '',
    });

    expect(result).toEqual({ kind: 'session', user: USER, token: 't3', refreshToken: 'r3' });
  });

  test('blank optional fields are omitted rather than sent empty', async () => {
    reply(201, { success: true, data: { user: USER, token: 't3', refreshToken: 'r3' } });

    await authApi.register({
      firstName: 'Ada',
      lastName: 'Obi',
      email: 'ada@example.com',
      password: 'Str0ng!Pass',
      phoneNumber: '',
      dateOfBirth: '',
    });

    const body = JSON.parse(lastCall.init.body);
    expect(body.phoneNumber).toBeUndefined();
    expect(body.dateOfBirth).toBeUndefined();
  });
});

describe('the simple endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  test('requestPasswordReset posts the email', async () => {
    reply(200, { success: true });
    const result = await authApi.requestPasswordReset('ada@example.com');
    expect(lastCall.path).toBe('/api/users/forgot-password');
    expect(result).toEqual({ ok: true });
  });

  test('resetPassword puts the token in the path, not the body', async () => {
    reply(200, { success: true });
    await authApi.resetPassword('tok-123', 'Str0ng!Pass');
    expect(lastCall.path).toBe('/api/users/reset-password/tok-123');
    expect(JSON.parse(lastCall.init.body)).toEqual({ newPassword: 'Str0ng!Pass' });
  });

  test('resetPassword surfaces an expired token', async () => {
    reply(400, { success: false, message: 'Invalid or expired reset token' });
    const result = await authApi.resetPassword('tok-123', 'Str0ng!Pass');
    expect(result).toEqual({ ok: false, message: 'Invalid or expired reset token' });
  });

  test('verifyEmail posts the email and code', async () => {
    reply(200, { success: true });
    await authApi.verifyEmail('ada@example.com', '483920');
    expect(lastCall.path).toBe('/api/users/verify-email');
    expect(JSON.parse(lastCall.init.body)).toEqual({
      email: 'ada@example.com',
      code: '483920',
    });
  });

  test('resendVerification posts the email', async () => {
    reply(200, { success: true });
    await authApi.resendVerification('ada@example.com');
    expect(lastCall.path).toBe('/api/users/resend-verification');
  });
});

describe('fetchProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  test('returns the user on 200', async () => {
    reply(200, { success: true, data: USER });
    expect(await authApi.fetchProfile()).toEqual(USER);
  });

  test('returns null rather than throwing on 401', async () => {
    reply(401, { success: false, message: 'Not authorised' });
    expect(await authApi.fetchProfile()).toBeNull();
  });
});
