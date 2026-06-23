// app/shared/warehouses/warehouse-analysis-helpers.ts
//
// Reporting helpers for the /warehouses/analysis page. Mirrors the architecture
// of purchases-analytics-helpers.ts, but the data unit is a flat WarehouseStock
// line (StockRow) rather than a PurchaseOrder with nested items. Because each row
// is a single atom (its own "order" and its own "line"), per-row attribution is
// automatic — there's no multi-line PO to fan out across categories/brands.
import type { StockRow } from '@/services/warehouseStock.service';
import { BASE_CURRENCY, CURRENCY_SYMBOLS } from '../purchases/types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type GroupByKey =
  | 'warehouse'
  | 'product'
  | 'product_category'
  | 'subcategory'
  | 'brand'
  | 'size'
  | 'stock_status'
  | 'expiry';

export type Measure =
  | 'stock_value'
  | 'on_hand_qty'
  | 'available_qty'
  | 'reserved_qty'
  | 'sku_count'
  | 'line_count';

export type ChartType = 'bar' | 'line' | 'pie' | 'table';

export type ViewMode = 'graph' | 'pivot';

export type SortField = 'value' | 'label' | 'lines';

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
  // Number of stock lines in this bucket (surfaced as "lines" in the UI).
  orders: number;
  orderList: StockRow[];
}

export interface GroupRow2 {
  label: string;
  isoKey: string;
  __total__: number;
  orders: number;
  orderList: StockRow[];
  [seriesKey: string]: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────────────

// Shared wine-label palette (kept in sync with purchases analytics).
export const PALETTE = [
  '#b20202', // maroon (brand)
  '#c8932c', // brass / gold
  '#3d6b5c', // deep teal-green
  '#5b7da0', // slate blue
  '#a8512e', // terracotta
  '#7d6b9e', // muted violet
  '#8a9b4f', // olive
  '#c46a6a', // dusty rose
  '#4a5d6e', // steel
  '#d9a05b', // amber
];

export const SAVED_KEY = 'dh-warehouse-analysis-searches';

export const FILTER_STATIC: { key: string; label: string }[] = [
  { key: 'in_stock', label: 'In Stock' },
  { key: 'low_stock', label: 'Low Stock' },
  { key: 'out_of_stock', label: 'Out of Stock' },
  { key: 'has_reserved', label: 'Has Reserved' },
  { key: 'expiring_soon', label: 'Expiring / Expired' },
];

export const GROUP_BY_ITEMS: { key: GroupByKey; label: string }[] = [
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'product', label: 'Product' },
  { key: 'product_category', label: 'Product Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'brand', label: 'Brand' },
  { key: 'size', label: 'Size' },
  { key: 'stock_status', label: 'Stock Status' },
  { key: 'expiry', label: 'Expiry Bucket' },
];

export const ALL_GROUP_ITEMS = [...GROUP_BY_ITEMS];

export const MEASURES: { key: Measure; label: string }[] = [
  { key: 'stock_value', label: 'Stock Value (cost)' },
  { key: 'on_hand_qty', label: 'On-hand Quantity' },
  { key: 'available_qty', label: 'Available Quantity' },
  { key: 'reserved_qty', label: 'Reserved Quantity' },
  { key: 'sku_count', label: 'SKU Count' },
  { key: 'line_count', label: 'Stock Line Count' },
];

export const IS_CURRENCY: Record<Measure, boolean> = {
  stock_value: true,
  on_hand_qty: false,
  available_qty: false,
  reserved_qty: false,
  sku_count: false,
  line_count: false,
};

// ── Row-level derived values ────────────────────────────────────────────────────

export function availableQty(r: StockRow): number {
  return Math.max(0, (r.currentQuantity || 0) - (r.reservedQuantity || 0));
}

export type StockStatus = 'in' | 'low' | 'out';

export function stockStatus(r: StockRow): StockStatus {
  if ((r.currentQuantity || 0) <= 0) return 'out';
  if ((r.minStockLevel || 0) > 0 && r.currentQuantity <= r.minStockLevel)
    return 'low';
  return 'in';
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  in: 'In Stock',
  low: 'Low Stock',
  out: 'Out of Stock',
};

export type ExpiryBucket = 'expired' | 'd30' | 'd90' | 'later' | 'none';

export const EXPIRY_LABEL: Record<ExpiryBucket, string> = {
  expired: 'Expired',
  d30: '≤ 30 days',
  d90: '31–90 days',
  later: '> 90 days',
  none: 'No Expiry',
};

// Ordering used wherever expiry buckets are displayed in a fixed sequence.
export const EXPIRY_ORDER: ExpiryBucket[] = [
  'expired',
  'd30',
  'd90',
  'later',
  'none',
];

export function expiryBucket(r: StockRow, now = Date.now()): ExpiryBucket {
  if (!r.earliestExpiry) return 'none';
  const t = new Date(r.earliestExpiry).getTime();
  if (Number.isNaN(t)) return 'none';
  const days = (t - now) / 86400000;
  if (days < 0) return 'expired';
  if (days <= 30) return 'd30';
  if (days <= 90) return 'd90';
  return 'later';
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtNaira(v: number): string {
  return `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtCompact(v: number): string {
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)
    return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(1)}K`;
  return `₦${Math.round(v).toLocaleString()}`;
}

/** Compact non-currency formatter for unit counts. */
export function fmtCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
}

export function fmtAxisVal(v: number, measure: Measure): string {
  const sym = CURRENCY_SYMBOLS['NGN'];
  if (IS_CURRENCY[measure]) {
    if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${sym}${Math.round(v / 1_000)}K`;
    return `${sym}${v}`;
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

export function fmtMeasureVal(v: number, measure: Measure): string {
  if (Number.isNaN(v)) v = 0;
  return IS_CURRENCY[measure] ? fmtNaira(v) : Math.round(v).toLocaleString();
}

/** Compact data label — guards against NaN reaching a Recharts <LabelList>. */
export function fmtDataLabel(v: number, measure: Measure): string {
  if (Number.isNaN(v)) return '';
  if (!IS_CURRENCY[measure]) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
    return String(Math.round(v));
  }
  if (v >= 1_000_000) {
    const sym = CURRENCY_SYMBOLS['NGN'];
    return `${sym}${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  }
  return fmtNaira(v);
}

export function computeAvg(rows: { value: number }[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((s, r) => s + r.value, 0) / rows.length;
}

/** No date dimensions on this page — keys are already display-ready. */
export function formatG1Label(key: string, _dim: GroupByKey): string {
  return key;
}

// ── Dimension key resolution ────────────────────────────────────────────────────

/** Resolves a stock row to its bucket key along any dimension. */
export function getRowKey(
  r: StockRow,
  dim: GroupByKey,
  prodMeta: Record<string, ProdMeta>
): string {
  const meta = prodMeta[String(r.subProductId)];
  switch (dim) {
    case 'warehouse':
      return r.warehouseName || 'Unknown Warehouse';
    case 'product':
      return r.productName || r.sku || 'Unknown Product';
    case 'product_category':
      return meta?.catName || 'Uncategorized';
    case 'subcategory':
      return meta?.subCatName || meta?.catName || 'Uncategorized';
    case 'brand':
      return meta?.brandName || 'No Brand';
    case 'size':
      return r.sizeName || '—';
    case 'stock_status':
      return STOCK_STATUS_LABEL[stockStatus(r)];
    case 'expiry':
      return EXPIRY_LABEL[expiryBucket(r)];
    default:
      return 'Unknown';
  }
}

// ── Filtering ──────────────────────────────────────────────────────────────────

export function applyFilters(
  rows: StockRow[],
  filters: string[],
  prodMeta: Record<string, ProdMeta>,
  now = Date.now()
): StockRow[] {
  let r = [...rows];

  if (filters.includes('in_stock'))
    r = r.filter((x) => (x.currentQuantity || 0) > 0);
  if (filters.includes('low_stock'))
    r = r.filter((x) => stockStatus(x) === 'low');
  if (filters.includes('out_of_stock'))
    r = r.filter((x) => stockStatus(x) === 'out');
  if (filters.includes('has_reserved'))
    r = r.filter((x) => (x.reservedQuantity || 0) > 0);
  if (filters.includes('expiring_soon'))
    r = r.filter((x) => {
      const b = expiryBucket(x, now);
      return b === 'expired' || b === 'd30' || b === 'd90';
    });

  const productVals = filters
    .filter((f) => f.startsWith('product_search:'))
    .map((f) => f.slice(15).toLowerCase());
  if (productVals.length > 0)
    r = r.filter((x) =>
      productVals.some(
        (q) =>
          (x.productName ?? '').toLowerCase().includes(q) ||
          (x.sku ?? '').toLowerCase().includes(q)
      )
    );

  const warehouseVals = filters
    .filter((f) => f.startsWith('warehouse_search:'))
    .map((f) => f.slice(17).toLowerCase());
  if (warehouseVals.length > 0)
    r = r.filter((x) =>
      warehouseVals.some((q) =>
        (x.warehouseName ?? '').toLowerCase().includes(q)
      )
    );

  const catNameVals = filters
    .filter((f) => f.startsWith('catname_search:'))
    .map((f) => f.slice(15).toLowerCase());
  if (catNameVals.length > 0)
    r = r.filter((x) => {
      const meta = prodMeta[String(x.subProductId)];
      const cat = (meta?.catName || '').toLowerCase();
      const sub = (meta?.subCatName || '').toLowerCase();
      return catNameVals.some((q) => cat.includes(q) || sub.includes(q));
    });

  const categoryIds = filters
    .filter((f) => f.startsWith('category_'))
    .map((f) => f.slice(9));
  if (categoryIds.length > 0)
    r = r.filter((x) =>
      categoryIds.includes(prodMeta[String(x.subProductId)]?.catId || '')
    );

  const subcatIds = filters
    .filter((f) => f.startsWith('subcategory_'))
    .map((f) => f.slice(12));
  if (subcatIds.length > 0)
    r = r.filter((x) =>
      subcatIds.includes(prodMeta[String(x.subProductId)]?.subCatId || '')
    );

  const brandIds = filters
    .filter((f) => f.startsWith('brand_'))
    .map((f) => f.slice(6));
  if (brandIds.length > 0)
    r = r.filter((x) =>
      brandIds.includes(prodMeta[String(x.subProductId)]?.brandId || '')
    );

  return r;
}

// ── Measure aggregation ─────────────────────────────────────────────────────────

export function aggregateMeasure(
  rows: StockRow[],
  measure: Measure,
  toBase: (amount: number, currency: string) => number
): number {
  switch (measure) {
    case 'stock_value':
      return rows.reduce(
        (s, r) =>
          s +
          toBase((r.currentQuantity || 0) * (r.costPrice || 0), BASE_CURRENCY),
        0
      );
    case 'on_hand_qty':
      return rows.reduce((s, r) => s + (r.currentQuantity || 0), 0);
    case 'available_qty':
      return rows.reduce((s, r) => s + availableQty(r), 0);
    case 'reserved_qty':
      return rows.reduce((s, r) => s + (r.reservedQuantity || 0), 0);
    case 'sku_count': {
      const set = new Set<string>();
      rows.forEach((r) => set.add(String(r.subProductId)));
      return set.size;
    }
    case 'line_count':
      return rows.length;
    default:
      return 0;
  }
}

// ── Sorting ────────────────────────────────────────────────────────────────────

export function applySortStack<
  T extends { label: string; orders: number; isoKey: string },
>(rows: T[], sortStack: SortCriterion[], getValue: (row: T) => number): T[] {
  const sorted = [...rows];

  if (sortStack.length === 0) {
    sorted.sort((a, b) => getValue(b) - getValue(a));
    return sorted;
  }

  sorted.sort((a, b) => {
    for (const { field, dir } of sortStack) {
      let cmp = 0;
      if (field === 'value') cmp = getValue(a) - getValue(b);
      else if (field === 'lines') cmp = a.orders - b.orders;
      else cmp = a.label.localeCompare(b.label);
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
  return sorted;
}

// ── Single-level grouping ────────────────────────────────────────────────────

export function computeGroupData(
  rows: StockRow[],
  groupBy: GroupByKey,
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (amount: number, currency: string) => number,
  sortStack: SortCriterion[]
): GroupRow[] {
  const groups: Record<string, StockRow[]> = {};
  rows.forEach((r) => {
    const key = getRowKey(r, groupBy, prodMeta);
    (groups[key] ||= []).push(r);
  });

  const out: GroupRow[] = Object.entries(groups).map(([key, list]) => ({
    label: key,
    isoKey: key,
    value: aggregateMeasure(list, measure, toBase),
    orders: list.length,
    orderList: list,
  }));

  return applySortStack(out, sortStack, (r) => r.value);
}

// ── Two-level grouping ───────────────────────────────────────────────────────

export function computeMultiSeries(
  rows: StockRow[],
  groupBy: GroupByKey,
  groupBy2: GroupByKey,
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (amount: number, currency: string) => number,
  sortStack: SortCriterion[]
): {
  rows: GroupRow2[];
  series: string[];
  orderMap: Record<string, Record<string, StockRow[]>>;
} {
  const orderMap: Record<string, Record<string, StockRow[]>> = {};
  const seriesSet = new Set<string>();
  const g1Order: string[] = [];

  rows.forEach((r) => {
    const g1 = getRowKey(r, groupBy, prodMeta);
    const g2 = getRowKey(r, groupBy2, prodMeta);
    seriesSet.add(g2);
    if (!orderMap[g1]) {
      orderMap[g1] = {};
      g1Order.push(g1);
    }
    (orderMap[g1][g2] ||= []).push(r);
  });

  const series = Array.from(seriesSet).sort();

  const outRows: GroupRow2[] = g1Order.map((g1) => {
    const row: GroupRow2 = {
      label: g1,
      isoKey: g1,
      __total__: 0,
      orders: 0,
      orderList: [],
    };
    series.forEach((s) => {
      const list = orderMap[g1][s] || [];
      row.orderList.push(...list);
      const val = aggregateMeasure(list, measure, toBase);
      row[s] = val;
      row.__total__ += val;
    });
    row.orders = row.orderList.length;
    return row;
  });

  const sortedRows = applySortStack(outRows, sortStack, (r) => r.__total__);
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
  getOrders: (rowPath: string[], colPath: string[]) => StockRow[];
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
  maxCellVal: number;
}

export function computeHierarchicalPivot(
  rows: StockRow[],
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (amount: number, currency: string) => number
): HierPivotResult | null {
  if (rowDims.length === 0) return null;

  // Each cache cell holds the deduped set of rows whose key paths cover it.
  const cache = new Map<string, Map<string, StockRow>>();
  const numCache = new Map<string, number>();

  const cacheKey = (rPath: string[], cPath: string[]) =>
    rPath.join('\x00') + '\x01' + cPath.join('\x00');

  const addToCache = (rPath: string[], cPath: string[], r: StockRow) => {
    const k = cacheKey(rPath, cPath);
    let e = cache.get(k);
    if (!e) {
      e = new Map();
      cache.set(k, e);
    }
    e.set(r._id, r);
  };

  const rValSets: Set<string>[] = rowDims.map(() => new Set<string>());
  const cValSets: Set<string>[] = colDims.map(() => new Set<string>());
  const subRVals = new Map<string, Set<string>>();
  const subCVals = new Map<string, Set<string>>();

  rows.forEach((r) => {
    const rKeys = rowDims.map((d) => getRowKey(r, d, prodMeta));
    const cKeys = colDims.map((d) => getRowKey(r, d, prodMeta));

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

    for (let ri = 0; ri <= rKeys.length; ri++) {
      for (let ci = 0; ci <= cKeys.length; ci++) {
        addToCache(rKeys.slice(0, ri), cKeys.slice(0, ci), r);
      }
    }
  });

  const getVal = (rowPath: string[], colPath: string[]): number => {
    const k = cacheKey(rowPath, colPath);
    if (numCache.has(k)) return numCache.get(k)!;
    const e = cache.get(k);
    if (!e) {
      numCache.set(k, 0);
      return 0;
    }
    const val = aggregateMeasure(Array.from(e.values()), measure, toBase);
    numCache.set(k, val);
    return val;
  };

  const getOrderCount = (rowPath: string[], colPath: string[]): number =>
    cache.get(cacheKey(rowPath, colPath))?.size ?? 0;

  const getOrders = (rowPath: string[], colPath: string[]): StockRow[] =>
    Array.from(cache.get(cacheKey(rowPath, colPath))?.values() ?? []);

  const rowVals0 = Array.from(rValSets[0] ?? []);
  const colVals0 = Array.from(cValSets[0] ?? []);
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  rowVals0.forEach((k) => {
    rowTotals[k] = getVal([k], []);
  });
  colVals0.forEach((k) => {
    colTotals[k] = getVal([], [k]);
  });

  rowVals0.sort((a, b) => rowTotals[b] - rowTotals[a]);
  if (colDims[0]) colVals0.sort((a, b) => colTotals[b] - colTotals[a]);

  const subRowValsMap: Record<string, string[]> = {};
  rowVals0.forEach((rk) => {
    const vals = Array.from(subRVals.get(rk) ?? []);
    vals.sort((a, b) => getVal([rk, b], []) - getVal([rk, a], []));
    subRowValsMap[rk] = vals;
  });
  const subColValsMap: Record<string, string[]> = {};
  colVals0.forEach((ck) => {
    const vals = Array.from(subCVals.get(ck) ?? []);
    vals.sort((a, b) => getVal([], [ck, b]) - getVal([], [ck, a]));
    subColValsMap[ck] = vals;
  });

  const grandTotal = getVal([], []);
  let maxCellVal = 0;
  rowVals0.forEach((rk) =>
    colVals0.forEach((ck) => {
      maxCellVal = Math.max(maxCellVal, getVal([rk], [ck]));
    })
  );
  if (colVals0.length === 0)
    rowVals0.forEach((rk) => {
      maxCellVal = Math.max(maxCellVal, rowTotals[rk]);
    });

  return {
    rowVals0,
    colVals0,
    subRowValsMap,
    subColValsMap,
    getValue: getVal,
    getOrderCount,
    getOrders,
    rowTotals,
    colTotals,
    grandTotal,
    maxCellVal,
  };
}
