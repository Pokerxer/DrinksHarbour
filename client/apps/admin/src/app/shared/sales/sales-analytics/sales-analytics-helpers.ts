// The grouping engine behind /sales/analytics.
//
// Mirrors the shape of the purchases analysis engine but speaks SalesOrder:
// quotations and orders share one ledger here, status is docType-aware, and
// money reads revenue-first (revenue/discount/tax), not cost-first. The
// bucket/multi-series algorithms live once below as a generic engine bound by
// a small config; only SALES_* declarations are domain-specific.
//
// Vitest runs `environment: 'node'` — nothing renderable may live here.

import type { SalesOrder, SalesLineItem } from '@/services/salesOrder.service';
import {
  getWeekNumber,
  isoWeekKeyOf,
  localDayKeyOf,
  getQuarter,
} from '../../purchases/purchases-analytics-helpers';
import {
  orderStatusLabel,
  quoteStatusLabel,
} from '../sales-helpers';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SalesGroupByKey =
  | 'customer'
  | 'salesperson'
  | 'product'
  | 'product_category'
  | 'subcategory'
  | 'brand'
  | 'status'
  | 'payment_method'
  | 'payment_status'
  | 'warehouse'
  | 'order_day'
  | 'order_week'
  | 'order_month'
  | 'order_quarter'
  | 'order_year';

export type SalesMeasure =
  | 'revenue'
  | 'untaxed_total'
  | 'discount_total'
  | 'tax_total'
  | 'count'
  | 'avg_order'
  | 'product_qty'
  | 'delivered_qty'
  | 'line_count';

export type ChartType = 'bar' | 'line' | 'pie' | 'table';
export type ViewMode = 'graph' | 'stacked';
export type SortField = 'value' | 'label' | 'orders';

export interface SortCriterion {
  field: SortField;
  dir: 'asc' | 'desc';
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: string[];
  groupBy: SalesGroupByKey | null;
  groupBy2: SalesGroupByKey | null;
  measure: SalesMeasure;
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
  orderList: SalesOrder[];
}

export interface MultiSeriesResult {
  rows: {
    label: string;
    isoKey: string;
    __total__: number;
    orders: number;
    orderList: SalesOrder[];
    [seriesKey: string]: unknown;
  }[];
  series: string[];
  orderMap: Record<string, Record<string, SalesOrder[]>>;
}

type Cell<I> = { item: I; currency: string };

interface EngineConfig<O, I> {
  itemsOf: (o: O) => I[];
  currencyOf: (o: O) => string;
  idOf: (o: O) => string;
  orderKey: (o: O, dim: string) => string;
  itemKey: (i: I, dim: string) => string;
  itemDims: Set<string>;
  fallbackKey: (dim: string) => string;
  aggregate: (
    orders: O[],
    cells: Cell<I>[],
    measure: string,
    toBase: (a: number, c: string) => number
  ) => number;
  formatLabel: (key: string, dim: string) => string;
}

interface EngineGroupRow<O> {
  label: string;
  isoKey: string;
  value: number;
  orders: number;
  orderList: O[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const SAVED_KEY = 'dh-sales-analysis-searches';

export const SALES_GROUP_ITEMS: { key: SalesGroupByKey; label: string }[] = [
  { key: 'customer', label: 'Customer' },
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'product', label: 'Product' },
  { key: 'product_category', label: 'Product Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'brand', label: 'Brand' },
  { key: 'status', label: 'Status' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'payment_status', label: 'Payment Status' },
  { key: 'warehouse', label: 'Warehouse' },
];

export const SALES_GROUP_DATE_ITEMS: { key: SalesGroupByKey; label: string }[] =
  [
    { key: 'order_year', label: 'Year' },
    { key: 'order_quarter', label: 'Quarter' },
    { key: 'order_month', label: 'Month' },
    { key: 'order_week', label: 'Week' },
    { key: 'order_day', label: 'Day' },
  ];

export const ALL_SALES_GROUP_ITEMS = [
  ...SALES_GROUP_ITEMS,
  ...SALES_GROUP_DATE_ITEMS,
];

export const SALES_MEASURES: { key: SalesMeasure; label: string }[] = [
  { key: 'revenue', label: 'Revenue (incl. tax)' },
  { key: 'untaxed_total', label: 'Untaxed Total' },
  { key: 'discount_total', label: 'Discount Given' },
  { key: 'tax_total', label: 'Tax' },
  { key: 'avg_order', label: 'Average Order Value' },
  { key: 'product_qty', label: 'Units Sold' },
  { key: 'delivered_qty', label: 'Units Delivered' },
  { key: 'line_count', label: 'Order Line Count' },
  { key: 'count', label: 'Document Count' },
];

export const IS_CURRENCY: Record<SalesMeasure, boolean> = {
  revenue: true,
  untaxed_total: true,
  discount_total: true,
  tax_total: true,
  avg_order: true,
  count: false,
  product_qty: false,
  delivered_qty: false,
  line_count: false,
};

const ITEM_DIMS = new Set<SalesGroupByKey>([
  'product',
  'product_category',
  'subcategory',
  'brand',
]);

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

export const PAYMENT_FILTER_ITEMS: { key: string; label: string }[] = [
  { key: 'pay_unpaid', label: 'Unpaid' },
  { key: 'pay_partial', label: 'Partially Paid' },
  { key: 'pay_paid', label: 'Paid' },
];

export const STATUS_FILTER_ITEMS: { key: string; label: string }[] = [
  { key: 'status_draft', label: 'Draft' },
  { key: 'status_confirmed', label: 'Confirmed (order)' },
  { key: 'status_partially_fulfilled', label: 'Partially Fulfilled' },
  { key: 'status_fulfilled', label: 'Fulfilled' },
  { key: 'status_cancelled', label: 'Cancelled (order)' },
  { key: 'status_sent', label: 'Sent (quote)' },
  { key: 'status_accepted', label: 'Accepted (quote)' },
];

// ── Dates & keys ───────────────────────────────────────────────────────────────

export function soDate(so: SalesOrder): Date {
  return new Date(so.createdAt || Date.now());
}

/** Normalises a line's subproduct ref (bare id or populated doc) to its id. */
function subProductKey(item: SalesLineItem): string {
  const ref = item.subproduct as unknown;
  if (ref && typeof ref === 'object')
    return String((ref as { _id?: unknown })._id ?? '');
  return String(ref ?? '');
}

export function resolveSalesItemDimKey(
  item: SalesLineItem,
  dim: SalesGroupByKey,
  prodMeta: Record<string, ProdMeta>
): string {
  switch (dim) {
    case 'product':
      return item.name || item.sku || 'Unknown';
    case 'product_category':
      return prodMeta[subProductKey(item)]?.catName || 'Uncategorized';
    case 'subcategory':
      return (
        prodMeta[subProductKey(item)]?.subCatName ||
        prodMeta[subProductKey(item)]?.catName ||
        'Uncategorized'
      );
    case 'brand':
      return prodMeta[subProductKey(item)]?.brandName || 'No Brand';
    default:
      return item.name || item.sku || 'Unknown';
  }
}

function warehouseBucket(ref: SalesOrder['warehouseId']): string {
  if (!ref) return 'No Warehouse';
  if (typeof ref === 'string') return ref;
  return ref.name ?? 'No Warehouse';
}

export function getSalesG1Key(
  so: SalesOrder,
  dim: SalesGroupByKey,
  prodMeta: Record<string, ProdMeta>
): string {
  if (ITEM_DIMS.has(dim)) {
    const item = so.items?.[0];
    if (!item) {
      if (dim === 'product') return 'Unknown';
      if (dim === 'brand') return 'No Brand';
      return 'Uncategorized';
    }
    return resolveSalesItemDimKey(item, dim, prodMeta);
  }

  const d = soDate(so);
  switch (dim) {
    case 'customer':
      return so.customerSnapshot?.name || 'Walk-in Customer';
    case 'salesperson':
      return so.salesperson || 'Unassigned';
    case 'status':
      // One Status dimension across both doc types — each shows its own
      // lifecycle vocabulary rather than collapsing to "unknown".
      return so.docType === 'quotation'
        ? quoteStatusLabel(so.quoteStatus)
        : orderStatusLabel(so.orderStatus);
    case 'payment_method':
      return so.paymentMethod
        ? so.paymentMethod.charAt(0).toUpperCase() + so.paymentMethod.slice(1)
        : 'No Payment';
    case 'payment_status':
      return PAYMENT_STATUS_LABELS[so.paymentStatus ?? 'unpaid'] ?? 'Unpaid';
    case 'warehouse':
      return warehouseBucket(so.warehouseId);
    case 'order_day':
      return localDayKeyOf(d);
    case 'order_week':
      return isoWeekKeyOf(d);
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

export function formatSalesG1Label(
  key: string,
  dim: SalesGroupByKey
): string {
  if (dim === 'order_day') {
    // Rebuild from parts — `new Date('YYYY-MM-DD')` parses as UTC midnight and
    // would render the previous day in UTC-negative timezones.
    const [y, m, d] = key.split('-').map(Number);
    if (y && m && d)
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    return key;
  }
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
    const [, q] = key.split('-');
    const [year] = key.split('-Q');
    return `Q${q} ${year}`;
  }
  return key;
}

// ── Measure aggregation ────────────────────────────────────────────────────────

function lineDiscountOff(item: SalesLineItem): number {
  if (!(item.discount > 0)) return 0;
  if ((item.discountType ?? 'fixed') === 'percentage')
    return ((item.unitPrice ?? 0) * (item.quantity ?? 0) * item.discount) / 100;
  return item.discount;
}

export function aggregateSalesMeasure(
  orderList: SalesOrder[],
  cells: Cell<SalesLineItem>[],
  measure: SalesMeasure,
  toBase: (amount: number, currency: string) => number
): number {
  const products = cells.filter(({ item }) => item.lineType === 'product');
  switch (measure) {
    case 'revenue':
      // lineTotal nets the discount; tax sits on top of it.
      return products.reduce(
        (s, { item, currency }) =>
          s + toBase((item.lineTotal ?? 0) + (item.taxAmount ?? 0), currency),
        0
      );
    case 'untaxed_total':
      return products.reduce(
        (s, { item, currency }) => s + toBase(item.lineTotal ?? 0, currency),
        0
      );
    case 'discount_total':
      return products.reduce(
        (s, { item, currency }) =>
          s + toBase(lineDiscountOff(item), currency),
        0
      );
    case 'tax_total':
      return products.reduce(
        (s, { item, currency }) => s + toBase(item.taxAmount ?? 0, currency),
        0
      );
    case 'count':
      return orderList.length;
    case 'avg_order': {
      const total = products.reduce(
        (s, { item, currency }) =>
          s + toBase((item.lineTotal ?? 0) + (item.taxAmount ?? 0), currency),
        0
      );
      return orderList.length > 0 ? total / orderList.length : 0;
    }
    case 'product_qty':
      return products.reduce((s, { item }) => s + (item.quantity ?? 0), 0);
    case 'delivered_qty':
      return products.reduce((s, { item }) => s + (item.fulfilledQty ?? 0), 0);
    case 'line_count':
      return products.length;
    default:
      return 0;
  }
}

// ── Filtering ──────────────────────────────────────────────────────────────────

function isDateKey(k: string): boolean {
  return k.startsWith('date_');
}

function matchesDate(d: Date, df: string): boolean {
  const now = new Date();
  if (df === 'date_today') return d.toDateString() === now.toDateString();
  if (df === 'date_week') {
    const s = new Date(now);
    s.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    s.setHours(0, 0, 0, 0);
    return d >= s;
  }
  if (df.startsWith('date_m_')) {
    const [, , yr, mo] = df.split('_');
    return d.getFullYear() === parseInt(yr) && d.getMonth() + 1 === parseInt(mo);
  }
  if (df.startsWith('date_q_')) {
    const [, , yr, q] = df.split('_');
    return d.getFullYear() === parseInt(yr) && getQuarter(d) === parseInt(q);
  }
  if (df.startsWith('date_y_'))
    return d.getFullYear() === parseInt(df.replace('date_y_', ''));
  return false;
}

export function applySalesFilters(
  orders: SalesOrder[],
  filters: string[],
  prodMeta: Record<string, ProdMeta>
): SalesOrder[] {
  let r = [...orders];

  if (filters.includes('not_cancelled'))
    r = r.filter(
      (o) =>
        o.orderStatus !== 'cancelled' &&
        !['rejected', 'expired'].includes(o.quoteStatus ?? '')
    );

  const types = filters.filter((f) => f.startsWith('type_'));
  if (types.length > 0)
    r = r.filter((o) => types.includes(`type_${o.docType}`));

  // A lifecycle value only ever matches documents whose own docType carries
  // it — validated against each enum so a stray order-only value on a
  // quotation can never satisfy e.g. status_fulfilled.
  const ORDER_STATUSES = new Set([
    'draft',
    'confirmed',
    'partially_fulfilled',
    'fulfilled',
    'cancelled',
  ]);
  const QUOTE_STATUSES = new Set([
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'converted',
  ]);
  const statuses = filters
    .filter((f) => f.startsWith('status_'))
    .map((f) => f.replace('status_', ''));
  if (statuses.length > 0)
    r = r.filter((o) => {
      const valid = o.docType === 'quotation' ? QUOTE_STATUSES : ORDER_STATUSES;
      const mine = o.docType === 'quotation' ? o.quoteStatus : o.orderStatus;
      return statuses.some((s) => valid.has(s) && s === (mine ?? ''));
    });

  const pays = filters
    .filter((f) => f.startsWith('pay_'))
    .map((f) => f.replace('pay_', ''));
  if (pays.length > 0)
    r = r.filter((o) => pays.includes(o.paymentStatus ?? 'unpaid'));

  const custVals = filters
    .filter((f) => f.startsWith('customer_search:'))
    .map((f) => f.slice(16).toLowerCase());
  if (custVals.length > 0)
    r = r.filter((o) =>
      custVals.some((q) =>
        (o.customerSnapshot?.name ?? '').toLowerCase().includes(q)
      )
    );

  const productVals = filters
    .filter((f) => f.startsWith('product_search:'))
    .map((f) => f.slice(15).toLowerCase());
  if (productVals.length > 0)
    r = r.filter((o) =>
      productVals.some((q) =>
        (o.items ?? []).some((i) =>
          (i.name ?? '').toLowerCase().includes(q)
        )
      )
    );

  const catNameVals = filters
    .filter((f) => f.startsWith('catname_search:'))
    .map((f) => f.slice(16).toLowerCase());
  if (catNameVals.length > 0)
    r = r.filter((o) =>
      catNameVals.some((q) =>
        (o.items ?? []).some((i) => {
          const meta = prodMeta[subProductKey(i)];
          return (
            (meta?.catName ?? '').toLowerCase().includes(q) ||
            (meta?.subCatName ?? '').toLowerCase().includes(q)
          );
        })
      )
    );

  const categoryIds = filters
    .filter((f) => f.startsWith('category_'))
    .map((f) => f.slice(9));
  if (categoryIds.length > 0)
    r = r.filter((o) =>
      (o.items ?? []).some(
        (i) => prodMeta[subProductKey(i)]?.catId === categoryIds.find((c) => c === prodMeta[subProductKey(i)]?.catId)
      )
    );

  const brandIds = filters
    .filter((f) => f.startsWith('brand_'))
    .map((f) => f.slice(6));
  if (brandIds.length > 0)
    r = r.filter((o) =>
      (o.items ?? []).some(
        (i) => brandIds.includes(prodMeta[subProductKey(i)]?.brandId ?? '')
      )
    );

  const dateFilters = filters.filter(isDateKey);
  if (dateFilters.length === 0) return r;
  return r.filter((o) => dateFilters.some((df) => matchesDate(soDate(o), df)));
}

// ── Sorting ────────────────────────────────────────────────────────────────────

function sortRows<T extends { label: string; orders: number; isoKey: string }>(
  rows: T[],
  groupBy: string,
  sortStack: SortCriterion[],
  getValue: (r: T) => number
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

// ── Generic grouping engine ────────────────────────────────────────────────────

function computeGroups<O, I>(
  orders: O[],
  groupBy: string,
  measure: string,
  cfg: EngineConfig<O, I>,
  toBase: (a: number, c: string) => number,
  sortStack: SortCriterion[]
): EngineGroupRow<O>[] {
  const groups: Record<
    string,
    { orderSet: Set<O>; cells: Cell<I>[] }
  > = {};
  const getBucket = (key: string) =>
    (groups[key] ??= { orderSet: new Set(), cells: [] });

  const isItem = cfg.itemDims.has(groupBy);
  orders.forEach((o) => {
    const currency = cfg.currencyOf(o);
    const items = cfg.itemsOf(o);
    if (isItem && items.length === 0) {
      getBucket(cfg.fallbackKey(groupBy)).orderSet.add(o);
      return;
    }
    if (isItem) {
      items.forEach((item) => {
        const b = getBucket(cfg.itemKey(item, groupBy));
        b.orderSet.add(o);
        b.cells.push({ item, currency });
      });
      return;
    }
    const b = getBucket(cfg.orderKey(o, groupBy));
    b.orderSet.add(o);
    items.forEach((item) => b.cells.push({ item, currency }));
  });

  const rows: EngineGroupRow<O>[] = Object.entries(groups).map(
    ([key, g]) => ({
      label: cfg.formatLabel(key, groupBy),
      isoKey: key,
      value: cfg.aggregate(Array.from(g.orderSet), g.cells, measure, toBase),
      orders: g.orderSet.size,
      orderList: Array.from(g.orderSet),
    })
  );

  return sortRows(rows, groupBy, sortStack, (r) => r.value);
}

function computeMulti<O, I>(
  orders: O[],
  groupBy: string,
  groupBy2: string,
  measure: string,
  cfg: EngineConfig<O, I>,
  toBase: (a: number, c: string) => number,
  sortStack: SortCriterion[]
): MultiSeriesResult & { rowsRaw: MultiSeriesResult['rows'] } {
  const orderMap: Record<string, Record<string, O[]>> = {};
  const cellItems: Record<string, Record<string, Cell<I>[]>> = {};
  const cellSets: Record<string, Record<string, Set<O>>> = {};
  const seriesSet = new Set<string>();
  const g1Order: string[] = [];

  const register = (g1: string, g2: string) => {
    seriesSet.add(g2);
    if (!orderMap[g1]) {
      orderMap[g1] = {};
      cellItems[g1] = {};
      cellSets[g1] = {};
      g1Order.push(g1);
    }
    if (!orderMap[g1][g2]) {
      orderMap[g1][g2] = [];
      cellItems[g1][g2] = [];
      cellSets[g1][g2] = new Set();
    }
  };

  const g1IsItem = cfg.itemDims.has(groupBy);
  const g2IsItem = cfg.itemDims.has(groupBy2);

  orders.forEach((o) => {
    const currency = cfg.currencyOf(o);
    const items = cfg.itemsOf(o);
    const g1o = g1IsItem ? null : cfg.orderKey(o, groupBy);
    const g2o = g2IsItem ? null : cfg.orderKey(o, groupBy2);

    if (items.length === 0) {
      const g1 = g1o ?? cfg.fallbackKey(groupBy);
      const g2 = g2o ?? cfg.fallbackKey(groupBy2);
      register(g1, g2);
      if (!cellSets[g1][g2].has(o)) {
        cellSets[g1][g2].add(o);
        orderMap[g1][g2].push(o);
      }
      return;
    }

    items.forEach((item) => {
      const g1 = g1IsItem ? cfg.itemKey(item, groupBy) : g1o!;
      const g2 = g2IsItem ? cfg.itemKey(item, groupBy2) : g2o!;
      register(g1, g2);
      cellItems[g1][g2].push({ item, currency });
      if (!cellSets[g1][g2].has(o)) {
        cellSets[g1][g2].add(o);
        orderMap[g1][g2].push(o);
      }
    });
  });

  const series = Array.from(seriesSet).sort();

  const rows = g1Order.map((g1) => {
    const row: {
      label: string;
      isoKey: string;
      __total__: number;
      orders: number;
      orderList: O[];
      [seriesKey: string]: unknown;
    } = {
      label: cfg.formatLabel(g1, groupBy),
      isoKey: g1,
      __total__: 0,
      orders: 0,
      orderList: [],
    };
    const seen = new Set<string>();
    series.forEach((s) => {
      const list = orderMap[g1][s] ?? [];
      list.forEach((o) => {
        const id = cfg.idOf(o);
        if (!seen.has(id)) {
          seen.add(id);
          row.orderList.push(o);
        }
      });
      const val = cfg.aggregate(list, cellItems[g1]?.[s] ?? [], measure, toBase);
      row[s] = val;
      row.__total__ += val;
    });
    row.orders = row.orderList.length;
    return row;
  });

  const sortedRows = sortRows(rows, groupBy, sortStack, (r) => r.__total__);
  return { rows: sortedRows, rowsRaw: sortedRows, series, orderMap };
}

// ── Sales-bound engine ─────────────────────────────────────────────────────────

const SALES_ENGINE: EngineConfig<SalesOrder, SalesLineItem> = {
  itemsOf: (so) => so.items ?? [],
  currencyOf: (so) => so.currency || 'NGN',
  idOf: (so) => so._id,
  orderKey: (so, dim) => getSalesG1Key(so, dim as SalesGroupByKey, PROD_META_REF),
  itemKey: (item, dim) =>
    resolveSalesItemDimKey(item, dim as SalesGroupByKey, PROD_META_REF),
  itemDims: ITEM_DIMS,
  fallbackKey: (dim) =>
    dim === 'product' ? 'Unknown' : dim === 'brand' ? 'No Brand' : 'Uncategorized',
  aggregate: (orders, cells, measure, toBase) =>
    aggregateSalesMeasure(
      orders,
      cells,
      measure as SalesMeasure,
      toBase
    ),
  formatLabel: (key, dim) => formatSalesG1Label(key, dim as SalesGroupByKey),
};

/** Module-scoped metadata map threaded into the engine's key resolvers. */
let PROD_META_REF: Record<string, ProdMeta> = {};

export function withProdMeta(meta: Record<string, ProdMeta>): void {
  PROD_META_REF = meta ?? {};
}

export function computeSalesGroupData(
  orders: SalesOrder[],
  groupBy: SalesGroupByKey,
  measure: SalesMeasure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (a: number, c: string) => number,
  sortStack: SortCriterion[]
): GroupRow[] {
  withProdMeta(prodMeta);
  return computeGroups(orders, groupBy, measure, SALES_ENGINE, toBase, sortStack);
}

export function computeSalesMultiSeries(
  orders: SalesOrder[],
  groupBy: SalesGroupByKey,
  groupBy2: SalesGroupByKey,
  measure: SalesMeasure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (a: number, c: string) => number,
  sortStack: SortCriterion[]
): MultiSeriesResult {
  withProdMeta(prodMeta);
  const { rowsRaw, ...rest } = computeMulti(
    orders,
    groupBy,
    groupBy2,
    measure,
    SALES_ENGINE,
    toBase,
    sortStack
  );
  void rowsRaw;
  return rest;
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
    quarters.push({
      key: `date_q_${now.getFullYear()}_${q}`,
      label: `Q${q}`,
    });
  }
  const years: { key: string; label: string }[] = [];
  for (let i = 0; i < 3; i++) {
    years.push({ key: `date_y_${now.getFullYear() - i}`, label: String(now.getFullYear() - i) });
  }
  return { months, quarters, years };
}
