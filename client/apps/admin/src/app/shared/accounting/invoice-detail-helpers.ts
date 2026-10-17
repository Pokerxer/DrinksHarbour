import type { SavedInvoice } from '@/services/arAp.service';
export function invoiceMoney(invoice: SavedInvoice, amount = 0) {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: invoice.currency || 'NGN',
    }).format(value);
  } catch {
    return `${invoice.currency || 'NGN'} ${value.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }
}
export function invoiceActions(invoice: SavedInvoice) {
  const posted = invoice.state === 'posted';
  return {
    canReceive:
      posted &&
      !invoice.reconciliationIssue &&
      invoice.outstanding > 0 &&
      invoice.currency === 'NGN',
    canEdit:
      invoice.state === 'draft' &&
      invoice.source === 'sales' &&
      !!invoice.editableDraft,
    state:
      invoice.state === 'posted'
        ? 'Posted'
        : invoice.state === 'cancelled'
          ? 'Cancelled'
          : 'Draft',
  };
}
export function invoiceTotals(invoice: SavedInvoice) {
  const rows: Array<[string, number]> = [
    ['Subtotal', invoice.subtotal],
    ['Discount', -invoice.discountTotal],
    ['Promotions', -(invoice.promotionTotal || 0)],
    ['Coupon', -(invoice.couponDiscount || 0)],
    ['Pricelist discount', -(invoice.pricelistCartDiscount || 0)],
    ['Loyalty', -(invoice.loyaltyRedeemed || 0)],
    ['VAT', invoice.taxTotal],
    ['Shipping', invoice.shippingFee || 0],
    ['Tip', invoice.tipAmount || 0],
    ['Rounding', invoice.roundingAmount || 0],
    ['Total', invoice.total],
    ['Paid', invoice.amountPaid],
    ['Credit / refunds', invoice.creditedAmount || 0],
    ['Outstanding', invoice.outstanding],
  ];
  return rows.filter(
    ([label, amount]) =>
      amount !== 0 ||
      ['Subtotal', 'Total', 'Paid', 'Outstanding'].includes(label)
  );
}
