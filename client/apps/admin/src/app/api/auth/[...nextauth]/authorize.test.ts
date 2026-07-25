import { afterEach, describe, expect, test, vi } from 'vitest';
import { authOptions } from './auth-options';
import { MFA_REQUIRED_PREFIX } from './mfa-challenge';

/**
 * Exercises the `authorize` callbacks of both credentials providers against a
 * stubbed backend, so the role whitelist is verified as behaviour rather than
 * as a constant.
 *
 * The admin dashboard must reject storefront customers even when the backend
 * authenticates them successfully — /api/users/login is shared with the
 * storefront, so a valid customer login is an expected response here, not an
 * error case.
 */

type AuthorizeFn = (
  credentials: Record<string, string> | undefined
) => Promise<unknown>;

function authorizeFor(id: string): AuthorizeFn {
  const provider = authOptions.providers.find(
    (p) => (p as { options?: { id?: string }; id: string }).options?.id === id
  ) as { options: { authorize: AuthorizeFn } } | undefined;

  if (!provider) throw new Error(`No provider registered with id '${id}'`);
  return provider.options.authorize;
}

function stubJsonResponse(
  payload: Record<string, unknown>,
  { ok = true }: { ok?: boolean } = {}
) {
  const fetchMock = vi.fn(async () => ({
    ok,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubLoginResponse(user: Record<string, unknown>) {
  return stubJsonResponse({
    success: true,
    data: { user, token: 'access-token', refreshToken: 'refresh-token' },
  });
}

const BASE_USER = {
  _id: 'u1',
  id: 'u1',
  email: 'someone@example.com',
  firstName: 'Some',
  lastName: 'One',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('credentials provider role whitelist', () => {
  test('rejects a customer even when the backend authenticates them', async () => {
    stubLoginResponse({ ...BASE_USER, role: 'customer' });

    await expect(
      authorizeFor('credentials')({
        email: 'shopper@example.com',
        password: 'pw',
      })
    ).rejects.toThrow(/not authorized/i);
  });

  test('rejects an unknown role', async () => {
    stubLoginResponse({ ...BASE_USER, role: 'wizard' });

    await expect(
      authorizeFor('credentials')({ email: 'a@b.com', password: 'pw' })
    ).rejects.toThrow(/not authorized/i);
  });

  test.each([
    'super_admin',
    'admin',
    'tenant_admin',
    'tenant_owner',
    'tenant_staff',
  ])('admits %s', async (role) => {
    stubLoginResponse({ ...BASE_USER, role });

    const user = (await authorizeFor('credentials')({
      email: 'staff@example.com',
      password: 'pw',
    })) as { role: string; token: string };

    expect(user.role).toBe(role);
    expect(user.token).toBe('access-token');
  });
});

describe('credentials provider MFA challenge', () => {
  test('refuses to build a session when the backend demands MFA', async () => {
    // The backend answers a correct password from an MFA-enabled account with
    // `mfaRequired` and NO access token. Treating that as success produced a
    // session carrying `token: undefined`, so every later API call 401'd.
    stubJsonResponse({
      success: true,
      data: {
        user: { ...BASE_USER, role: 'admin' },
        mfaRequired: true,
        pendingMfaToken: 'pending-token-123',
      },
    });

    await expect(
      authorizeFor('credentials')({ email: 'a@b.com', password: 'pw' })
    ).rejects.toThrow(`${MFA_REQUIRED_PREFIX}pending-token-123`);
  });

  test('rejects an MFA-enabled customer before disclosing a pending token', async () => {
    stubJsonResponse({
      success: true,
      data: {
        user: { ...BASE_USER, role: 'customer' },
        mfaRequired: true,
        pendingMfaToken: 'pending-token-123',
      },
    });

    await expect(
      authorizeFor('credentials')({
        email: 'shopper@example.com',
        password: 'pw',
      })
    ).rejects.toThrow(/not authorized/i);
  });
});

describe('mfa provider', () => {
  test('exchanges a pending token and code for a full session', async () => {
    const fetchMock = stubJsonResponse({
      success: true,
      data: {
        user: { ...BASE_USER, role: 'admin' },
        token: 'access-token',
        refreshToken: 'refresh-token',
      },
    });

    const user = (await authorizeFor('mfa')({
      pendingMfaToken: 'pending-token-123',
      code: '123456',
    })) as { role: string; token: string; refreshToken: string };

    expect(user.role).toBe('admin');
    expect(user.token).toBe('access-token');
    expect(user.refreshToken).toBe('refresh-token');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toContain('/api/users/mfa/verify');
    expect(JSON.parse(init.body)).toEqual({
      pendingMfaToken: 'pending-token-123',
      code: '123456',
    });
  });

  test('surfaces the backend message when the code is wrong', async () => {
    stubJsonResponse(
      { success: false, message: 'Invalid verification code' },
      { ok: false }
    );

    await expect(
      authorizeFor('mfa')({ pendingMfaToken: 'pending', code: '000000' })
    ).rejects.toThrow('Invalid verification code');
  });

  test('applies the admin role whitelist to the second factor too', async () => {
    stubJsonResponse({
      success: true,
      data: {
        user: { ...BASE_USER, role: 'customer' },
        token: 'access-token',
        refreshToken: 'refresh-token',
      },
    });

    await expect(
      authorizeFor('mfa')({ pendingMfaToken: 'pending', code: '123456' })
    ).rejects.toThrow(/not authorized/i);
  });

  test('requires both a pending token and a code', async () => {
    await expect(
      authorizeFor('mfa')({ pendingMfaToken: 'pending', code: '' })
    ).rejects.toThrow(/verification code/i);
  });
});

describe('pos-pin provider role whitelist', () => {
  test('rejects a customer', async () => {
    stubLoginResponse({ ...BASE_USER, role: 'customer' });

    await expect(
      authorizeFor('pos-pin')({ tenantSlug: 'acme', pin: '1234' })
    ).rejects.toThrow(/not authorized/i);
  });

  test('rejects an unknown role', async () => {
    stubLoginResponse({ ...BASE_USER, role: 'wizard' });

    await expect(
      authorizeFor('pos-pin')({ tenantSlug: 'acme', pin: '1234' })
    ).rejects.toThrow(/not authorized/i);
  });

  test('admits tenant_staff', async () => {
    stubLoginResponse({ ...BASE_USER, role: 'tenant_staff' });

    const user = (await authorizeFor('pos-pin')({
      tenantSlug: 'acme',
      pin: '1234',
    })) as { role: string };

    expect(user.role).toBe('tenant_staff');
  });
});
