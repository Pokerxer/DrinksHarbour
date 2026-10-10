type RefundQuantities = {
  source?: 'sales' | 'pos';
  items: { orderItemIndex: number; quantity: number; salesReturnedQuantity?: number }[];
};

// A Sales stock return does not settle the customer's monetary refund.
export function computeRefundedMap(refunds: RefundQuantities[] = []): Record<number, number> {
  const quantities: Record<number, number> = {};
  for (const refund of refunds) {
    if (refund.source === 'sales') continue;
    for (const line of refund.items) {
      quantities[line.orderItemIndex] = (quantities[line.orderItemIndex] || 0) + line.quantity;
    }
  }
  return quantities;
}


// Physical returns include Sales stock returns and POS returns; old cash-only
// settlements overlap Sales quantities and must not count a second time.
export function computeReturnedMap(refunds: RefundQuantities[] = []): Record<number, number> {
  const quantities: Record<number, number> = {};
  for (const refund of refunds) {
    for (const line of refund.items) {
      const overlap = refund.source === 'sales' ? 0 : Math.min(line.quantity, Math.max(0, line.salesReturnedQuantity || 0));
      quantities[line.orderItemIndex] = (quantities[line.orderItemIndex] || 0) + Math.max(0, line.quantity - overlap);
    }
  }
  return quantities;
}
