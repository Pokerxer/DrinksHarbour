import { expect, it } from 'vitest';
import type { SavedInvoice } from '@/services/arAp.service';
import { buildCustomerInvoice } from './customer-invoice';
import { renderDocument } from './pdf-render';
const invoice = {
  _id: 'invoice',
  number: 'INV-2026-1',
  source: 'sales',
  sourceId: 'source',
  sourceNumber: 'SO-1',
  state: 'posted',
  currency: 'NGN',
  date: '2026-10-13',
  subtotal: 100,
  discountTotal: 10,
  taxTotal: 7,
  total: 97,
  amountPaid: 40,
  outstanding: 57,
  paymentStatus: 'partial',
  items: [
    {
      lineType: 'product',
      name: 'Wine',
      quantity: 1,
      unitPrice: 100,
      lineTotal: 90,
      taxAmount: 7,
    },
  ],
  customerSnapshot: { name: 'Saved customer' },
  detailContext: {
    issuer: { name: 'Wyn City', bankAccounts: [] },
    activity: [],
  },
} as SavedInvoice;
it('uses the shared document model and preserves saved financial amounts and identity', () => {
  const doc = buildCustomerInvoice(invoice);
  expect(doc.kind).toBe('invoice');
  expect(doc.number).toBe(invoice.number);
  expect(doc.companyName).toBe('Wyn City');
  expect(doc.totals.find((row) => row.label === 'Total')?.value).toContain(
    '97.00'
  );
  expect(
    doc.totals.find((row) => row.label === 'Outstanding')?.value
  ).toContain('57.00');
  expect(doc.table.rows[0][0].text).toBe('Wine');
  const pdf = renderDocument({ ...doc, templateId: 'classic' });
  expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(1000);
});
it('marks drafts and cancellations in the system invoice template', () => {
  expect(buildCustomerInvoice({ ...invoice, state: 'draft' }).watermark).toBe(
    'DRAFT'
  );
  expect(
    buildCustomerInvoice({ ...invoice, state: 'cancelled' }).watermark
  ).toBe('CANCELLED');
});
it('omits item tax columns while retaining VAT and saved amounts in totals', () => {
  const doc = buildCustomerInvoice({
    ...invoice,
    items: [
      ...invoice.items,
      { lineType: 'section', name: 'Beverages' },
      { lineType: 'note', name: 'Handle with care' },
    ],
  } as SavedInvoice);
  expect(doc.table.columns.map((column) => column.label)).toEqual([
    'Description',
    'Qty',
    'Unit price',
    'Amount',
  ]);
  expect(doc.table.rows.every((row) => row.length === 4)).toBe(true);
  expect(doc.table.rows[0][3].text).toContain('90.00');
  expect(doc.totals.find((row) => row.label === 'VAT')?.value).toContain(
    '7.00'
  );
  expect(doc.totals.find((row) => row.label === 'Total')?.value).toContain(
    '97.00'
  );
});
it('preserves issued amounts and four columns while annotating returned goods and credit status', () => {
  const returned = buildCustomerInvoice({
    ...invoice,
    paymentStatus: 'paid',
    amountPaid: 0,
    creditedAmount: 97,
    creditNoteAmount: 97,
    outstanding: 0,
    returnSummary: {
      status: 'full',
      returnedUnits: 1,
      recordedUnits: 1,
      soldUnits: 1,
      needsReview: false,
      refundRecorded: false,
      truncated: false,
      lines: [],
    },
  });
  expect(returned.status).toBe('FULLY CREDITED');
  expect(returned.table.columns.map((column) => column.label)).toEqual([
    'Description',
    'Qty',
    'Unit price',
    'Amount',
  ]);
  expect(returned.table.rows[0][1].text).toBe('1');
  expect(returned.totals.find((row) => row.label === 'Total')?.value).toContain(
    '97.00'
  );
  expect(
    returned.sections.find((section) => section.title === 'Returned goods')
      ?.body
  ).toContain('Fully returned');
});
