import { expect, it } from 'vitest';
import { buildPOSSessionDocument } from './pos-session-document';
import type { POSSession } from '@/app/shared/point-of-sale/types';
it('session export distinguishes stock returns, cash refunds and remaining units', () => {
  const session: POSSession = { tenant: 'tenant', openedBy: { _id: 'cashier', firstName: 'A', lastName: 'B' },
    cashierLog: [], openingCash: 0, methodBalances: [], hasDifference: false,
    cardSales: 0, transferSales: 0, mobileMoneySales: 0, splitSales: 0, notes: '', closingNotes: '', openingBalance: 0,
    _id: 'session', status: 'open', openedAt: '2026-09-28',
    totalSales: 50, netCollections: 100, returnDeduction: 150, orderCount: 2,
    cashSales: 200, currentPaymentTotals: { cash: { total: 100, count: 2 } },
  };
  const result = buildPOSSessionDocument(session, [
    { items: [{ quantity: 2 }], refunds: [{ source: 'sales', totalRefunded: 0, items: [{ orderItemIndex: 0, quantity: 1 }] }] },
    { items: [{ quantity: 2 }], refunds: [{ totalRefunded: 100, items: [{ orderItemIndex: 0, quantity: 2 }] }] },
  ]);
  const rows = Object.fromEntries(result.table!.rows.map(row => [row[0].text, row[1].text]));
  expect(rows['Net sales']).toBe('NGN 50.00');
  expect(rows['Net collections']).toBe('NGN 100.00');
  expect(rows['Cash']).toBe('NGN 100.00');
  expect(rows['Items sold']).toBe('1');
  expect(rows['Refunded orders']).toBe('1');
});
