import { expect, it } from 'vitest';
import {
  documentDue,
  documentCsv,
  documentPageLabel,
} from './accounting-documents';
import type { OpenInvoice, OpenBill } from '@/services/arAp.service';
const doc: OpenInvoice = {
  _id: 'one',
  orderNumber: '=SUM(A1)',
  date: '2026-10-01',
  dueDate: '2026-10-12',
  customerSnapshot: { name: 'Ada, Obi' },
  total: 100,
  amountPaid: 20,
  creditedAmount: 5,
  outstanding: 75,
  paymentStatus: 'partial',
};
it('uses Nigerian calendar days and never invents a due date', () => {
  expect(documentDue(doc, new Date('2026-10-12T23:30:00Z'))).toMatchObject({
    overdue: true,
    label: '1 day overdue',
  });
  expect(
    documentDue(
      { ...doc, dueDate: '2026-10-13' },
      new Date('2026-10-13T10:00:00Z')
    )
  ).toMatchObject({ overdue: false, label: 'Due today' });
  expect(documentDue({ ...doc, dueDate: undefined })).toMatchObject({
    overdue: false,
    label: 'Not set',
  });
  expect(documentDue({ ...doc, dueDate: 'invalid' })).toMatchObject({
    overdue: false,
    label: 'Not set',
  });
});
it('exports only supplied rows with invoice amounts and safe CSV cells', () => {
  const csv = documentCsv([doc], 'customer');
  expect(csv).toContain("'=SUM(A1)");
  expect(csv).toContain('"Ada, Obi"');
  expect(csv).toContain('"100","20","5","75"');
  expect(csv.split('\n')).toHaveLength(2);
});
it('exports vendor bills using bill fields', () => {
  const bill: OpenBill = {
    _id: 'bill',
    billNumber: 'BILL-1',
    date: '2026-10-01',
    vendorName: 'Supplier',
    totalAmount: 200,
    paidAmount: 10,
    outstanding: 190,
    status: 'partial',
  };
  expect(documentCsv([bill], 'vendor')).toContain('"200","10","0","190"');
});
it('reports the visible range without pretending an empty page has rows', () => {
  expect(documentPageLabel(2, 25, 3, 28)).toBe('Showing 26–28 of 28');
  expect(documentPageLabel(1, 25, 0, 0)).toBe('0 matching invoices');
});
