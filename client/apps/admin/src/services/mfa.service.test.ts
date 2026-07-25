import { afterEach, describe, expect, test, vi } from 'vitest';
import { stepUpMfa } from './mfa.service';

/**
 * The mfa-verified token lasts 10 minutes — it attests to a recent challenge,
 * not to the session. Step-up is how a signed-in admin re-proves when a
 * privileged action outlives that window.
 */
function stubFetch(
  response: { ok: boolean; body: Record<string, unknown> } | Error
) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return { ok: response.ok, json: async () => response.body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stepUpMfa', () => {
  test('exchanges a code for a fresh mfa-verified token', async () => {
    const fetchMock = stubFetch({
      ok: true,
      body: { success: true, data: { mfaToken: 'fresh-mfa-token' } },
    });

    const result = await stepUpMfa('123456', 'access-token');

    expect(result.success).toBe(true);
    expect(result.mfaToken).toBe('fresh-mfa-token');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toContain('/api/users/mfa/step-up');
    expect(init.headers.Authorization).toBe('Bearer access-token');
    // The endpoint verifies against the authenticated user; only the code travels.
    expect(JSON.parse(init.body)).toEqual({ code: '123456' });
  });

  test('surfaces a rejected code', async () => {
    stubFetch({
      ok: false,
      body: { success: false, message: 'Invalid MFA code. Please try again.' },
    });

    const result = await stepUpMfa('000000', 'access-token');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/invalid mfa code/i);
  });

  test('reports a failure rather than throwing when the network is down', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await expect(stepUpMfa('123456', 'access-token')).resolves.toMatchObject({
      success: false,
    });
  });

  test('refuses to call the API without an access token', async () => {
    const fetchMock = stubFetch({ ok: true, body: { success: true } });

    const result = await stepUpMfa('123456', undefined);

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
