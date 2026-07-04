'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { API_URL } from '@/lib/api';
import { setAuthTokens, logoutServer } from '@/lib/fetchWithAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  _id: string;
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string;
  role: string;
  isEmailVerified: boolean;
  isAgeVerified: boolean;
  phoneNumber?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  mfaEnabled?: boolean;
  loyaltyTier?: 'cork' | 'barrel' | 'cellar' | 'vault';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  mfaToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface LoginResult {
  success: boolean;
  error?: string;
  requiresEmailVerification?: boolean;
  mfaRequired?: boolean;
  pendingMfaToken?: string;
}

interface RegisterResult {
  success: boolean;
  error?: string;
  requiresEmailVerification?: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
  register: (data: RegisterPayload) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  updateUser: (updates: Partial<AuthUser>) => void;
  loadProfile: () => Promise<void>;
  completeMfaLogin: (pendingMfaToken: string, code: string, rememberMe?: boolean) => Promise<LoginResult>;
  setMfaToken: (token: string | null) => void;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  agreeTerms: boolean;
  agreeAge: boolean;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const KEYS = {
  token:        'dh_token',
  refreshToken: 'dh_refresh_token',
  user:         'dh_user',
  rememberMe:   'dh_remember_me',
  mfaToken:     'dh_mfa_token',
};

function saveSession(token: string, refreshToken: string, user: AuthUser, rememberMe: boolean) {
  const store = rememberMe ? localStorage : sessionStorage;
  store.setItem(KEYS.token, token);
  store.setItem(KEYS.refreshToken, refreshToken);
  store.setItem(KEYS.user, JSON.stringify(user));
  if (rememberMe) localStorage.setItem(KEYS.rememberMe, '1');
}

function clearSession() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(KEYS.token);
    s.removeItem(KEYS.refreshToken);
    s.removeItem(KEYS.user);
  });
  localStorage.removeItem(KEYS.rememberMe);
}

function readSession(): { token: string | null; refreshToken: string | null; user: AuthUser | null } {
  if (typeof window === 'undefined') return { token: null, refreshToken: null, user: null };

  // Check sessionStorage first, then localStorage
  const token =
    sessionStorage.getItem(KEYS.token) ||
    localStorage.getItem(KEYS.token) ||
    null;

  const refreshToken =
    sessionStorage.getItem(KEYS.refreshToken) ||
    localStorage.getItem(KEYS.refreshToken) ||
    null;

  let user: AuthUser | null = null;
  try {
    const raw =
      sessionStorage.getItem(KEYS.user) ||
      localStorage.getItem(KEYS.user) ||
      null;
    if (raw) user = JSON.parse(raw);
  } catch {
    user = null;
  }

  return { token, refreshToken, user };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user:            null,
    token:           null,
    refreshToken:    null,
    mfaToken:        null,
    isLoading:       true,
    isAuthenticated: false,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Schedule auto-refresh 60 s before a 7-day token expires ───────────────
  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;                   // ms
      const delay = Math.max(expiresAt - Date.now() - 60_000, 5_000);
      refreshTimerRef.current = setTimeout(() => refreshAuth(), delay);
    } catch { /* non-JWT token — skip */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hydrate from cookies (primary) or legacy localStorage (fallback) ──────
  // In the cookie model, we don't have the raw token in JS — we just check
  // if there's an active session by calling /api/users/me with credentials: include.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // 1. Try cookie-based session (the future state)
      try {
        const res = await fetch(`${API_URL}/api/users/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.data?.user || data.user || data.data;
          if (u && !cancelled) {
            // Store the user profile in localStorage for instant hydration on next load
            try { localStorage.setItem(KEYS.user, JSON.stringify(u)); } catch {}
            setState((s) => ({
              ...s,
              user: u as AuthUser,
              token: 'cookie', // sentinel — tokens are in httpOnly cookies, not JS
              refreshToken: 'cookie',
              isAuthenticated: true,
              isLoading: false,
            }));
            return;
          }
        }
      } catch { /* network — fall through to legacy */ }

      // 2. Fall back to legacy localStorage tokens (backwards compat)
      const { token, refreshToken, user } = readSession();
      setAuthTokens(token, refreshToken);
      if (token && user && !cancelled) {
        setState((s) => ({
          ...s,
          user,
          token,
          refreshToken,
          mfaToken: null,
          isAuthenticated: true,
          isLoading: false,
        }));
        scheduleRefresh(token);
      } else if (!cancelled) {
        setState((s) => ({ ...s, isLoading: false }));
      }
    }

    hydrate();
    return () => { cancelled = true; if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [scheduleRefresh]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<LoginResult> => {
    try {
      const res = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // send + receive httpOnly auth cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 403 usually means email not verified
        if (res.status === 403 || data.message?.toLowerCase().includes('verif')) {
          return { success: false, error: data.message, requiresEmailVerification: true };
        }
        return { success: false, error: data.message || 'Login failed' };
      }

      // ── MFA challenge: backend returns mfaRequired + pendingMfaToken ────────
      if (data.mfaRequired || data.data?.mfaRequired) {
        return {
          success: false,
          mfaRequired: true,
          pendingMfaToken: data.pendingMfaToken ?? data.data?.pendingMfaToken,
          error: data.message || 'MFA verification required.',
        };
      }

      const token        = data.token        ?? data.data?.token;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken ?? '';
      const user: AuthUser = data.user ?? data.data?.user;

      if (!user) return { success: false, error: 'Invalid response from server' };

      // In cookie mode, the backend sets httpOnly cookies — we don't store the
      // raw token in localStorage. In legacy mode (no cookies), fall back to storage.
      if (token) {
        const hasCookies = typeof document !== 'undefined' && /(?:^|;\s*)dh_access=/.test(document.cookie);
        if (!hasCookies) {
          saveSession(token, refreshToken, user, rememberMe);
          setAuthTokens(token, refreshToken);
          scheduleRefresh(token);
        } else {
          setAuthTokens(null, null); // cookie mode — don't use Bearer header
        }
      }

      // Store user profile for instant hydration on next page load
      try { localStorage.setItem(KEYS.user, JSON.stringify(user)); } catch {}

      setState((s) => ({
        ...s,
        user,
        token: token || 'cookie',
        refreshToken: refreshToken || 'cookie',
        mfaToken: s.mfaToken,
        isLoading: false,
        isAuthenticated: true,
      }));

      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }, [scheduleRefresh]);

  // ── Register ───────────────────────────────────────────────────────────────
  const register = useCallback(async (payload: RegisterPayload): Promise<RegisterResult> => {
    try {
      const res = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // receive httpOnly auth cookies
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || 'Registration failed' };
      }

      const token        = data.token        ?? data.data?.token;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken ?? '';
      const user: AuthUser | undefined = data.user ?? data.data?.user;

      if (token && user) {
        const hasCookies = typeof document !== 'undefined' && /(?:^|;\s*)dh_access=/.test(document.cookie);
        if (!hasCookies) {
          saveSession(token, refreshToken, user, false);
          setAuthTokens(token, refreshToken);
          scheduleRefresh(token);
        } else {
          setAuthTokens(null, null);
        }
        try { localStorage.setItem(KEYS.user, JSON.stringify(user)); } catch {}
        setState((s) => ({ ...s, user, token: token || 'cookie', refreshToken: refreshToken || 'cookie', isLoading: false, isAuthenticated: true }));
        return {
          success: true,
          requiresEmailVerification: !user.isEmailVerified,
        };
      }

      // No token — email verification required before first login
      return { success: true, requiresEmailVerification: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }, [scheduleRefresh]);

  // ── Logout (canonical: revokes refresh token server-side, then clears local) ─
  const logout = useCallback(async (): Promise<void> => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await logoutServer();
    setAuthTokens(null, null);
    [localStorage, sessionStorage].forEach((s) => s.removeItem(KEYS.mfaToken));
    setState({ user: null, token: null, refreshToken: null, mfaToken: null, isLoading: false, isAuthenticated: false });
  }, []);

  // ── Complete MFA login (second half of the MFA flow) ───────────────────────
  const completeMfaLogin = useCallback(async (
    pendingMfaToken: string,
    code: string,
    rememberMe = false,
  ): Promise<LoginResult> => {
    try {
      const res = await fetch(`${API_URL}/api/users/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // receive httpOnly auth cookies
        body: JSON.stringify({ pendingMfaToken, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'MFA verification failed' };
      }
      const token        = data.token        ?? data.data?.token;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken ?? '';
      const user: AuthUser = data.user ?? data.data?.user;
      if (!user) return { success: false, error: 'Invalid response from server' };

      // Cookie mode: backend sets cookies. Legacy mode: store in localStorage.
      if (token) {
        const hasCookies = typeof document !== 'undefined' && /(?:^|;\s*)dh_access=/.test(document.cookie);
        if (!hasCookies) {
          saveSession(token, refreshToken, user, rememberMe);
          setAuthTokens(token, refreshToken);
          scheduleRefresh(token);
        } else {
          setAuthTokens(null, null);
        }
      }
      try { localStorage.setItem(KEYS.user, JSON.stringify(user)); } catch {}
      setState((s) => ({ ...s, user, token: token || 'cookie', refreshToken: refreshToken || 'cookie', mfaToken: s.mfaToken, isLoading: false, isAuthenticated: true }));
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }, [scheduleRefresh]);

  // ── Set/clear the MFA-verified token (used by admin API calls via x-mfa-token) ──
  const setMfaToken = useCallback((token: string | null) => {
    setState((s) => {
      const rememberMe = !!localStorage.getItem(KEYS.rememberMe);
      const store = rememberMe ? localStorage : sessionStorage;
      if (token) store.setItem(KEYS.mfaToken, token);
      else store.removeItem(KEYS.mfaToken);
      return { ...s, mfaToken: token };
    });
  }, []);

  // ── Token refresh ──────────────────────────────────────────────────────────
  // In cookie mode, the refresh token is in the dh_refresh cookie — just POST
  // with credentials: 'include' and the backend rotates the cookies.
  // In legacy mode, send the refresh token in the body.
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const hasCookies = typeof document !== 'undefined' && /(?:^|;\s*)dh_refresh=/.test(document.cookie);
    const { refreshToken } = readSession();

    if (!hasCookies && !refreshToken) { logout(); return false; }

    try {
      const res = await fetch(`${API_URL}/api/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...(hasCookies ? {} : { body: JSON.stringify({ refreshToken }) }),
      });

      const data = await res.json();
      if (!res.ok) { logout(); return false; }

      const newToken        = data.token        ?? data.data?.token;
      const newRefreshToken = data.refreshToken ?? data.data?.refreshToken ?? refreshToken;
      const user: AuthUser  = data.user         ?? data.data?.user ?? state.user;

      if (!newToken && !hasCookies) { logout(); return false; }

      // In legacy mode, persist rotated tokens. In cookie mode, cookies are already set.
      if (newToken && !hasCookies) {
        const rememberMe = !!localStorage.getItem(KEYS.rememberMe);
        saveSession(newToken, newRefreshToken, user, rememberMe);
        setAuthTokens(newToken, newRefreshToken);
        scheduleRefresh(newToken);
      }

      setState((s) => ({ ...s, token: newToken || 'cookie', refreshToken: newRefreshToken || 'cookie', user }));
      return true;
    } catch {
      logout();
      return false;
    }
  }, [logout, scheduleRefresh, state.user]);

  // ── Update user (e.g. after profile edit) ─────────────────────────────────
  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setState((s) => {
      if (!s.user) return s;
      const updated = { ...s.user, ...updates };
      const rememberMe = !!localStorage.getItem(KEYS.rememberMe);
      const store = rememberMe ? localStorage : sessionStorage;
      store.setItem(KEYS.user, JSON.stringify(updated));
      return { ...s, user: updated };
    });
  }, []);

  // ── Load fresh profile from /api/users/me ──────────────────────────────────
  // Uses credentials: 'include' (cookie mode) with Bearer header fallback (legacy).
  const loadProfile = useCallback(async (): Promise<void> => {
    const { token } = readSession();
    const hasCookies = typeof document !== 'undefined' && /(?:^|;\s*)dh_access=/.test(document.cookie);
    if (!token && !hasCookies && !state.isAuthenticated) return;
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        credentials: 'include',
        ...(hasCookies ? {} : { headers: { Authorization: `Bearer ${token}` } }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const u = data.data?.user || data.user || data.data;
      if (u) {
        try { localStorage.setItem(KEYS.user, JSON.stringify(u)); } catch {}
        setState((s) => ({ ...s, user: { ...s.user, ...u } as AuthUser }));
      }
    } catch { /* network — keep cached user */ }
  }, [state.isAuthenticated]);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    refreshAuth,
    updateUser,
    loadProfile,
    completeMfaLogin,
    setMfaToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
