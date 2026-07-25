import { afterEach, describe, expect, test, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import { authOptions } from './auth-options';

/**
 * Token refresh must happen in `jwt()`, not `session()`.
 *
 * NextAuth v4 re-encodes the JWT cookie from the `jwt()` return value only.
 * Assigning rotated tokens onto `token` inside `session()` throws them away —
 * and because the backend *rotates and revokes* (`RefreshToken.markRotated`),
 * the discarded refresh token is the only one the client could have presented
 * again. Every later refresh then fails against a dead jti.
 */

type JwtCallback = NonNullable<
  NonNullable<typeof authOptions.callbacks>['jwt']
>;
type SessionCallback = NonNullable<
  NonNullable<typeof authOptions.callbacks>['session']
>;

const jwtCallback = authOptions.callbacks!.jwt as JwtCallback;
const sessionCallback = authOptions.callbacks!.session as SessionCallback;

/** A JWT-shaped access token whose `exp` is `secondsFromNow` away. */
function accessTokenExpiringIn(secondsFromNow: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })
  ).toString('base64');
  return `header.${payload}.signature`;
}

function stubRefresh(
  result: { token: string; refreshToken: string } | 'failure'
) {
  const fetchMock = vi.fn(async () =>
    result === 'failure'
      ? { ok: false, json: async () => ({ success: false }) }
      : {
          ok: true,
          json: async () => ({
            success: true,
            data: { ...result, expiresIn: '7d' },
          }),
        }
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function runJwt(token: Record<string, unknown>) {
  return jwtCallback({
    token: token as unknown as JWT,
    user: undefined as never,
    account: null,
    trigger: undefined,
  } as Parameters<JwtCallback>[0]);
}

function runSession(token: Record<string, unknown>) {
  return sessionCallback({
    session: { user: {}, expires: '' } as unknown as Session,
    token: token as unknown as JWT,
  } as Parameters<SessionCallback>[0]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('jwt() token refresh', () => {
  test('persists the rotated tokens onto the JWT', async () => {
    stubRefresh({ token: 'new-access', refreshToken: 'new-refresh' });

    const token = await runJwt({
      accessToken: accessTokenExpiringIn(-10),
      refreshToken: 'old-refresh',
    });

    expect(token.accessToken).toBe('new-access');
    expect(token.refreshToken).toBe('new-refresh');
    expect(token.error).toBeUndefined();
  });

  test('refreshes just before expiry, not strictly after', async () => {
    // Two requests entering jwt() together would otherwise race to spend the
    // same rotated refresh token; refreshing early makes the common case a
    // single refresh well before anything is expired.
    const fetchMock = stubRefresh({
      token: 'new-access',
      refreshToken: 'new-refresh',
    });

    const token = await runJwt({
      accessToken: accessTokenExpiringIn(30),
      refreshToken: 'old-refresh',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(token.accessToken).toBe('new-access');
  });

  test('leaves a comfortably valid access token alone', async () => {
    const fetchMock = stubRefresh({
      token: 'new-access',
      refreshToken: 'new-refresh',
    });

    const token = await runJwt({
      accessToken: accessTokenExpiringIn(3600),
      refreshToken: 'old-refresh',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(token.accessToken).toBe(accessTokenExpiringIn(3600));
  });

  test('flags RefreshAccessTokenError when the refresh is rejected', async () => {
    stubRefresh('failure');

    const token = await runJwt({
      accessToken: accessTokenExpiringIn(-10),
      refreshToken: 'dead-refresh',
    });

    expect(token.error).toBe('RefreshAccessTokenError');
  });

  test('does not attempt a refresh without a refresh token', async () => {
    const fetchMock = stubRefresh({
      token: 'new-access',
      refreshToken: 'new-refresh',
    });

    const token = await runJwt({ accessToken: accessTokenExpiringIn(-10) });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(token.error).toBeUndefined();
  });
});

describe('session() is pure', () => {
  test('never refreshes — an expired token is the jwt callback’s business', async () => {
    const fetchMock = stubRefresh({
      token: 'new-access',
      refreshToken: 'new-refresh',
    });

    const expired = accessTokenExpiringIn(-10);
    const session = (await runSession({
      accessToken: expired,
      refreshToken: 'old-refresh',
      id: 'u1',
      role: 'admin',
    })) as Session & { user: { token: string; role: string } };

    expect(fetchMock).not.toHaveBeenCalled();
    expect(session.user.token).toBe(expired);
    expect(session.user.role).toBe('admin');
  });

  test('surfaces the refresh error so the client signs out', async () => {
    const session = (await runSession({
      accessToken: 'stale',
      refreshToken: 'dead',
      error: 'RefreshAccessTokenError',
    })) as Session & { error?: string };

    expect(session.error).toBe('RefreshAccessTokenError');
  });
});
