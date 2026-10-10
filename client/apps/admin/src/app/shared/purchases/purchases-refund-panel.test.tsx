// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PurchaseRefundPanel from './purchases-refund-panel';
import { vendorReturnService, type VendorReturn } from '@/services/vendorReturn.service';
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const ret = {
  _id: 'r',
  totalAmount: 100,
  refundAmount: 60,
  currency: 'NGN',
  refunds: [],
} as unknown as VendorReturn;
it('refund shortcuts use the remaining balance and submit a retry identity', async () => {
  const save = vi
    .spyOn(vendorReturnService, 'recordRefund')
    .mockResolvedValue({ success: true, data: ret });
  const complete = vi.fn();
  render(<PurchaseRefundPanel ret={ret} token="t" onComplete={complete} onCancel={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '100%' }));
  expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('40.00');
  fireEvent.click(screen.getByRole('button', { name: 'Record received refund' }));
  await waitFor(() => expect(complete).toHaveBeenCalledWith(ret));
  expect(save.mock.calls[0][1]).toMatchObject({
    amount: 40,
    method: 'bank_transfer',
    requestId: expect.any(String),
  });
});
it('over-refunds never reach the API', () => {
  const save = vi.spyOn(vendorReturnService, 'recordRefund');
  render(<PurchaseRefundPanel ret={ret} token="t" onComplete={() => {}} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record received refund' }));
  expect(save).not.toHaveBeenCalled();
});
