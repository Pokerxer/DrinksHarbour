// Report-order types shared by every POS analytics surface. Mirrors the server's
// services/posReportOrder.service.js projection — the net-sales fields are
// computed there, never in the browser.

export interface ReportLineNetTotals {
  netSales?: number;
  returnedQuantity?: number;
  netQuantity?: number;
}

export interface ReportOrderItem extends ReportLineNetTotals {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  /** Pre-discount line value: priceAtPurchase x quantity. */
  grossSubtotal?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  /** What the tenant paid for this stock when it was sold. Authoritative for profit. */
  costPriceAtPurchase?: number;
  /** The Size model's *current* cost. Falls back to costPriceAtPurchase on legacy lines. */
  sizeCostPrice?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  warehouse?: { _id: string; name?: string; code?: string } | null;
}

export interface ReportOrderRefundLine {
  orderItemIndex: number;
  quantity: number;
  amount?: number;
  salesReturnedQuantity?: number;
}

export interface ReportOrderRefund {
  receiptNumber?: string;
  items?: ReportOrderRefundLine[];
  source?: 'sales' | 'pos';
  reason?: string;
  totalRefunded?: number;
  paymentMethod?: string;
  refundedAt?: string;
}

export interface ReportOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;

  /** Cash the customer handed over: goods + tip +/- cash rounding. */
  total: number;
  /** Goods value before tax, order discount, tip and rounding. */
  subtotal?: number;
  /** Goods value at the till before returns. Excludes tip and rounding. */
  grossRevenue?: number;
  /** Goods value at the till after returns. Excludes tip and rounding. */
  netSales?: number;
  /** Returns/refunds removed from commercial sales. */
  returnDeduction?: number;
  /** Cash refunds paid out (excludes Sales stock returns, which refund nothing). */
  totalRefunds?: number;
  /** Value of stock returned through Sales with no cash movement. */
  salesReturnValue?: number;
  /** Cash still held after refunds: the drawer reconciliation figure. */
  netCollections?: number;
  returnStatus?: 'none' | 'partially_returned' | 'returned';

  /** Staff gratuity. Never product income. */
  tipAmount?: number;
  totalTips?: number;
  /** Cash-tender rounding delta. Never product income. */
  roundingAmount?: number;
  totalRounding?: number;

  /** Cashier/threshold footer discount. Line discounts are separate. */
  discountTotal?: number;
  /** Sum of per-line and bundle discounts, already netted out of itemSubtotal. */
  lineDiscountTotal?: number;
  /** Withheld unless the receipt is quotation-linked. */
  taxAmount?: number;

  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  isVoided?: boolean;
  placedAt: string;
  createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    customerId?: string | null;
  } | null;
  session?: { _id: string; terminalType?: string; openedAt?: string } | null;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[] };
  items?: ReportOrderItem[];
  refunds?: ReportOrderRefund[];
}

const VOID_STATUSES = ['hold', 'voided', 'cancelled'];

/**
 * The minimum an order must carry for the money helpers below. Deliberately
 * narrow: these read a handful of fields, and the POS order list, the session
 * report and the analysis page each declare their own richer order type. Typing
 * the helpers against this rather than `ReportOrder` lets all three share one
 * implementation without a cast.
 */
export interface NetSalesOrder {
  total: number;
  subtotal?: number;
  grossRevenue?: number;
  netSales?: number;
  returnDeduction?: number;
  totalRefunds?: number;
  salesReturnValue?: number;
  tipAmount?: number;
  totalTips?: number;
  roundingAmount?: number;
  totalRounding?: number;
  discountTotal?: number;
  lineDiscountTotal?: number;
  taxAmount?: number;
  isVoided?: boolean;
  status?: string;
  items?: ReportOrderItem[];
  refunds?: ReportOrderRefund[];
}

/** True when the receipt was recalled or voided and must contribute nothing. */
export function isVoided(order: Pick<NetSalesOrder, 'isVoided' | 'status'>): boolean {
  return !!order.isVoided || order.status === 'voided';
}

/**
 * Commercial sales after returns. Prefers the server's authoritative figure and
 * only falls back to arithmetic for a legacy order that predates the field.
 * A server-sent 0 is a real zero (a fully returned receipt), so `??` not `||`.
 */
export function netSales(order: NetSalesOrder): number {
  if (isVoided(order) || VOID_STATUSES.includes(order.status || '')) return 0;
  if (order.netSales !== undefined) return order.netSales;
  const gross = order.grossRevenue ?? order.subtotal ?? order.total;
  return gross - returnDeduction(order);
}

/** Value removed from commercial sales by returns and refunds. Never negative. */
export function returnDeduction(order: NetSalesOrder): number {
  if (order.returnDeduction !== undefined) return order.returnDeduction;
  return (order.refunds || []).reduce((sum, row) => sum + (row.totalRefunded || 0), 0);
}

/** Cash refunds paid out. Stock returned through Sales moves no cash. */
export function cashRefunded(order: NetSalesOrder): number {
  if (order.totalRefunds !== undefined) return order.totalRefunds;
  return (order.refunds || [])
    .filter((row) => row.source !== 'sales')
    .reduce((sum, row) => sum + (row.totalRefunded || 0), 0);
}

/** Staff gratuity on this receipt. */
export function tipAmount(order: NetSalesOrder): number {
  return order.totalTips ?? order.tipAmount ?? 0;
}

/** Cash-tender rounding delta on this receipt. */
export function roundingAmount(order: NetSalesOrder): number {
  return order.totalRounding ?? order.roundingAmount ?? 0;
}

/** Every naira given away, on both the line and the receipt footer. */
export function totalDiscount(order: NetSalesOrder): number {
  const line = order.lineDiscountTotal ?? (order.items || [])
    .reduce((sum, i) => sum + (i.discountAmount || 0), 0);
  return (order.discountTotal || 0) + line;
}

/** Tax charged on this receipt. Withheld unless quotation-linked. */
export function taxCollected(order: NetSalesOrder): number {
  return order.taxAmount ?? (order.items || []).reduce((sum, i) => sum + (i.taxAmount || 0), 0);
}

/** Units still held by the customer after returns. */
export function netQuantity(item: ReportOrderItem): number {
  return item.netQuantity ?? item.quantity;
}

/** Line revenue after returns. */
export function lineNetSales(item: ReportOrderItem): number {
  return item.netSales ?? item.itemSubtotal;
}

/**
 * The cost this stock was bought for when it was sold. Falls back to the Size
 * model's current cost only for legacy lines with no snapshot, so a profit report
 * does not silently rewrite history when a cost price is edited today.
 */
export function lineCost(item: ReportOrderItem): number {
  const snapshot = item.costPriceAtPurchase ?? 0;
  return snapshot > 0 ? snapshot : item.sizeCostPrice ?? 0;
}

/** A walk-in is a real sale, but counting them as distinct customers is wrong. */
export function isWalkIn(order: {
  customer?: ReportOrderCustomer | null;
}): boolean {
  const c = order.customer;
  if (!c) return true;
  if (c.customerId) return false;
  return !c.phone && (!c.firstName || c.firstName === 'Walk-in');
}

export interface ReportOrderCustomer {
  firstName?: string;
  lastName?: string;
  phone?: string;
  customerId?: string | null;
}

/**
 * Distinct customers in a set of receipts. Registered customers count by
 * customerId; walk-in sales are counted separately rather than collapsing into
 * a single "Walk-in Customer" identity.
 */
export function countCustomers(orders: { customer?: ReportOrderCustomer | null }[]): {
  unique: number;
  walkIn: number;
} {
  const ids = new Set<string>();
  let walkIn = 0;
  for (const o of orders) {
    if (isWalkIn(o)) {
      walkIn++;
      continue;
    }
    const c = o.customer;
    if (c?.customerId) ids.add(c.customerId);
    else ids.add(`${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim());
  }
  return { unique: ids.size, walkIn };
}

/** Cashier display name, falling back to the order id so cashiers never merge. */
export function cashierLabel(staff?: ReportOrder['posStaff']): string {
  if (!staff) return 'Unknown';
  return (
    staff.posName || `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() || 'Unknown'
  );
}
