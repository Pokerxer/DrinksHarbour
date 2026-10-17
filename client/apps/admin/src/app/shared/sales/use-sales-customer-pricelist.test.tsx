// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { posApi } from '@/app/shared/point-of-sale/api';
import { useSalesCustomerPricelist } from './use-sales-customer-pricelist';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('failed options can be retried without changing customer or warehouse', async () => {
  vi.spyOn(posApi, 'getPricelists')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      pricelists: [{ _id: 'trade', name: 'Trade' }],
      resolvedId: 'trade',
    });
  const { result } = renderHook(() =>
    useSalesCustomerPricelist('token', 'customer', 'warehouse')
  );
  await waitFor(() => expect(result.current.error).toBeTruthy());
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.selected?.name).toBe('Trade'));
  expect(result.current.error).toBeNull();
});

it('a late customer response cannot replace the current dropdown options', async () => {
  let resolveOld!: (
    value: Awaited<ReturnType<typeof posApi.getPricelists>>
  ) => void;
  vi.spyOn(posApi, 'getPricelists')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValueOnce({
      pricelists: [{ _id: 'new', name: 'New customer prices' }],
      resolvedId: 'new',
    });
  const { result, rerender } = renderHook(
    ({ customer }) => useSalesCustomerPricelist('token', customer, 'warehouse'),
    { initialProps: { customer: 'old' } }
  );
  rerender({ customer: 'new' });
  await waitFor(() => expect(result.current.resolvedId).toBe('new'));
  await act(async () => {
    resolveOld({
      pricelists: [{ _id: 'old', name: 'Old prices' }],
      resolvedId: 'old',
    });
  });
  expect(result.current.pricelists.map((p) => p._id)).toEqual(['new']);
});
