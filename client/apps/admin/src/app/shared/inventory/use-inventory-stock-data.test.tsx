// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { useInventoryStockData } from './use-inventory-stock-data';
const response = (id: string) => ({ success: true, data: [{ _id: id }] as StockRow[] });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('includes zero-stock catalogue lines and clears a failed refresh before retrying', async () => {
  const fetch = vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue(response('old'));
  const { result } = renderHook(() => useInventoryStockData('token', 'authenticated', 'stock'));
  await waitFor(() => expect(result.current.rows[0]?._id).toBe('old'));
  expect(fetch).toHaveBeenCalledWith('token', { includeUnstocked: true });
  fetch.mockRejectedValueOnce(new Error('Stock unavailable'));
  await act(() => result.current.load());
  expect(result.current.rows).toEqual([]);
  expect(result.current.error).toBe('Stock unavailable');
  fetch.mockResolvedValueOnce(response('new'));
  await act(() => result.current.load());
  expect(result.current.rows[0]._id).toBe('new');
  expect(result.current.error).toBe('');
});
it('an older result cannot overwrite a newer refresh', async () => {
  let complete!: (value: ReturnType<typeof response>) => void;
  vi.spyOn(warehouseStockService, 'getAllStock')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValueOnce(response('new'));
  const { result } = renderHook(() => useInventoryStockData('token', 'authenticated', 'stock'));
  await act(() => result.current.load());
  await act(async () => {
    complete(response('old'));
  });
  expect(result.current.rows[0]._id).toBe('new');
});
it('changing tenant authentication clears the previous stock immediately', async () => {
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue(response('old'));
  const { result, rerender } = renderHook(
    ({ token }) => useInventoryStockData(token, 'authenticated', 'stock'),
    { initialProps: { token: 'token' } },
  );
  await waitFor(() => expect(result.current.rows.length).toBe(1));
  rerender({ token: '' });
  expect(result.current.rows).toEqual([]);
  expect(result.current.error).toContain('Sign in');
});
