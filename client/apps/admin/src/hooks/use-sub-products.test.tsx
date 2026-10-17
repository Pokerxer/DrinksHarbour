// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useSubProducts } from './use-sub-products';
import { subproductService } from '@/services/subproduct.service';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('manual refresh bypasses the sub-product page cache', async () => {
  const get = vi.spyOn(subproductService, 'getSubProducts').mockResolvedValue({
    success: true,
    data: { subProducts: [{ _id: 'one', status: 'active' }] },
  });
  const { result } = renderHook(() =>
    useSubProducts('token', { clientSideMode: true })
  );
  await waitFor(() => expect(result.current.items.length).toBe(1));
  act(() => {
    result.current.refresh();
  });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  expect(get.mock.calls[1][1]).toMatchObject({ limit: 5000, refresh: 'true' });
});

it('loads remaining catalog pages before presenting complete client-side results', async () => {
  const get = vi
    .spyOn(subproductService, 'getSubProducts')
    .mockImplementation(async (_token, params) => ({
      success: true,
      data: {
        subProducts: [
          { _id: params?.page === 2 ? 'two' : 'one', status: 'active' },
        ],
        pagination: {
          page: params?.page || 1,
          limit: 1,
          total: 2,
          pages: 2,
          hasNext: params?.page !== 2,
        },
      },
    }));
  const { result } = renderHook(() =>
    useSubProducts('token', { clientSideMode: true })
  );
  await waitFor(() =>
    expect(result.current.items.map((p) => p._id)).toEqual(['one', 'two'])
  );
  expect(result.current.pagination?.hasNext).toBe(false);
  expect(get.mock.calls[1][1]).toMatchObject({ page: 2 });
});

it('replaces the widget catalog when the authenticated token changes', async () => {
  vi.spyOn(subproductService, 'getSubProducts').mockImplementation(
    async (token) => ({
      success: true,
      data: { subProducts: [{ _id: token }] },
    })
  );
  const { result, rerender } = renderHook(
    ({ token }) => useSubProducts(token, { clientSideMode: true }),
    { initialProps: { token: 'tenant-one' } }
  );
  await waitFor(() => expect(result.current.items[0]?._id).toBe('tenant-one'));
  rerender({ token: 'tenant-two' });
  await waitFor(() => expect(result.current.items[0]?._id).toBe('tenant-two'));
});

it('does not publish a partial catalog when a later page fails', async () => {
  vi.spyOn(subproductService, 'getSubProducts').mockImplementation(
    async (_token, params) =>
      params?.page === 2
        ? { success: false, message: 'Catalog page unavailable' }
        : {
            success: true,
            data: {
              subProducts: [{ _id: 'one' }],
              pagination: {
                page: 1,
                limit: 1,
                total: 2,
                pages: 2,
                hasNext: true,
              },
            },
          }
  );
  const { result } = renderHook(() =>
    useSubProducts('token', { clientSideMode: true })
  );
  await waitFor(() =>
    expect(result.current.error).toBe('Catalog page unavailable')
  );
  expect(result.current.items).toEqual([]);
  expect(result.current.stats.total).toBe(0);
});

it('rejects late catalog pages belonging to the previous token', async () => {
  let finish!: (value: object) => void;
  vi.spyOn(subproductService, 'getSubProducts').mockImplementation(
    async (token) =>
      token === 'old-token'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : { success: true, data: { subProducts: [{ _id: 'current' }] } }
  );
  const { result, rerender } = renderHook(
    ({ token }) => useSubProducts(token, { clientSideMode: true }),
    { initialProps: { token: 'old-token' } }
  );
  rerender({ token: 'new-token' });
  await waitFor(() => expect(result.current.items[0]?._id).toBe('current'));
  await act(async () =>
    finish({ success: true, data: { subProducts: [{ _id: 'old' }] } })
  );
  expect(result.current.items[0]?._id).toBe('current');
});

it('defaults to 50 rows and requests lightweight client-side catalog records', async () => {
  const get = vi.spyOn(subproductService, 'getSubProducts').mockResolvedValue({
    success: true,
    data: { subProducts: [{ _id: 'one' }] },
  });
  const { result } = renderHook(() =>
    useSubProducts('token', { clientSideMode: true })
  );
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  expect(result.current.pageSize).toBe(50);
  expect(get.mock.calls[0][1]).toMatchObject({ view: 'list', limit: 5000 });
});
