import type { PosOrder, LineRow } from '../types';
import { lineCost, lineNetSales, netQuantity } from '../../report-totals';
import { paymentAttribution } from '../../analysis/measures';

export function flattenOrders(orders: PosOrder[]): LineRow[] {
  const rows: LineRow[] = [];
  for (const o of orders) {
    if (!o.items?.length) continue;
    const cashier = o.posStaff
      ? o.posStaff.posName ||
        `${o.posStaff.firstName} ${o.posStaff.lastName}`.trim()
      : 'Unknown';
    // A receipt tendered across two methods is not one method. `paymentMethod`
    // alone reported the first leg only, so a cash+card sale looked like a pure
    // cash sale in the table, the grouping and every export built on it.
    const tender = paymentAttribution(o);
    for (const item of o.items) {
      const subtotal = lineNetSales(item);
      const quantity = netQuantity(item);
      const discount = item.discountAmount ?? 0;
      const gross = item.itemSubtotal + discount;
      const unitCost = lineCost(item);
      const costPrice = unitCost * quantity;
      // A line with no cost basis is a gap in the data, not a free product.
      // Reporting it as 100% margin would invent profit; reporting its revenue
      // at 0% margin would invent loss. It is flagged, and the summary reports
      // the revenue it covers separately.
      const hasCost = unitCost > 0;
      const profit = hasCost ? subtotal - costPrice : 0;
      // The server allocates the receipt's commercial gross across lines and
      // reports what each line lost to returns, so gross − returns === net holds
      // exactly. A legacy line that predates those fields gets the pair derived
      // together, so the summary identity survives the fallback rather than
      // breaking on an order the tenant can see but we cannot reconcile.
      const preDiscount = item.itemSubtotal + discount;
      const grossShare = item.grossShare ?? preDiscount;
      const returnedValue =
        item.returnedValue ?? Math.max(0, grossShare - subtotal);
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
        qty: quantity,
        unitPrice: item.priceAtPurchase,
        discount,
        subtotal,
        gross,
        grossShare,
        returnedValue,
        costPrice,
        hasCost,
        profit,
        paymentMethod: tender.method,
        splitPayment: tender.split,
        paymentShares: tender.shares,
        isVoided: !!(o.isVoided || o.status === 'voided'),
        warehouse: item.warehouse?.name ?? '',
      });
    }
  }
  return rows;
}
