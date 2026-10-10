// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAnalysisData } from './use-analysis-data';
import { warehouseStockService } from '@/services/warehouseStock.service';
import { posApi } from '../../point-of-sale/api';
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { token: 't' } } }) }));
vi.mock('@/services/warehouseStock.service', () => ({
  warehouseStockService: { getAllStock: vi.fn() },
}));
vi.mock('../../point-of-sale/api', () => ({
  posApi: {
    getProductMeta: vi.fn(),
    getCategories: vi.fn().mockResolvedValue({ categories: [] }),
    getBrands: vi.fn().mockResolvedValue({ brands: [] }),
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('keeps the report loading until product metadata is ready', async () => {
  vi.mocked(warehouseStockService.getAllStock).mockResolvedValue({ success: true, data: [] });
  let resolve!: (value: { meta: []; total: number }) => void;
  vi.mocked(posApi.getProductMeta).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = renderHook(() => useAnalysisData());
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.phase).toBe('loading');
  await act(async () => resolve({ meta: [], total: 0 }));
  await waitFor(() => expect(result.current.phase).toBe('ready'));
});
it('reports metadata failures instead of silently presenting an unfiltered report', async () => {
  vi.mocked(warehouseStockService.getAllStock).mockResolvedValue({ success: true, data: [] });
  vi.mocked(posApi.getProductMeta).mockRejectedValue(new Error('Product metadata unavailable'));
  const { result } = renderHook(() => useAnalysisData());
  await waitFor(() => expect(result.current.phase).toBe('error'));
  expect(result.current.errorMessage).toBe('Product metadata unavailable');
});

it('ignores an older response after a refreshed report is ready', async () => {
  let finishOld!: (value: Awaited<ReturnType<typeof warehouseStockService.getAllStock>>) => void;
  vi.mocked(warehouseStockService.getAllStock)
    .mockReturnValueOnce(
      new Promise((done) => {
        finishOld = done;
      }),
    )
    .mockResolvedValue({
      success: true,
      data: [{ _id: 'new' }] as import('@/services/warehouseStock.service').StockRow[],
    });
  vi.mocked(posApi.getProductMeta).mockResolvedValue({ meta: [], total: 0 });
  const { result } = renderHook(() => useAnalysisData());
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.stock[0]._id).toBe('new');
  await act(async () =>
    finishOld({
      success: true,
      data: [{ _id: 'old' }] as import('@/services/warehouseStock.service').StockRow[],
    }),
  );
  expect(result.current.stock[0]._id).toBe('new');
});

it('keeps stock within the warehouse when reloading or switching locations', async () => {
  vi.mocked(warehouseStockService.getAllStock).mockResolvedValue({
    success: true,
    data: [
      { _id: 'a', warehouseId: 'one' },
      { _id: 'b', warehouseId: 'two' },
    ] as import('@/services/warehouseStock.service').StockRow[],
  });
  vi.mocked(posApi.getProductMeta).mockResolvedValue({ meta: [], total: 0 });
  const { result, rerender } = renderHook(({ id }) => useAnalysisData(id), {
    initialProps: { id: 'one' },
  });
  await waitFor(() => expect(result.current.stock.map((row) => row._id)).toEqual(['a']));
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.stock.map((row) => row._id)).toEqual(['a']);
  rerender({ id: 'two' });
  await waitFor(() => expect(result.current.stock.map((row) => row._id)).toEqual(['b']));
});
