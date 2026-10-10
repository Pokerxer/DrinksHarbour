// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useSubProducts } from './use-sub-products';
import { subproductService } from '@/services/subproduct.service';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('manual refresh bypasses the sub-product page cache', async () => {
  const get = vi.spyOn(subproductService, 'getSubProducts').mockResolvedValue({
    success: true, data: { subProducts: [{ _id: 'one', status: 'active' }] },
  });
  const { result } = renderHook(() => useSubProducts('token', { clientSideMode: true }));
  await waitFor(() => expect(result.current.items.length).toBe(1));
  act(() => { result.current.refresh(); });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  expect(get.mock.calls[1][1]).toMatchObject({ limit: 5000, refresh: 'true' });
});
