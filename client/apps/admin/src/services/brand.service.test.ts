import { afterEach, expect, test, vi } from 'vitest';
import { brandService, getAdminBrands } from './brand.service';
afterEach(() => vi.unstubAllGlobals());
test('banner search sends trimmed query and keeps active-only scope', async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { brands: [{ name: 'Glenfiddich' }] } }),
  }));
  vi.stubGlobal('fetch', fetcher);
  expect(
    await brandService.getBrands('token', {
      search: ' GLENFIDDICH ',
      limit: 100,
    })
  ).toEqual([{ name: 'Glenfiddich' }]);
  const [url, options] = fetcher.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(new URL(url).searchParams.get('search')).toBe('GLENFIDDICH');
  expect(new URL(url).searchParams.get('status')).toBe('active');
  expect(options.cache).toBe('no-store');
});
test('admin brand list is refreshed rather than reusing a cached response', async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { brands: [], total: 0 } }),
  }));
  vi.stubGlobal('fetch', fetcher);
  await getAdminBrands('token');
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('/api/brands/admin'),
    expect.objectContaining({ cache: 'no-store' })
  );
});
test('banner search reports service errors instead of a successful empty list', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: 'Unable to search brands' }),
    }))
  );
  await expect(
    brandService.getBrands('token', { search: 'laph' })
  ).rejects.toThrow('Unable to search brands');
});
