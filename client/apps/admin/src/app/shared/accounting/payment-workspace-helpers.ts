import type { PaymentDoc, PaymentSide } from '@/services/arAp.service';
export function paymentParty(payment: PaymentDoc, side: PaymentSide) {
  return side === 'customer'
    ? payment.customerName ||
        [payment.customer?.firstName, payment.customer?.lastName]
          .filter(Boolean)
          .join(' ') ||
        'Customer unavailable'
    : payment.vendorName || payment.vendor?.name || 'Vendor unavailable';
}
export function paymentAmounts(payment: PaymentDoc) {
  const allocated =
    Math.round(
      (payment.allocations || []).reduce(
        (sum, a) => sum + Number(a.amount || 0),
        0
      ) * 100
    ) / 100;
  return {
    allocated,
    unallocated: payment.readOnly
      ? 0
      : Math.max(
          0,
          Math.round((Number(payment.amount) - allocated) * 100) / 100
        ),
  };
}
export const paymentMethod = (method: string) => method.replace(/_/g, ' ');
