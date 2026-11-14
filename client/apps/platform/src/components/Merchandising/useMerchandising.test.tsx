// client/apps/platform/src/components/Merchandising/useMerchandising.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMerchandising, cardPrice } from './useMerchandising';
import { useTenant } from '@/context/TenantContext';

vi.mock('@/context/TenantContext', () => ({ useTenant: vi.fn() }));

const payload = {
  data: {
    productId: 'p1',
    context: 'pdp',
    boughtTogether: [{ _id: 'p1', name: 'A', slug: 'a', priceRange: { min: 1000, max: 2000 } }],
    crossSells: [],
    upSells: [],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('useMerchandising', () => {
  it('fetches the batched endpoint with tenant storefront headers', async () => {
    (useTenant as ReturnType<typeof vi.fn>).mockReturnValue({ tenantSlug: 'acme' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMerchandising('p1', 'pdp'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.boughtTogether).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/products/p1/merchandising?');
    expect(url).toContain('context=pdp');
    expect(init.headers['x-is-tenant-site']).toBe('true');
    expect(init.headers['x-tenant-slug']).toBe('acme');
  });

  it('sends marketplace headers when there is no tenant slug', async () => {
    (useTenant as ReturnType<typeof vi.fn>).mockReturnValue({ tenantSlug: null });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useMerchandising('p1', 'cart'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('context=cart');
    expect(init.headers['x-is-tenant-site']).toBe('false');
  });

  it('degrades to null data on a failed fetch', async () => {
    (useTenant as ReturnType<typeof vi.fn>).mockReturnValue({ tenantSlug: null });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    const { result } = renderHook(() => useMerchandising('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it('does nothing without a productId', () => {
    (useTenant as ReturnType<typeof vi.fn>).mockReturnValue({ tenantSlug: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useMerchandising(undefined));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cardPrice', () => {
  it('prefers tenant price, then priceRange.min, then averageSellingPrice', () => {
    expect(cardPrice({ _id: '1', name: 'x', slug: 'x', price: 500 })).toBe(500);
    expect(cardPrice({ _id: '1', name: 'x', slug: 'x', priceRange: { min: 1000, max: 2000 } })).toBe(1000);
    expect(cardPrice({ _id: '1', name: 'x', slug: 'x', averageSellingPrice: 3000 })).toBe(3000);
    expect(cardPrice({ _id: '1', name: 'x', slug: 'x' })).toBeNull();
  });
});
