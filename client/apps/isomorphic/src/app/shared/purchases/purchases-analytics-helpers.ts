// app/shared/purchases/purchases-analytics-helpers.ts
import type { PurchaseOrder, POItem } from '@/services/purchaseOrder.service';
import { BASE_CURRENCY, CURRENCY_SYMBOLS } from './types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type GroupByKey =
  | 'vendor'
  | 'product'
  | 'product_category'
  | 'subcategory'
  | 'brand'
  | 'status'
  | 'currency'
  | 'order_day'
  | 'order_week'
  | 'order_month'
  | 'order_quarter'
  | 'order_year';

export type Measure =
  | 'total_cost'
  | 'untaxed_total'
  | 'tax_total'
  | 'count'
  | 'avg_order'
  | 'product_qty'
  | 'received_qty'
  | 'line_count';

export type ChartType = 'bar' | 'line' | 'pie' | 'table';

export type ViewMode = 'graph' | 'pivot';

export type SortField = 'value' | 'label' | 'orders';

export interface SortCriterion {
  field: SortField;
  dir: 'asc' | 'desc';
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: string[];
  groupBy: GroupByKey | null;
  groupBy2: GroupByKey | null;
  measure: Measure;
}

export interface CatItem {
  _id: string;
  name: string;
  parent?: string;
  level?: number;
}

export interface BrandItem {
  _id: string;
  name: string;
}

export interface ProdMeta {
  catId: string;
  catName: string;
  subCatId?: string;
  subCatName?: string;
  brandId: string;
  brandName: string;
}

export interface GroupRow {
  label: string;
  isoKey: string;
  value: number;
  orders: number;
  orderList: PurchaseOrder[];
}

export interface GroupRow2 {
  label: string;
  isoKey: string;
  __total__: number;
  orders: number;
  orderList: PurchaseOrder[];
  [seriesKey: string]: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const PALETTE = [
  '#b20202',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
];

export const STATUS_LABELS: Record<string, string> = {
  draft: 'RFQ / Draft',
  confirmed: 'Confirmed',
  received: 'Received',
  validated: 'Validated',
  cancelled: 'Cancelled',
};

export const SAVED_KEY = 'dh-purchases-analysis-searches';

export const FILTER_STATIC: { key: string; label: string }[] = [
  { key: 'not_cancelled', label: 'Not Cancelled' },
  { key: 'status_draft', label: 'RFQs (Draft)' },
  { key: 'status_confirmed', label: 'Confirmed' },
  { key: 'status_received', label: 'Received' },
  { key: 'status_validated', label: 'Validated' },
];

export const GROUP_BY_ITEMS: { key: GroupByKey; label: string }[] = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'product', label: 'Product' },
  { key: 'product_category', label: 'Product Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'brand', label: 'Brand' },
  { key: 'status', label: 'Status' },
  { key: 'currency', label: 'Currency' },
];

export const GROUP_BY_DATE_ITEMS: { key: GroupByKey; label: string }[] = [
  { key: 'order_year', label: 'Year' },
  { key: 'order_quarter', label: 'Quarter' },
  { key: 'order_month', label: 'Month' },
  { key: 'order_week', label: 'Week' },
  { key: 'order_day', label: 'Day' },
];

export const ALL_GROUP_ITEMS = [...GROUP_BY_ITEMS, ...GROUP_BY_DATE_ITEMS];

export const MEASURES: { key: Measure; label: string }[] = [
  { key: 'total_cost', label: 'Total Cost (incl. tax)' },
  { key: 'untaxed_total', label: 'Untaxed Total' },
  { key: 'tax_total', label: 'Tax' },
  { key: 'avg_order', label: 'Average Order Value' },
  { key: 'product_qty', label: 'Product Quantity' },
  { key: 'received_qty', label: 'Received Quantity' },
  { key: 'line_count', label: 'Order Line Count' },
  { key: 'count', label: 'Order Count' },
];

export const IS_CURRENCY: Record<Measure, boolean> = {
  total_cost: true,
  untaxed_total: true,
  tax_total: true,
  avg_order: true,
  count: false,
  product_qty: false,
  received_qty: false,
  line_count: false,
};

export const ITEM_DIMS = new Set<GroupByKey>([
  'product',
  'product_category',
  'subcategory',
  'brand',
]);

// ── Formatting helpers ────────────────────────────────────────────────────────

export function poDate(po: PurchaseOrder): Date {
  return new Date(po.confirmationDate || po.createdAt || Date.now());
}

export function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(
    ((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7
  );
}

export function getQuarter(d: Date): number {
  return Math.ceil((d.getMonth() + 1) / 3);
}

export function fmtNaira(v: number): string {
  return `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formats an amount using the symbol for its own currency (not converted). */
export function fmtCur(v: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtCompact(v: number): string {
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)
    return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(1)}K`;
  return `₦${Math.round(v).toLocaleString()}`;
}

export function fmtAxisVal(v: number, measure: Measure): string {
  if (IS_CURRENCY[measure]) {
    if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `₦${Math.round(v / 1_000)}K`;
    return `₦${v}`;
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

export function fmtMeasureVal(v: number, measure: Measure): string {
  return IS_CURRENCY[measure] ? fmtNaira(v) : String(Math.round(v));
}

export function buildDateFilterItems(now: Date) {
  const months: { key: string; label: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `date_m_${d.getFullYear()}_${d.getMonth() + 1}`,
      label: d.toLocaleDateString('en-US', { month: 'long' }),
    });
  }
  const quarters: { key: string; label: string }[] = [];
  for (let q = 4; q >= 1; q--) {
    quarters.push({ key: `date_q_${now.getFullYear()}_${q}`, label: `Q${q}` });
  }
  const years: { key: string; label: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const yr = now.getFullYear() - i;
    years.push({ key: `date_y_${yr}`, label: String(yr) });
  }
  return { months, quarters, years };
}

export function isDateKey(k: string) {
  return k.startsWith('date_');
}

export function itemName(i: POItem): string {
  return i.subProductName || i.productName || i.sku || 'Unknown';
}

// Line cost helpers — unitCost is the canonical purchase price
export function lineUntaxed(i: POItem): number {
  return (i.unitCost ?? i.unitPrice ?? 0) * (i.quantity ?? 0);
}
export function lineTax(i: POItem): number {
  return lineUntaxed(i) * ((i.taxRate ?? 0) / 100);
}

// ── Item / group key resolution ───────────────────────────────────────────────

/** Resolves an item to a bucket key for an item-level GroupByKey dimension. */
export function resolveItemDimKey(
  item: POItem,
  dim: GroupByKey,
  prodMeta: Record<string, ProdMeta>
): string {
  const meta = prodMeta[item.productName];
  switch (dim) {
    case 'product':
      return itemName(item);
    case 'product_category':
      return meta?.catName || 'Uncategorized';
    case 'subcategory':
      return meta?.subCatName || meta?.catName || 'Uncategorized';
    case 'brand':
      return meta?.brandName || 'No Brand';
    default:
      return itemName(item);
  }
}

/** Resolves a whole PO to a single bucket key along any GroupByKey dimension. */
export function getPOG1Key(
  po: PurchaseOrder,
  dim: GroupByKey,
  prodMeta: Record<string, ProdMeta>
): string {
  if (ITEM_DIMS.has(dim)) {
    const item = po.items?.[0];
    if (!item) {
      if (dim === 'product') return 'Unknown';
      if (dim === 'brand') return 'No Brand';
      return 'Uncategorized';
    }
    return resolveItemDimKey(item, dim, prodMeta);
  }

  const d = poDate(po);
  switch (dim) {
    case 'vendor':
      return po.vendorName || 'Unknown Vendor';
    case 'status':
      return STATUS_LABELS[po.status] || po.status;
    case 'currency':
      return po.currency || BASE_CURRENCY;
    case 'order_day':
      return d.toISOString().split('T')[0];
    case 'order_week':
      return `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, '0')}`;
    case 'order_quarter':
      return `${d.getFullYear()}-Q${getQuarter(d)}`;
    case 'order_year':
      return String(d.getFullYear());
    case 'order_month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    default:
      return 'Unknown';
  }
}

/** Formats a bucket key produced by computeGroupData/getPOG1Key into a display label. */
export function formatG1Label(key: string, dim: GroupByKey): string {
  if (dim === 'order_day')
    return new Date(key).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  if (dim === 'order_week') {
    const [yr, w] = key.split('-W');
    return `W${w} ${yr}`;
  }
  if (dim === 'order_month') {
    const [yr, mo] = key.split('-');
    return new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString(
      'en-US',
      { month: 'short', year: 'numeric' }
    );
  }
  if (dim === 'order_quarter') {
    const [yr, q] = key.split('-');
    return `${q} ${yr}`;
  }
  return key;
}

// ── Filtering ──────────────────────────────────────────────────────────────────

export function applyFilters(
  orders: PurchaseOrder[],
  filters: string[],
  prodMeta: Record<string, ProdMeta>
): PurchaseOrder[] {
  let r = [...orders];

  if (filters.includes('not_cancelled'))
    r = r.filter((o) => o.status !== 'cancelled' && o.status !== 'cancel');

  const statusFilters = filters
    .filter((f) => f.startsWith('status_'))
    .map((f) => f.replace('status_', ''));
  if (statusFilters.length > 0)
    r = r.filter((o) => statusFilters.includes(o.status));

  const vendorVals = filters
    .filter((f) => f.startsWith('vendor_search:'))
    .map((f) => f.slice(14).toLowerCase());
  if (vendorVals.length > 0)
    r = r.filter((o) =>
      vendorVals.some((q) => (o.vendorName ?? '').toLowerCase().includes(q))
    );

  const productVals = filters
    .filter((f) => f.startsWith('product_search:'))
    .map((f) => f.slice(15).toLowerCase());
  if (productVals.length > 0)
    r = r.filter((o) =>
      productVals.some((q) =>
        (o.items || []).some((i) => itemName(i).toLowerCase().includes(q))
      )
    );

  const catNameVals = filters
    .filter((f) => f.startsWith('catname_search:'))
    .map((f) => f.slice(16).toLowerCase());
  if (catNameVals.length > 0)
    r = r.filter((o) =>
      (o.items || []).some((i) => {
        const meta = prodMeta[i.productName];
        const cat = (meta?.catName || '').toLowerCase();
        const sub = (meta?.subCatName || '').toLowerCase();
        return catNameVals.some((q) => cat.includes(q) || sub.includes(q));
      })
    );

  const categoryIds = filters
    .filter((f) => f.startsWith('category_'))
    .map((f) => f.slice(9));
  if (categoryIds.length > 0)
    r = r.filter((o) =>
      (o.items || []).some((i) =>
        categoryIds.includes(prodMeta[i.productName]?.catId || '')
      )
    );

  const brandIds = filters
    .filter((f) => f.startsWith('brand_'))
    .map((f) => f.slice(6));
  if (brandIds.length > 0)
    r = r.filter((o) =>
      (o.items || []).some((i) =>
        brandIds.includes(prodMeta[i.productName]?.brandId || '')
      )
    );

  const dateFilters = filters.filter((f) => isDateKey(f));
  if (dateFilters.length === 0) return r;

  const now = new Date();
  return r.filter((o) => {
    const d = poDate(o);
    return dateFilters.some((df) => {
      if (df === 'date_today') return d.toDateString() === now.toDateString();
      if (df === 'date_week') {
        const s = new Date(now);
        s.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        s.setHours(0, 0, 0, 0);
        return d >= s;
      }
      if (df.startsWith('date_m_')) {
        const [, , yr, mo] = df.split('_');
        return (
          d.getFullYear() === parseInt(yr) && d.getMonth() + 1 === parseInt(mo)
        );
      }
      if (df.startsWith('date_q_')) {
        const [, , yr, q] = df.split('_');
        return (
          d.getFullYear() === parseInt(yr) && getQuarter(d) === parseInt(q)
        );
      }
      if (df.startsWith('date_y_'))
        return d.getFullYear() === parseInt(df.replace('date_y_', ''));
      return false;
    });
  });
}

// ── Measure aggregation (shared by single- and two-level grouping) ─────────────

export function aggregateMeasure(
  orderList: PurchaseOrder[],
  items: { item: POItem; currency: string }[],
  measure: Measure,
  toBase: (amount: number, currency: string) => number
): number {
  switch (measure) {
    case 'total_cost':
      return items.reduce(
        (s, { item, currency }) =>
          s + toBase(lineUntaxed(item) + lineTax(item), currency),
        0
      );
    case 'untaxed_total':
      return items.reduce(
        (s, { item, currency }) => s + toBase(lineUntaxed(item), currency),
        0
      );
    case 'tax_total':
      return items.reduce(
        (s, { item, currency }) => s + toBase(lineTax(item), currency),
        0
      );
    case 'count':
      return orderList.length;
    case 'avg_order': {
      const total = items.reduce(
        (s, { item, currency }) =>
          s + toBase(lineUntaxed(item) + lineTax(item), currency),
        0
      );
      return orderList.length > 0 ? total / orderList.length : 0;
    }
    case 'product_qty':
      return items.reduce((s, { item }) => s + (item.quantity ?? 0), 0);
    case 'received_qty':
      return items.reduce((s, { item }) => s + (item.receivedQty ?? 0), 0);
    case 'line_count':
      return items.length;
    default:
      return 0;
  }
}

// ── Sorting ────────────────────────────────────────────────────────────────────

export function applySortStack<
  T extends { label: string; orders: number; isoKey: string },
>(
  rows: T[],
  groupBy: GroupByKey,
  sortStack: SortCriterion[],
  getValue: (row: T) => number
): T[] {
  const sorted = [...rows];

  if (sortStack.length === 0) {
    if (groupBy.startsWith('order_'))
      sorted.sort((a, b) => a.isoKey.localeCompare(b.isoKey));
    else sorted.sort((a, b) => getValue(b) - getValue(a));
    return sorted;
  }

  sorted.sort((a, b) => {
    for (const { field, dir } of sortStack) {
      let cmp = 0;
      if (field === 'value') cmp = getValue(a) - getValue(b);
      else if (field === 'orders') cmp = a.orders - b.orders;
      else cmp = a.label.localeCompare(b.label);
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
  return sorted;
}

// ── Single-level grouping ────────────────────────────────────────────────────

export function computeGroupData(
  orders: PurchaseOrder[],
  groupBy: GroupByKey,
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (amount: number, currency: string) => number,
  sortStack: SortCriterion[]
): GroupRow[] {
  type Bucket = {
    orderList: PurchaseOrder[];
    items: { item: POItem; currency: string }[];
  };
  const groups: Record<string, Bucket> = {};
  const getBucket = (key: string): Bucket => {
    if (!groups[key]) groups[key] = { orderList: [], items: [] };
    return groups[key];
  };

  const isItemGroup = ITEM_DIMS.has(groupBy);

  orders.forEach((o) => {
    const currency = o.currency || BASE_CURRENCY;
    if (isItemGroup) {
      (o.items || []).forEach((item) => {
        const key = resolveItemDimKey(item, groupBy, prodMeta);
        const b = getBucket(key);
        if (!b.orderList.includes(o)) b.orderList.push(o);
        b.items.push({ item, currency });
      });
      return;
    }

    const key = getPOG1Key(o, groupBy, prodMeta);
    const b = getBucket(key);
    b.orderList.push(o);
    (o.items || []).forEach((item) => b.items.push({ item, currency }));
  });

  const rows: GroupRow[] = Object.entries(groups).map(
    ([key, { orderList, items }]) => ({
      label: formatG1Label(key, groupBy),
      isoKey: key,
      value: aggregateMeasure(orderList, items, measure, toBase),
      orders: orderList.length,
      orderList,
    })
  );

  return applySortStack(rows, groupBy, sortStack, (r) => r.value);
}

// ── Two-level grouping ───────────────────────────────────────────────────────

export function computeMultiSeries(
  orders: PurchaseOrder[],
  groupBy: GroupByKey,
  groupBy2: GroupByKey,
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (amount: number, currency: string) => number,
  sortStack: SortCriterion[]
): {
  rows: GroupRow2[];
  series: string[];
  orderMap: Record<string, Record<string, PurchaseOrder[]>>;
} {
  const orderMap: Record<string, Record<string, PurchaseOrder[]>> = {};
  const seriesSet = new Set<string>();
  const g1Order: string[] = [];

  orders.forEach((o) => {
    const g1 = getPOG1Key(o, groupBy, prodMeta);
    const g2 = getPOG1Key(o, groupBy2, prodMeta);
    seriesSet.add(g2);
    if (!orderMap[g1]) {
      orderMap[g1] = {};
      g1Order.push(g1);
    }
    if (!orderMap[g1][g2]) orderMap[g1][g2] = [];
    orderMap[g1][g2].push(o);
  });

  const series = Array.from(seriesSet).sort();

  const rows: GroupRow2[] = g1Order.map((g1) => {
    const row: GroupRow2 = {
      label: formatG1Label(g1, groupBy),
      isoKey: g1,
      __total__: 0,
      orders: 0,
      orderList: [],
    };
    const seen = new Set<string>();

    series.forEach((s) => {
      const poList = orderMap[g1][s] || [];
      const items: { item: POItem; currency: string }[] = [];
      poList.forEach((o) => {
        const currency = o.currency || BASE_CURRENCY;
        (o.items || []).forEach((item) => items.push({ item, currency }));
        if (!seen.has(o._id)) {
          seen.add(o._id);
          row.orderList.push(o);
        }
      });
      const val = aggregateMeasure(poList, items, measure, toBase);
      row[s] = val;
      row.__total__ += val;
    });

    row.orders = row.orderList.length;
    return row;
  });

  const sortedRows = applySortStack(
    rows,
    groupBy,
    sortStack,
    (r) => r.__total__
  );

  return { rows: sortedRows, series, orderMap };
}

// ── Hierarchical pivot (Odoo-style) ─────────────────────────────────────────────

export interface HierPivotResult {
  rowVals0: string[];
  colVals0: string[];
  subRowValsMap: Record<string, string[]>;
  subColValsMap: Record<string, string[]>;
  getValue: (rowPath: string[], colPath: string[]) => number;
  getOrderCount: (rowPath: string[], colPath: string[]) => number;
  getOrders: (rowPath: string[], colPath: string[]) => PurchaseOrder[];
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
  maxCellVal: number;
}

export function computeHierarchicalPivot(
  orders: PurchaseOrder[],
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (amount: number, currency: string) => number
): HierPivotResult | null {
  if (rowDims.length === 0) return null;

  interface CacheEntry {
    ords: Map<string, PurchaseOrder>;
    items: { item: POItem; currency: string }[];
  }
  const cache = new Map<string, CacheEntry>();
  const numCache = new Map<string, number>();

  const cacheKey = (rPath: string[], cPath: string[]) =>
    rPath.join('\x00') + '\x01' + cPath.join('\x00');

  const addToCache = (
    rPath: string[],
    cPath: string[],
    ordId: string,
    order: PurchaseOrder,
    items: { item: POItem; currency: string }[]
  ) => {
    const k = cacheKey(rPath, cPath);
    let e = cache.get(k);
    if (!e) { e = { ords: new Map(), items: [] }; cache.set(k, e); }
    e.ords.set(ordId, order);
    e.items.push(...items);
  };

  const isItemGroup = rowDims.some((d) => ITEM_DIMS.has(d)) || colDims.some((d) => ITEM_DIMS.has(d));

  const rValSets: Set<string>[] = rowDims.map(() => new Set<string>());
  const cValSets: Set<string>[] = colDims.map(() => new Set<string>());
  const subRVals = new Map<string, Set<string>>();
  const subCVals = new Map<string, Set<string>>();

  orders.forEach((o) => {
    const currency = o.currency || BASE_CURRENCY;
    const allItems = o.items || [];

    const processAtom = (item: POItem | null) => {
      const rKeys = rowDims.map((d) =>
        ITEM_DIMS.has(d) && item ? resolveItemDimKey(item, d, prodMeta) : getPOG1Key(o, d, prodMeta)
      );
      const cKeys = colDims.map((d) =>
        ITEM_DIMS.has(d) && item ? resolveItemDimKey(item, d, prodMeta) : getPOG1Key(o, d, prodMeta)
      );

      rKeys.forEach((k, i) => rValSets[i]?.add(k));
      cKeys.forEach((k, i) => cValSets[i]?.add(k));
      if (rKeys.length >= 2) {
        if (!subRVals.has(rKeys[0])) subRVals.set(rKeys[0], new Set());
        subRVals.get(rKeys[0])!.add(rKeys[1]);
      }
      if (cKeys.length >= 2) {
        if (!subCVals.has(cKeys[0])) subCVals.set(cKeys[0], new Set());
        subCVals.get(cKeys[0])!.add(cKeys[1]);
      }

      const atomItems: { item: POItem; currency: string }[] = item
        ? [{ item, currency }]
        : allItems.map((i) => ({ item: i, currency }));

      for (let ri = 0; ri <= rKeys.length; ri++) {
        for (let ci = 0; ci <= cKeys.length; ci++) {
          addToCache(rKeys.slice(0, ri), cKeys.slice(0, ci), o._id, o, atomItems);
        }
      }
    };

    if (isItemGroup) {
      if (allItems.length > 0) allItems.forEach((item) => processAtom(item));
      else processAtom(null);
    } else {
      processAtom(null);
    }
  });

  const getVal = (rowPath: string[], colPath: string[]): number => {
    const k = cacheKey(rowPath, colPath);
    if (numCache.has(k)) return numCache.get(k)!;
    const e = cache.get(k);
    if (!e) { numCache.set(k, 0); return 0; }
    const val = aggregateMeasure(Array.from(e.ords.values()), e.items, measure, toBase);
    numCache.set(k, val);
    return val;
  };

  const getOrderCount = (rowPath: string[], colPath: string[]): number =>
    cache.get(cacheKey(rowPath, colPath))?.ords.size ?? 0;

  const getOrders = (rowPath: string[], colPath: string[]): PurchaseOrder[] =>
    Array.from(cache.get(cacheKey(rowPath, colPath))?.ords.values() ?? []);

  const isDateDim = (d: GroupByKey) => d.startsWith('order_');

  const rowVals0 = Array.from(rValSets[0] ?? []);
  const colVals0 = Array.from(cValSets[0] ?? []);
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  rowVals0.forEach((k) => { rowTotals[k] = getVal([k], []); });
  colVals0.forEach((k) => { colTotals[k] = getVal([], [k]); });

  if (isDateDim(rowDims[0])) rowVals0.sort((a, b) => a.localeCompare(b));
  else rowVals0.sort((a, b) => rowTotals[b] - rowTotals[a]);
  if (colDims[0]) {
    if (isDateDim(colDims[0])) colVals0.sort((a, b) => a.localeCompare(b));
    else colVals0.sort((a, b) => colTotals[b] - colTotals[a]);
  }

  const subRowValsMap: Record<string, string[]> = {};
  rowVals0.forEach((rk) => {
    const vals = Array.from(subRVals.get(rk) ?? []);
    if (rowDims[1] && isDateDim(rowDims[1])) vals.sort((a, b) => a.localeCompare(b));
    else vals.sort((a, b) => getVal([rk, b], []) - getVal([rk, a], []));
    subRowValsMap[rk] = vals;
  });
  const subColValsMap: Record<string, string[]> = {};
  colVals0.forEach((ck) => {
    const vals = Array.from(subCVals.get(ck) ?? []);
    if (colDims[1] && isDateDim(colDims[1])) vals.sort((a, b) => a.localeCompare(b));
    else vals.sort((a, b) => getVal([], [ck, b]) - getVal([], [ck, a]));
    subColValsMap[ck] = vals;
  });

  const grandTotal = getVal([], []);
  let maxCellVal = 0;
  rowVals0.forEach((rk) => colVals0.forEach((ck) => { maxCellVal = Math.max(maxCellVal, getVal([rk], [ck])); }));
  if (colVals0.length === 0) rowVals0.forEach((rk) => { maxCellVal = Math.max(maxCellVal, rowTotals[rk]); });

  return {
    rowVals0, colVals0, subRowValsMap, subColValsMap,
    getValue: getVal, getOrderCount, getOrders,
    rowTotals, colTotals, grandTotal, maxCellVal,
  };
}
