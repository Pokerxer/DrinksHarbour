import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { productService } from './product.service';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const unavailable = () =>
  new Response(
    JSON.stringify({
      message: 'Database temporarily unavailable. Please retry.',
    }),
    { status: 503, headers: { 'Retry-After': '5' } }
  );

describe('linked product read recovery', () => {
  it('reads reservations through the private stock route with auth, cancellation and no cache', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { product: { _id: 'p', subProducts: [] } },
        })
      )
    );
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    await productService.getProductStock('p', 'staff-token', controller.signal);
    expect(fetcher.mock.calls[0][0]).toContain('/api/products/admin/p/stock');
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: 'Bearer staff-token' },
      signal: controller.signal,
    });
  });
  it('reads buyer history only through the authenticated private sales route', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { report: {} } })));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    await productService.getProductSalesHistory('p', 'staff-token', controller.signal);
    expect(fetcher.mock.calls[0][0]).toContain('/api/products/admin/p/sales');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', cache: 'no-store', headers: { Authorization: 'Bearer staff-token' }, signal: controller.signal });
  });
  it('bypasses cached product responses when checking live stock', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: { product: { _id: 'p' } } })
        )
      );
    vi.stubGlobal('fetch', fetcher);
    await productService.getProductById('p', 'token', true);
    expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
  });
  it('waits and retries a temporary database outage without any writes', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(unavailable())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { product: { _id: 'p', name: 'Beer' } },
          })
        )
      );
    vi.stubGlobal('fetch', fetcher);
    const result = productService.getProductById('p', 'token', true);
    const outcome = expect(result).resolves.toMatchObject({
      data: { product: { _id: 'p' } },
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toContain('/api/products/p?includePending=true');
      expect(init.method || 'GET').toBe('GET');
    }
  });
  it('stops after one retry and preserves the HTTP status', async () => {
    const fetcher = vi.fn().mockImplementation(async () => unavailable());
    vi.stubGlobal('fetch', fetcher);
    const result = expect(
      productService.getProductById('p', 'token')
    ).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await result;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 404])('does not retry HTTP %s', async (status) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Request failed' }), { status })
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      productService.getProductById('p', 'token')
    ).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('cancels the pending retry when the selection changes or the form closes', async () => {
    const fetcher = vi.fn().mockImplementation(async () => unavailable());
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const outcome = productService
      .getProductById('p', 'token', true, controller.signal)
      .then(
        () => null,
        (error: unknown) => error
      );
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    await vi.runAllTimersAsync();
    expect(await outcome).toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not send a request that has already been cancelled', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(
      productService.getProductById('p', 'token', true, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves status when an upstream error is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 }))
    );
    await expect(
      productService.getProductById('p', 'token')
    ).rejects.toMatchObject({
      status: 403,
      message: 'Failed to fetch product',
    });
  });
});

describe('pending products queue service', () => {
  it('reads the super-admin pending queue through /api/products/admin/pending with filters', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            products: [
              {
                _id: 'p1',
                name: 'Zambezi Dry Gin',
                slug: 'zambezi-dry-gin',
                type: 'spirit',
                status: 'pending',
                images: [{ url: '/gin.jpg', alt: 'Zambezi' }],
                brand: { _id: 'b1', name: 'Zambezi Co' },
                publicationScope: 'tenant_private',
                owningTenant: { _id: 't1', name: 'Havour Wine', slug: 'havour-wine' },
                submittingTenant: { _id: 't1', name: 'Havour Wine', slug: 'havour-wine' },
                submissionSource: 'tenant',
                createdAt: '2026-10-01T10:00:00Z',
              },
              { _id: 'p2', name: 'Cape Chardonnay', status: 'pending', createdAt: '2026-09-20T09:00:00Z' },
            ],
            pagination: {
              page: 2, limit: 20, total: 41, pages: 3, hasNext: true, hasPrev: true,
            },
          },
        })
      )
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await productService.getPendingProducts('token', {
      page: 2, limit: 20, search: 'gin', type: 'spirit',
    });
    expect(fetcher.mock.calls[0][0]).toContain(
      '/api/products/admin/pending?page=2&limit=20&search=gin&type=spirit'
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      cache: 'no-store',
      headers: { Authorization: 'Bearer token' },
    });
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toMatchObject({
      _id: 'p1',
      name: 'Zambezi Dry Gin',
      publicationScope: 'tenant_private',
      owningTenantName: 'Havour Wine',
      submittingTenantName: 'Havour Wine',
      submissionSource: 'tenant',
      imageUrl: '/gin.jpg',
    });
    // Legacy row without scope: keep the fields the queue needs, nothing invented.
    expect(result.products[1]).toMatchObject({
      _id: 'p2',
      publicationScope: undefined,
      owningTenantName: undefined,
      submittingTenantName: undefined,
      submissionSource: undefined,
    });
    expect(result.pagination.total).toBe(41);
  });

  it('supports the submitting-tenant filter and cancelled enquiries', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { products: [], pagination: { page: 1, limit: 10, total: 0, pages: 0, hasNext: false, hasPrev: false } } }))
      );
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    await productService.getPendingProducts(
      'token',
      { submittingTenant: 't-flat', sort: 'createdAt', order: 'asc' },
      controller.signal
    );
    expect(fetcher.mock.calls[0][0]).toContain('tenant=t-flat');
    expect(fetcher.mock.calls[0][0]).toContain('sort=createdAt');
    expect(fetcher.mock.calls[0][0]).toContain('order=asc');
    expect(fetcher.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('approves through the super-admin-only approve route', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, message: 'Product approved successfully', data: { product: { _id: 'p1', status: 'approved' } } })
      )
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await productService.approveProduct('p1', 'token');
    expect(fetcher.mock.calls[0][0]).toContain('/api/products/p1/approve');
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
    // Approve posts no body — eligibility is entirely server-side.
    expect(fetcher.mock.calls[0][1].body).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('rejects with the required reason in the body', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, message: 'Product rejected', data: { product: { _id: 'p1' } } })
      )
    );
    vi.stubGlobal('fetch', fetcher);
    await productService.rejectProduct('p1', 'token', 'Duplicate of Cape Chardonnay');
    expect(fetcher.mock.calls[0][0]).toContain('/api/products/p1/reject');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(fetcher.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    expect(fetcher.mock.calls[0][1].body).toBe(
      JSON.stringify({ reason: 'Duplicate of Cape Chardonnay' })
    );
  });

  it('surfaces the API failure message when an action is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Only super-admins can approve products' }), { status: 403 })
      )
    );
    await expect(productService.approveProduct('p1', 'token')).rejects.toThrow(
      'Only super-admins can approve products'
    );
  });
});
