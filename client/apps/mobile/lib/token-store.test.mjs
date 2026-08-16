import { beforeEach, describe, expect, test, vi } from 'vitest';

const store = new Map();

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k, v) => void store.set(k, v)),
  getItemAsync: vi.fn(async (k) => (store.has(k) ? store.get(k) : null)),
  deleteItemAsync: vi.fn(async (k) => void store.delete(k)),
}));

const { saveSession, readSession, clearSession } = await import('./token-store.ts');

describe('token-store', () => {
  beforeEach(() => store.clear());

  test('a saved session reads back intact', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1', user: { id: 'u1' } });
    expect(await readSession()).toEqual({
      accessToken: 'a1',
      refreshToken: 'r1',
      user: { id: 'u1' },
    });
  });

  test('no stored session reads as null rather than throwing', async () => {
    expect(await readSession()).toBeNull();
  });

  test('a session without a refresh token is still valid', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: null, user: { id: 'u1' } });
    expect(await readSession()).toEqual({
      accessToken: 'a1',
      refreshToken: null,
      user: { id: 'u1' },
    });
  });

  test('clearSession removes every key, not just the access token', async () => {
    await saveSession({ accessToken: 'a1', refreshToken: 'r1', user: { id: 'u1' } });
    await clearSession();
    expect(store.size).toBe(0);
    expect(await readSession()).toBeNull();
  });

  // The case that matters in practice: a partial write or an OS-level keychain
  // migration leaves garbage behind, and a throw here would brick the app at
  // launch with no way for the user to recover.
  test('corrupt stored data reads as null instead of throwing', async () => {
    store.set('dh_session', '{not valid json');
    expect(await readSession()).toBeNull();
  });

  test('a stored entry with no access token is treated as no session', async () => {
    store.set('dh_session', JSON.stringify({ refreshToken: 'r1', user: { id: 'u1' } }));
    expect(await readSession()).toBeNull();
  });
});
