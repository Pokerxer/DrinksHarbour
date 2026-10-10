import type {
  PurchaseOrder,
  POItem,
  PurchaseReceiptMetrics,
} from '@/services/purchaseOrder.service';
const finite = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
export function receiptMetrics(item: POItem): PurchaseReceiptMetrics {
  if (item.receiptMetrics)
    return Object.fromEntries(
      Object.entries(item.receiptMetrics).map(([k, v]) => [k, finite(v)]),
    ) as unknown as PurchaseReceiptMetrics;
  // Compatibility with older saved feeds. The analytics endpoint supplies
  // authoritative receipt/return documents, including split-warehouse history.
  const returnedQuantity = finite(item.returnedQty);
  const netReceivedQuantity = finite(item.receivedQty);
  const receivedQuantity = netReceivedQuantity + returnedQuantity;
  const unit =
    (finite(item.quantity) > 0 && Number.isFinite(item.totalCost)
      ? finite(item.totalCost) / item.quantity
      : finite(item.unitCost ?? item.unitPrice)) *
    (1 + finite(item.taxRate) / 100);
  return {
    receivedQuantity,
    returnedQuantity,
    netReceivedQuantity,
    receivedValue: receivedQuantity * unit,
    returnedValue: returnedQuantity * unit,
    netReceivedValue: netReceivedQuantity * unit,
  };
}
export function purchaseReceiptTotals(orders: PurchaseOrder[]) {
  const currencies = new Map<string, PurchaseReceiptMetrics & { currency: string }>();
  for (const order of orders) {
    if (['cancel', 'cancelled'].includes(order.status)) continue;
    const currency = order.currency || 'NGN';
    const row = currencies.get(currency) || {
      currency,
      receivedQuantity: 0,
      returnedQuantity: 0,
      netReceivedQuantity: 0,
      receivedValue: 0,
      returnedValue: 0,
      netReceivedValue: 0,
    };
    for (const item of order.items || []) {
      const metrics = receiptMetrics(item);
      for (const key of Object.keys(metrics) as (keyof PurchaseReceiptMetrics)[])
        row[key] += metrics[key];
    }
    currencies.set(currency, row);
  }
  return { currencies: Array.from(currencies.values()) };
}
