type PurchaseLine = {
  subProductId: string;
  sizeId?: string;
  quantity: number;
  receivedQty?: number;
  returnedQty?: number;
  totalCost?: number;
  unitCost?: number;
  unitPrice?: number;
  packPrice?: number;
  packagingQty?: number;
  packSize?: number;
};

export const purchaseReturnKey = (item: Pick<PurchaseLine, 'subProductId' | 'sizeId'>) =>
  `${item.subProductId}:${item.sizeId || ''}`;

export function returnablePurchaseQuantity(
  item: PurchaseLine,
  previous: Record<string, number>,
): number {
  const returned = previous[purchaseReturnKey(item)] || 0;
  return Math.max(0, (item.receivedQty || 0) - returned);
}

export function purchaseReturnUnitPrice(
  item: Pick<
    PurchaseLine,
    'quantity' | 'totalCost' | 'unitCost' | 'unitPrice' | 'packPrice' | 'packagingQty' | 'packSize'
  >,
): number {
  if (item.quantity > 0 && item.totalCost != null) return item.totalCost / item.quantity;
  if (item.unitCost != null) return item.unitCost;
  if (item.unitPrice != null) return item.unitPrice;
  return (item.packPrice || 0) / (item.packagingQty || item.packSize || 1);
}

export function wholeInvoiceReturnQuantities(
  items: PurchaseLine[],
  pending: Record<string, number>,
  invoice?: Record<string, number>,
): number[] {
  return items.map((item) =>
    Math.min(
      returnablePurchaseQuantity(item, pending),
      invoice ? invoice[purchaseReturnKey(item)] || 0 : Infinity,
    ),
  );
}

export function invoiceReturnQuantities(
  items: { subProductId?: string; sizeId?: string; quantity: number }[],
  returns: {
    vendorBill?: string | { _id: string };
    status: string;
    items: { subProductId?: string; sizeId?: string; quantity: number }[];
  }[],
  billId: string,
  quantitiesAlreadyAdjusted: boolean,
): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const item of items) {
    if (!item.subProductId) continue;
    const key = purchaseReturnKey({ ...item, subProductId: item.subProductId });
    quantities[key] = (quantities[key] || 0) + item.quantity;
  }
  for (const entry of returns) {
    const id = typeof entry.vendorBill === 'object' ? entry.vendorBill._id : entry.vendorBill;
    if (id !== billId || entry.status === 'cancelled') continue;
    if (quantitiesAlreadyAdjusted && entry.status !== 'draft') continue;
    for (const item of entry.items) {
      if (!item.subProductId) continue;
      const key = purchaseReturnKey({ ...item, subProductId: item.subProductId });
      quantities[key] = Math.max(0, (quantities[key] || 0) - item.quantity);
    }
  }
  return quantities;
}
