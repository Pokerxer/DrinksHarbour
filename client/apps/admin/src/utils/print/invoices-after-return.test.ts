import { expect, it } from 'vitest';
import { buildBillInvoice } from './bill-print';
import { buildTransferInvoice } from './transfer-print';
import type { VendorBill } from '@/services/vendorBill.service';
import type { StockTransfer } from '@/services/stockTransfer.service';
it('prints original invoice, return credit, remaining value and refund balance without changing paid history', () => {
  const bill = {
    _id: 'b',
    billNumber: 'B1',
    vendorName: 'Supplier',
    currency: 'NGN',
    status: 'paid',
    items: [{ subProductId: 'p', quantity: 6, unitPrice: 100, taxRate: 0, amount: 600 }],
    subtotal: 600,
    taxAmount: 0,
    totalAmount: 600,
    paidAmount: 1000,
    payments: [],
    originalInvoice: {
      items: [{ subProductId: 'p', quantity: 10, unitPrice: 100, taxRate: 0, amount: 1000 }],
      subtotal: 1000,
      taxAmount: 0,
      totalAmount: 1000,
    },
    returnAdjustments: [{ vendorReturn: 'r', lines: [{ itemIndex: 0, quantity: 4 }] }],
    returns: [
      {
        _id: 'r',
        returnNumber: 'R1',
        vendorBill: 'b',
        status: 'confirmed',
        items: [{ subProductId: 'p', quantity: 4 }],
        refundAmount: 100,
        totalAmount: 400,
      },
    ],
  } as unknown as VendorBill;
  const doc = buildBillInvoice(bill, 'Buyer');
  expect(doc.table.rows[0][0].sub).toBe('10 invoiced · 4 returned · 6 remaining');
  expect(doc.totals).toContainEqual(
    expect.objectContaining({ label: 'Original invoice', value: 'NGN 1,000.00' }),
  );
  expect(doc.totals).toContainEqual(
    expect.objectContaining({ label: 'Return credit', value: '− NGN 400.00' }),
  );
  expect(doc.totals).toContainEqual(
    expect.objectContaining({ label: 'Supplier refund remaining', value: 'NGN 300.00' }),
  );
  expect(doc.miniTables?.some((table) => table.title.startsWith('Returns'))).toBe(true);
});
it('fully returned transfer prints a returned notice, zero total and recorded history', () => {
  const doc = buildTransferInvoice(
    {
      transferNumber: 'T1',
      status: 'completed',
      currency: 'NGN',
      items: [
        { subProductName: 'Wine', quantity: 10, receivedQty: 10, returnedQty: 10, costPrice: 100 },
      ],
      total: 0,
      subtotal: 0,
      returns: [
        {
          returnedAt: '2026-10-03',
          returnedBy: { name: 'Ada' },
          refundedValue: 1000,
          remainingValue: 0,
          lines: [{ itemIndex: 0, quantity: 10 }],
        },
      ],
    } as unknown as StockTransfer,
    'Buyer',
  );
  expect(doc.notice?.title).toBe('Fully returned');
  expect(doc.miniTables?.[0].rows[0].map((cell) => cell.text).join(' ')).toContain('Ada');
  expect(doc.totals).toContainEqual(
    expect.objectContaining({ label: 'Original invoice', value: 'NGN 1,000.00' }),
  );
});
