// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseService } from '@/services/warehouse.service';
import { warehouseStockService } from '@/services/warehouseStock.service';
import { useInventoryLocations } from './use-inventory-locations';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('keeps locations but clears failed stock and supports retry', async () => {
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({
    success: true,
    data: [{ _id: 'w' }],
  });
  const stock = vi
    .spyOn(warehouseStockService, 'getAllStock')
    .mockResolvedValue({ success: true, data: [] });
  const { result } = renderHook(() => useInventoryLocations('token', 'authenticated'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(stock).toHaveBeenCalledWith('token', { includeUnstocked: true });
  stock.mockRejectedValueOnce(new Error('Stock unavailable'));
  await act(() => result.current.load());
  expect(result.current.warehouses).toHaveLength(1);
  expect(result.current.stock).toEqual([]);
  expect(result.current.stockError).toBe('Stock unavailable');
  stock.mockResolvedValueOnce({ success: true, data: [] });
  await act(() => result.current.load());
  expect(result.current.stockError).toBe('');
});
it('ignores late requests and clears tenant data on sign out', async () => {
  let complete!: (value: unknown) => void;
  vi.spyOn(warehouseService, 'getWarehouses')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue({ success: true, data: [{ _id: 'new' }] });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({ success: true, data: [] });
  const { result, rerender } = renderHook(
    ({ token }) => useInventoryLocations(token, 'authenticated'),
    { initialProps: { token: 't' } },
  );
  await act(() => result.current.load());
  await act(async () => complete({ success: true, data: [{ _id: 'old' }] }));
  expect(result.current.warehouses[0]._id).toBe('new');
  rerender({ token: '' });
  expect(result.current.warehouses).toEqual([]);
  expect(result.current.error).toContain('Sign in');
});
