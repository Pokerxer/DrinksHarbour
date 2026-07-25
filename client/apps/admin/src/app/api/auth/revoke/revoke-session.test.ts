import { afterEach, describe, expect, test, vi } from 'vitest';
import { revokeBackendSession } from './revoke-session';

/**
 * Signing out of NextAuth only drops the local cookie. The backend keeps the
 * refresh token live in the RefreshToken collection until natural expiry unless
 * POST /api/users/logout is called with it, so sign-out must revoke explicitly.
 *
 * The refresh token is deliberately passed from server-side code (the route
 * handler reads it out of the encrypted NextAuth JWT); it is never exposed to
 * the browser.
 */

function stubFetch(response: { ok: boolean } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return { ok: response.ok, json: async () => ({ success: response.ok }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('revokeBackendSession', () => {
  test('posts the refresh token for revocation, authenticated as the user', async () => {
    const fetchMock = stubFetch({ ok: true });

    const revoked = await revokeBackendSession('access-token', 'refresh-token');

    expect(revoked).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toContain('/api/users/logout');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer access-token');
    // The endpoint revokes by the refresh token's jti; without it in the body
    // there is nothing for it to revoke on this client.
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'refresh-token' });
  });

  test('reports failure without throwing when the backend rejects', async () => {
    stubFetch({ ok: false });

    await expect(
      revokeBackendSession('access-token', 'refresh-token')
    ).resolves.toBe(false);
  });

  test('reports failure without throwing when the network is down', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await expect(
      revokeBackendSession('access-token', 'refresh-token')
    ).resolves.toBe(false);
  });

  test('makes no call when the session carries no access token', async () => {
    const fetchMock = stubFetch({ ok: true });

    await expect(
      revokeBackendSession(undefined, 'refresh-token')
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
