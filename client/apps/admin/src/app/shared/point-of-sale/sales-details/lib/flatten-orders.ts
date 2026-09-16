import type { PosOrder, LineRow } from '../types';

export function flattenOrders(orders: PosOrder[]): LineRow[] {
  const rows: LineRow[] = [];
  for (const o of orders) {
    if (!o.items?.length) continue;
    const cashier = o.posStaff
      ? o.posStaff.posName ||
        `${o.posStaff.firstName} ${o.posStaff.lastName}`.trim()
      : 'Unknown';
    for (const item of o.items) {
      const subtotal = item.itemSubtotal;
      const discount = item.discountAmount ?? 0;
      const gross = subtotal + discount;
      const costPrice = (item.sizeCostPrice ?? 0) * item.quantity;
      const profit = costPrice > 0 ? subtotal - costPrice : 0;
      rows.push({
        orderId: o._id,
        orderNumber: o.orderNumber ?? o._id.slice(-6).toUpperCase(),
        receiptNumber: o.receiptNumber ?? '',
        date: o.placedAt || o.createdAt,
        cashier,
        product: item.name,
        variant: item.variant ?? '',
        category: item.category ?? '',
        subcategory: item.subcategory ?? '',
        brand: item.brand ?? '',
        qty: item.quantity,
        unitPrice: item.priceAtPurchase,
        discount,
        subtotal,
        gross,
        costPrice,
        profit,
        paymentMethod: o.paymentMethod,
        isVoided: !!(o.isVoided || o.status === 'voided'),
        warehouse: item.warehouse?.name ?? '',
      });
    }
  }
  return rows;
}