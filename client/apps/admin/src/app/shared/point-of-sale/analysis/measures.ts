// The single source of truth for every number the POS order-analysis page shows.
//
// This module replaces three hand-written copies of the same measure switch that
// lived in the page (the group builder, the multi-series chart and the pivot).
// They had already drifted — one ignored item-grouped pivots, one ignored
// product filters — so the same measure produced different figures depending on
// which chart the operator was looking at. There is now exactly one
// implementation, and the three views call it.
//
// Money rules, applied everywhere:
//   * `netSales` is the server's figure: goods at the till after returns. It
//     already has the receipt's footer discount deducted, so nothing deducts it
//     a second time.
//   * A tip is money for the staff and cash rounding is a tender artefact.
//     Neither is product income; both are reported, never folded into sales.
//   * Profit uses the cost the tenant actually paid when the stock was sold
//     (`costPriceAtPurchase`), not the Size model's current cost.

import {
  cashierLabel,
  cashRefunded,
  countCustomers,
  isVoided,
  lineCost,
  lineNetSales,
  netQuantity,
  netSales,
  returnDeduction,
  roundingAmount,
  taxCollected,
  tipAmount,
  totalDiscount,
  type NetSalesOrder,
  type ReportOrder,
  type ReportOrderCustomer,
  type ReportOrderItem,
} from '../report-totals';

export type GroupByKey =
  | 'cashier'
  | 'payment_method'
  | 'product'
  | 'terminal'
  | 'product_category'
  | 'subcategory'
  | 'brand'
  | 'warehouse'
  | 'order_day'
  | 'order_week'
  | 'order_month'
  | 'order_quarter'
  | 'order_year';

export type Measure =
  | 'total_price'
  | 'count'
  | 'avg_price'
  | 'product_qty'
  | 'line_count'
  | 'gross'
  | 'tax'
  | 'total_discount'
  | 'total_refunds'
  | 'tips'
  | 'profit'
  | 'margin'
  | 'delay_validation';

export const ITEM_DIMS = new Set<GroupByKey>([
  'product',
  'product_category',
  'subcategory',
  'brand',
]);

export const MEASURES: { key: Measure; label: string; separator?: boolean }[] = [
  { key: 'total_price', label: 'Net Revenue' },
  { key: 'gross', label: 'Gross Sales' },
  { key: 'total_refunds', label: 'Returns & Refunds' },
  { key: 'total_discount', label: 'Discount Given' },
  { key: 'tax', label: 'Tax Collected' },
  { key: 'tips', label: 'Gratuities' },
  { key: 'count', label: 'Orders', separator: true },
  { key: 'avg_price', label: 'Avg Order Value' },
  { key: 'product_qty', label: 'Items Sold' },
  { key: 'line_count', label: 'Sale Lines' },
  { key: 'profit', label: 'Gross Profit', separator: true },
  { key: 'margin', label: 'Profit Margin %' },
  { key: 'delay_validation', label: 'Validation Delay' },
];

export const IS_CURRENCY: Record<Measure, boolean> = {
  total_price: true,
  gross: true,
  total_refunds: true,
  total_discount: true,
  tax: true,
  tips: true,
  profit: true,
  count: false,
  avg_price: true,
  product_qty: false,
  line_count: false,
  margin: false,
  delay_validation: false,
};

export const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card/POS',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  split: 'Split',
  wallet: 'Wallet',
  other: 'Other',
};

export type ProdMeta = Record<
  string,
  { catName?: string; subCatName?: string; brandName?: string; catId?: string; brandId?: string }
>;

// ── Line-level economics ─────────────────────────────────────────────────────

/** One line's contribution, plus whether its cost basis is actually known. */
export interface LineEconomics {
  revenue: number;
  cost: number;
  profit: number;
  /** False when the tenant never costed this line, so profit cannot be trusted. */
  costed: boolean;
}

export function lineEconomics(item: ReportOrderItem): LineEconomics {
  const revenue = lineNetSales(item);
  const unitCost = lineCost(item);
  const qty = netQuantity(item);
  if (unitCost <= 0) {
    // No cost basis. Revenue is real, cost is unknown — report the revenue but
    // mark it uncosted so callers can exclude it from profit rather than
    // silently booking an inflated margin.
    return { revenue, cost: 0, profit: 0, costed: false };
  }
  const cost = unitCost * qty;
  return { revenue, cost, profit: revenue - cost, costed: true };
}

/** Aggregate a set of lines, separating revenue we can cost from revenue we cannot. */
export function sumLines(items: ReportOrderItem[]): {
  revenue: number;
  cost: number;
  profit: number;
  uncostedRevenue: number;
  uncostedLines: number;
} {
  let revenue = 0, cost = 0, profit = 0, uncostedRevenue = 0, uncostedLines = 0;
  for (const item of items) {
    const e = lineEconomics(item);
    revenue += e.revenue;
    if (e.costed) {
      cost += e.cost;
      profit += e.profit;
    } else {
      uncostedRevenue += e.revenue;
      uncostedLines += 1;
    }
  }
  return { revenue, cost, profit, uncostedRevenue, uncostedLines };
}

// ── Measure evaluation ───────────────────────────────────────────────────────

/**
 * The set a measure is evaluated over. For an order-level grouping (cashier,
 * payment method, day) this is the orders and all their lines. For an item-level
 * grouping (product, brand, category) it is the distinct orders touching those
 * items plus the matching items only — so a product row reports that product,
 * not the whole basket it happened to sit in.
 *
 * Typed structurally rather than as `ReportOrder` so the order list, the session
 * report and the analysis page can each pass their own order type without a cast.
 */
export type ScopeOrder = NetSalesOrder & DimOrder & {
  _id?: string;
  customer?: ReportOrderCustomer | null;
};

export interface MeasureScope {
  orders: ScopeOrder[];
  items: ReportOrderItem[];
  /** True when the grouping dimension is a product attribute. */
  isItemGroup: boolean;
}

function scopeOrders(scope: MeasureScope): ScopeOrder[] {
  return scope.orders;
}

function scopeItems(scope: MeasureScope): ReportOrderItem[] {
  return scope.isItemGroup ? scope.items : scope.orders.flatMap((o) => o.items || []);
}

function scopeRevenue(scope: MeasureScope): number {
  return scope.isItemGroup
    ? scopeItems(scope).reduce((s, i) => s + lineNetSales(i), 0)
    : scopeOrders(scope).reduce((s, o) => s + netSales(o), 0);
}

/**
 * Distinct receipts in a scope. A product row must count each basket once even
 * when it bought three of the same bottle, so a line-level grouping counts orders
 * rather than lines. Falls back to the position in the list when a receipt has no
 * id, so a partially populated payload cannot collapse every order into one.
 */
function distinctOrderCount(orders: ScopeOrder[]): number {
  const seen = new Set<string>();
  orders.forEach((o, index) => seen.add(o._id ?? `#${index}`));
  return seen.size;
}

function scopeProfit(scope: MeasureScope): number {
  // Profit is only ever computed from lines, never from the receipt total, so the
  // same number appears whether the operator grouped by product or by cashier.
  // The receipt footer discount is deliberately NOT subtracted again here:
  // `netSales` has already had it deducted server-side.
  return sumLines(scopeItems(scope)).profit;
}

/**
 * Evaluate one measure over one scope. This is the only place a measure is
 * defined — the group builder, the chart series and the pivot all route here.
 */
export function applyMeasure(measure: Measure, scope: MeasureScope): number {
  const orders = scopeOrders(scope);
  const items = scopeItems(scope);

  switch (measure) {
    case 'total_price':
      return scopeRevenue(scope);

    case 'gross':
      // Before returns, but still excluding tips and cash rounding.
      return scope.isItemGroup
        ? items.reduce((s, i) => s + (i.grossSubtotal ?? i.priceAtPurchase * i.quantity), 0)
        : orders.reduce((s, o) => s + (o.grossRevenue ?? o.subtotal ?? o.total), 0);

    case 'total_refunds':
      return scope.isItemGroup
        ? items.reduce((s, i) => s + returnedValue(i), 0)
        : orders.reduce((s, o) => s + returnDeduction(o), 0);

    case 'total_discount':
      // Both the line/bundle discounts and the receipt footer. Reporting only the
      // footer — as the page used to — understated what was given away.
      return scope.isItemGroup
        ? items.reduce((s, i) => s + (i.discountAmount || 0), 0)
        : orders.reduce((s, o) => s + totalDiscount(o), 0);

    case 'tax':
      return scope.isItemGroup
        ? items.reduce((s, i) => s + (i.taxAmount || 0), 0)
        : orders.reduce((s, o) => s + taxCollected(o), 0);

    case 'tips':
      // Gratuity belongs to the receipt, never to a product. An item grouping
      // therefore reports 0 rather than inventing a per-bottle tip.
      return scope.isItemGroup ? 0 : orders.reduce((s, o) => s + tipAmount(o), 0);

    case 'count':
      return scope.isItemGroup ? distinctOrderCount(orders) : orders.length;

    case 'avg_price': {
      const count = scope.isItemGroup
        ? distinctOrderCount(orders)
        : orders.length;
      return count > 0 ? scopeRevenue(scope) / count : 0;
    }

    case 'product_qty':
      return items.reduce((s, i) => s + netQuantity(i), 0);

    case 'line_count':
      return items.length;

    case 'profit':
      return scopeProfit(scope);

    case 'margin': {
      const profit = scopeProfit(scope);
      const revenue = scopeRevenue(scope);
      return revenue > 0 ? (profit / revenue) * 100 : 0;
    }

    case 'delay_validation': {
      // Minutes from creation to placement/validation. A receipt with neither
      // timestamp is skipped rather than folded in as NaN, which would otherwise
      // poison the average for the whole period.
      const delays = orders
        .map((o) => {
          const created = new Date(o.createdAt || o.placedAt || '').getTime();
          const placed = new Date(o.placedAt || o.createdAt || '').getTime();
          if (Number.isNaN(created) || Number.isNaN(placed)) return null;
          return Math.max(0, (placed - created) / 60000);
        })
        .filter((d): d is number => d !== null);
      return delays.length > 0 ? delays.reduce((s, d) => s + d, 0) / delays.length : 0;
    }

    default:
      return 0;
  }
}

/**
 * Value of the units returned on a line, valued on the basis they were sold.
 *
 * `netSales` is what survived the returns, so it cannot also price what left.
 * The pre-return line value (post line discount, plus tax) is used instead,
 * matching the weight the server pro-rates an order over.
 */
function returnedValue(item: ReportOrderItem): number {
  const returned = item.returnedQuantity ?? 0;
  const sold = item.quantity ?? 0;
  if (returned <= 0 || sold <= 0) return 0;
  const unitValue = ((item.itemSubtotal ?? 0) + (item.taxAmount ?? 0)) / sold;
  return unitValue * Math.min(returned, sold);
}

export interface PaymentMethodOrder {
  paymentMethod?: string;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[] } | null;
}

export interface PaymentAttribution {
  method: string;
  /** True when the cashier tendered the receipt across more than one method. */
  split: boolean;
  /** The tender amounts, so a caller can show how the receipt was paid. */
  shares: { method: string; amount: number }[];
}

/**
 * Which method a receipt is credited to.
 *
 * A split-tender receipt is credited to the method that took the most money, and
 * to exactly one of them. The page used to fan the receipt across every method it
 * was split into, which counted the same sale in "Cash" *and* in "Card" — so the
 * revenue-by-method chart and the payment-method grouping both overstated the
 * day's takings, and the two overstatements did not even agree with each other.
 *
 * Proportional allocation looks fairer but is not: it has to be applied to
 * revenue, quantities, line counts and profit separately, and any field that is
 * missed shows up as a total that does not add up. One receipt, one method, and
 * the arithmetic always closes.
 */
export function paymentAttribution(order: PaymentMethodOrder): PaymentAttribution {
  const splits = order.paymentDetails?.splitPayments;
  if (splits && splits.length > 0) {
    const best = splits.reduce((a, b) => ((b?.amount ?? 0) > (a?.amount ?? 0) ? b : a));
    return {
      method: best?.method || order.paymentMethod || 'other',
      split: splits.length > 1,
      shares: splits.map((s) => ({ method: s.method, amount: s.amount })),
    };
  }
  return {
    method: order.paymentMethod || 'other',
    split: false,
    shares: [],
  };
}

// ── Dimension keys ───────────────────────────────────────────────────────────

/**
 * The fields a dimension key is built from. Narrow on purpose: the order list,
 * the session report and the analysis page each declare their own order type,
 * and all three need to bucket identically.
 */
export interface DimOrder {
  placedAt?: string;
  createdAt?: string;
  paymentMethod?: string;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[] } | null;
  posStaff?: { firstName?: string; lastName?: string; posName?: string } | null;
  session?: { terminalType?: string } | null;
}

export interface DimItem {
  name?: string;
  variant?: string;
}

export interface DimProdMeta {
  catName?: string;
  subCatName?: string;
  brandName?: string;
}

export function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

export function getQuarter(d: Date): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

export function getOrderDimKey(o: DimOrder, dim: GroupByKey): string {
  if (dim === 'cashier') {
    const s = o.posStaff;
    return s ? s.posName || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Unknown' : 'Unknown';
  }
  if (dim === 'terminal') {
    const t = o.session?.terminalType || 'retail';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (dim === 'payment_method')
    return METHOD_LABEL[paymentAttribution(o).method] || paymentAttribution(o).method || 'Other';
  const d = new Date(o.placedAt || o.createdAt || '');
  // Local calendar keys throughout. The page used toISOString() for the day but
  // local getters for week/month/quarter/year, so a late-evening sale could land
  // in a different day bucket than the week that contains it.
  if (dim === 'order_day') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (dim === 'order_week')
    return `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, '0')}`;
  if (dim === 'order_month')
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (dim === 'order_quarter') return `${d.getFullYear()}-Q${getQuarter(d)}`;
  if (dim === 'order_year') return String(d.getFullYear());
  return '—';
}

export function getItemDimKey(
  item: DimItem,
  dim: GroupByKey,
  prodMeta: Record<string, DimProdMeta>
): string {
  const name = item.name ?? '';
  if (dim === 'product') return item.variant ? `${name} · ${item.variant}` : name;
  const m = prodMeta[name];
  if (dim === 'product_category') return m?.catName || 'Unknown';
  if (dim === 'subcategory') return m?.subCatName || m?.catName || 'Unknown';
  if (dim === 'brand') return m?.brandName || 'Unknown';
  return '—';
}

// ── Headline KPIs ────────────────────────────────────────────────────────────

export interface AnalysisKpis {
  totalRevenue: number;
  grossRevenue: number;
  totalOrders: number;
  voidedOrders: number;
  avgOrder: number;
  itemsSold: number;
  avgItemsPerOrder: number;
  totalRefunds: number;
  cashRefunded: number;
  totalDiscount: number;
  discountRate: number;
  taxCollected: number;
  totalTips: number;
  totalRounding: number;
  totalProfit: number;
  marginPct: number;
  uncostedRevenue: number;
  uncostedLines: number;
  uniqueCustomers: number;
  walkInSales: number;
}

export function computeKpis(orders: ScopeOrder[]): AnalysisKpis {
  const active = orders.filter((o) => !isVoided(o) && o.status !== 'cancelled' && o.status !== 'hold');
  const voided = orders.filter((o) => isVoided(o));

  const totalRevenue = active.reduce((s, o) => s + netSales(o), 0);
  const grossRevenue = active.reduce((s, o) => s + (o.grossRevenue ?? o.subtotal ?? o.total), 0);
  const totalOrders = active.length;
  const discounts = active.reduce((s, o) => s + totalDiscount(o), 0);
  const tax = active.reduce((s, o) => s + taxCollected(o), 0);
  const lines = sumLines(active.flatMap((o) => o.items || []));
  const customers = countCustomers(active);
  const totalRefunds = active.reduce((s, o) => s + returnDeduction(o), 0);

  return {
    totalRevenue,
    grossRevenue,
    totalOrders,
    voidedOrders: voided.length,
    avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    itemsSold: active.reduce((s, o) => s + (o.items || []).reduce((si, i) => si + netQuantity(i), 0), 0),
    avgItemsPerOrder: totalOrders > 0
      ? active.reduce((s, o) => s + (o.items || []).reduce((si, i) => si + netQuantity(i), 0), 0) / totalOrders
      : 0,
    totalRefunds,
    cashRefunded: active.reduce((s, o) => s + cashRefunded(o), 0),
    totalDiscount: discounts,
    discountRate: grossRevenue > 0 ? (discounts / grossRevenue) * 100 : 0,
    taxCollected: tax,
    totalTips: active.reduce((s, o) => s + tipAmount(o), 0),
    totalRounding: active.reduce((s, o) => s + roundingAmount(o), 0),
    totalProfit: lines.profit,
    marginPct: totalRevenue > 0 ? (lines.profit / totalRevenue) * 100 : 0,
    uncostedRevenue: lines.uncostedRevenue,
    uncostedLines: lines.uncostedLines,
    uniqueCustomers: customers.unique,
    walkInSales: customers.walkIn,
  };
}
