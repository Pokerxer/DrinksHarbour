import { afterEach, describe, expect, test, vi } from 'vitest';

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => undefined),
}));
vi.mock('next-auth/react', () => ({ signOut: signOutMock }));

// eslint-disable-next-line import/first -- vi.mock is hoisted above this import
import { signOutAndRevoke } from './sign-out';

function stubFetch(behaviour: 'ok' | 'error') {
  const fetchMock = vi.fn(async () => {
    if (behaviour === 'error') throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => ({ success: true }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  signOutMock.mockClear();
});

describe('signOutAndRevoke', () => {
  test('revokes the backend session before dropping the local one', async () => {
    const fetchMock = stubFetch('ok');

    await signOutAndRevoke();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      '/api/auth/revoke'
    );
    expect(signOutMock).toHaveBeenCalledOnce();
  });

  test('still signs out locally when revocation fails', async () => {
    // Leaving the user apparently signed in because the network hiccuped is
    // worse than a refresh token that lives out its natural expiry.
    stubFetch('error');

    await signOutAndRevoke();

    expect(signOutMock).toHaveBeenCalledOnce();
  });
});
