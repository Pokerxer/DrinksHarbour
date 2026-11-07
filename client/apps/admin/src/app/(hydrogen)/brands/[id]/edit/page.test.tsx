import { afterEach, expect, test, vi } from 'vitest';
const auth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedUser: auth }));
vi.mock('@/app/shared/page-header', () => ({ default: () => null }));
vi.mock('@/app/shared/ecommerce/brand/create-brand', () => ({ default: () => null }));
vi.mock('@/app/shared/ecommerce/ecommerce-page-header', () => ({ default: () => null }));
vi.mock('@/config/site.config', () => ({ metaObject: (title: string) => ({ title }) }));
import EditBrandPage, { generateMetadata } from './page';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

for (const [name, read] of [['metadata', generateMetadata], ['edit form', EditBrandPage]] as const) {
  test(`${name} loads unpublished brands through an authenticated admin read`, async () => {
    auth.mockResolvedValue({ token: 'admin-token', role: 'admin' });
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { brand: { name: 'Proposal', status: 'pending' } } }),
    }));
    vi.stubGlobal('fetch', fetcher);
    await read({ params: Promise.resolve({ id: 'proposal-id' }) });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/brands/admin/proposal-id'),
      expect.objectContaining({ cache: 'no-store', headers: { Authorization: 'Bearer admin-token' } })
    );
  });
}
