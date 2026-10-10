import { expect, it } from 'vitest';
import { billReturnSummary } from './invoice-return-summary';
import type { VendorBill } from '@/services/vendorBill.service';
import type { VendorReturn } from '@/services/vendorReturn.service';
it('ignores draft, cancelled and other-invoice returns when displaying returned units and refunds', () => {
  const bill = { _id: 'b', items: [{ subProductId: 'p', quantity: 6 }], totalAmount: 600, paidAmount: 1000 } as VendorBill;
  const entry = { _id: 'r', vendorBill: 'b', status: 'confirmed', items: [{ subProductId: 'p', quantity: 4 }], refundAmount: 100 } as VendorReturn;
  const summary = billReturnSummary(bill, [entry, { ...entry, _id: 'draft', status: 'draft' }, { ...entry, _id: 'cancelled', status: 'cancelled' }, { ...entry, _id: 'other', vendorBill: 'other' }]);
  expect(summary.lines[0].returned).toBe(4);
  expect(summary.refunds).toBe(100);
  expect(summary.refundRemaining).toBe(300);
  expect(summary.linked).toHaveLength(3);
});
it('cancelled adjustments keep their history without reducing quantities a second time', () => {
  const summary = billReturnSummary({ _id: 'b', items: [{ subProductId: 'p', quantity: 10 }], totalAmount: 1000, paidAmount: 0, returnAdjustments: [{ vendorReturn: 'r', active: false, lines: [{ itemIndex: 0, quantity: 4 }] }] } as VendorBill);
  expect(summary.lines[0].returned).toBe(0);
  expect(summary.fullyReturned).toBe(false);
});
