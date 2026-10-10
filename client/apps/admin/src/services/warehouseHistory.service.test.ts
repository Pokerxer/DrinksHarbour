import { afterEach, expect, it, vi } from 'vitest';
import { getWarehouseHistory, getWarehouseHistoryProducts } from './warehouseHistory.service';
afterEach(() => vi.unstubAllGlobals());
it('sends combined history filters as encoded query values with JWT authority', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { rows: [], pagination: { total: 0 } } }),
  });
  vi.stubGlobal('fetch', fetcher);
  await getWarehouseHistory('warehouse', 'jwt', {
    kind: 'purchases',
    page: 1,
    product: 'one,two',
    start: '2026-10-01',
    end: '',
    status: 'received',
    search: 'PO (1) & supplier',
  });
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.pathname).toBe('/api/warehouses/warehouse/history');
  expect(url.searchParams.get('product')).toBe('one,two');
  expect(url.searchParams.get('search')).toBe('PO (1) & supplier');
  expect(url.searchParams.get('status')).toBe('received');
  expect(url.searchParams.has('end')).toBe(false);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
});
it('loads warehouse history product options and propagates API failures', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [{ id: 'p', label: 'Historical wine' }] }),
    })
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'Warehouse not found' }),
    });
  vi.stubGlobal('fetch', fetcher);
  expect(await getWarehouseHistoryProducts('warehouse', 'jwt')).toEqual([
    { id: 'p', label: 'Historical wine' },
  ]);
  expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe(
    '/api/warehouses/warehouse/history/products',
  );
  await expect(getWarehouseHistoryProducts('foreign', 'jwt')).rejects.toThrow(
    'Warehouse not found',
  );
});
it('reports connection failures with a useful recovery message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(getWarehouseHistoryProducts('warehouse', 'jwt')).rejects.toThrow(
    /Cannot connect to the server/,
  );
});
