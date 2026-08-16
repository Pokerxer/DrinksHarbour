import { beforeEach, describe, expect, test, vi } from 'vitest';

let session = null;

vi.mock('./token-store.ts', () => ({
  readSession: vi.fn(async () => session),
  saveSession: vi.fn(async (s) => void (session = s)),
  clearSession: vi.fn(async () => void (session = null)),
}));

vi.mock('commerce-core', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

const { apiFetch, setOnSessionExpired, __resetRefreshState } = await import('./api-client.ts');

const res = (status, body = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiFetch', () => {
  beforeEach(() => {
    session = null;
    __resetRefreshState();
    setOnSessionExpired(null);
    vi.restoreAllMocks();
  });

  test('prefixes the base URL and sends no auth header when signed out', async () => {
    const fetchMock = vi.fn(async () => res(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/products');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/products');
    expect(init.headers.Authorization).toBeUndefined();
  });

  test('attaches the Bearer header when signed in', async () => {
    session = { accessToken: 'a1', refreshToken: 'r1', user: {} };
    const fetchMock = vi.fn(async () => res(200));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/users/profile');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer a1');
  });

  // Mobile is Bearer-only. csrf.middleware.js:88 waives CSRF for Bearer
  // requests, so sending cookies or a CSRF token would be both pointless and a
  // way to accidentally re-enter the cookie code path on the server.
  test('never sends credentials or a CSRF token', async () => {
    session = { accessToken: 'a1', refreshToken: 'r1', user: {} };
    const fetchMock = vi.fn(async () => res(200));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/users/profile', { method: 'POST' });

    const init = fetchMock.mock.calls[0][1];
    expect(init.credentials).toBeUndefined();
    expect(init.headers['x-csrf-token']).toBeUndefined();
  });

  test('a 401 triggers one refresh and one retry of the original request', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: { id: 'u1' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { data: { token: 'fresh', refreshToken: 'r2' } }))
      .mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const out = await apiFetch('/api/users/profile');

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/users/refresh-token');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh');
    expect(session.accessToken).toBe('fresh');
  });

  test('the refreshed session keeps the existing user profile', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: { id: 'u1' } };
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).includes('/refresh-token')) {
        return res(200, { data: { token: 'fresh', refreshToken: 'r2' } });
      }
      return init?.headers?.Authorization === 'Bearer fresh' ? res(200) : res(401);
    }));

    await apiFetch('/api/users/profile');

    expect(session.user).toEqual({ id: 'u1' });
  });

  // The reason this module exists as its own unit. Four screens mounting at
  // once each hit 401; without single-flight each fires its own refresh, the
  // winner rotates the refresh token, and the other three are signed out
  // holding a session that was valid a millisecond ago. The server also
  // rate-limits this endpoint to 30/IP/15min (user.routes.js:46-51).
  test('concurrent 401s share ONE refresh call', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: {} };
    let refreshCalls = 0;

    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).includes('/refresh-token')) {
        refreshCalls += 1;
        return res(200, { data: { token: 'fresh', refreshToken: 'r2' } });
      }
      return init?.headers?.Authorization === 'Bearer fresh' ? res(200) : res(401);
    }));

    const results = await Promise.all([
      apiFetch('/api/a'),
      apiFetch('/api/b'),
      apiFetch('/api/c'),
      apiFetch('/api/d'),
    ]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(refreshCalls).toBe(1);
  });

  test('a failed refresh clears the session and notifies the app', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: {} };
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);

    vi.stubGlobal('fetch', vi.fn(async () => res(401)));

    const out = await apiFetch('/api/users/profile');

    expect(out.status).toBe(401);
    expect(session).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  test('a 401 with no refresh token does not attempt a refresh', async () => {
    session = { accessToken: 'a1', refreshToken: null, user: {} };
    const fetchMock = vi.fn(async () => res(401));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/users/profile');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('a refresh that returns 200 without a token is treated as failure', async () => {
    session = { accessToken: 'stale', refreshToken: 'r1', user: {} };
    vi.stubGlobal('fetch', vi.fn(async (url) =>
      String(url).includes('/refresh-token') ? res(200, { data: {} }) : res(401)
    ));

    const out = await apiFetch('/api/users/profile');

    expect(out.status).toBe(401);
    expect(session).toBeNull();
  });

  test('a non-401 error response is returned untouched, with no refresh', async () => {
    session = { accessToken: 'a1', refreshToken: 'r1', user: {} };
    const fetchMock = vi.fn(async () => res(500));
    vi.stubGlobal('fetch', fetchMock);

    const out = await apiFetch('/api/users/profile');

    expect(out.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
