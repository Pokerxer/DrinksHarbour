// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInvoiceCreateActions } from './use-invoice-create-actions';
import { arApService } from '@/services/arAp.service';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(arApService, 'saveInvoiceDraft').mockResolvedValue({
    success: true,
    data: {
      _id: 'invoice-1',
    } as import('@/services/arAp.service').SavedInvoice,
  });
});
const options = () => ({
  token: 'token',
  orderId: 'draft-1',
  dueDate: '2026-10-20',
  saveError: '',
  issueError: '',
  ensureSaved: vi.fn().mockResolvedValue('draft-1'),
  onPrint: vi.fn().mockResolvedValue(undefined),
  onIssued: vi.fn(),
});
it('does not print when the separate invoice draft could not be saved', async () => {
  const input = options();
  vi.mocked(arApService.saveInvoiceDraft).mockRejectedValue(
    new Error('Invoice draft save failed')
  );
  const { result } = renderHook(() => useInvoiceCreateActions(input));
  await act(async () => {
    await result.current.print();
  });
  expect(input.onPrint).not.toHaveBeenCalled();
  expect(result.current.error).toBe('Invoice draft save failed');
});
it('blocks issue after a failed save and exposes the error', async () => {
  const input = options();
  input.ensureSaved.mockResolvedValue(null);
  vi.spyOn(salesOrderService, 'get').mockResolvedValue({
    success: true,
    data: {} as SalesOrder,
  });
  const issue = vi.spyOn(arApService, 'issueInvoice');
  const { result } = renderHook(() => useInvoiceCreateActions(input));
  await act(async () => {
    await result.current.issue();
  });
  expect(issue).not.toHaveBeenCalled();
  expect(result.current.error).toMatch(/save/i);
});
it('recognizes an already-issued retry without saving or posting twice', async () => {
  const input = options();
  vi.spyOn(salesOrderService, 'get').mockResolvedValue({
    success: true,
    data: { invoiceIssuedAt: '2026-10-13' } as SalesOrder,
  });
  const issue = vi.spyOn(arApService, 'issueInvoice');
  const { result } = renderHook(() => useInvoiceCreateActions(input));
  await act(async () => {
    await result.current.issue();
  });
  expect(input.ensureSaved).not.toHaveBeenCalled();
  expect(issue).not.toHaveBeenCalled();
  expect(input.onIssued).toHaveBeenCalledOnce();
});
it('prints only after forcing the latest draft edits to save', async () => {
  const input = options();
  const { result } = renderHook(() => useInvoiceCreateActions(input));
  await act(async () => {
    await result.current.print();
  });
  expect(input.ensureSaved).toHaveBeenCalledWith(true);
  expect(input.onPrint).toHaveBeenCalledWith('draft-1');
  expect(arApService.saveInvoiceDraft).toHaveBeenCalledWith('token', 'draft-1');
});
it('ignores issue clicks while a print is pending', async () => {
  const input = options();
  let finish!: () => void;
  input.onPrint.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const issue = vi.spyOn(arApService, 'issueInvoice');
  const { result } = renderHook(() => useInvoiceCreateActions(input));
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current.print();
    await Promise.resolve();
  });
  expect(result.current.action).toBe('printing');
  await act(async () => {
    await result.current.issue();
  });
  expect(issue).not.toHaveBeenCalled();
  await act(async () => {
    finish();
    await pending;
  });
});
it('issues the saved id and chosen due date exactly once', async () => {
  const input = options();
  vi.spyOn(salesOrderService, 'get').mockResolvedValue({
    success: true,
    data: {} as SalesOrder,
  });
  const issue = vi
    .spyOn(arApService, 'issueInvoice')
    .mockResolvedValue({ success: true, data: { _id: 'draft-1' } });
  const { result } = renderHook(() => useInvoiceCreateActions(input));
  await act(async () => {
    await Promise.all([result.current.issue(), result.current.issue()]);
  });
  expect(issue).toHaveBeenCalledOnce();
  expect(issue).toHaveBeenCalledWith('token', 'draft-1', '2026-10-20');
});
