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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  _id: string;
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
  isAgeVerified: boolean;
  phoneNumber?: string;
  avatar?: string;
  dateOfBirth?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface LoginResult {
  success: boolean;
  error?: string;
  requiresEmailVerification?: boolean;
}

interface RegisterResult {
  success: boolean;
  error?: string;
  requiresEmailVerification?: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
  register: (data: RegisterPayload) => Promise<RegisterResult>;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
  updateUser: (updates: Partial<AuthUser>) => void;
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

  // ── Hydrate from storage on mount ─────────────────────────────────────────
  useEffect(() => {
    const { token, refreshToken, user } = readSession();
    if (token && user) {
      setState({ user, token, refreshToken, isLoading: false, isAuthenticated: true });
      scheduleRefresh(token);
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
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

      const token        = data.token        ?? data.data?.token;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken ?? '';
      const user: AuthUser = data.user ?? data.data?.user;

      if (!token || !user) return { success: false, error: 'Invalid response from server' };

      saveSession(token, refreshToken, user, rememberMe);
      setState({ user, token, refreshToken, isLoading: false, isAuthenticated: true });
      scheduleRefresh(token);

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
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || 'Registration failed' };
      }

      // Some flows return a token immediately; others require email verification first
      const token        = data.token        ?? data.data?.token;
      const refreshToken = data.refreshToken ?? data.data?.refreshToken ?? '';
      const user: AuthUser | undefined = data.user ?? data.data?.user;

      if (token && user) {
        saveSession(token, refreshToken, user, false);
        setState({ user, token, refreshToken, isLoading: false, isAuthenticated: true });
        scheduleRefresh(token);
        // Registration succeeded and returned a session — but email may still need verification
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

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    clearSession();
    setState({ user: null, token: null, refreshToken: null, isLoading: false, isAuthenticated: false });
  }, []);

  // ── Token refresh ──────────────────────────────────────────────────────────
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const { refreshToken } = readSession();
    if (!refreshToken) { logout(); return false; }

    try {
      const res = await fetch(`${API_URL}/api/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json();
      if (!res.ok) { logout(); return false; }

      const newToken        = data.token        ?? data.data?.token;
      const newRefreshToken = data.refreshToken ?? data.data?.refreshToken ?? refreshToken;
      const user: AuthUser  = data.user         ?? data.data?.user ?? state.user;

      if (!newToken) { logout(); return false; }

      const rememberMe = !!localStorage.getItem(KEYS.rememberMe);
      saveSession(newToken, newRefreshToken, user, rememberMe);
      setState((s) => ({ ...s, token: newToken, refreshToken: newRefreshToken, user }));
      scheduleRefresh(newToken);
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

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    refreshAuth,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
