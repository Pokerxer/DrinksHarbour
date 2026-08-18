import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'dh_session';

export interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  user: unknown;
  /**
   * Whether the user asked for a biometric lock. It lives in the blob rather
   * than its own keychain entry so it stays atomic with the tokens it guards.
   */
  biometricEnabled?: boolean;
}

/**
 * The whole session is one keychain entry rather than three. It keeps the
 * access and refresh tokens atomically consistent — separate entries can be
 * left half-updated by a crash mid-write, which is how you end up with a fresh
 * access token paired with a rotated-away refresh token.
 */
export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function readSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    // Corrupt entry — treat as signed out rather than crashing at launch.
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
