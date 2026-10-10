import { afterEach, expect, it, vi } from 'vitest';
import { notificationRequest } from './notification.service';
afterEach(() => vi.unstubAllGlobals());
it('requires signed-in authority and uses no-store, never a client tenant header', async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { notifications: [], total: 0, unreadCount: 0, page: 1, limit: 20 },
    }),
  }));
  vi.stubGlobal('fetch', fetcher);
  await expect(notificationRequest('')).rejects.toThrow('Sign in');
  expect(fetcher).not.toHaveBeenCalled();
  await notificationRequest('token');
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/api/notifications'),
    expect.objectContaining({
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
    })
  );
});
it('non-JSON and malformed successful responses fail with usable feedback', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => {
        throw Error('HTML');
      },
    }))
  );
  await expect(notificationRequest('token')).rejects.toThrow(
    'Unable to load notifications'
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: {} }),
    }))
  );
  await expect(notificationRequest('token')).rejects.toThrow(
    'Invalid notification response'
  );
});
it('propagates cancellation and validates mutation responses', async () => {
  const controller = new AbortController();
  const fetcher = vi.fn(async () => {
    throw new DOMException('Aborted', 'AbortError');
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(
    notificationRequest('token', '', { signal: controller.signal })
  ).rejects.toMatchObject({ name: 'AbortError' });
});
