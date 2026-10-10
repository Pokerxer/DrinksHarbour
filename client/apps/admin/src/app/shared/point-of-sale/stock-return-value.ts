export type StockReturnItem = {
  name?: string;
  variant?: string;
  quantity: number;
  priceAtPurchase?: number;
  itemSubtotal?: number;
  discountAmount?: number;
};

// Value of the returned goods from the original receipt, never money refunded.
export function stockReturnValue(item: StockReturnItem | undefined, quantity: number) {
  if (!item || item.quantity <= 0) return { unitPrice: null, value: null };
  const unitPrice = item.priceAtPurchase ?? null;
  const soldValue = item.itemSubtotal ?? (unitPrice === null ? null :
    Math.max(0, unitPrice * item.quantity - (item.discountAmount || 0)));
  return { unitPrice, value: soldValue === null ? null :
    Math.round(soldValue * Math.min(item.quantity, Math.max(0, quantity)) / item.quantity * 100) / 100 };
}
