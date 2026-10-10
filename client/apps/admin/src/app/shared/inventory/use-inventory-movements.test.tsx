// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import { useInventoryMovements } from './use-inventory-movements';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const response = (id: string) => ({
  movements: [{ _id: id } as InventoryMovement],
  total: 1,
  truncated: false,
});
it('loads paginated history and clears stale rows on a failed refresh', async () => {
  const fetch = vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue(response('a'));
  const { result } = renderHook(() =>
    useInventoryMovements('token', 'authenticated', 'moves', '', '', '00:00', '23:59'),
  );
  await waitFor(() => expect(result.current.moves[0]?._id).toBe('a'));
  fetch.mockRejectedValueOnce(new Error('Unavailable'));
  await act(() => result.current.fetchMoves());
  expect(result.current.moves).toEqual([]);
  expect(result.current.errorMsg).toBe('Unavailable');
});
it('ignores responses after the authenticated account changes', async () => {
  let complete!: (value: ReturnType<typeof response>) => void;
  vi.spyOn(inventoryService, 'getAllMovements')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue(response('new'));
  const { result, rerender } = renderHook(
    ({ token }) => useInventoryMovements(token, 'authenticated', 'moves', '', '', '00:00', '23:59'),
    { initialProps: { token: 'old' } },
  );
  rerender({ token: 'new' });
  await waitFor(() => expect(result.current.moves[0]?._id).toBe('new'));
  await act(async () => complete(response('old')));
  expect(result.current.moves[0]._id).toBe('new');
  rerender({ token: '' });
  await waitFor(() => expect(result.current.moves).toEqual([]));
});
it('uses inclusive recorded-date bounds and does not fetch an invalid range', async () => {
  const fetch = vi
    .spyOn(inventoryService, 'getAllMovements')
    .mockResolvedValue({ ...response('a'), truncated: true });
  const { result, rerender } = renderHook(
    ({ from }) =>
      useInventoryMovements('t', 'authenticated', 'moves', from, '2026-10-04', '10:00', '10:00'),
    { initialProps: { from: '2026-10-04' } },
  );
  await waitFor(() => expect(result.current.truncated).toBe(true));
  const params = fetch.mock.calls[0][1]!;
  expect(new Date(params.endDate!).getTime() - new Date(params.startDate!).getTime()).toBe(59999);
  rerender({ from: '2026-10-05' });
  await waitFor(() => expect(result.current.errorMsg).toContain('valid date'));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.current.moves).toEqual([]);
});
