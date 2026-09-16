import { describe, expect, it } from 'vitest';
import { buildPOSCheckout, buildPOSRefund } from './pos-documents';

const order = {
  _id: 'order-1',
  receiptNumber: 'R-001',
  total: 10750,
  subtotal: 10000,
  paymentMethod: 'cash',
  change: 250,
  placedAt: '2026-09-15T10:00:00.000Z',
  posStaff: 'Cashier',
  items: [{ name: 'Reserve Red Wine', variant: '750ml', sku: 'RRW', quantity: 1, priceAtPurchase: 10000, itemSubtotal: 10000, discountAmount: 0 }],
} as const;

describe('POS document adapters', () => {
  it('keeps checkout totals, payment details and tenant name in the shared model', () => {
    const model = buildPOSCheckout(order as any, { name: 'Cloud Bay' });
    expect(model.companyName).toBe('CLOUD BAY');
    expect(model.number).toBe('R-001');
    expect(model.totals.some((total) => total.value.includes('10,750.00'))).toBe(true);
    expect(model.table.rows[0][0].sub).toBe('750ml');
  });

  it('builds return documents with the original invoice reference and refund total', () => {
    const model = buildPOSRefund(order as any, {
      receiptNumber: 'RET-001',
      totalRefunded: 10000,
      paymentMethod: 'cash',
      items: [{ orderItemIndex: 0, quantity: 1, unitPrice: 10000, amount: 10000 }],
    }, { name: 'Cloud Bay' });
    expect(model.docTitle).toBe('Return receipt');
    expect(model.meta[0]).toEqual(['Original invoice', 'R-001']);
    expect(model.totals[0].value).toContain('10,000.00');
  });
});
