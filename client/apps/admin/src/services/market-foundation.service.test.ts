import { afterEach, expect, test, vi } from 'vitest';
import { foundationRequest } from './market-foundation.service';
afterEach(() => vi.unstubAllGlobals());
test('market commands retain bearer identity and optimistic version without accepting success on conflict', async () => {
  const fetcher = vi.fn(async () => ({
    ok: false,
    json: async () => ({
      message: 'Market revision changed; reload before saving',
    }),
  }));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    foundationRequest('test-token', '/market-enrollments/id/review', 'POST', {
      expectedVersion: 2,
      status: 'rejected',
      reason: 'Reviewed synthetic application',
    })
  ).rejects.toThrow(/revision changed/);
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/api/market-enrollments/id/review'),
    expect.objectContaining({
      cache: 'no-store',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: expect.stringContaining('"expectedVersion":2'),
    })
  );
});
test('empty or incomplete operator response is not treated as a successful save', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }))
  );
  await expect(foundationRequest('token', '/sales-channels')).rejects.toThrow(
    /incomplete/
  );
});
