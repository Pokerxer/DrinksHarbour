import { invoiceSettlementLabel, returnLabel } from './invoice-return-helpers';
import { routes } from '@/config/routes';
import { csvCell } from './accounting-helpers';
import type {
  OpenInvoice,
  OpenBill,
  PaymentSide,
} from '@/services/arAp.service';
export type AccountingDocument = OpenInvoice | OpenBill;
export function documentView(doc: AccountingDocument, side: PaymentSide) {
  const invoice = doc as OpenInvoice;
  const bill = doc as OpenBill;
  const ar = side === 'customer';
  return {
    label: (ar ? invoice.orderNumber : bill.billNumber) || 'Untitled document',
    name: ar
      ? invoice.customerSnapshot?.name ||
        `${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`.trim() ||
        'Walk-in customer'
      : bill.vendor?.name || bill.vendorName || 'Vendor',
    href: ar
      ? invoice.persisted
        ? `/accounting/invoices/${doc._id}`
        : invoice.source === 'pos'
          ? routes.eCommerce.orderDetails(doc._id)
          : routes.eCommerce.salesDetails(doc._id)
      : routes.eCommerce.vendorBillDetails(doc._id),
    sourceLabel: ar ? (invoice.source === 'pos' ? 'POS' : 'Sales') : '',
    total: ar ? invoice.total : bill.totalAmount,
    paid: ar ? invoice.amountPaid : bill.paidAmount,
    credited: ar ? invoice.creditedAmount || 0 : 0,
    status: ar
      ? invoice.state && invoice.state !== 'posted'
        ? invoice.state
        : invoice.paymentStatus
      : bill.status,
  };
}

const nigeriaDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export function documentDue(doc: AccountingDocument, now = new Date()) {
  if (doc.outstanding <= 0) return { overdue: false, label: 'Settled' };
  const due = doc.dueDate ? new Date(doc.dueDate) : null;
  if (!due || Number.isNaN(due.getTime()))
    return { overdue: false, label: 'Not set' };
  const days = Math.round(
    (Date.parse(nigeriaDate(now)) - Date.parse(nigeriaDate(due))) / 86400000
  );
  return {
    overdue: days > 0,
    label:
      days > 0
        ? `${days} ${days === 1 ? 'day' : 'days'} overdue`
        : days === 0
          ? 'Due today'
          : `Due in ${-days} ${days === -1 ? 'day' : 'days'}`,
  };
}

export function documentStatus(status: string) {
  return (
    (
      {
        partial: 'Partially paid',
        paid: 'Paid',
        unpaid: 'Unpaid',
        confirmed: 'Unpaid',
        overdue: 'Overdue',
        draft: 'Draft · Review',
        cancelled: 'Cancelled',
      } as Record<string, string>
    )[status] || status
  );
}

export function documentCsv(docs: AccountingDocument[], side: PaymentSide) {
  const headers = [
    side === 'customer' ? 'Invoice' : 'Bill',
    side === 'customer' ? 'Customer' : 'Vendor',
    'Issued',
    'Due date',
    'Status',
    'Total (NGN)',
    'Paid (NGN)',
    'Credited (NGN)',
    'Outstanding (NGN)',
    ...(side === 'customer'
      ? [
          'Source',
          'Return status',
          'Returned units',
          'Verified refunds (NGN)',
          'Posted credit notes (NGN)',
        ]
      : []),
  ];
  const rows = docs.map((doc) => {
    const view = documentView(doc, side);
    return [
      view.label,
      view.name,
      doc.date,
      doc.dueDate || '',
      side === 'customer' &&
      (!(doc as OpenInvoice).state || (doc as OpenInvoice).state === 'posted')
        ? invoiceSettlementLabel(doc as OpenInvoice)
        : documentStatus(view.status),
      view.total,
      view.paid,
      view.credited,
      doc.outstanding,
      ...(side === 'customer'
        ? [
            view.sourceLabel,
            returnLabel(doc as OpenInvoice),
            (doc as OpenInvoice).returnSummary?.recordedUnits || 0,
            (doc as OpenInvoice).refundedAmount || 0,
            (doc as OpenInvoice).creditNoteAmount || 0,
          ]
        : []),
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function documentPageLabel(
  page: number,
  limit: number,
  count: number,
  total: number,
  side: PaymentSide = 'customer'
) {
  if (!count) return `0 matching ${side === 'customer' ? 'invoices' : 'bills'}`;
  const start = (page - 1) * limit + 1;
  return `Showing ${start}–${Math.min(start + count - 1, total)} of ${total}`;
}
export function allocationError(
  amount: number,
  allocations: { docId: string; amount: string }[],
  docs: AccountingDocument[]
) {
  if (!Number.isFinite(amount) || amount <= 0)
    return 'Enter a positive payment amount.';
  const seen = new Set<string>();
  const parties = new Set<string>();
  let total = 0;
  for (const allocation of allocations) {
    if (seen.has(allocation.docId)) return 'Allocate each document only once.';
    seen.add(allocation.docId);
    const doc = docs.find((d) => d._id === allocation.docId);
    if (!doc) return 'The selected document is no longer available.';
    const party =
      (doc as OpenInvoice).customer?._id || (doc as OpenBill).vendor?._id;
    if (party) parties.add(party);
    const value = Number(allocation.amount);
    if (!Number.isFinite(value) || value <= 0)
      return 'Enter a positive allocation amount.';
    if (Math.round(value * 100) > Math.round(doc.outstanding * 100))
      return 'An allocation exceeds its outstanding balance.';
    total += Math.round(value * 100);
  }
  if (parties.size > 1)
    return 'Allocate a payment to one customer or vendor at a time.';
  return total > Math.round(amount * 100)
    ? 'Allocations exceed the payment amount.'
    : '';
}
export function accountingNavActive(
  href: string,
  pathname: string,
  side: string
) {
  const [path, query] = href.split('?');
  if (path !== pathname) return false;
  const requiredSide = new URLSearchParams(query).get('side');
  return !requiredSide || requiredSide === (side || 'customer');
}
