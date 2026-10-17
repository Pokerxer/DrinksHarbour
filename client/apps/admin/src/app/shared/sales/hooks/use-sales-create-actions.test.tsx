// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSalesCreateActions } from './use-sales-create-actions';
import { salesOrderService } from '@/services/salesOrder.service';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
vi.mock('@/utils/salesInvoice', () => ({
  printQuotation: vi.fn(),
  printProformaInvoice: vi.fn(),
}));
const form = {
  priced: [
    {
      lineType: 'product',
      subProductId: 'product',
      quantity: 1,
      unitPrice: 100,
    },
  ],
  grandTotal: 100,
  validUntil: '',
  setSaving: vi.fn(),
} as never;
it('printing flushes the latest draft and prevents simultaneous confirmation', async () => {
  let release!: (id: string) => void;
  const pendingSave = new Promise<string>((resolve) => {
    release = resolve;
  });
  const ensureSaved = vi.fn(() => pendingSave);
  const convert = vi
    .spyOn(salesOrderService, 'convert')
    .mockResolvedValue({ success: true, data: {} } as never);
  vi.spyOn(salesOrderService, 'get').mockResolvedValue({
    success: true,
    data: {},
  } as never);
  const { result } = renderHook(() =>
    useSalesCreateActions({
      form,
      token: 'token',
      ensureSaved,
      router: { push: vi.fn() } as never,
      tenantName: 'Shop',
      onHistory: vi.fn(),
    })
  );
  let print!: Promise<unknown>, confirm!: Promise<unknown>;
  act(() => {
    print = result.current.handlePrint('quotation');
    confirm = result.current.handleSave(true);
  });
  const saves = ensureSaved.mock.calls.length;
  await act(async () => {
    release('draft');
    await Promise.all([print, confirm]);
  });
  expect(saves).toBe(1);
  expect(ensureSaved).toHaveBeenCalledWith(true);
  expect(convert).not.toHaveBeenCalled();
});
it('presentation-only lines cannot be confirmed or saved as a quotation', async () => {
  const ensureSaved = vi.fn().mockResolvedValue('draft');
  const { result } = renderHook(() =>
    useSalesCreateActions({
      form: {
        ...(form as object),
        priced: [{ lineType: 'section', quantity: 0, unitPrice: 0 }],
      } as never,
      token: 'token',
      ensureSaved,
      router: { push: vi.fn() } as never,
      tenantName: 'Shop',
      onHistory: vi.fn(),
    })
  );
  await act(() => result.current.handleSave(false));
  expect(ensureSaved).not.toHaveBeenCalled();
});

it('retrying confirmation after a lost response opens the converted order without rewriting it', async () => {
  const ensureSaved = vi.fn().mockResolvedValue('draft');
  const convert = vi
    .spyOn(salesOrderService, 'convert')
    .mockResolvedValue({ success: true, data: {} } as never);
  vi.spyOn(salesOrderService, 'get').mockResolvedValue({
    success: true,
    data: { _id: 'draft', docType: 'order' },
  } as never);
  const push = vi.fn();
  const { result } = renderHook(() =>
    useSalesCreateActions({
      form,
      token: 'token',
      orderId: 'draft',
      ensureSaved,
      router: { push } as never,
      tenantName: 'Shop',
      onHistory: vi.fn(),
    })
  );
  await act(() => result.current.handleSave(true));
  expect(ensureSaved).not.toHaveBeenCalled();
  expect(convert).not.toHaveBeenCalled();
  expect(push).toHaveBeenCalledWith('/sales/draft');
});

it('printing a locked saved document never flushes or changes it',async()=>{
  const ensureSaved=vi.fn();
  vi.spyOn(salesOrderService,'get').mockResolvedValue({success:true,data:{_id:'sale'}} as never);
  const {result}=renderHook(()=>useSalesCreateActions({form,token:'token',readOnly:true,orderId:'sale',ensureSaved,router:{push:vi.fn()} as never,tenantName:'Shop',onHistory:vi.fn()}));
  await act(()=>result.current.handlePrint('quotation'));
  expect(ensureSaved).not.toHaveBeenCalled();
  expect(result.current.error).toBe('');
});

it('creation confirmation saves first and reserves without opening payment', async()=>{
  const ensureSaved=vi.fn().mockResolvedValue('draft');
  const reserve=vi.spyOn(salesOrderService,'confirmReservation').mockResolvedValue({success:true,data:{}} as never);
  const payment=vi.spyOn(salesOrderService,'confirm');
  const {result}=renderHook(()=>useSalesCreateActions({form,token:'token',ensureSaved,router:{push:vi.fn()} as never,tenantName:'Shop',onHistory:vi.fn()}));
  await act(()=>result.current.handleSave(true));
  expect(ensureSaved).toHaveBeenCalledWith(true);expect(reserve).toHaveBeenCalledWith('draft','token');
  expect(payment).not.toHaveBeenCalled();
});
it('coupon failures reach the editor panel instead of being reported as success',async()=>{
 vi.spyOn(salesOrderService,'applyCoupon').mockRejectedValue(new Error('Coupon expired'));
 const {result}=renderHook(()=>useSalesCreateActions({form,token:'token',ensureSaved:vi.fn().mockResolvedValue('draft'),router:{push:vi.fn()} as never,tenantName:'Shop',onHistory:vi.fn()}));
 await act(async()=>{await expect(result.current.handleCoupon('OLD')).rejects.toThrow('Coupon expired');});
});
