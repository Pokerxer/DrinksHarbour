// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PurchaseRefundHistory } from './purchases-refund-panel';
import type { VendorReturn } from '@/services/vendorReturn.service';
afterEach(cleanup);
it('shows each refund actor and preserves the earlier legacy balance', () => {
  const ret = { currency: 'NGN', totalAmount: 100, refundAmount: 70,
    refunds: [{ _id: 'a', amount: 20, method: 'cash', date: '2026-10-03T00:00:00Z',
      recordedBy: { _id: 'u', name: 'Ada' }, reference: 'REF-2', notes: 'Second payment' }] } as unknown as VendorReturn;
  render(<PurchaseRefundHistory ret={ret} />);
  expect(screen.getByText(/Ada/)).toBeTruthy();
  expect(screen.getByText(/Earlier refunds/)).toBeTruthy();
  expect(screen.getByText(/REF-2/)).toBeTruthy();
});
