import { billReturnSummary } from '@/app/shared/purchases/invoice-return-summary';
import type { VendorBill } from '@/services/vendorBill.service';
import { fmtAmt, fmtDate, moneyWords } from './print-shared';
import type { DocumentModel, DocCell } from './doc-model';

export function buildBillInvoice(bill: VendorBill, companyName: string): DocumentModel {
  const summary = billReturnSummary(bill);
  const amountDue = Math.max(0, bill.totalAmount - bill.paidAmount);

  const rows: DocCell[][] = bill.items.map((item, index) => {
    const name = item.subProductName ?? '—';
    const size = item.sizeName ? ` – ${item.sizeName}` : '';
    return [
      {
        text: `${name}${size}`,
        ...(summary.lines[index].returned > 0
          ? {
              sub: `${summary.lines[index].original ?? '—'} invoiced · ${summary.lines[index].returned} returned · ${summary.lines[index].remaining} remaining`,
            }
          : {}),
      },
      { text: String(item.quantity) },
      { text: fmtAmt(item.unitPrice, bill.currency) },
      { text: `${item.taxRate ?? 0}%` },
      { text: fmtAmt(item.amount, bill.currency), strong: true },
    ];
  });

  let miniTables: DocumentModel['miniTables'] = bill.payments?.length
    ? [
        {
          title: `Payments (${bill.payments.length})`,
          columns: [
            ['Date', 'left'],
            ['Method', 'left'],
            ['Reference', 'left'],
            ['Amount', 'right'],
          ] as [string, 'left' | 'center' | 'right'][],
          rows: bill.payments.map((p): DocCell[] => [
            { text: fmtDate(p.date) },
            { text: (p.method ?? '—').replace(/_/g, ' ') },
            { text: p.reference ?? '—' },
            { text: fmtAmt(p.amount, bill.currency), color: '#16a34a' },
          ]),
        },
      ]
    : undefined;

  const totals: DocumentModel['totals'] = [
    { label: 'Subtotal', value: fmtAmt(bill.subtotal, bill.currency) },
    { label: 'Tax', value: fmtAmt(bill.taxAmount, bill.currency) },
    {
      label: 'Total',
      value: fmtAmt(bill.totalAmount, bill.currency),
      variant: 'grand',
    },
  ];
  if (bill.paidAmount > 0) {
    totals.push({
      label: 'Paid to date',
      value: `− ${fmtAmt(bill.paidAmount, bill.currency)}`,
      color: '#16a34a',
    });
    totals.push({
      label: 'Balance Due',
      value: fmtAmt(amountDue, bill.currency),
      variant: 'strong',
      color: amountDue > 0 ? '#dc2626' : '#16a34a',
    });
  }

  if (summary.credit != null && summary.credit > 0)
    totals.unshift(
      { label: 'Original invoice', value: fmtAmt(summary.originalTotal!, bill.currency) },
      { label: 'Return credit', value: `− ${fmtAmt(summary.credit, bill.currency)}` },
    );
  if (summary.refundRemaining > 0)
    totals.push({
      label: 'Supplier refund remaining',
      value: fmtAmt(summary.refundRemaining, bill.currency),
    });
  if (summary.linked.length)
    (miniTables || (miniTables = [])).push({
      title: `Returns (${summary.linked.length})`,
      columns: [
        ['Return', 'left'],
        ['Date', 'left'],
        ['Status', 'left'],
        ['Value', 'right'],
      ],
      rows: summary.linked.map((entry) => [
        { text: entry.returnNumber },
        { text: fmtDate(entry.createdAt || entry.returnDate) },
        { text: entry.status.replace(/_/g, ' ') },
        { text: fmtAmt(entry.totalAmount, bill.currency) },
      ]),
    });
  const sections: DocumentModel['sections'] = [];
  if (bill.terms) sections.push({ title: 'Payment Terms', body: bill.terms });
  if (bill.notes) sections.push({ title: 'Notes', body: bill.notes });

  return {
    kind: 'bill',
    ...(summary.lines.some((line) => line.returned > 0)
      ? {
          notice: {
            tone: 'info' as const,
            title: summary.fullyReturned ? 'Fully returned' : 'Adjusted after returns',
            body: 'Return adjustments are shown below. Payment history remains recorded.',
          },
        }
      : {}),
    companyName,
    department: 'Vendor Bill',
    docTitle: 'Vendor Bill',
    number: bill.billNumber,
    status: bill.status,
    watermark: bill.status === 'paid' ? 'PAID' : bill.status === 'overdue' ? 'OVERDUE' : undefined,
    parties: [
      { heading: 'Bill From (Vendor)', name: bill.vendorName },
      { heading: 'Bill To (Buyer)', name: companyName },
    ],
    meta: [
      ['Bill Date', fmtDate(bill.billDate)],
      ['Due Date', fmtDate(bill.dueDate)],
      ['Currency', bill.currency],
      ['Reference', bill.billNumber],
    ],
    table: {
      columns: [
        { label: 'Product' },
        { label: 'Qty', align: 'center' },
        { label: 'Unit Price', align: 'right' },
        { label: 'Tax', align: 'right' },
        { label: 'Amount', align: 'right' },
      ],
      rows,
    },
    miniTables,
    totals,
    words: moneyWords(bill.totalAmount, bill.currency),
    sections,
    signatures: [
      { role: 'Received & checked by (Buyer)' },
      { role: 'Vendor Authorised Signature' },
    ],
    fileName: `Vendor Bill ${bill.billNumber}.pdf`,
  };
}
