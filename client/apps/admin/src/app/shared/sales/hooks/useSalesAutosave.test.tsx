// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSalesAutosave } from './useSalesAutosave';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import type { PricedLine } from '../sales-line-table';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const line = {
  lineType: 'product',
  subProductId: 'product',
  quantity: 1,
} as PricedLine;
const options = {
  token: 'token',
  priced: [line],
  customer: null,
  notes: '',
  terms: '',
  validUntil: '',
  paymentTerms: '',
  pricelistId: '',
  warehouseId: '',
  buildPayload: () => ({
    items: [{ lineType: 'product', subproduct: 'product', quantity: 1 }],
    dueDate: '2026-10-20',
  }),
  draftPath: (id: string) => `/accounting/invoices/create?draft=${id}`,
};
it('simultaneous manual save and ensureSaved create one invoice draft', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof salesOrderService.create>>
  ) => void;
  const create = vi.spyOn(salesOrderService, 'create').mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const { result } = renderHook(() => useSalesAutosave(options));
  let saved!: Promise<unknown>;
  let ensured!: Promise<string | null>;
  act(() => {
    saved = result.current.handleManualSave();
    ensured = result.current.ensureSaved(true);
  });
  expect(create).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ success: true, data: { _id: 'draft-1' } as SalesOrder });
    await Promise.all([saved, ensured]);
  });
  expect(await ensured).toBe('draft-1');
  expect(create.mock.calls[0][0].dueDate).toBe('2026-10-20');
  expect(window.location.pathname + window.location.search).toBe(
    '/accounting/invoices/create?draft=draft-1'
  );
});
it('failed forced saving never returns a stale draft id', async () => {
  vi.spyOn(salesOrderService, 'update').mockRejectedValue(
    new Error('Save failed')
  );
  const { result } = renderHook(() =>
    useSalesAutosave({ ...options, initial: { _id: 'draft-1' } as SalesOrder })
  );
  let value: string | null = 'unset';
  await act(async () => {
    value = await result.current.ensureSaved(true);
  });
  expect(value).toBeNull();
  expect(result.current.autoSaveStatus).toBe('error');
});

it('does not mark newer edits saved when an older save finishes', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  let finish!: (
    value: Awaited<ReturnType<typeof salesOrderService.create>>
  ) => void;
  vi.spyOn(salesOrderService, 'create').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { result, rerender } = renderHook(
    (quantity: number) =>
      useSalesAutosave({
        ...options,
        priced: [{ ...line, quantity }],
        buildPayload: () => ({
          items: [{ lineType: 'product', subproduct: 'product', quantity }],
        }),
      }),
    { initialProps: 1 }
  );
  act(() => {
    vi.advanceTimersByTime(1001);
  });
  let saved!: Promise<unknown>;
  act(() => {
    saved = result.current.handleManualSave();
  });
  rerender(2);
  await act(async () => {
    finish({ success: true, data: { _id: 'draft-1' } as SalesOrder });
    await saved;
  });
  expect(result.current.isDirtyRef.current).toBe(true);
  expect(result.current.autoSaveStatus).not.toBe('saved');
  expect(await saved).toBe(false);
});

it('leaving during a save flushes newer edits to the same draft instead of creating another', async () => {
  vi.useFakeTimers();
  const update = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', update);
  let finish!: (
    value: Awaited<ReturnType<typeof salesOrderService.create>>
  ) => void;
  const create = vi.spyOn(salesOrderService, 'create').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { result, rerender, unmount } = renderHook(
    (quantity: number) =>
      useSalesAutosave({
        ...options,
        priced: [{ ...line, quantity }],
        buildPayload: () => ({
          items: [{ lineType: 'product', subproduct: 'product', quantity }],
        }),
      }),
    { initialProps: 1 }
  );
  act(() => {
    vi.advanceTimersByTime(1001);
  });
  let saved!: Promise<unknown>;
  act(() => {
    saved = result.current.handleManualSave();
  });
  rerender(2);
  unmount();
  await act(async () => {
    finish({ success: true, data: { _id: 'draft-1' } as SalesOrder });
    await saved;
    await Promise.resolve();
  });
  expect(create).toHaveBeenCalledOnce();
  expect(update).toHaveBeenCalledOnce();
  expect(update.mock.calls[0][0]).toContain('/draft-1');
  expect(update.mock.calls[0][1]?.method).toBe('PUT');
  const body = JSON.parse(String(update.mock.calls[0][1]?.body)) as {
    items: { quantity: number }[];
  };
  expect(body.items[0].quantity).toBe(2);
});

it('read-only documents never persist on manual save, warehouse change or page leave', async () => {
  vi.useFakeTimers();
  const update = vi.spyOn(salesOrderService,'update').mockResolvedValue({success:true,data:{_id:'locked'} as SalesOrder});
  const fetch = vi.fn().mockResolvedValue({ok:true});
  vi.stubGlobal('fetch',fetch);
  const {result,rerender,unmount} = renderHook((warehouse:string)=>useSalesAutosave({
    ...options,initial:{_id:'locked',locked:true} as SalesOrder,enabled:false,warehouseId:warehouse,
  }),{initialProps:'one'});
  act(()=>{vi.advanceTimersByTime(1200);});
  rerender('two');
  act(()=>{result.current.isDirtyRef.current=true;});
  await act(async()=>{await result.current.handleManualSave();});
  act(()=>{window.dispatchEvent(new Event('beforeunload'));});
  unmount();
  expect(update).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
