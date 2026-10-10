import type { POSOrderResponse } from '../types';

type ReceiptMoney = Pick<POSOrderResponse, 'total' | 'taxAmount' | 'tipAmount' | 'roundingAmount'>;
type ReceiptTaxSettings = {
  showTaxOnReceipt: boolean;
  taxRate: number;
  taxEnabled?: boolean;
};

/**
 * The tax line on a printed receipt.
 *
 * Prefers the tax actually charged. Zero is authoritative too: a zero-rated
 * receipt must not acquire the tenant's default VAT, and an order that recorded
 * no tax must not be given an invented one.
 *
 * The estimate is a last resort for receipts that predate the recorded field —
 * it backs the tax out of a total that is itself tax-inclusive, which is only
 * meaningful when the tenant is actually charging VAT. Showing it because a
 * tenant asked for a tax *breakdown* on the receipt would put a number on a
 * receipt for tax that was never charged.
 */
export function receiptTax(order: ReceiptMoney, settings: ReceiptTaxSettings) {
  if (order.taxAmount != null) {
    return { label: 'VAT', amount: order.taxAmount };
  }
  const charging = !!settings.taxEnabled && settings.taxRate > 0;
  if (!charging || !settings.showTaxOnReceipt) return null;
  const goods = order.total - (order.tipAmount || 0) - (order.roundingAmount || 0);
  return {
    label: `VAT ${settings.taxRate}%`,
    amount: (goods * settings.taxRate) / (100 + settings.taxRate),
  };
}
