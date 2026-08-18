import { getApiBaseUrl } from 'commerce-core';
import { clearSession, readSession, saveSession } from './token-store.ts';

let refreshInFlight: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/** Test-only. Clears the module-level single-flight state between cases. */
export function __resetRefreshState(): void {
  refreshInFlight = null;
}

function buildHeaders(init: RequestInit | undefined, token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Refresh the access token.
 *
 * Concurrent callers share one in-flight request. Without that, four screens
 * mounting at once each hit 401 and each fires its own refresh; the winner
 * rotates the refresh token and the losers are signed out holding a session
 * that was valid moments earlier. The endpoint is also rate-limited to 30
 * requests per IP per 15 minutes (server/routes/user.routes.js:46-51).
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const payload = await response.json();
      const token: string | undefined = payload?.data?.token;
      if (!token) return null;

      const existing = await readSession();
      await saveSession({
        accessToken: token,
        refreshToken: payload?.data?.refreshToken ?? refreshToken,
        user: existing?.user ?? null,
      });

      return token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Authenticated fetch against the Express backend.
 *
 * Bearer-only by design: auth.middleware.js:16 reads the Authorization header
 * first ("mobile apps, API clients"), and csrf.middleware.js:88 waives CSRF for
 * Bearer-authenticated requests. Cookies are never sent and no CSRF token is
 * ever attached.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await readSession();
  const url = `${getApiBaseUrl()}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: buildHeaders(init, session?.accessToken ?? null),
  });

  if (response.status !== 401 || !session) {
    return response;
  }

  // No refresh token means the session cannot be recovered. Ending it is the
  // honest outcome — returning the 401 raw leaves a signed-in UI making
  // requests that will never succeed.
  if (!session.refreshToken) {
    await clearSession();
    onSessionExpired?.();
    return response;
  }

  const freshToken = await refreshAccessToken(session.refreshToken);

  if (!freshToken) {
    await clearSession();
    onSessionExpired?.();
    return response;
  }

  return fetch(url, {
    ...init,
    headers: buildHeaders(init, freshToken),
  });
}
