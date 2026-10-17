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
