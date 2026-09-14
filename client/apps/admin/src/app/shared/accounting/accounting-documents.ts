import { routes } from '@/config/routes';
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
      ? invoice.customer
        ? `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim()
        : invoice.customerSnapshot?.name || 'Walk-in customer'
      : bill.vendor?.name || bill.vendorName || 'Vendor',
    href: ar
      ? routes.eCommerce.salesDetails(doc._id)
      : routes.eCommerce.vendorBillDetails(doc._id),
    total: ar ? invoice.total : bill.totalAmount,
    paid: ar ? invoice.amountPaid : bill.paidAmount,
    credited: ar ? invoice.creditedAmount || 0 : 0,
    status: ar ? invoice.paymentStatus : bill.status,
  };
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
