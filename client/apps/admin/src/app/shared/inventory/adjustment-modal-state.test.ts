// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAdjustmentEntry } from './use-adjustment-entry';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { warehouseService } from '@/services/warehouse.service';
import {
  inventoryAdjustmentService,
  AdjustmentError,
} from '@/services/inventoryAdjustment.service';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function setup() {
  const row = {
    warehouseId: 'a',
    subProductId: 'wine',
    productName: 'Wine',
    sku: 'W',
    sizeId: 'small',
    sizeName: 'Small',
    currentQuantity: 10,
    reservedQuantity: 0,
  } as StockRow;
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [row, { ...row, sizeId: 'large', sizeName: 'Large' }],
  });
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({
    data: [
      { _id: 'a', name: 'A' },
      { _id: 'b', name: 'B' },
    ],
  });
  const hook = renderHook(() => useAdjustmentEntry('t', vi.fn()));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  act(() => {
    hook.result.current.selectProduct('wine');
    hook.result.current.setReason('Count');
  });
  return hook;
}
it('requires a fresh quantity when warehouse, size or method changes and when counts refresh', async () => {
  const h = await setup();
  for (const change of [
    () => h.result.current.setWarehouse('b'),
    () => h.result.current.setSize('large'),
    () => h.result.current.setMode('add'),
  ]) {
    act(() => h.result.current.setQuantity('4'));
    act(change);
    expect(h.result.current.quantity).toBe('');
    expect(h.result.current.invalid).toBe(true);
  }
  act(() => h.result.current.setQuantity('4'));
  await act(async () => {
    await h.result.current.load();
  });
  expect(h.result.current.quantity).toBe('');
});
it('blocks stale-stock resubmission until counts are refreshed', async () => {
  const h = await setup();
  const save = vi
    .spyOn(inventoryAdjustmentService, 'create')
    .mockRejectedValue(new AdjustmentError('Stock changed', 409));
  act(() => h.result.current.setQuantity('4'));
  await act(async () => {
    await h.result.current.submit();
  });
  expect(h.result.current.invalid).toBe(true);
  expect(h.result.current.needsRefresh).toBe(true);
  await act(async () => {
    await h.result.current.submit();
  });
  expect(save).toHaveBeenCalledOnce();
  await act(async () => {
    await h.result.current.load();
  });
  expect(h.result.current.needsRefresh).toBe(false);
  expect(h.result.current.quantity).toBe('');
});
