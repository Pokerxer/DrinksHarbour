import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAdminUser } from './adminUser.service';

/**
 * POST /api/users is the only way to create an admin now that /signup is gone.
 * It is `protect` + `authorize('super_admin')`, so the caller's access token
 * must travel with the request, and its validation messages are the ones the
 * operator needs to see (duplicate email, weak password, missing tenant).
 */

const INPUT = {
  firstName: 'Ada',
  lastName: 'Okoye',
  email: 'ada@drinksharbour.com',
  password: 'Str0ng!Pass',
  role: 'admin' as const,
};

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

describe('createAdminUser', () => {
  test('posts the new user authenticated as the acting admin', async () => {
    const fetchMock = stubFetch({
      ok: true,
      body: { success: true, data: { user: { _id: 'u2', ...INPUT } } },
    });

    const result = await createAdminUser(INPUT, 'access-token');

    expect(result.success).toBe(true);
    expect(result.user?._id).toBe('u2');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toContain('/api/users');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer access-token');
    expect(JSON.parse(init.body)).toEqual(INPUT);
  });

  test('sends a tenant when the role is tenant-scoped', async () => {
    // The service rejects tenant_admin/owner/staff without a tenant to scope
    // them to, so the field must survive the trip.
    const fetchMock = stubFetch({
      ok: true,
      body: { success: true, data: { user: { _id: 'u3' } } },
    });

    await createAdminUser(
      { ...INPUT, role: 'tenant_admin', tenant: 'tenant-id-1' },
      'access-token'
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect((JSON.parse(init.body) as { tenant?: string }).tenant).toBe(
      'tenant-id-1'
    );
  });

  test('omits an empty tenant rather than sending a blank id', async () => {
    const fetchMock = stubFetch({
      ok: true,
      body: { success: true, data: { user: { _id: 'u4' } } },
    });

    await createAdminUser({ ...INPUT, tenant: '' }, 'access-token');

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(init.body)).not.toHaveProperty('tenant');
  });

  test('surfaces the backend message when the request is rejected', async () => {
    stubFetch({
      ok: false,
      body: { success: false, message: 'User with this email already exists' },
    });

    const result = await createAdminUser(INPUT, 'access-token');

    expect(result.success).toBe(false);
    expect(result.message).toBe('User with this email already exists');
  });

  test('reports a failure rather than throwing when the network is down', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    const result = await createAdminUser(INPUT, 'access-token');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unable to reach|network/i);
  });

  test('refuses to call the API without an access token', async () => {
    const fetchMock = stubFetch({ ok: true, body: { success: true } });

    const result = await createAdminUser(INPUT, undefined);

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createAdminUser MFA step-up', () => {
  test('sends the mfa-verified token when the session holds one', async () => {
    // POST /api/users sits behind requireMfa, which wants proof of a recent
    // MFA challenge as an x-mfa-token header.
    const fetchMock = stubFetch({
      ok: true,
      body: { success: true, data: { user: { _id: 'u5' } } },
    });

    await createAdminUser(INPUT, 'access-token', 'mfa-token');

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers['x-mfa-token']).toBe('mfa-token');
  });

  test('omits the header entirely when there is no mfa token', async () => {
    const fetchMock = stubFetch({
      ok: true,
      body: { success: true, data: { user: { _id: 'u6' } } },
    });

    await createAdminUser(INPUT, 'access-token');

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers).not.toHaveProperty('x-mfa-token');
  });

  test.each([
    'MFA verification required. Please complete MFA verification to access this resource.',
    'Invalid or expired MFA verification. Please re-verify.',
  ])('flags a %s response as re-provable', async (message) => {
    stubFetch({ ok: false, body: { success: false, message } });

    const result = await createAdminUser(INPUT, 'access-token');

    expect(result.success).toBe(false);
    expect(result.mfaRequired).toBe(true);
  });

  test('does not mistake an ordinary rejection for an MFA challenge', async () => {
    stubFetch({
      ok: false,
      body: { success: false, message: 'User with this email already exists' },
    });

    const result = await createAdminUser(INPUT, 'access-token');

    expect(result.mfaRequired).toBeFalsy();
  });
});
