import type { OpenInvoice } from '@/services/arAp.service';
export const returnLabel = (invoice: OpenInvoice) =>
  ({
    none: '',
    partial: 'Partially returned',
    full: 'Fully returned',
    review: 'Return quantity review',
  })[invoice.returnSummary?.status || 'none'];
export function creditReviewPending(invoice: OpenInvoice) {
  return (
    invoice.source === 'sales' &&
    invoice.state === 'posted' &&
    (invoice.returnSummary?.recordedUnits || 0) > 0 &&
    !(invoice.creditNoteAmount || invoice.creditedAmount)
  );
}
export function invoiceSettlementLabel(invoice: OpenInvoice) {
  if (invoice.state === 'cancelled') return 'Payment closed';
  if (
    invoice.state === 'posted' &&
    invoice.total > 0 &&
    invoice.outstanding <= 0
  ) {
    if (
      invoice.source === 'pos' &&
      (invoice.refundedAmount || 0) >= invoice.total - 0.01
    )
      return 'Fully refunded';
    if (
      Math.max(invoice.creditNoteAmount || 0, invoice.creditedAmount || 0) >=
      invoice.total - 0.01
    )
      return 'Fully credited';
  }
  return invoice.paymentStatus === 'paid'
    ? 'Paid'
    : invoice.paymentStatus === 'partial'
      ? 'Partially paid'
      : 'Unpaid';
}
