// Commercial editing is separate from warehouse operations. A locked document
// can still be delivered or returned through the existing stock workflows.
function canEdit(so) {
  if (so.locked || so.invoiceIssuedAt) return false;
  if (so.docType === 'quotation')
    return ['draft', 'sent'].includes(so.quoteStatus);
  return so.orderStatus === 'draft';
}

function cancellationReason(so) {
  if (so.locked) return 'Unlock this document before cancelling it.';
  if (
    so.docType === 'quotation' &&
    ['converted', 'rejected'].includes(so.quoteStatus)
  )
    return 'This quotation can no longer be cancelled.';
  if (
    so.docType === 'order' &&
    ['fulfilled', 'cancelled', 'partially_fulfilled'].includes(so.orderStatus)
  )
    return 'This order is delivered or closed. Use the returns workflow for delivered goods.';
  if (
    (so.items || []).some((item) => item.fulfilledQty > 0) ||
    (so.fulfillments || []).some((row) =>
      (row.items || []).some((item) => item.qty > 0),
    )
  )
    return 'Goods have been delivered. Use the returns workflow.';
  if (
    so.amountPaid > 0 ||
    ['paid', 'partial'].includes(so.paymentStatus) ||
    so.walletTxRef
  )
    return 'Payment has been recorded. Review credits and refunds before cancelling.';
  if (so.invoiceIssuedAt || so.relatedInvoice)
    return 'An invoice has been issued. Review the invoice and credit workflow before cancelling.';
  return null;
}

function assertUnlocked(so) {
  if (!so.locked) return;
  const error = new Error('Unlock this document before changing it.');
  error.statusCode = 409;
  throw error;
}

module.exports = { canEdit, cancellationReason, assertUnlocked };
