import { afterEach, expect, test, vi } from 'vitest';
import { apiKeyRequest, getKeyStatus } from './api-key.service';
afterEach(() => vi.unstubAllGlobals());
test('expired keys are distinguished from active and revoked keys', () => {
  const key = { expiresAt: '2026-01-01', revokedAt: null };
  expect(getKeyStatus(key, new Date('2026-02-01').getTime())).toBe('Expired');
  expect(getKeyStatus(key, new Date('2025-12-01').getTime())).toBe('Active');
  expect(getKeyStatus({ ...key, revokedAt: '2025-11-01' })).toBe('Revoked');
});
test('missing authentication never sends a request', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(apiKeyRequest('')).rejects.toThrow('Sign in');
  expect(fetcher).not.toHaveBeenCalled();
});
test('non-JSON API failures produce actionable feedback', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => {
        throw Error('HTML');
      },
    }))
  );
  await expect(apiKeyRequest('token')).rejects.toThrow(
    'Unable to manage API keys'
  );
});
test('requests use the signed-in authority and disable caching', async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { keys: [] } }),
  }));
  vi.stubGlobal('fetch', fetcher);
  await expect(apiKeyRequest('token')).resolves.toEqual({ keys: [] });
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/api/api-keys'),
    expect.objectContaining({
      cache: 'no-store',
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    })
  );
});

test('a successful response without key data is rejected before rendering', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) })));
  await expect(apiKeyRequest('token')).rejects.toThrow('Unable to manage API keys');
});
