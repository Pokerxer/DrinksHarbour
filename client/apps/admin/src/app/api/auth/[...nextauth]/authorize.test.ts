import { afterEach, describe, expect, test, vi } from 'vitest';
import { authOptions } from './auth-options';

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

function stubLoginResponse(user: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: { user, token: 'access-token', refreshToken: 'refresh-token' },
      }),
    }))
  );
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

  test.each(['super_admin', 'admin', 'tenant_admin', 'tenant_owner', 'tenant_staff'])(
    'admits %s',
    async (role) => {
      stubLoginResponse({ ...BASE_USER, role });

      const user = (await authorizeFor('credentials')({
        email: 'staff@example.com',
        password: 'pw',
      })) as { role: string; token: string };

      expect(user.role).toBe(role);
      expect(user.token).toBe('access-token');
    }
  );
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
