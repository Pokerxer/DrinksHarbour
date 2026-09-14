import { describe, it, expect } from 'vitest';
import {
  documentView,
  allocationError,
  accountingNavActive,
} from './accounting-documents';
import type { OpenInvoice } from '@/services/arAp.service';
const invoice = {
  _id: 'so',
  orderNumber: 'SO-1',
  date: '2026-09-01',
  total: 100,
  amountPaid: 20,
  outstanding: 50,
  paymentStatus: 'partial',
  creditedAmount: 30,
  customerSnapshot: { name: 'Ada' },
} as OpenInvoice;
describe('accounting document interactions', () => {
  it('links invoices to sales and preserves paid and credited amounts', () => {
    expect(documentView(invoice, 'customer')).toMatchObject({
      href: '/sales/so',
      label: 'SO-1',
      name: 'Ada',
      paid: 20,
      credited: 30,
    });
  });
  it('rejects duplicate allocations and allocation above outstanding', () => {
    expect(
      allocationError(
        100,
        [
          { docId: 'so', amount: '10' },
          { docId: 'so', amount: '10' },
        ],
        [invoice]
      )
    ).toMatch(/once/);
    expect(
      allocationError(100, [{ docId: 'so', amount: '51' }], [invoice])
    ).toMatch(/outstanding/);
  });
  it('rejects missing documents and non-finite amounts', () => {
    expect(allocationError(Infinity, [], [])).toMatch(/amount/);
    expect(allocationError(10, [{ docId: 'gone', amount: '1' }], [])).toMatch(
      /available/
    );
  });
  it('distinguishes customer and vendor navigation on the same route', () => {
    expect(
      accountingNavActive(
        '/accounting/payments?side=vendor',
        '/accounting/payments',
        'vendor'
      )
    ).toBe(true);
    expect(
      accountingNavActive(
        '/accounting/payments?side=customer',
        '/accounting/payments',
        'vendor'
      )
    ).toBe(false);
  });
});
