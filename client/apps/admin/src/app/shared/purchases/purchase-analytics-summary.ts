import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import type { PurchaseAnalyticsSummary } from '@/services/purchaseAnalytics.service';
import {
  itemName,
  itemSubProductKey,
  lineUntaxed,
  lineTax,
  localDayKeyOf,
  poDate,
  toFiniteNumber,
} from './purchases-analytics-helpers';
/** Ordered-value widgets follow the same projected ledger as graph/pivot/export. */
export function buildPurchaseSummary(
  orders: PurchaseOrder[],
  toBase: (amount: number, currency: string) => number,
): PurchaseAnalyticsSummary {
  const summary: PurchaseAnalyticsSummary = {
    totalPOs: orders.length,
    totalAmount: 0,
    statusBreakdown: { draft: 0, confirmed: 0, received: 0, validated: 0, cancelled: 0 },
    approvalBreakdown: { pending: 0, approved: 0, rejected: 0 },
    pendingApprovals: 0,
    topVendors: [],
    monthlyTrend: [],
    sizeBreakdown: [],
    topProducts: [],
  };
  const vendors = new Map<string, PurchaseAnalyticsSummary['topVendors'][number]>();
  const months = new Map<string, PurchaseAnalyticsSummary['monthlyTrend'][number]>();
  const sizes = new Map<string, PurchaseAnalyticsSummary['sizeBreakdown'][number]>();
  const products = new Map<string, PurchaseAnalyticsSummary['topProducts'][number]>();
  for (const order of orders) {
    const status = order.status === 'cancel' ? 'cancelled' : order.status;
    if (status in summary.statusBreakdown)
      summary.statusBreakdown[status as keyof typeof summary.statusBreakdown]++;
    if (order.approvalStatus && order.approvalStatus in summary.approvalBreakdown)
      summary.approvalBreakdown[order.approvalStatus as keyof typeof summary.approvalBreakdown]++;
    const currency = order.currency || 'NGN';
    const amount = (order.items || []).reduce(
      (sum, item) => sum + toBase(lineUntaxed(item) + lineTax(item), currency),
      0,
    );
    summary.totalAmount += amount;
    const name = order.vendorName || 'Unknown Vendor';
    const vendor = vendors.get(name) || { name, count: 0, amount: 0 };
    vendor.count++;
    vendor.amount += amount;
    vendors.set(name, vendor);
    const date = poDate(order);
    if (Number.isFinite(date.getTime())) {
      const month = localDayKeyOf(date).slice(0, 7);
      const row = months.get(month) || { month, count: 0, amount: 0 };
      row.count++;
      row.amount += amount;
      months.set(month, row);
    }
    const countedSizes = new Set<string>();
    const countedProducts = new Set<string>();
    for (const item of order.items || []) {
      const sizeName = item.sizeName || item.size || 'Default';
      const productName = itemName(item);
      const key = `${itemSubProductKey(item) || productName}:${item.sizeId || sizeName}`;
      const value = toBase(lineUntaxed(item) + lineTax(item), currency);
      const size = sizes.get(sizeName) || {
        sizeName,
        totalQuantity: 0,
        totalAmount: 0,
        orderCount: 0,
      };
      const product = products.get(key) || {
        productName,
        sizeName,
        totalQuantity: 0,
        totalAmount: 0,
        orderCount: 0,
      };
      for (const row of [size, product]) {
        row.totalQuantity += toFiniteNumber(item.quantity);
        row.totalAmount += value;
      }
      if (!countedSizes.has(sizeName)) size.orderCount++;
      if (!countedProducts.has(key)) product.orderCount++;
      countedSizes.add(sizeName);
      countedProducts.add(key);
      sizes.set(sizeName, size);
      products.set(key, product);
    }
  }
  summary.pendingApprovals = summary.approvalBreakdown.pending;
  summary.topVendors = Array.from(vendors.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  summary.monthlyTrend = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
  summary.sizeBreakdown = Array.from(sizes.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  summary.topProducts = Array.from(products.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  return summary;
}
