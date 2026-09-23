import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteAdminTenants, buildTenantFormData } from './tenant.service';

afterEach(() => vi.unstubAllGlobals());
describe('tenant management requests', () => {
  it('bulk deletion persists successes and preserves failed and protected tenants', async () => {
    const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify({ message: 'In use' }), { status: url.endsWith('/bad') ? 409 : 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await deleteAdminTenants('token', [
      { _id: 'ok', isSystemTenant: false }, { _id: 'bad' }, { _id: 'system', isSystemTenant: true },
    ]);
    expect(result.deletedIds).toEqual(['ok']);
    expect(result.failures.map((f) => f.id)).toEqual(['bad', 'system']);
    expect(fetcher.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['ok', 'bad']);
  });
  it('serializes explicit clearing and nested bank accounts without losing values', () => {
    const form = buildTenantFormData({ name: 'Store', slug: 'store', packMarkupPercentage: '', enforceAgeVerification: false, bankAccounts: [{ accountNumber: '0123456789' }] });
    expect(form.get('packMarkupPercentage')).toBe('');
    expect(form.get('enforceAgeVerification')).toBe('false');
    expect(JSON.parse(String(form.get('bankAccounts')))).toEqual([{ accountNumber: '0123456789' }]);
  });
});
