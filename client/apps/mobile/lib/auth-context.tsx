import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authApi from './auth-api.ts';
import type { AuthUser, SessionResult } from './auth-api.ts';
import type { RegisterFormValues } from './auth-forms.ts';
import { authenticate, readCapability, shouldPrompt } from './biometric-gate.ts';
import { clearSession, readSession, saveSession } from './token-store.ts';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  biometricEnabled: boolean;
  login: (email: string, password: string) => Promise<SessionResult>;
  completeMfaLogin: (pendingMfaToken: string, code: string) => Promise<SessionResult>;
  register: (values: RegisterFormValues) => Promise<SessionResult>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Cold start ────────────────────────────────────────────────────────────
  // Read the stored session, then gate it on biometrics if the user asked for
  // that. Every biometric failure path clears and lands on password login,
  // which always works — design §4 requires biometrics never lock anyone out.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await readSession();

      if (!session) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const optedIn = session.biometricEnabled === true;

      if (shouldPrompt(await readCapability(), optedIn)) {
        const unlocked = await authenticate();
        if (!unlocked) {
          await clearSession();
          if (!cancelled) setIsLoading(false);
          return;
        }
      }

      if (!cancelled) {
        setUser((session.user as AuthUser) ?? null);
        setBiometricEnabledState(optedIn);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (result: Extract<SessionResult, { kind: 'session' }>, keepBiometric: boolean) => {
      await saveSession({
        accessToken: result.token,
        refreshToken: result.refreshToken,
        user: result.user,
        biometricEnabled: keepBiometric,
      });
      setUser(result.user);
      setBiometricEnabledState(keepBiometric);
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      // An MFA challenge is deliberately NOT persisted. pendingMfaToken is a
      // 5-minute JWT and not a session; storing it would survive a kill and
      // outlive its own validity.
      if (result.kind === 'session') await persist(result, biometricEnabled);
      return result;
    },
    [persist, biometricEnabled]
  );

  const completeMfaLogin = useCallback(
    async (pendingMfaToken: string, code: string) => {
      const result = await authApi.verifyMfa(pendingMfaToken, code);
      if (result.kind === 'session') await persist(result, biometricEnabled);
      return result;
    },
    [persist, biometricEnabled]
  );

  const register = useCallback(
    async (values: RegisterFormValues) => {
      const result = await authApi.register(values);
      if (result.kind === 'session') await persist(result, false);
      return result;
    },
    [persist]
  );

  const signOut = useCallback(async () => {
    await authApi.logout();
    await clearSession();
    setUser(null);
    setBiometricEnabledState(false);
  }, []);

  const loadProfile = useCallback(async () => {
    const fresh = await authApi.fetchProfile();
    if (!fresh) return;
    setUser(fresh);
    const session = await readSession();
    if (session) await saveSession({ ...session, user: fresh });
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    const session = await readSession();
    if (!session) return;
    await saveSession({ ...session, biometricEnabled: enabled });
    setBiometricEnabledState(enabled);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      biometricEnabled,
      login,
      completeMfaLogin,
      register,
      signOut,
      loadProfile,
      updateUser,
      setBiometricEnabled,
    }),
    [
      user,
      isLoading,
      biometricEnabled,
      login,
      completeMfaLogin,
      register,
      signOut,
      loadProfile,
      updateUser,
      setBiometricEnabled,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
