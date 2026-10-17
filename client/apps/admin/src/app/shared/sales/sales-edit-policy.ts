import type { SalesOrder } from '@/services/salesOrder.service';
import { outstanding } from './sales-helpers';

export function editableSale(so: SalesOrder): boolean {
  if (so.locked || so.invoiceIssuedAt) return false;
  return so.docType === 'quotation'
    ? ['draft', 'sent'].includes(so.quoteStatus || '')
    : so.orderStatus === 'draft';
}

export function cancelSaleReason(so: SalesOrder): string | null {
  if (so.locked) return 'Unlock this document before cancelling it.';
  if (
    so.docType === 'quotation' &&
    ['converted', 'rejected'].includes(so.quoteStatus || '')
  )
    return 'This quotation is already closed.';
  if (so.docType === 'order' && so.orderStatus === 'cancelled')
    return 'This order is already cancelled.';
  if (
    ['fulfilled', 'partially_fulfilled'].includes(so.orderStatus || '') ||
    so.items.some((item) => item.fulfilledQty > 0) ||
    so.fulfillments?.some((row) => row.items.some((item) => item.qty > 0))
  )
    return 'Goods have been delivered. Use returns for delivered goods.';
  if (
    (so.amountPaid || 0) > 0 ||
    ['paid', 'partial'].includes(so.paymentStatus || '') ||
    so.walletTxRef
  )
    return 'Payment has been recorded. Review credits and refunds before cancelling.';
  if (so.invoiceIssuedAt || so.relatedInvoice)
    return 'Review the issued invoice and credit workflow before cancelling.';
  return null;
}

export function lockableSale(so: SalesOrder): boolean {
  if (so.locked) return true; // Always allow clearing a historical lock.
  return so.docType === 'quotation'
    ? !['converted', 'rejected', 'expired'].includes(so.quoteStatus || '')
    : so.orderStatus !== 'cancelled';
}

export function deliveryLines(so: SalesOrder) {
  return so.items.filter(
    (item) => !item.lineType || item.lineType === 'product',
  );
}

export function canDeliverSale(so: SalesOrder): boolean {
  return (
    so.docType === 'order' &&
    ['confirmed', 'partially_fulfilled'].includes(so.orderStatus || '') &&
    deliveryLines(so).some((item) => outstanding(item) > 0)
  );
}
