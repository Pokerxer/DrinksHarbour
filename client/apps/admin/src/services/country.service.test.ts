import { afterEach, expect, test, vi } from 'vitest';
import * as country from './country.service';
afterEach(() => vi.unstubAllGlobals());
test('country management rejects stale-version errors without claiming success', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: 'Country changed; reload before saving' }),
    }))
  );
  await expect(
    country.countryRequest('token', '/GB/activation', 'POST', {
      expectedVersion: 2,
      active: true,
      reason: 'Reviewed references',
    })
  ).rejects.toThrow('Country changed; reload before saving');
});
test('country management sends bearer authority expected version and private no-store reads', async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { code: 'GB', version: 3 } }),
  }));
  vi.stubGlobal('fetch', fetcher);
  const result = await country.countryRequest<{
    code: string;
    version: number;
  }>('token', '/GB/review', 'POST', {
    expectedVersion: 2,
    prerequisite: 'legal',
    evidence: 'legal-reference',
    reason: 'Reviewed legal terms',
  });
  expect(result.version).toBe(3);
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/api/countries/admin/GB/review'),
    expect.objectContaining({
      cache: 'no-store',
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      body: expect.stringContaining('"expectedVersion":2'),
    })
  );
});
