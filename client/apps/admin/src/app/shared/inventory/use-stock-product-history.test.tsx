// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import { useStockProductHistory } from './use-stock-product-history';
const response = (id: string, truncated = false) => ({
  movements: [{ _id: id }] as InventoryMovement[],
  total: 1,
  truncated,
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('fetches all product movements and inclusive UTC dates, exposes partial history, clears failure and retries', async () => {
  const fetch = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue(response('a', true));
  const { result } = renderHook(() =>
    useStockProductHistory('token', 'p', 2, '2026-10-01', '2026-10-04'),
  );
  await waitFor(() => expect(result.current.moves).toHaveLength(1));
  expect(fetch).toHaveBeenCalledWith('token', {
    subProductId: 'p',
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-04T23:59:59.999Z',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  expect(result.current.truncated).toBe(true);
  fetch.mockRejectedValueOnce(new Error('Failed history'));
  await act(() => result.current.load());
  expect(result.current.moves).toEqual([]);
  expect(result.current.error).toBe('Failed history');
  fetch.mockResolvedValueOnce(response('b'));
  await act(() => result.current.load());
  expect(result.current.moves[0]._id).toBe('b');
});
it('an old product response cannot replace a newly selected product', async () => {
  let complete!: (value: ReturnType<typeof response>) => void;
  vi.spyOn(inventoryService, 'getAllMovements')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValueOnce(response('new'));
  const { result, rerender } = renderHook(
    ({ product }) => useStockProductHistory('token', product, 0, '', ''),
    { initialProps: { product: 'old' } },
  );
  rerender({ product: 'new' });
  await waitFor(() => expect(result.current.moves[0]?._id).toBe('new'));
  await act(async () => complete(response('old')));
  expect(result.current.moves[0]._id).toBe('new');
});
it('rejects reversed dates without fetching and reloads history when a stock count changes', async () => {
  const fetch = vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue(response('a'));
  const { result, rerender } = renderHook(
    ({ quantity, from, to }) => useStockProductHistory('token', 'p', quantity, from, to),
    { initialProps: { quantity: 1, from: '2026-10-05', to: '2026-10-04' } },
  );
  await waitFor(() => expect(result.current.error).toContain('start date'));
  expect(fetch).not.toHaveBeenCalled();
  rerender({ quantity: 1, from: '', to: '' });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  rerender({ quantity: 2, from: '', to: '' });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
});
