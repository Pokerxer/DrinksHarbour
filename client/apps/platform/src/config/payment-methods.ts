/**
 * Customer-facing payment method labels.
 *
 * Keys mirror the Order.paymentMethod enum (server/utils/paymentMethods.js).
 * Shared so the same order doesn't read as "Bank Transfer (Korapay)" on the
 * confirmation page and "Bank Transfer" in My Account — the my-account pages
 * used to title-case the raw enum instead ("Cash On Delivery").
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Credit / Debit Card',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cash_on_delivery: 'Cash on Delivery',
  cash: 'Cash',
  wallet: 'DH Wallet',
  gift_card: 'Gift Card',
  split: 'Split Payment',
};

/** Label for a stored method, falling back to a readable form of the raw value. */
export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '—';
  return (
    PAYMENT_METHOD_LABELS[method] ??
    method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
