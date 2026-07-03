// Authenticated fetch wrapper for the httpOnly-cookie auth model.
//
// Tokens (access + refresh) are stored in httpOnly cookies set by the backend
// and are automatically sent with credentials: 'include'. This wrapper:
//  1. Adds credentials: 'include' to every request
//  2. Injects the CSRF double-submit token (read from the dh_csrf cookie)
//     as the x-csrf-token header on mutation requests
//  3. On 401 → tries one silent refresh → retries the original request
//  4. On refresh failure → redirects to /login?reason=expired
//
// The old localStorage token storage is kept as a BACKWARDS COMPAT fallback
// so the migration is gradual — if cookies aren't present, the wrapper falls
// back to the Bearer header from localStorage. Once all sessions have rotated
// to cookies, the fallback can be removed.

import { API_URL } from './api';

// ─── Legacy localStorage keys (backwards-compat fallback) ─────────────────────
const LEGACY_ACCESS_KEY  = 'dh_token';
const LEGACY_REFRESH_KEY = 'dh_refresh_token';
const LEGACY_REMEMBER_KEY = 'dh_remember_me';
const LEGACY_MFA_KEY     = 'dh_mfa_token';

// Module-level token cache for the legacy fallback path.
// In the cookie model these stay null (cookies handle everything).
let _accessToken: string | null = null;
let _refreshToken: string | null = null;

export function setAuthTokens(accessToken: string | null, refreshToken: string | null) {
  _accessToken = accessToken;
  _refreshToken = refreshToken;
}

function readLegacyTokens(): { accessToken: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null };
  const accessToken =
    sessionStorage.getItem(LEGACY_ACCESS_KEY) || localStorage.getItem(LEGACY_ACCESS_KEY) || null;
  const refreshToken =
    sessionStorage.getItem(LEGACY_REFRESH_KEY) || localStorage.getItem(LEGACY_REFRESH_KEY) || null;
  return { accessToken, refreshToken };
}

function clearLegacyTokens() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(LEGACY_ACCESS_KEY);
    s.removeItem(LEGACY_REFRESH_KEY);
    s.removeItem('dh_user');
    s.removeItem(LEGACY_MFA_KEY);
  });
  localStorage.removeItem(LEGACY_REMEMBER_KEY);
}

/**
 * Read the CSRF token from the dh_csrf cookie (set by the backend, NOT httpOnly).
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)dh_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Check if we're in cookie mode (dh_access cookie is present).
 */
function hasAccessCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return /(?:^|;\s*)dh_access=/.test(document.cookie);
}

// Attempt a single token refresh via the cookie-based refresh endpoint.
// Returns true on success (cookies are rotated by the backend), false on failure.
async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // send + receive the dh_refresh cookie
    });
    if (!res.ok) {
      // Try legacy refresh if cookie refresh failed
      return tryLegacyRefresh();
    }
    return true;
  } catch {
    return tryLegacyRefresh();
  }
}

// Legacy refresh (for sessions that still use localStorage tokens)
async function tryLegacyRefresh(): Promise<boolean> {
  const refreshToken = _refreshToken ?? readLegacyTokens().refreshToken;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const token = data.token ?? data.data?.token;
    const newRefresh = data.refreshToken ?? data.data?.refreshToken ?? refreshToken;
    if (!token) return false;
    const rememberMe = !!localStorage.getItem(LEGACY_REMEMBER_KEY);
    const store = rememberMe ? localStorage : sessionStorage;
    store.setItem(LEGACY_ACCESS_KEY, token);
    store.setItem(LEGACY_REFRESH_KEY, newRefresh);
    setAuthTokens(token, newRefresh);
    return true;
  } catch {
    return false;
  }
}

export interface FetchWithAuthOptions extends RequestInit {
  skipAuthRefresh?: boolean;
  skipAuthHeader?: boolean;
}

export async function fetchWithAuth(
  url: string,
  options: FetchWithAuthOptions = {}
): Promise<Response> {
  const { skipAuthRefresh, skipAuthHeader, ...rest } = options;

  // Lazily hydrate legacy tokens if not in cookie mode
  const cookieMode = hasAccessCookie();
  if (!cookieMode && !_accessToken && typeof window !== 'undefined') {
    const { accessToken, refreshToken } = readLegacyTokens();
    setAuthTokens(accessToken, refreshToken);
  }

  const headers = new Headers(rest.headers || {});

  // In legacy mode, inject the Bearer header (cookie mode relies on cookies alone)
  if (!cookieMode && !skipAuthHeader && _accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
  }

  // Inject the CSRF double-submit token on mutation requests
  // (the backend middleware only checks POST/PUT/PATCH/DELETE, but sending it
  // on all requests is harmless and simpler)
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers.set('x-csrf-token', csrfToken);
  }

  // Inject the MFA-verified token (legacy mode only — cookie mode uses the dh_mfa cookie)
  if (!cookieMode && !skipAuthHeader && typeof window !== 'undefined') {
    const mfaToken = sessionStorage.getItem(LEGACY_MFA_KEY) || localStorage.getItem(LEGACY_MFA_KEY);
    if (mfaToken) {
      headers.set('x-mfa-token', mfaToken);
    }
  }

  if (!headers.has('Content-Type') && rest.body && typeof rest.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Always include credentials so cookies are sent + received
  let res = await fetch(url, { ...rest, headers, credentials: 'include' });

  // 401 → try one refresh, then retry the original request
  if (res.status === 401 && !skipAuthRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // In cookie mode, the new cookies are already set — just retry.
      // In legacy mode, update the Bearer header with the new token.
      if (!cookieMode && _accessToken) {
        headers.set('Authorization', `Bearer ${_accessToken}`);
      }
      res = await fetch(url, { ...rest, headers, credentials: 'include' });
    } else {
      // Refresh failed — clear session and redirect to login
      clearLegacyTokens();
      setAuthTokens(null, null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?redirect=${redirect}&reason=expired`;
      }
    }
  }

  // 403 with MFA message → the admin's mfa-verified token expired
  if (res.status === 403 && !skipAuthRefresh && typeof window !== 'undefined') {
    const cloned = res.clone();
    try {
      const data = await cloned.json();
      if (data.message?.toLowerCase().includes('mfa')) {
        [localStorage, sessionStorage].forEach((s) => s.removeItem(LEGACY_MFA_KEY));
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?reason=mfa_expired';
        }
      }
    } catch { /* not JSON — ignore */ }
  }

  return res;
}

// Canonical logout: revokes the refresh token server-side, then clears local state.
// In cookie mode, the backend clears the cookies; in legacy mode, we clear localStorage.
export async function logoutServer(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/users/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // In legacy mode, also send the Bearer header + refresh token in body
      ...(!_accessToken ? {} : {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
        body: JSON.stringify({ refreshToken: _refreshToken ?? readLegacyTokens().refreshToken }),
      }),
    });
  } catch {
    // Network failure — still clear locally
  } finally {
    clearLegacyTokens();
    setAuthTokens(null, null);
  }
}