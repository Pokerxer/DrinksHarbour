import { apiFetch } from './api-client.ts';
import { toUserMessage, type RegisterFormValues } from './auth-forms.ts';

export interface AuthUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  role: string;
  phoneNumber?: string;
  isEmailVerified?: boolean;
  isAgeVerified?: boolean;
  mfaEnabled?: boolean;
  loyaltyTier?: 'cork' | 'barrel' | 'cellar' | 'vault';
}

export type SessionResult =
  | { kind: 'session'; user: AuthUser; token: string; refreshToken: string | null }
  | { kind: 'mfa'; user: AuthUser; pendingMfaToken: string }
  | { kind: 'error'; message: string };

export type SimpleResult = { ok: true } | { ok: false; message: string };

interface Envelope {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * Every controller replies through successResponse(), which wraps the payload
 * as { success, message, data }. Errors come back with `message` at the top
 * level and no data.
 */
async function post(path: string, body: unknown): Promise<{ status: number | null; payload: Envelope }> {
  try {
    const response = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
    let payload: Envelope = {};
    try {
      payload = (await response.json()) as Envelope;
    } catch {
      payload = {};
    }
    return { status: response.status, payload };
  } catch {
    // fetch rejected — no response exists at all.
    return { status: null, payload: {} };
  }
}

function toSessionResult(status: number | null, payload: Envelope): SessionResult {
  if (status === null || status < 200 || status >= 300) {
    return { kind: 'error', message: toUserMessage(status, payload) };
  }

  const data = payload.data ?? {};
  const user = data.user as AuthUser | undefined;

  if (!user) {
    return { kind: 'error', message: toUserMessage(status, payload) };
  }

  if (data.mfaRequired && typeof data.pendingMfaToken === 'string') {
    return { kind: 'mfa', user, pendingMfaToken: data.pendingMfaToken };
  }

  if (typeof data.token === 'string') {
    return {
      kind: 'session',
      user,
      token: data.token,
      refreshToken: typeof data.refreshToken === 'string' ? data.refreshToken : null,
    };
  }

  return { kind: 'error', message: toUserMessage(status, payload) };
}

function toSimpleResult(status: number | null, payload: Envelope): SimpleResult {
  if (status !== null && status >= 200 && status < 300) return { ok: true };
  return { ok: false, message: toUserMessage(status, payload) };
}

export async function login(email: string, password: string): Promise<SessionResult> {
  const { status, payload } = await post('/api/users/login', { email, password });
  return toSessionResult(status, payload);
}

export async function verifyMfa(pendingMfaToken: string, code: string): Promise<SessionResult> {
  const { status, payload } = await post('/api/users/mfa/verify', { pendingMfaToken, code });
  return toSessionResult(status, payload);
}

export async function register(values: RegisterFormValues): Promise<SessionResult> {
  const body: Record<string, string> = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    password: values.password,
  };
  // Sending '' would fail the optional validators if they were ever repaired,
  // and stores an empty string on the user either way.
  if (values.phoneNumber.trim()) body.phoneNumber = values.phoneNumber.trim();
  if (values.dateOfBirth.trim()) body.dateOfBirth = values.dateOfBirth.trim();

  const { status, payload } = await post('/api/users/register', body);
  return toSessionResult(status, payload);
}

export async function requestPasswordReset(email: string): Promise<SimpleResult> {
  const { status, payload } = await post('/api/users/forgot-password', { email });
  return toSimpleResult(status, payload);
}

export async function resetPassword(token: string, newPassword: string): Promise<SimpleResult> {
  const { status, payload } = await post(
    `/api/users/reset-password/${encodeURIComponent(token)}`,
    { newPassword }
  );
  return toSimpleResult(status, payload);
}

export async function verifyEmail(email: string, code: string): Promise<SimpleResult> {
  const { status, payload } = await post('/api/users/verify-email', { email, code });
  return toSimpleResult(status, payload);
}

export async function resendVerification(email: string): Promise<SimpleResult> {
  const { status, payload } = await post('/api/users/resend-verification', { email });
  return toSimpleResult(status, payload);
}

export async function fetchProfile(): Promise<AuthUser | null> {
  try {
    const response = await apiFetch('/api/users/me');
    if (!response.ok) return null;
    const payload = (await response.json()) as Envelope;
    return (payload.data as unknown as AuthUser) ?? null;
  } catch {
    return null;
  }
}

/** Best-effort. A failed logout must never block clearing the local session. */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/users/logout', { method: 'POST' });
  } catch {
    // ignored on purpose
  }
}
