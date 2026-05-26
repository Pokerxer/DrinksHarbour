'use client';

import { useEffect, useState, useMemo, useRef, useCallback, Fragment, type RefObject } from 'react';
import {
  Bar, BarChart, Line, Area, ComposedChart, PieChart, Pie, Cell, Sector,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, LabelList,
} from 'recharts';
import {
  PiArrowsClockwise, PiCurrencyNgn, PiShoppingCart, PiReceipt,
  PiArrowCounterClockwise, PiChartBar, PiUsers, PiClock,
  PiPackage, PiTrendUp, PiFunnel, PiStack, PiStar, PiTrash,
  PiCaretDown, PiX, PiMagnifyingGlass, PiArrowUp, PiArrowDown,
  PiList, PiFloppyDisk, PiTag, PiStorefront, PiCheck,
  PiCalendarBlank, PiSlidersHorizontal, PiTable,
  PiArrowLeft, PiInfo, PiArrowsDownUp, PiCheckSquare, PiSquare, PiPrinter,
} from 'react-icons/pi';
import { printInvoices, DEFAULT_STORE } from '@/utils/invoice';
import InvoicePreview from '@/components/InvoicePreview';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string; variant?: string; quantity: number;
  priceAtPurchase: number; itemSubtotal: number; discountAmount?: number;
  sizeCostPrice?: number;
}
interface OrderRefund { totalRefunded: number; paymentMethod?: string; refundedAt?: string; }
interface PosOrder {
  _id: string; orderNumber?: string; receiptNumber?: string;
  total: number; subtotal?: number; discountTotal?: number;
  paymentMethod: string; paymentStatus?: string; status?: string; isVoided?: boolean;
  placedAt: string; createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  session?: { _id: string; terminalType?: string; openedAt?: string } | null;
  paymentDetails?: { splitPayments?: { method: string; amount: number }[] };
  items?: OrderItem[];
  refunds?: OrderRefund[];
}

type GroupByKey  = 'cashier' | 'payment_method' | 'product' | 'terminal'
                 | 'product_category' | 'subcategory' | 'brand'
                 | 'order_day' | 'order_week' | 'order_month' | 'order_quarter' | 'order_year';
type Measure     = 'total_price' | 'count' | 'avg_price' | 'product_qty' | 'line_count' | 'subtotal' | 'total_discount' | 'profit' | 'delay_validation' | 'subtotal_notax';
type ChartType     = 'bar' | 'line' | 'pie' | 'table';
type SortField     = 'value' | 'label' | 'orders';
type ViewMode      = 'graph' | 'pivot';
interface SortCriterion { field: SortField; dir: 'asc' | 'desc'; }

interface SavedSearch {
  id: string; name: string;
  filters: string[]; groupBy: GroupByKey | null; groupBy2: GroupByKey | null; measure: Measure;
}

interface CatItem { _id: string; name: string; parent?: string; level?: number; }
interface BrandItem { _id: string; name: string; }

// name-keyed lookup built from products
interface ProdMeta { catId: string; catName: string; subCatId?: string; subCatName?: string; brandId: string; brandName: string; }

// ── Constants ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card/POS', bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money', split: 'Split', other: 'Other',
};

const PALETTE = ['#b20202','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#ec4899','#14b8a6','#8b5cf6'];
const SAVED_KEY = 'dh-pos-analysis-searches';

const FILTER_STATIC: { key: string; label: string }[] = [
  { key: 'invoiced',      label: 'Invoiced' },
  { key: 'not_invoiced',  label: 'Not Invoiced' },
  { key: 'not_cancelled', label: 'Not Cancelled' },
];

const GROUP_BY_ITEMS: { key: GroupByKey; label: string }[] = [
  { key: 'cashier',          label: 'Cashier' },
  { key: 'terminal',         label: 'Point of Sale' },
  { key: 'product',          label: 'Product' },
  { key: 'product_category', label: 'Product Category' },
  { key: 'subcategory',      label: 'Subcategory' },
  { key: 'brand',            label: 'Brand' },
  { key: 'payment_method',   label: 'Payment Method' },
];

const GROUP_BY_DATE_ITEMS: { key: GroupByKey; label: string }[] = [
  { key: 'order_year',    label: 'Year' },
  { key: 'order_quarter', label: 'Quarter' },
  { key: 'order_month',   label: 'Month' },
  { key: 'order_week',    label: 'Week' },
  { key: 'order_day',     label: 'Day' },
];

const ALL_GROUP_ITEMS = [...GROUP_BY_ITEMS, ...GROUP_BY_DATE_ITEMS];

const MEASURES: { key: Measure; label: string; separator?: boolean }[] = [
  { key: 'avg_price',         label: 'Average Price' },
  { key: 'delay_validation',  label: 'Delay Validation' },
  { key: 'profit',            label: 'Profit' },
  { key: 'product_qty',       label: 'Product Quantity' },
  { key: 'line_count',        label: 'Sale Line Count' },
  { key: 'subtotal',          label: 'Subtotal w/o Discount' },
  { key: 'subtotal_notax',    label: 'Subtotal w/o Tax' },
  { key: 'total_discount',    label: 'Total Discount' },
  { key: 'total_price',       label: 'Total Price' },
  { key: 'count',             label: 'Count', separator: true },
];

const IS_CURRENCY: Record<Measure, boolean> = {
  total_price: true, avg_price: true, subtotal: true, total_discount: true,
  profit: true, subtotal_notax: true,
  count: false, product_qty: false, line_count: false, delay_validation: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function cashierLabel(u?: { firstName: string; lastName: string; posName?: string } | null) {
  return u ? (u.posName || `${u.firstName} ${u.lastName}`.trim()) : 'Unknown';
}

function fmtAxisVal(v: number, measure: Measure): string {
  if (measure === 'delay_validation') return `${v.toFixed(1)}m`;
  if (IS_CURRENCY[measure]) {
    if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `₦${Math.round(v / 1_000)}K`;
    return `₦${v}`;
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

function fmtCompact(v: number): string {
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (v >= 1_000)         return `₦${(v / 1_000).toFixed(1)}K`;
  return `₦${Math.round(v).toLocaleString()}`;
}

function fmtMeasureVal(v: number, measure: Measure): string {
  if (measure === 'delay_validation') {
    if (v < 1) return `${Math.round(v * 60)}s`;
    if (v >= 60) return `${(v / 60).toFixed(1)}h`;
    return `${v.toFixed(1)}m`;
  }
  return IS_CURRENCY[measure] ? formatCurrency(v) : String(Math.round(v));
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
}

function getQuarter(d: Date): number { return Math.ceil((d.getMonth() + 1) / 3); }

// Generate dynamic date filter sections from current date
function buildDateFilterItems(now: Date) {
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

function isDateKey(k: string)   { return k.startsWith('date_'); }
function isSearchFilter(k: string) {
  return k.startsWith('pos_search:') || k.startsWith('customer_search:') ||
         k.startsWith('product_search:') || k.startsWith('catname_search:');
}

const SEARCH_DEFS = [
  {
    prefix: 'pos_search:',
    label:  'Cashier',
    match:  (o: PosOrder, q: string, _pm: Record<string, ProdMeta>) =>
      cashierLabel(o.posStaff).toLowerCase().includes(q),
  },
  {
    prefix: 'customer_search:',
    label:  'Customer',
    match:  (o: PosOrder, q: string, _pm: Record<string, ProdMeta>) => {
      const name  = `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.trim().toLowerCase();
      const phone = (o.customer?.phone ?? '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    },
  },
  {
    prefix: 'product_search:',
    label:  'Product',
    match:  (o: PosOrder, q: string, _pm: Record<string, ProdMeta>) =>
      (o.items || []).some(i => i.name.toLowerCase().includes(q) || (i.variant ?? '').toLowerCase().includes(q)),
  },
  {
    prefix: 'catname_search:',
    label:  'Category',
    match:  (o: PosOrder, q: string, pm: Record<string, ProdMeta>) =>
      (o.items || []).some(i => {
        const m = pm[i.name];
        return m && (m.catName.toLowerCase().includes(q) || (m.subCatName ?? '').toLowerCase().includes(q));
      }),
  },
] as const;

function applyFilters(
  orders: PosOrder[],
  filters: string[],
  prodMeta: Record<string, ProdMeta>,
): PosOrder[] {
  let r = [...orders];

  // Status filters
  if (filters.includes('not_cancelled')) r = r.filter(o =>
    !o.isVoided && o.status !== 'voided' && o.status !== 'cancelled'
  );
  if (filters.includes('invoiced'))      r = r.filter(o =>
    o.paymentStatus === 'paid' || o.status === 'paid' || o.status === 'completed'
  );
  if (filters.includes('not_invoiced'))  r = r.filter(o =>
    o.paymentStatus !== 'paid' && o.status !== 'paid' && o.status !== 'completed'
  );

  // Category / brand filters
  const catFilters   = filters.filter(f => f.startsWith('category_')).map(f => f.replace('category_', ''));
  const brandFilters = filters.filter(f => f.startsWith('brand_')).map(f => f.replace('brand_', ''));
  if (catFilters.length > 0) {
    r = r.filter(o => (o.items || []).some(item => {
      const meta = prodMeta[item.name];
      return meta && catFilters.includes(meta.catId);
    }));
  }
  if (brandFilters.length > 0) {
    r = r.filter(o => (o.items || []).some(item => {
      const meta = prodMeta[item.name];
      return meta && brandFilters.includes(meta.brandId);
    }));
  }

  // Smart text-search filters — multiple values per type use OR logic
  const posVals      = filters.filter(f => f.startsWith('pos_search:')).map(f => f.slice(11).toLowerCase());
  const custVals     = filters.filter(f => f.startsWith('customer_search:')).map(f => f.slice(16).toLowerCase());
  const productVals  = filters.filter(f => f.startsWith('product_search:')).map(f => f.slice(15).toLowerCase());
  const catnameVals  = filters.filter(f => f.startsWith('catname_search:')).map(f => f.slice(15).toLowerCase());

  if (posVals.length > 0)
    r = r.filter(o => posVals.some(q => cashierLabel(o.posStaff).toLowerCase().includes(q)));
  if (custVals.length > 0)
    r = r.filter(o => custVals.some(q => {
      const name = `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.trim().toLowerCase();
      return name.includes(q) || (o.customer?.phone ?? '').toLowerCase().includes(q);
    }));
  if (productVals.length > 0)
    r = r.filter(o => productVals.some(q =>
      (o.items || []).some(i => i.name.toLowerCase().includes(q) || (i.variant ?? '').toLowerCase().includes(q))
    ));
  if (catnameVals.length > 0)
    r = r.filter(o => catnameVals.some(q =>
      (o.items || []).some(i => {
        const m = prodMeta[i.name];
        return m && (m.catName.toLowerCase().includes(q) || (m.subCatName ?? '').toLowerCase().includes(q));
      })
    ));

  // Date filters — multiple can be active (OR logic); date_custom is handled externally
  const dateFilters = filters.filter(f => isDateKey(f) && f !== 'date_custom');
  if (dateFilters.length === 0) return r;

  const now = new Date();

  r = r.filter(o => {
    const d = new Date(o.placedAt || o.createdAt);
    return dateFilters.some(df => {
      if (df === 'date_today')     return d.toDateString() === now.toDateString();
      if (df === 'date_yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); return d.toDateString() === y.toDateString(); }
      if (df === 'date_week')      { const s = new Date(now); s.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); s.setHours(0,0,0,0); return d >= s; }
      if (df.startsWith('date_m_')) { const [,,yr,mo] = df.split('_'); return d.getFullYear() === parseInt(yr) && d.getMonth() + 1 === parseInt(mo); }
      if (df.startsWith('date_q_')) { const [,,yr,q]  = df.split('_'); return d.getFullYear() === parseInt(yr) && getQuarter(d) === parseInt(q); }
      if (df.startsWith('date_y_')) { return d.getFullYear() === parseInt(df.replace('date_y_', '')); }
      return false;
    });
  });

  return r;
}

// ── Group data computation ─────────────────────────────────────────────────────

interface GroupRow { label: string; isoKey: string; value: number; orders: number; orderList: PosOrder[]; }

function computeGroupData(
  orders: PosOrder[],
  groupBy: GroupByKey,
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  itemFilter?: (item: OrderItem) => boolean,
): GroupRow[] {
  type Bucket = { orders: Set<string>; orderList: PosOrder[]; items: OrderItem[] };
  const groups: Record<string, Bucket> = {};

  const getBucket = (key: string): Bucket => {
    if (!groups[key]) groups[key] = { orders: new Set(), orderList: [], items: [] };
    return groups[key];
  };

  const isItemGroup = groupBy === 'product' || groupBy === 'product_category' || groupBy === 'subcategory' || groupBy === 'brand';

  orders.forEach(o => {
    if (isItemGroup) {
      const items = itemFilter ? (o.items || []).filter(itemFilter) : (o.items || []);
      items.forEach(item => {
        let key: string;
        if (groupBy === 'product') {
          key = item.variant ? `${item.name} · ${item.variant}` : item.name;
        } else if (groupBy === 'product_category') {
          key = prodMeta[item.name]?.catName || 'Uncategorized';
        } else if (groupBy === 'subcategory') {
          key = prodMeta[item.name]?.subCatName || prodMeta[item.name]?.catName || 'Uncategorized';
        } else {
          key = prodMeta[item.name]?.brandName || 'No Brand';
        }
        const b = getBucket(key);
        if (!b.orders.has(o._id)) { b.orders.add(o._id); b.orderList.push(o); }
        b.items.push(item);
      });
      return;
    }

    let key: string;
    if (groupBy === 'cashier') {
      key = cashierLabel(o.posStaff);
    } else if (groupBy === 'payment_method') {
      if (o.paymentDetails?.splitPayments?.length) {
        o.paymentDetails.splitPayments.forEach(sp => {
          const mk = METHOD_LABEL[sp.method] || sp.method;
          const b  = getBucket(mk);
          b.orders.add(o._id + sp.method);
          b.orderList.push({ ...o, total: sp.amount } as PosOrder);
        });
        return;
      }
      key = METHOD_LABEL[o.paymentMethod] || o.paymentMethod || 'Other';
    } else if (groupBy === 'terminal') {
      const t = o.session?.terminalType || 'retail';
      key = t.charAt(0).toUpperCase() + t.slice(1);
    } else if (groupBy === 'order_day') {
      key = new Date(o.placedAt || o.createdAt).toISOString().split('T')[0];
    } else if (groupBy === 'order_week') {
      const d = new Date(o.placedAt || o.createdAt);
      key = `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, '0')}`;
    } else if (groupBy === 'order_quarter') {
      const d = new Date(o.placedAt || o.createdAt);
      key = `${d.getFullYear()}-Q${getQuarter(d)}`;
    } else if (groupBy === 'order_year') {
      key = String(new Date(o.placedAt || o.createdAt).getFullYear());
    } else { // order_month
      const d = new Date(o.placedAt || o.createdAt);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const b = getBucket(key);
    b.orders.add(o._id);
    b.orderList.push(o);
  });

  return Object.entries(groups).map(([key, { orderList, items }]) => {
    const ordersForRow = orderList;
    let value: number;
    switch (measure) {
      case 'total_price':
        value = isItemGroup
          ? items.reduce((s, i) => s + (i.itemSubtotal ?? i.priceAtPurchase * i.quantity), 0)
          : orderList.reduce((s, o) => s + (o.total ?? 0), 0);
        break;
      case 'count':
        value = orderList.length;
        break;
      case 'avg_price':
        value = isItemGroup
          ? (items.length > 0 ? items.reduce((s, i) => s + i.priceAtPurchase, 0) / items.length : 0)
          : (orderList.length > 0 ? orderList.reduce((s, o) => s + (o.total ?? 0), 0) / orderList.length : 0);
        break;
      case 'product_qty':
        value = items.length > 0 ? items.reduce((s, i) => s + i.quantity, 0)
          : orderList.reduce((s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0), 0);
        break;
      case 'line_count':
        value = items.length > 0 ? items.length
          : orderList.reduce((s, o) => s + (o.items || []).length, 0);
        break;
      case 'subtotal':
        value = orderList.reduce((s, o) => s + (o.subtotal ?? o.total ?? 0), 0);
        break;
      case 'subtotal_notax':
        // No tax tracking in this system — subtotal already excludes tax
        value = isItemGroup
          ? items.reduce((s, i) => s + (i.itemSubtotal ?? i.priceAtPurchase * i.quantity), 0)
          : orderList.reduce((s, o) => s + (o.subtotal ?? o.total ?? 0), 0);
        break;
      case 'total_discount':
        value = orderList.reduce((s, o) => s + (o.discountTotal ?? 0), 0);
        break;
      case 'profit': {
        // Profit = selling price − Size.costPrice × qty
        // Uses sizeCostPrice populated directly from the Size model.
        // Items with no cost price set contribute 0 profit.
        const profitFn = (i: OrderItem): number => {
          const cost = i.sizeCostPrice ?? 0;
          if (cost <= 0) return 0;
          const revenue = i.itemSubtotal ?? i.priceAtPurchase * i.quantity;
          return revenue - cost * i.quantity;
        };
        if (isItemGroup) {
          value = items.reduce((s, i) => s + profitFn(i), 0);
        } else {
          value = orderList.reduce((s, o) => {
            const lineProfit = (o.items || []).reduce((cs, i) => cs + profitFn(i), 0);
            const hasCost    = (o.items || []).some(i => (i.sizeCostPrice ?? 0) > 0);
            return s + lineProfit - (hasCost ? (o.discountTotal ?? 0) : 0);
          }, 0);
        }
        break;
      }
      case 'delay_validation': {
        // Average minutes from order creation to placement/validation
        const delays = orderList.map(o => {
          const created = new Date(o.createdAt).getTime();
          const placed  = new Date(o.placedAt || o.createdAt).getTime();
          return Math.max(0, (placed - created) / 60000);
        });
        value = delays.length > 0 ? delays.reduce((s, d) => s + d, 0) / delays.length : 0;
        break;
      }
      default:
        value = 0;
    }

    // Human label + ISO sort key
    let label = key;
    let isoKey = key;
    if (groupBy === 'order_day') {
      label = new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (groupBy === 'order_week') {
      const [yr, wPart] = key.split('-W');
      label = `W${wPart} ${yr}`;
    } else if (groupBy === 'order_month') {
      const [yr, mo] = key.split('-');
      label = new Date(parseInt(yr), parseInt(mo) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (groupBy === 'order_quarter') {
      const [yr, q] = key.split('-');
      label = `${q} ${yr}`;
    }

    return { label, isoKey, value, orders: orderList.length, orderList: ordersForRow };
  });
}

// ── Multi-series (stacked) computation ────────────────────────────────────────

function getOrderG1Key(o: PosOrder, groupBy: GroupByKey, prodMeta: Record<string, ProdMeta>): string {
  if (groupBy === 'cashier') return cashierLabel(o.posStaff);
  if (groupBy === 'terminal') {
    const t = o.session?.terminalType || 'retail';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (groupBy === 'payment_method') return METHOD_LABEL[o.paymentMethod] || o.paymentMethod || 'Other';
  if (groupBy === 'order_day') return new Date(o.placedAt || o.createdAt).toISOString().split('T')[0];
  if (groupBy === 'order_week') {
    const d = new Date(o.placedAt || o.createdAt);
    return `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, '0')}`;
  }
  if (groupBy === 'order_quarter') {
    const d = new Date(o.placedAt || o.createdAt);
    return `${d.getFullYear()}-Q${getQuarter(d)}`;
  }
  if (groupBy === 'order_month') {
    const d = new Date(o.placedAt || o.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (groupBy === 'order_year') return String(new Date(o.placedAt || o.createdAt).getFullYear());
  const firstName = o.items?.[0];
  const itemName  = firstName ? (firstName.variant ? `${firstName.name} · ${firstName.variant}` : firstName.name) : 'Unknown';
  if (groupBy === 'product') return itemName;
  if (groupBy === 'product_category') return prodMeta[o.items?.[0]?.name || '']?.catName || 'Uncategorized';
  if (groupBy === 'subcategory') {
    const m = prodMeta[o.items?.[0]?.name || ''];
    return m?.subCatName || m?.catName || 'Uncategorized';
  }
  if (groupBy === 'brand') return prodMeta[o.items?.[0]?.name || '']?.brandName || 'No Brand';
  return itemName;
}

function formatG1Label(isoKey: string, groupBy: GroupByKey): string {
  if (groupBy === 'order_day')  return new Date(isoKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (groupBy === 'order_week') { const [yr, w] = isoKey.split('-W'); return `W${w} ${yr}`; }
  if (groupBy === 'order_month') {
    const [yr, mo] = isoKey.split('-');
    return new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (groupBy === 'order_quarter') { const [yr, q] = isoKey.split('-'); return `${q} ${yr}`; }
  return isoKey;
}

type GroupRow2 = { label: string; isoKey: string; __total__: number; [key: string]: string | number };

function computeMultiSeries(
  orders: PosOrder[],
  groupBy: GroupByKey,
  groupBy2: GroupByKey,
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  groupBy3?: GroupByKey | null,
): { rows: GroupRow2[]; series: string[]; orderMap: Record<string, Record<string, PosOrder[]>> } {
  const nested: Record<string, Record<string, PosOrder[]>> = {};

  orders.forEach(o => {
    const g1 = getOrderG1Key(o, groupBy, prodMeta);
    const g2 = getOrderG1Key(o, groupBy2, prodMeta);
    const g3 = groupBy3 ? getOrderG1Key(o, groupBy3, prodMeta) : null;
    const seriesKey = g3 ? `${g2} › ${g3}` : g2;
    if (!nested[g1]) nested[g1] = {};
    if (!nested[g1][seriesKey]) nested[g1][seriesKey] = [];
    nested[g1][seriesKey].push(o);
  });

  const seriesSet = new Set<string>();
  Object.values(nested).forEach(m => Object.keys(m).forEach(k => seriesSet.add(k)));
  const series = Array.from(seriesSet).sort();

  const rows: GroupRow2[] = Object.entries(nested).map(([g1Key, g2Map]) => {
    const row: GroupRow2 = { label: formatG1Label(g1Key, groupBy), isoKey: g1Key, __total__: 0 };
    series.forEach(s => {
      const ords = g2Map[s] || [];
      let val = 0;
      switch (measure) {
        case 'total_price':       val = ords.reduce((a, o) => a + (o.total ?? 0), 0); break;
        case 'count':             val = ords.length; break;
        case 'avg_price':         val = ords.length > 0 ? ords.reduce((a, o) => a + (o.total ?? 0), 0) / ords.length : 0; break;
        case 'product_qty':       val = ords.reduce((a, o) => a + (o.items || []).reduce((b, i) => b + i.quantity, 0), 0); break;
        case 'line_count':        val = ords.reduce((a, o) => a + (o.items || []).length, 0); break;
        case 'subtotal':          val = ords.reduce((a, o) => a + (o.subtotal ?? o.total ?? 0), 0); break;
        case 'subtotal_notax':    val = ords.reduce((a, o) => a + (o.subtotal ?? o.total ?? 0), 0); break;
        case 'total_discount':    val = ords.reduce((a, o) => a + (o.discountTotal ?? 0), 0); break;
        case 'profit':
          val = ords.reduce((a, o) => {
            const lineProfit = (o.items || []).reduce((b, i) => {
              const cost = i.sizeCostPrice ?? 0;
              if (cost <= 0) return b;
              const revenue = i.itemSubtotal ?? i.priceAtPurchase * i.quantity;
              return b + revenue - cost * i.quantity;
            }, 0);
            const hasCost = (o.items || []).some(i => (i.sizeCostPrice ?? 0) > 0);
            return a + lineProfit - (hasCost ? (o.discountTotal ?? 0) : 0);
          }, 0);
          break;
        case 'delay_validation': {
          const delays = ords.map(o => Math.max(0, (new Date(o.placedAt || o.createdAt).getTime() - new Date(o.createdAt).getTime()) / 60000));
          val = delays.length > 0 ? delays.reduce((a, d) => a + d, 0) / delays.length : 0;
          break;
        }
      }
      row[s] = val;
      row.__total__ += val;
    });
    return row;
  });

  const isTime = ['order_day','order_week','order_month','order_quarter','order_year'].includes(groupBy);
  if (isTime) rows.sort((a, b) => a.isoKey.localeCompare(b.isoKey));
  else rows.sort((a, b) => b.__total__ - a.__total__);

  return { rows, series, orderMap: nested };
}

// ── Pivot helpers ──────────────────────────────────────────────────────────────

const ITEM_DIMS = new Set<GroupByKey>(['product', 'product_category', 'subcategory', 'brand']);

function getOrderDimKey(o: PosOrder, dim: GroupByKey): string {
  if (dim === 'cashier') return cashierLabel(o.posStaff);
  if (dim === 'terminal') {
    const t = o.session?.terminalType || 'retail';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (dim === 'payment_method') return METHOD_LABEL[o.paymentMethod] || o.paymentMethod || 'Other';
  if (dim === 'order_day')   return new Date(o.placedAt || o.createdAt).toISOString().split('T')[0];
  if (dim === 'order_week')  { const d = new Date(o.placedAt || o.createdAt); return `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, '0')}`; }
  if (dim === 'order_month') { const d = new Date(o.placedAt || o.createdAt); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  if (dim === 'order_quarter') { const d = new Date(o.placedAt || o.createdAt); return `${d.getFullYear()}-Q${getQuarter(d)}`; }
  if (dim === 'order_year')  return String(new Date(o.placedAt || o.createdAt).getFullYear());
  return '—';
}

function getItemDimKey(item: OrderItem, dim: GroupByKey, prodMeta: Record<string, ProdMeta>): string {
  if (dim === 'product') return item.variant ? `${item.name} · ${item.variant}` : item.name;
  const m = prodMeta[item.name];
  if (dim === 'product_category') return m?.catName    || 'Unknown';
  if (dim === 'subcategory')      return m?.subCatName || m?.catName || 'Unknown';
  if (dim === 'brand')            return m?.brandName  || 'Unknown';
  return '—';
}

function fmtDimKey(key: string, dim: GroupByKey): string {
  if (dim === 'order_day')   return new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (dim === 'order_week')  { const [yr, w] = key.split('-W'); return `W${w} ${yr}`; }
  if (dim === 'order_month') { const [yr, mo] = key.split('-'); return new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }
  if (dim === 'order_quarter') return key.replace('-', ' ');
  return key;
}

function applyMeasure(orderList: PosOrder[], items: OrderItem[], measure: Measure, isItemGroup: boolean): number {
  switch (measure) {
    case 'total_price':
      return isItemGroup
        ? items.reduce((s, i) => s + (i.itemSubtotal ?? i.priceAtPurchase * i.quantity), 0)
        : orderList.reduce((s, o) => s + (o.total ?? 0), 0);
    case 'count': return orderList.length;
    case 'avg_price':
      return isItemGroup
        ? (items.length > 0 ? items.reduce((s, i) => s + i.priceAtPurchase, 0) / items.length : 0)
        : (orderList.length > 0 ? orderList.reduce((s, o) => s + (o.total ?? 0), 0) / orderList.length : 0);
    case 'product_qty':
      return items.length > 0
        ? items.reduce((s, i) => s + i.quantity, 0)
        : orderList.reduce((s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0), 0);
    case 'line_count':
      return items.length > 0 ? items.length : orderList.reduce((s, o) => s + (o.items || []).length, 0);
    case 'subtotal': case 'subtotal_notax':
      return isItemGroup
        ? items.reduce((s, i) => s + (i.itemSubtotal ?? i.priceAtPurchase * i.quantity), 0)
        : orderList.reduce((s, o) => s + (o.subtotal ?? o.total ?? 0), 0);
    case 'total_discount': return orderList.reduce((s, o) => s + (o.discountTotal ?? 0), 0);
    case 'profit': {
      const pFn = (i: OrderItem) => {
        const sp = i.sizeCostPrice ?? 0; const rev = i.itemSubtotal ?? i.priceAtPurchase * i.quantity;
        return sp > 0 ? rev - sp * i.quantity : 0;
      };
      if (isItemGroup) return items.reduce((s, i) => s + pFn(i), 0);
      return orderList.reduce((s, o) => {
        const lp = (o.items || []).reduce((cs, i) => cs + pFn(i), 0);
        const hc = (o.items || []).some(i => (i.sizeCostPrice ?? 0) > 0);
        return s + lp - (hc ? (o.discountTotal ?? 0) : 0);
      }, 0);
    }
    case 'delay_validation': {
      const delays = orderList.map(o => Math.max(0, (new Date(o.placedAt || o.createdAt).getTime() - new Date(o.createdAt).getTime()) / 60000));
      return delays.length > 0 ? delays.reduce((s, d) => s + d, 0) / delays.length : 0;
    }
    default: return 0;
  }
}

interface PivotCell { orders: Map<string, PosOrder>; items: OrderItem[]; }

function computePivot(
  orders: PosOrder[],
  rowDim: GroupByKey,
  colDim: GroupByKey,
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  itemFilter: ((item: OrderItem) => boolean) | null,
) {
  const rowIsItem   = ITEM_DIMS.has(rowDim);
  const colIsItem   = ITEM_DIMS.has(colDim);
  const eitherIsItem = rowIsItem || colIsItem;

  const cells: Record<string, Record<string, PivotCell>> = {};
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  orders.forEach(o => {
    const allItems  = o.items || [];
    const filtItems = itemFilter ? allItems.filter(itemFilter) : allItems;

    if (!eitherIsItem) {
      const rk = getOrderDimKey(o, rowDim);
      const ck = getOrderDimKey(o, colDim);
      rowSet.add(rk); colSet.add(ck);
      if (!cells[rk])      cells[rk] = {};
      if (!cells[rk][ck]) cells[rk][ck] = { orders: new Map(), items: [] };
      cells[rk][ck].orders.set(o._id, o);
      cells[rk][ck].items.push(...filtItems);
    } else {
      const effItems = filtItems.length > 0 ? filtItems : allItems;
      effItems.forEach(item => {
        const rk = rowIsItem ? getItemDimKey(item, rowDim, prodMeta) : getOrderDimKey(o, rowDim);
        const ck = colIsItem ? getItemDimKey(item, colDim, prodMeta) : getOrderDimKey(o, colDim);
        rowSet.add(rk); colSet.add(ck);
        if (!cells[rk])      cells[rk] = {};
        if (!cells[rk][ck]) cells[rk][ck] = { orders: new Map(), items: [] };
        cells[rk][ck].orders.set(o._id, o);
        cells[rk][ck].items.push(item);
      });
    }
  });

  const isItemGroup = eitherIsItem;
  const valueGrid: Record<string, Record<string, number>> = {};
  const ordGrid:   Record<string, Record<string, number>> = {};
  Object.keys(cells).forEach(rk => {
    valueGrid[rk] = {}; ordGrid[rk] = {};
    Object.keys(cells[rk]).forEach(ck => {
      const cell = cells[rk][ck];
      const ol   = Array.from(cell.orders.values());
      valueGrid[rk][ck] = applyMeasure(ol, cell.items, measure, isItemGroup);
      ordGrid[rk][ck]   = ol.length;
    });
  });

  let rowKeys = Array.from(rowSet);
  let colKeys = Array.from(colSet);

  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  const rowOrders: Record<string, number> = {};
  rowKeys.forEach(rk => {
    rowTotals[rk] = colKeys.reduce((s, ck) => s + (valueGrid[rk]?.[ck] ?? 0), 0);
    rowOrders[rk] = Array.from(new Set(Object.values(cells[rk] ?? {}).flatMap(c => Array.from(c.orders.keys())))).length;
  });
  colKeys.forEach(ck => {
    colTotals[ck] = rowKeys.reduce((s, rk) => s + (valueGrid[rk]?.[ck] ?? 0), 0);
  });
  const grandTotal  = rowKeys.reduce((s, rk) => s + rowTotals[rk], 0);
  const allVals     = Object.values(valueGrid).flatMap(r => Object.values(r));
  const maxCell     = allVals.length > 0 ? Math.max(...allVals) : 0;

  const isDate = (d: GroupByKey) => ['order_day','order_week','order_month','order_quarter','order_year'].includes(d);
  if (isDate(rowDim)) rowKeys.sort((a, b) => a.localeCompare(b));
  else                rowKeys.sort((a, b) => rowTotals[b] - rowTotals[a]);
  if (isDate(colDim)) colKeys.sort((a, b) => a.localeCompare(b));
  else                colKeys.sort((a, b) => colTotals[b] - colTotals[a]);

  return { rowKeys, colKeys, valueGrid, ordGrid, rowTotals, colTotals, rowOrders, grandTotal, maxCell };
}

// ── Hierarchical pivot computation (Odoo-style) ────────────────────────────────

interface HierPivotResult {
  rowVals0: string[];
  colVals0: string[];
  subRowValsMap: Record<string, string[]>;
  subColValsMap: Record<string, string[]>;
  getValue: (rowPath: string[], colPath: string[]) => number;
  getOrderCount: (rowPath: string[], colPath: string[]) => number;
  getOrders: (rowPath: string[], colPath: string[]) => PosOrder[];
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
  maxCellVal: number;
}

function computeHierarchicalPivot(
  orders: PosOrder[],
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  itemFilter: ((item: OrderItem) => boolean) | null,
): HierPivotResult | null {
  if (rowDims.length === 0) return null;
  const isItemGroup = rowDims.some(d => ITEM_DIMS.has(d)) || colDims.some(d => ITEM_DIMS.has(d));

  // ── Pre-computed value cache ──────────────────────────────────────────────────
  // For each (order × item) atom we insert into all (ri, ci) prefix-combinations
  // of its rKeys / cKeys.  This means getValue(rowPath, colPath) is an O(1) Map
  // lookup instead of an O(atoms) linear scan executed for every cell.
  interface CacheEntry { ords: Map<string, PosOrder>; items: OrderItem[]; }
  const cache    = new Map<string, CacheEntry>();
  const numCache = new Map<string, number>();

  const cacheKey = (rPath: string[], cPath: string[]) =>
    rPath.join('\x00') + '\x01' + cPath.join('\x00');

  const addToCache = (rPath: string[], cPath: string[], ordId: string, order: PosOrder, item: OrderItem | null) => {
    const k = cacheKey(rPath, cPath);
    let e = cache.get(k);
    if (!e) { e = { ords: new Map(), items: [] }; cache.set(k, e); }
    e.ords.set(ordId, order);
    if (item) e.items.push(item);
  };

  const rValSets: Set<string>[] = rowDims.map(() => new Set<string>());
  const cValSets: Set<string>[] = colDims.map(() => new Set<string>());
  const subRVals = new Map<string, Set<string>>();
  const subCVals = new Map<string, Set<string>>();

  orders.forEach(o => {
    const allItems  = o.items || [];
    const filtItems = itemFilter ? allItems.filter(itemFilter) : allItems;

    const processAtom = (item: OrderItem | null) => {
      const rKeys = rowDims.map(d => ITEM_DIMS.has(d) && item ? getItemDimKey(item, d, prodMeta) : getOrderDimKey(o, d));
      const cKeys = colDims.map(d => ITEM_DIMS.has(d) && item ? getItemDimKey(item, d, prodMeta) : getOrderDimKey(o, d));

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

      // Insert into every prefix-combination (grand total, row totals, col totals, cells, …)
      for (let ri = 0; ri <= rKeys.length; ri++) {
        for (let ci = 0; ci <= cKeys.length; ci++) {
          addToCache(rKeys.slice(0, ri), cKeys.slice(0, ci), o._id, o, item);
        }
      }
    };

    if (isItemGroup) {
      const eff = filtItems.length > 0 ? filtItems : allItems;
      eff.forEach(item => processAtom(item));
    } else {
      processAtom(null);
    }
  });

  const getVal = (rowPath: string[], colPath: string[]): number => {
    const k = cacheKey(rowPath, colPath);
    if (numCache.has(k)) return numCache.get(k)!;
    const e = cache.get(k);
    if (!e) { numCache.set(k, 0); return 0; }
    const val = applyMeasure(Array.from(e.ords.values()), e.items, measure, isItemGroup);
    numCache.set(k, val);
    return val;
  };

  const getOrderCount = (rowPath: string[], colPath: string[]): number =>
    cache.get(cacheKey(rowPath, colPath))?.ords.size ?? 0;

  const getOrders = (rowPath: string[], colPath: string[]): PosOrder[] =>
    Array.from(cache.get(cacheKey(rowPath, colPath))?.ords.values() ?? []);

  const isDateDim = (d: GroupByKey) => ['order_day','order_week','order_month','order_quarter','order_year'].includes(d);

  const rowVals0 = Array.from(rValSets[0] ?? []);
  const colVals0 = Array.from(cValSets[0] ?? []);
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  rowVals0.forEach(k => { rowTotals[k] = getVal([k], []); });
  colVals0.forEach(k => { colTotals[k] = getVal([], [k]); });

  if (isDateDim(rowDims[0])) rowVals0.sort((a, b) => a.localeCompare(b));
  else rowVals0.sort((a, b) => rowTotals[b] - rowTotals[a]);
  if (colDims[0]) {
    if (isDateDim(colDims[0])) colVals0.sort((a, b) => a.localeCompare(b));
    else colVals0.sort((a, b) => colTotals[b] - colTotals[a]);
  }

  const subRowValsMap: Record<string, string[]> = {};
  rowVals0.forEach(rk => {
    const vals = Array.from(subRVals.get(rk) ?? []);
    if (rowDims[1] && isDateDim(rowDims[1])) vals.sort((a, b) => a.localeCompare(b));
    else vals.sort((a, b) => getVal([rk, b], []) - getVal([rk, a], []));
    subRowValsMap[rk] = vals;
  });
  const subColValsMap: Record<string, string[]> = {};
  colVals0.forEach(ck => {
    const vals = Array.from(subCVals.get(ck) ?? []);
    if (colDims[1] && isDateDim(colDims[1])) vals.sort((a, b) => a.localeCompare(b));
    else vals.sort((a, b) => getVal([], [ck, b]) - getVal([], [ck, a]));
    subColValsMap[ck] = vals;
  });

  const grandTotal = getVal([], []);
  let maxCellVal = 0;
  rowVals0.forEach(rk => colVals0.forEach(ck => { maxCellVal = Math.max(maxCellVal, getVal([rk], [ck])); }));
  if (colVals0.length === 0) rowVals0.forEach(rk => { maxCellVal = Math.max(maxCellVal, rowTotals[rk]); });

  return { rowVals0, colVals0, subRowValsMap, subColValsMap, getValue: getVal, getOrderCount, getOrders, rowTotals, colTotals, grandTotal, maxCellVal };
}

// ── Order drill-down: helpers ─────────────────────────────────────────────────

function drillFmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function drillFmtTime(d: string) { return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function drillStatusBadge(o: PosOrder) {
  const ref = (o.refunds || []).reduce((s, r) => s + r.totalRefunded, 0);
  const amt = o.total ?? 0;
  if (o.isVoided || o.status === 'voided') return { label: 'Voided',         cls: 'bg-gray-100 text-gray-500' };
  if (ref >= amt && ref > 0)              return { label: 'Refunded',        cls: 'bg-red-50 text-red-600' };
  if (ref > 0)                            return { label: 'Part. Returned',  cls: 'bg-amber-50 text-amber-600' };
  return                                         { label: 'Paid',            cls: 'bg-emerald-50 text-emerald-600' };
}
function drillCustomer(c?: { firstName?: string; lastName?: string; phone?: string } | null) {
  return c?.firstName && c.firstName !== 'Walk-in' ? `${c.firstName} ${c.lastName || ''}`.trim() : null;
}

// ── Single-order detail panel (shown inside the drill drawer) ─────────────────

function DrillOrderDetail({ order, onBack, onClose }: {
  order: PosOrder; onBack: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'invoice' | 'returns'>('details');
  const amount   = order.total ?? 0;
  const refunded = (order.refunds || []).reduce((s, r) => s + r.totalRefunded, 0);
  const subtotal = order.subtotal ?? amount;
  const discount = order.discountTotal ?? 0;
  const splits   = order.paymentDetails?.splitPayments ?? [];
  const change   = order.paymentDetails?.change ?? 0;
  const ng       = (v: number) => `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const { label: stLabel, cls: stCls } = drillStatusBadge(order);
  const payLabel = splits.length > 0
    ? splits.map(s => `${s.method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${ng(s.amount)}`).join(' + ')
    : (order.paymentMethod || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const sessionStr = order.session
    ? (() => {
        const term = (order.session.terminalType || 'retail');
        const label = term.charAt(0).toUpperCase() + term.slice(1);
        const date  = order.session.openedAt ? new Date(order.session.openedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
        return date ? `${label} · ${date}` : label;
      })()
    : '—';

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
            <PiArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{order.receiptNumber || order.orderNumber || '—'}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stCls}`}>{stLabel}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">{drillFmtDate(order.placedAt || order.createdAt)} · {drillFmtTime(order.placedAt || order.createdAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => printInvoices([order], DEFAULT_STORE)} title="Print invoice"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#b20202] transition-colors">
            <PiPrinter className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
            <PiX className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-gray-100 text-xs font-semibold">
        {([
          { id: 'details', label: 'Details',  icon: <PiInfo className="h-3.5 w-3.5" /> },
          { id: 'invoice', label: 'Invoice',  icon: <PiReceipt className="h-3.5 w-3.5" /> },
          { id: 'returns', label: `Returns${(order.refunds?.length ?? 0) > 0 ? ` (${order.refunds!.length})` : ''}`, icon: <PiArrowCounterClockwise className="h-3.5 w-3.5" /> },
        ] as const).map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${tab === t.id ? 'border-b-2 border-[#b20202] text-[#b20202]' : 'border-b-2 border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Details */}
      {tab === 'details' && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50/50">
            {[
              { label: 'Total',    value: formatCurrency(amount),               red: true },
              { label: 'Items',    value: String((order.items || []).length) },
              { label: 'Returned', value: refunded > 0 ? formatCurrency(refunded) : '—', amber: refunded > 0 },
            ].map(({ label, value, red, amber }) => (
              <div key={label} className="px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${red ? 'text-[#b20202]' : amber ? 'text-amber-600' : 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="border-b border-gray-100 px-6 py-4 space-y-2 text-xs">
            {[
              { label: 'Cashier',   value: cashierLabel(order.posStaff) },
              { label: 'Customer',  value: drillCustomer(order.customer) || 'Walk-in Customer' },
              { label: 'Session',   value: sessionStr },
              { label: 'Payment',   value: payLabel },
              ...(change > 0 ? [{ label: 'Change', value: formatCurrency(change) }] : []),
              { label: 'Receipt #', value: order.receiptNumber || '—' },
              { label: 'Order #',   value: order.orderNumber || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="font-semibold text-gray-400">{label}</span>
                <span className="font-medium text-gray-800 text-right">{value}</span>
              </div>
            ))}
          </div>
          {(order.items || []).length > 0 && (
            <div>
              <div className="border-b border-gray-50 bg-gray-50/60 px-6 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Items</p>
              </div>
              <table className="w-full text-xs">
                <thead className="border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-6 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-6 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(order.items || []).map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/40">
                      <td className="px-6 py-2.5 font-medium text-gray-800">
                        {item.name}
                        {item.variant && <span className="font-normal text-gray-400"> · {item.variant}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{item.quantity}</td>
                      <td className="px-6 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(item.itemSubtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-100 px-6 py-3 space-y-1 text-xs">
                {discount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Discount</span>
                    <span className="font-semibold">−{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(amount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice */}
      {tab === 'invoice' && (
        <InvoicePreview
          order={order}
          store={DEFAULT_STORE}
          onPrint={() => printInvoices([order], DEFAULT_STORE)}
          className="flex-1"
        />
      )}

      {/* Returns */}
      {tab === 'returns' && (
        <div className="flex-1 overflow-y-auto">
          {(order.refunds || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <PiArrowCounterClockwise className="h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">No returns for this order</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(order.refunds || []).map((r, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-800">{r.receiptNumber || `Return ${i + 1}`}</span>
                    <span className="text-sm font-bold text-red-600 tabular-nums">−{formatCurrency(r.totalRefunded)}</span>
                  </div>
                  {r.refundedAt && <p className="text-[11px] text-gray-400">{drillFmtDate(r.refundedAt)} · {drillFmtTime(r.refundedAt)}</p>}
                  {r.paymentMethod && <p className="text-[11px] text-gray-400 capitalize mt-0.5">via {r.paymentMethod.replace(/_/g, ' ')}</p>}
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-gray-200 px-6 py-3 text-sm font-bold">
                <span className="text-gray-600">Total Returned</span>
                <span className="text-red-600 tabular-nums">−{formatCurrency(refunded)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Order drill-down drawer (list + detail) ───────────────────────────────────

type DrillSortCol = 'date' | 'receipt' | 'customer' | 'cashier' | 'method' | 'total' | 'status';
type DrillStatusFilter = 'all' | 'paid' | 'refunded' | 'voided';

function DrillSortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: 'asc' | 'desc' }) {
  if (sortCol !== col) return <PiArrowsDownUp className="h-3 w-3 opacity-30" />;
  return sortDir === 'asc'
    ? <PiArrowUp   className="h-3 w-3 text-[#b20202]" />
    : <PiArrowDown className="h-3 w-3 text-[#b20202]" />;
}

const DRILL_HEADERS: { col: DrillSortCol; label: string; right?: boolean }[] = [
  { col: 'date',     label: 'Date' },
  { col: 'receipt',  label: 'Receipt' },
  { col: 'customer', label: 'Customer' },
  { col: 'cashier',  label: 'Cashier' },
  { col: 'method',   label: 'Method' },
  { col: 'total',    label: 'Total', right: true },
  { col: 'status',   label: 'Status' },
];

function OrderDrillDrawer({ orders, title, onClose }: {
  orders: PosOrder[];
  title: string;
  measure: Measure;
  onClose: () => void;
}) {
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [search,        setSearch]        = useState('');
  const [sortCol,       setSortCol]       = useState<DrillSortCol>('date');
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [statusFilter,  setStatusFilter]  = useState<DrillStatusFilter>('all');
  const [checked,       setChecked]       = useState<Set<string>>(new Set());

  // KPIs (exclude voided)
  const active      = orders.filter(o => !o.isVoided && o.status !== 'voided');
  const netRevenue  = active.reduce((s, o) => s + (o.total ?? 0), 0);
  const avgOrder    = active.length > 0 ? netRevenue / active.length : 0;
  const itemQty     = active.reduce((s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0), 0);
  const voidedCount = orders.length - active.length;

  function handleSort(col: DrillSortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  }

  const filtered = useMemo(() => {
    let list = [...orders];

    if (statusFilter === 'paid')     list = list.filter(o => !o.isVoided && (o.refunds || []).reduce((s, r) => s + r.totalRefunded, 0) === 0);
    if (statusFilter === 'refunded') list = list.filter(o => { const r = (o.refunds || []).reduce((s, r) => s + r.totalRefunded, 0); return r > 0; });
    if (statusFilter === 'voided')   list = list.filter(o => o.isVoided || o.status === 'voided');

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        (o.receiptNumber || '').toLowerCase().includes(q) ||
        (o.orderNumber || '').toLowerCase().includes(q) ||
        cashierLabel(o.posStaff).toLowerCase().includes(q) ||
        `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.trim().toLowerCase().includes(q) ||
        (o.customer?.phone ?? '').toLowerCase().includes(q) ||
        (o.paymentMethod || '').toLowerCase().replace(/_/g, ' ').includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'date':     cmp = new Date(a.placedAt || a.createdAt).getTime() - new Date(b.placedAt || b.createdAt).getTime(); break;
        case 'receipt':  cmp = (a.receiptNumber || '').localeCompare(b.receiptNumber || ''); break;
        case 'customer': cmp = (`${a.customer?.firstName ?? ''} ${a.customer?.lastName ?? ''}`.trim() || 'zzz').localeCompare(`${b.customer?.firstName ?? ''} ${b.customer?.lastName ?? ''}`.trim() || 'zzz'); break;
        case 'cashier':  cmp = cashierLabel(a.posStaff).localeCompare(cashierLabel(b.posStaff)); break;
        case 'method':   cmp = (a.paymentMethod || '').localeCompare(b.paymentMethod || ''); break;
        case 'total':    cmp = (a.total ?? 0) - (b.total ?? 0); break;
        case 'status':   cmp = drillStatusBadge(a).label.localeCompare(drillStatusBadge(b).label); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [orders, search, statusFilter, sortCol, sortDir]);

  const allChecked    = filtered.length > 0 && filtered.every(o => checked.has(o._id));
  const someChecked   = checked.size > 0 && !allChecked;
  const checkedOrders = orders.filter(o => checked.has(o._id));
  const checkedTotal  = checkedOrders.reduce((s, o) => s + (o.total ?? 0), 0);

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(filtered.map(o => o._id)));
  }
  function toggleOne(id: string) {
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">

        {selectedOrder ? (
          <DrillOrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onClose={onClose} />
        ) : (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900 leading-tight">{title}</h2>
                <p className="mt-0.5 text-xs text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
              </div>
              <button type="button" onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                <PiX className="h-5 w-5" />
              </button>
            </div>

            {/* KPI cards */}
            <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-gray-100 bg-gray-50/40 px-6 py-4 sm:grid-cols-4">
              {[
                { label: 'Net Revenue', value: formatCurrency(netRevenue),     accent: '#b20202' },
                { label: 'Orders',      value: active.length.toLocaleString(), sub: voidedCount > 0 ? `${voidedCount} voided` : undefined, accent: '#4f46e5' },
                { label: 'Avg Order',   value: formatCurrency(avgOrder),       accent: '#059669' },
                { label: 'Items Sold',  value: itemQty.toLocaleString(),       accent: '#f97316' },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{label}</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">{value}</p>
                  {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
                </div>
              ))}
            </div>

            {/* Search bar */}
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-6 py-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-1.5">
                <PiMagnifyingGlass className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search receipt, cashier, customer…"
                  className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder-gray-400"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                    <PiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{filtered.length} shown</span>
            </div>

            {/* Status tabs */}
            <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-6 py-2.5">
              <div className="flex rounded-xl border border-gray-200 bg-gray-50/70 p-0.5 text-xs font-semibold">
                {(['all', 'paid', 'refunded', 'voided'] as DrillStatusFilter[]).map(f => (
                  <button key={f} type="button"
                    onClick={() => { setStatusFilter(f); setChecked(new Set()); }}
                    className={`rounded-lg px-3 py-1.5 capitalize transition-all ${statusFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders table */}
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="overflow-hidden">

                {/* Bulk action bar */}
                {checked.size > 0 && (
                  <div className="flex items-center gap-3 border-b border-[#b20202]/20 bg-[#fef2f2] px-5 py-2.5">
                    <span className="flex-1 text-xs font-semibold text-gray-700">
                      <span className="font-bold text-[#b20202]">{checked.size}</span> selected ·{' '}
                      <span className="font-bold text-gray-900">{formatCurrency(checkedTotal)}</span>
                    </span>
                    <button type="button" onClick={() => setChecked(new Set())}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
                      Clear
                    </button>
                    <button type="button" onClick={() => printInvoices(checkedOrders, DEFAULT_STORE)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                      <PiPrinter className="h-3.5 w-3.5" />
                      Print {checked.size > 1 ? `${checked.size} Invoices` : 'Invoice'}
                    </button>
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <PiReceipt className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">
                      {search ? `No orders matching "${search}"` : statusFilter !== 'all' ? `No ${statusFilter} orders` : 'No orders'}
                    </p>
                    {(search || statusFilter !== 'all') && (
                      <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); }}
                        className="text-xs font-medium text-[#b20202] hover:underline">
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        <th className="w-8 px-3 py-2.5 text-center">
                          <button type="button" onClick={toggleAll} className="text-gray-300 hover:text-[#b20202] transition-colors">
                            {allChecked
                              ? <PiCheckSquare className="h-4 w-4 text-[#b20202]" />
                              : someChecked
                                ? <PiCheckSquare className="h-4 w-4 text-gray-400" />
                                : <PiSquare className="h-4 w-4" />}
                          </button>
                        </th>
                        {DRILL_HEADERS.map(({ col, label, right }) => (
                          <th key={col} onClick={() => handleSort(col)}
                            className={`cursor-pointer select-none px-3 py-2.5 transition-colors hover:text-gray-600 ${right ? 'text-right' : 'text-left'}`}>
                            <span className="flex items-center gap-1">
                              {label}
                              <DrillSortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                            </span>
                          </th>
                        ))}
                        <th className="w-8 px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(o => {
                        const isChk  = checked.has(o._id);
                        const { label: stLabel, cls: stCls } = drillStatusBadge(o);
                        const custName = drillCustomer(o.customer);
                        const payLabel = o.paymentDetails?.splitPayments?.length
                          ? 'Split'
                          : METHOD_LABEL[o.paymentMethod] || (o.paymentMethod || '—').replace(/_/g, ' ');
                        const dt = new Date(o.placedAt || o.createdAt);
                        return (
                          <tr key={o._id}
                            className={`border-b border-gray-50 transition-colors ${
                              isChk
                                ? 'border-l-2 border-l-violet-400 bg-violet-50/40'
                                : 'border-l-2 border-l-transparent bg-white hover:bg-gray-50/80'
                            }`}>

                            {/* Checkbox */}
                            <td className="w-8 px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              <button type="button" onClick={() => toggleOne(o._id)} className="text-gray-300 hover:text-[#b20202] transition-colors">
                                {isChk ? <PiCheckSquare className="h-4 w-4 text-[#b20202]" /> : <PiSquare className="h-4 w-4" />}
                              </button>
                            </td>

                            {/* Date */}
                            <td className="cursor-pointer px-3 py-2.5 text-gray-500" onClick={() => setSelectedOrder(o)}>
                              <div className="text-[11px]">{dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                              <div className="font-mono text-[10px] text-gray-400">{dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                            </td>

                            {/* Receipt */}
                            <td className="cursor-pointer px-3 py-2.5" onClick={() => setSelectedOrder(o)}>
                              <div className="font-mono text-[11px] font-semibold text-gray-800">
                                {o.receiptNumber || o.orderNumber || o._id.slice(-6).toUpperCase()}
                              </div>
                              {(o.isVoided || o.status === 'voided') && (
                                <span className="rounded bg-red-100 px-1 py-px text-[9px] font-bold uppercase text-red-600">void</span>
                              )}
                            </td>

                            {/* Customer */}
                            <td className="max-w-[80px] cursor-pointer truncate px-3 py-2.5 text-[11px]" onClick={() => setSelectedOrder(o)}>
                              {custName
                                ? <span className="font-medium text-gray-700">{custName}</span>
                                : <span className="text-gray-300">Walk-in</span>}
                            </td>

                            {/* Cashier */}
                            <td className="cursor-pointer px-3 py-2.5 text-[11px] text-gray-600" onClick={() => setSelectedOrder(o)}>
                              {cashierLabel(o.posStaff)}
                            </td>

                            {/* Method */}
                            <td className="cursor-pointer px-3 py-2.5" onClick={() => setSelectedOrder(o)}>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                o.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700' :
                                o.paymentMethod === 'card' ? 'bg-blue-50 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{payLabel}</span>
                            </td>

                            {/* Total */}
                            <td className={`cursor-pointer px-3 py-2.5 text-right font-bold tabular-nums ${o.isVoided ? 'text-gray-300 line-through' : 'text-gray-900'}`}
                              onClick={() => setSelectedOrder(o)}>
                              {formatCurrency(o.total ?? 0)}
                            </td>

                            {/* Status */}
                            <td className="cursor-pointer px-3 py-2.5" onClick={() => setSelectedOrder(o)}>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${stCls}`}>{stLabel}</span>
                            </td>

                            {/* Print */}
                            <td className="w-8 px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              <button type="button" onClick={() => printInvoices([o], DEFAULT_STORE)} title="Print"
                                className="text-gray-200 transition-colors hover:text-[#b20202]">
                                <PiPrinter className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </>
  );
}

// ── Pivot UI helpers (module-level so React never re-mounts them) ─────────────

function PivotDimDropdown({
  open, onToggle, onAdd, existing, otherDims, refEl, title,
}: {
  open: boolean;
  onToggle: () => void;
  onAdd: (k: GroupByKey) => void;
  existing: GroupByKey[];
  otherDims: GroupByKey[];
  refEl: RefObject<HTMLDivElement | null>;
  title: string;
}) {
  return (
    <div ref={refEl} className="relative">
      <button type="button" onClick={onToggle}
        className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
        title={title}>+</button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Group by</p>
          {ALL_GROUP_ITEMS.map(g => {
            const inThis  = existing.includes(g.key);
            const inOther = otherDims.includes(g.key);
            const disabled = inThis || inOther;
            return (
              <button key={g.key} type="button" disabled={disabled}
                onClick={() => { onAdd(g.key); onToggle(); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  disabled ? 'cursor-not-allowed text-gray-300' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {inThis ? (
                  <PiCheck className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                ) : inOther ? (
                  <span className="w-3.5 shrink-0 text-[9px] text-gray-300">↔</span>
                ) : (
                  <span className="w-3.5" />
                )}
                {g.label}
                {inOther && <span className="ml-auto text-[9px] text-gray-300">other axis</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function exportPivotCSV(
  p: HierPivotResult,
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  expandedRows: Set<string>,
  expandedCols: Set<string>,
) {
  const rowHeader = rowDims.map(d => ALL_GROUP_ITEMS.find(g => g.key === d)?.label ?? d).join(' › ');
  const headers: string[] = [rowHeader, 'Total'];

  const visCols: { path: string[]; label: string }[] = [];
  if (colDims.length > 0) {
    p.colVals0.forEach(ck => {
      if (colDims.length >= 2 && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach(sk => {
          visCols.push({ path: [ck, sk], label: `${fmtDimKey(ck, colDims[0])} / ${fmtDimKey(sk, colDims[1])}` });
        });
      } else {
        visCols.push({ path: [ck], label: fmtDimKey(ck, colDims[0]) });
      }
    });
    visCols.forEach(c => headers.push(c.label));
  }

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const numVal = (rowPath: string[], colPath: string[]) => fmtMeasureVal(p.getValue(rowPath, colPath), measure);

  const csvRows: string[][] = [headers];

  // Grand total row
  const gtRow = ['Total', numVal([], [])];
  visCols.forEach(c => gtRow.push(numVal([], c.path)));
  csvRows.push(gtRow);

  // Data rows
  p.rowVals0.forEach(rk => {
    const row = [fmtDimKey(rk, rowDims[0]), numVal([rk], [])];
    visCols.forEach(c => row.push(numVal([rk], c.path)));
    csvRows.push(row);

    if (rowDims.length >= 2 && expandedRows.has(rk)) {
      (p.subRowValsMap[rk] ?? []).forEach(srk => {
        const sub = [`  ${fmtDimKey(rk, rowDims[0])} / ${fmtDimKey(srk, rowDims[1])}`, numVal([rk, srk], [])];
        visCols.forEach(c => sub.push(numVal([rk, srk], c.path)));
        csvRows.push(sub);
      });
    }
  });

  const content = csvRows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `pivot-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportPivotExcel(
  p: HierPivotResult,
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  expandedRows: Set<string>,
  expandedCols: Set<string>,
) {
  const rowHeader = rowDims.map(d => ALL_GROUP_ITEMS.find(g => g.key === d)?.label ?? d).join(' › ');

  const visCols: { path: string[]; label: string }[] = [];
  if (colDims.length > 0) {
    p.colVals0.forEach(ck => {
      if (colDims.length >= 2 && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach(sk => {
          visCols.push({ path: [ck, sk], label: `${fmtDimKey(ck, colDims[0])} / ${fmtDimKey(sk, colDims[1])}` });
        });
      } else {
        visCols.push({ path: [ck], label: fmtDimKey(ck, colDims[0]) });
      }
    });
  }

  const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const numVal = (rp: string[], cp: string[]) => p.getValue(rp, cp);

  const strCell = (v: string, bold = false) =>
    `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="String">${x(v)}</Data></Cell>`;
  const numCell = (v: number, bold = false) =>
    v === 0
      ? `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="String">—</Data></Cell>`
      : `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="Number">${v.toFixed(2)}</Data></Cell>`;

  const rows: string[] = [];

  // Header row
  const hdrCells = [strCell(rowHeader, true), strCell('Total', true), ...visCols.map(c => strCell(c.label, true))].join('');
  rows.push(`<Row>${hdrCells}</Row>`);

  // Grand total row
  const gtCells = [strCell('Total', true), numCell(p.grandTotal, true), ...visCols.map(c => numCell(numVal([], c.path), true))].join('');
  rows.push(`<Row>${gtCells}</Row>`);

  // Data rows
  p.rowVals0.forEach(rk => {
    const rowCells = [strCell(fmtDimKey(rk, rowDims[0])), numCell(p.rowTotals[rk]), ...visCols.map(c => numCell(numVal([rk], c.path)))].join('');
    rows.push(`<Row>${rowCells}</Row>`);
    if (rowDims.length >= 2 && expandedRows.has(rk)) {
      (p.subRowValsMap[rk] ?? []).forEach(srk => {
        const subCells = [strCell(`  ${fmtDimKey(rk, rowDims[0])} / ${fmtDimKey(srk, rowDims[1])}`), numCell(numVal([rk, srk], [])), ...visCols.map(c => numCell(numVal([rk, srk], c.path)))].join('');
        rows.push(`<Row>${subCells}</Row>`);
      });
    }
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="bold"><Font ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="Pivot">
    <Table>${rows.join('')}</Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `pivot-${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Filter tag labels ──────────────────────────────────────────────────────────

function getFilterLabel(key: string, cats: CatItem[], brands: BrandItem[]): string {
  for (const { prefix, label } of SEARCH_DEFS) {
    if (key.startsWith(prefix)) return `${label}: ${key.slice(prefix.length)}`;
  }
  if (key === 'invoiced')      return 'Invoiced';
  if (key === 'not_invoiced')  return 'Not Invoiced';
  if (key === 'not_cancelled') return 'Not Cancelled';
  if (key === 'date_today')    return 'Today';
  if (key === 'date_yesterday')return 'Yesterday';
  if (key === 'date_week')     return 'This Week';
  if (key === 'date_custom')   return 'Custom Range';
  if (key.startsWith('date_m_')) {
    const [, , yr, mo] = key.split('_');
    return new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (key.startsWith('date_q_')) {
    const [, , yr, q] = key.split('_');
    return `Q${q} ${yr}`;
  }
  if (key.startsWith('date_y_')) return key.replace('date_y_', '');
  if (key.startsWith('category_')) {
    const id = key.replace('category_', '');
    return cats.find(c => c._id === id)?.name || 'Category';
  }
  if (key.startsWith('brand_')) {
    const id = key.replace('brand_', '');
    return brands.find(b => b._id === id)?.name || 'Brand';
  }
  return key;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, badge, accentColor = '#b20202' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  badge?: string; accentColor?: string;
}) {
  return (
    <div className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
          {icon}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: `${accentColor}12`, color: accentColor }}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums leading-tight text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-gray-500">{sub}</p>}
      <div className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-2xl"
        style={{ background: `linear-gradient(to right, ${accentColor}80, ${accentColor}10)` }} />
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
  );
}

// ── Shared pie / donut panel ───────────────────────────────────────────────────

type PieRow = { label: string; value: number; orders: number; isoKey: string; orderList: PosOrder[] };

function PiePanelView({ allRows, measure, h, onDrill }: {
  allRows: PieRow[]; measure: Measure; h: string;
  onDrill?: (label: string, orders: PosOrder[]) => void;
}) {
  const [activeIdx, setActiveIdx] = useState<number | undefined>(undefined);
  const MAX_PIE    = 12;
  const pieData    = allRows.slice(0, MAX_PIE);
  const othersRaw  = allRows.slice(MAX_PIE);
  const othersVal  = othersRaw.reduce((s, r) => s + r.value, 0);
  const othersOrd  = othersRaw.reduce((s, r) => s + r.orders, 0);
  const othersOrds = othersRaw.flatMap(r => r.orderList);
  const chartData  = othersVal > 0
    ? [...pieData, { label: `${othersRaw.length} others`, value: othersVal, orders: othersOrd, isoKey: '_others', orderList: othersOrds }]
    : pieData;
  const pieTotal   = chartData.reduce((s, r) => s + r.value, 0);
  const pieAvg     = pieData.length > 0 ? pieData.reduce((s, r) => s + r.value, 0) / pieData.length : 0;
  const pieMax     = pieData.length > 0 ? pieData[0].value : 1;
  const getColor   = (i: number) => i >= pieData.length ? '#94a3b8' : PALETTE[i % PALETTE.length];
  const canDrill   = !!onDrill;

  const renderActiveShape = (props: Record<string, number & string>) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius - 6} outerRadius={outerRadius + 20}
          startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.13} />
        <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 10}
          startAngle={startAngle} endAngle={endAngle} fill={fill} />
        <Sector cx={cx} cy={cy} innerRadius={outerRadius + 14} outerRadius={outerRadius + 19}
          startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.5} />
      </g>
    );
  };

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: PieRow; fill: string }[] }) => {
    if (!active || !payload?.length) return null;
    const d   = payload[0].payload;
    const pct = pieTotal > 0 ? (d.value / pieTotal) * 100 : 0;
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs shadow-lg"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,.10)' }}>
        <p className="font-semibold text-gray-900">{d.label}</p>
        <p className="tabular-nums text-gray-600">{fmtMeasureVal(d.value, measure)} · {pct.toFixed(1)}%</p>
        <p className="text-gray-400">{d.orders.toLocaleString()} orders</p>
        {canDrill && d.orderList?.length > 0 && (
          <p className="mt-1 text-[10px] font-medium text-[#b20202]">Click to drill through</p>
        )}
      </div>
    );
  };

  const activeSlice    = activeIdx !== undefined ? chartData[activeIdx] : null;
  const activeIsOthers = activeIdx !== undefined && activeIdx >= pieData.length;
  const activePct      = activeSlice && pieTotal > 0 ? (activeSlice.value / pieTotal) * 100 : 0;
  const activeDiff     = activeSlice && !activeIsOthers ? activeSlice.value - pieAvg : 0;

  return (
    <div className={`flex w-full flex-col gap-0 sm:flex-row ${h}`}>
      {/* ── Donut ─────────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData} dataKey="value" nameKey="label"
              cx="50%" cy="50%"
              outerRadius="72%" innerRadius="46%"
              activeIndex={activeIdx}
              activeShape={renderActiveShape as never}
              onMouseEnter={(_, i) => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(undefined)}
              onClick={(d: PieRow) => { if (onDrill && d.orderList?.length > 0) onDrill(d.label, d.orderList); }}
              paddingAngle={2}
              style={{ cursor: canDrill ? 'pointer' : undefined }}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={getColor(i)}
                  opacity={activeIdx === undefined || activeIdx === i ? 1 : 0.38} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          {activeSlice ? (
            <>
              <p className="w-full truncate text-[11px] font-semibold leading-tight text-gray-500">
                {activeSlice.label}
              </p>
              <p className="mt-0.5 text-[1.3rem] font-bold tabular-nums leading-tight text-gray-900">
                {fmtMeasureVal(activeSlice.value, measure)}
              </p>
              <p className="text-[12px] font-bold tabular-nums" style={{ color: getColor(activeIdx!) }}>
                {activePct.toFixed(1)}%
              </p>
              {!activeIsOthers && (
                <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  activeDiff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {activeDiff >= 0 ? '▲' : '▼'} {fmtCompact(Math.abs(activeDiff))} vs avg
                </span>
              )}
              <p className="mt-1 text-[10px] text-gray-400">{activeSlice.orders.toLocaleString()} orders</p>
              {canDrill && activeSlice.orderList?.length > 0 && (
                <p className="mt-0.5 text-[10px] font-semibold text-[#b20202] opacity-70">↗ click to drill</p>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Total</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900">{fmtMeasureVal(pieTotal, measure)}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">{allRows.length} group{allRows.length !== 1 ? 's' : ''}</p>
              <p className="text-[10px] text-gray-400">avg {fmtCompact(pieAvg)}</p>
            </>
          )}
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col justify-center overflow-y-auto border-t border-gray-100 px-4 py-3 sm:w-72 sm:border-l sm:border-t-0 sm:py-4">
        {pieData.map((d, i) => {
          const pct   = pieTotal > 0 ? (d.value / pieTotal) * 100 : 0;
          const barW  = pieMax > 0 ? (d.value / pieMax) * 100 : 0;
          const isAct = activeIdx === i;
          const avgPO = d.orders > 0 ? d.value / d.orders : 0;
          const diff  = d.value - pieAvg;
          const color = getColor(i);
          return (
            <div key={d.isoKey}
              className={`rounded-xl py-2 pl-3 pr-3 transition-all duration-150 ${canDrill ? 'cursor-pointer' : ''} ${
                isAct ? 'bg-gray-50' : 'hover:bg-gray-50/70'
              }`}
              style={{ borderLeft: `3px solid ${isAct ? color : 'transparent'}` }}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(undefined)}
              onClick={() => { if (onDrill && d.orderList?.length > 0) onDrill(d.label, d.orderList); }}>

              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold leading-none text-white"
                    style={{ background: color }}>
                    {i + 1}
                  </span>
                  <span className={`truncate text-xs font-medium transition-colors ${isAct ? 'text-gray-900' : 'text-gray-600'}`}>
                    {d.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11px] tabular-nums text-gray-400">{pct.toFixed(1)}%</span>
                  <span className="text-xs font-semibold tabular-nums text-gray-800">{fmtMeasureVal(d.value, measure)}</span>
                </div>
              </div>

              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${barW}%`, background: color, opacity: isAct ? 1 : 0.6 }} />
              </div>

              <div style={{ maxHeight: isAct ? '80px' : '0px', overflow: 'hidden', transition: 'max-height 0.2s ease' }}>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2">
                  <div>
                    <p className="text-[10px] text-gray-400">Orders</p>
                    <p className="text-[11px] font-semibold text-gray-800">{d.orders.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400">Avg/order</p>
                    <p className="text-[11px] font-semibold text-gray-800">{d.orders > 0 ? fmtCompact(avgPO) : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">vs avg</p>
                    <p className={`text-[11px] font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {diff >= 0 ? '+' : ''}{fmtCompact(diff)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {othersVal > 0 && (
          <div
            className={`rounded-xl py-2 pl-3 pr-3 transition-all duration-150 ${canDrill ? 'cursor-pointer' : ''} ${
              activeIdx === pieData.length ? 'bg-gray-50' : 'hover:bg-gray-50/70'
            }`}
            style={{ borderLeft: `3px solid ${activeIdx === pieData.length ? '#94a3b8' : 'transparent'}` }}
            onMouseEnter={() => setActiveIdx(pieData.length)}
            onMouseLeave={() => setActiveIdx(undefined)}
            onClick={() => { if (onDrill && othersOrds.length > 0) onDrill(`${othersRaw.length} others`, othersOrds); }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                <span className="truncate text-xs text-gray-400">{othersRaw.length} others</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] tabular-nums text-gray-400">
                  {pieTotal > 0 ? ((othersVal / pieTotal) * 100).toFixed(1) : 0}%
                </span>
                <span className="text-xs font-semibold tabular-nums text-gray-400">{fmtMeasureVal(othersVal, measure)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main chart component ────────────────────────────────────────────────────────

function MainChart({ data, measure, chartType, effectiveGroupBy, className, onBarClick }: {
  data: GroupRow[]; measure: Measure; chartType: ChartType; effectiveGroupBy: GroupByKey; className?: string;
  onBarClick?: (label: string, orders: PosOrder[]) => void;
}) {
  // All hooks must be at the top — before any conditional returns
  const [sortCol, setSortCol] = useState<'value' | 'orders' | 'label'>('value');
  const [sortAsc, setSortAsc]  = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const measureLabel = MEASURES.find(m => m.key === measure)?.label ?? 'Value';
  const isCurrency   = IS_CURRENCY[measure];
  const isTimeSeries = ['order_day','order_week','order_month','order_quarter','order_year'].includes(effectiveGroupBy);

  const h = className ?? 'h-64';

  if (data.length === 0) {
    return <div className={`flex items-center justify-center text-sm text-gray-400 ${h}`}>No data for the selected filters</div>;
  }

  if (chartType === 'table') {
    const search = tableSearch;
    const setSearch = setTableSearch;

    const grandTotal = data.reduce((s, r) => s + r.value, 0);
    const grandOrds  = data.reduce((s, r) => s + r.orders, 0);
    const maxVal     = data.reduce((m, r) => Math.max(m, r.value), 0);
    const showAvgCol = IS_CURRENCY[measure];
    const MEDALS     = ['🥇', '🥈', '🥉'];

    const toggleSort = (col: 'value' | 'orders' | 'label') => {
      if (sortCol === col) setSortAsc(a => !a);
      else { setSortCol(col); setSortAsc(false); }
    };

    const displayed = data
      .filter(r => !search || r.label.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const m = sortAsc ? 1 : -1;
        if (sortCol === 'label')  return m * a.label.localeCompare(b.label);
        if (sortCol === 'orders') return m * (a.orders - b.orders);
        return m * (a.value - b.value);
      });

    let runningVal = 0;
    const rows = displayed.map(r => {
      runningVal += r.value;
      return { ...r, pct: grandTotal > 0 ? (r.value / grandTotal) * 100 : 0, cumPct: grandTotal > 0 ? (runningVal / grandTotal) * 100 : 0 };
    });

    const SortBtn = ({ col, children }: { col: 'value' | 'orders' | 'label'; children: React.ReactNode }) => (
      <button type="button" onClick={() => toggleSort(col)}
        className="flex items-center gap-1 hover:text-gray-900 transition-colors">
        {children}
        <span className={`text-[10px] ${sortCol === col ? 'text-[#b20202]' : 'text-gray-300'}`}>
          {sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}
        </span>
      </button>
    );

    return (
      <div className={`flex flex-col ${h}`}>

        {/* Search + summary strip */}
        <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-gray-100 px-5 py-3">
          <div className="relative min-w-[200px] flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter groups…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[#b20202] focus:bg-white" />
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span><span className="font-semibold text-gray-800">{rows.length}</span>{search ? ` of ${data.length}` : ''} groups</span>
            <span>Total: <span className="font-semibold text-gray-800">{fmtMeasureVal(grandTotal, measure)}</span></span>
            <span>Orders: <span className="font-semibold text-gray-800">{grandOrds.toLocaleString()}</span></span>
            {showAvgCol && grandOrds > 0 && (
              <span>Avg/order: <span className="font-semibold text-gray-800">{fmtMeasureVal(grandTotal / grandOrds, measure)}</span></span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white" style={{ boxShadow: '0 1px 0 #e2e8f0' }}>
              <tr>
                <th className="w-10 py-3 pl-5 text-left text-xs font-semibold text-gray-400">#</th>
                <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <SortBtn col="label">Group</SortBtn>
                </th>
                <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <div className="flex justify-end"><SortBtn col="value">{measureLabel}</SortBtn></div>
                </th>
                <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Share</th>
                <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <div className="flex justify-end"><SortBtn col="orders">Orders</SortBtn></div>
                </th>
                {showAvgCol && (
                  <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Avg / Order</th>
                )}
                <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Cumulative</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={showAvgCol ? 7 : 6} className="py-12 text-center text-sm text-gray-400">
                    No groups match &ldquo;{search}&rdquo;
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const barW   = maxVal > 0 ? (row.value / maxVal) * 100 : 0;
                const isTop3 = i < 3 && !search;
                return (
                  <tr key={row.label} className="group border-b border-gray-50 transition-colors hover:bg-blue-50/30">
                    {/* Rank */}
                    <td className="py-3.5 pl-5 text-xs text-gray-400">
                      {isTop3
                        ? <span className="text-base leading-none">{MEDALS[i]}</span>
                        : <span className="tabular-nums">{i + 1}</span>
                      }
                    </td>

                    {/* Group label */}
                    <td className="max-w-[220px] py-3.5 pr-4">
                      <span className="truncate font-medium text-gray-800">{row.label}</span>
                    </td>

                    {/* Measure value with data-bar background */}
                    <td className="relative py-3.5 pr-5 text-right">
                      <div className="absolute inset-y-2 left-0 rounded-r"
                        style={{ width: `${barW}%`, background: '#b2020210' }} />
                      <span className="relative tabular-nums font-semibold text-gray-900">
                        {fmtMeasureVal(row.value, measure)}
                      </span>
                    </td>

                    {/* Share % with mini bar */}
                    <td className="py-3.5 pr-5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#b20202] transition-all"
                            style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className="w-10 text-right tabular-nums text-xs font-medium text-gray-600">
                          {row.pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Orders */}
                    <td className="py-3.5 pr-5 text-right tabular-nums text-gray-600">
                      {row.orders.toLocaleString()}
                    </td>

                    {/* Avg per order */}
                    {showAvgCol && (
                      <td className="py-3.5 pr-5 text-right tabular-nums text-xs text-gray-500">
                        {row.orders > 0 ? fmtMeasureVal(row.value / row.orders, measure) : '—'}
                      </td>
                    )}

                    {/* Cumulative % */}
                    <td className="py-3.5 pr-5 text-right tabular-nums text-xs text-gray-400">
                      {row.cumPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals footer */}
            <tfoot className="sticky bottom-0 bg-white" style={{ boxShadow: '0 -1px 0 #e2e8f0' }}>
              <tr>
                <td className="py-3.5 pl-5" />
                <td className="py-3.5 pr-4 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {search ? `${rows.length} shown` : 'Total'}
                </td>
                <td className="py-3.5 pr-5 text-right text-sm font-bold tabular-nums text-gray-900">
                  {fmtMeasureVal(search ? rows.reduce((s, r) => s + r.value, 0) : grandTotal, measure)}
                </td>
                <td className="py-3.5 pr-5 text-right text-xs font-semibold text-gray-500">
                  {search ? `${rows.reduce((s, r) => s + r.pct, 0).toFixed(1)}%` : '100%'}
                </td>
                <td className="py-3.5 pr-5 text-right text-sm font-bold tabular-nums text-gray-900">
                  {(search ? rows.reduce((s, r) => s + r.orders, 0) : grandOrds).toLocaleString()}
                </td>
                {showAvgCol && (
                  <td className="py-3.5 pr-5 text-right tabular-nums text-xs text-gray-600">
                    {grandOrds > 0 ? fmtMeasureVal(grandTotal / grandOrds, measure) : '—'}
                  </td>
                )}
                <td className="py-3.5 pr-5" />
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    );
  }

  if (chartType === 'pie') {
    return <PiePanelView allRows={data} measure={measure} h={h} onDrill={onBarClick} />;
  }

  // ── shared tooltip ──────────────────────────────────────────────────────────
  const total = data.reduce((s, r) => s + r.value, 0);
  const avg   = data.length > 0 ? total / data.length : 0;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; payload: GroupRow }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const val      = payload[0].value;
    const row      = payload[0].payload;
    const pct      = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
    const diff     = val - avg;
    const aboveAvg = diff >= 0;
    return (
      <div className="min-w-[170px] rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xl">
        <p className="mb-2 truncate text-xs font-semibold text-gray-500">{label}</p>
        <p className="text-base font-bold tabular-nums text-gray-900">{fmtMeasureVal(val, measure)}</p>
        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
          <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
            <span>Share</span>
            <span className="font-medium text-gray-700">{pct}%</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
            <span>vs avg</span>
            <span className={`font-semibold ${aboveAvg ? 'text-emerald-600' : 'text-red-500'}`}>
              {aboveAvg ? '+' : ''}{fmtMeasureVal(diff, measure)}
            </span>
          </div>
          {row?.orders > 0 && (
            <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
              <span>Orders</span>
              <span className="font-medium text-gray-700">{row.orders.toLocaleString()}</span>
            </div>
          )}
        </div>
        {onBarClick && <p className="mt-2 text-[10px] font-medium text-[#b20202]">Click to drill through</p>}
      </div>
    );
  };

  // ── dedicated line / area chart ─────────────────────────────────────────────
  if (chartType === 'line') {
    const maxRow   = data.reduce((b, r) => r.value > b.value ? r : b, data[0]);
    const minRow   = data.reduce((b, r) => r.value < b.value ? r : b, data[0]);
    const first    = data[0]?.value ?? 0;
    const last     = data[data.length - 1]?.value ?? 0;
    const trend    = last - first;
    const showDots = data.length <= 30;

    const LineTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
      if (!active || !payload?.length) return null;
      const val  = payload[0].value;
      const idx  = data.findIndex(r => r.label === label);
      const prev = idx > 0 ? data[idx - 1].value : null;
      const delta = prev !== null ? val - prev : null;
      const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
      return (
        <div className="min-w-[170px] rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xl">
          <p className="mb-2 truncate text-xs font-semibold text-gray-500">{label}</p>
          <p className="text-base font-bold tabular-nums text-gray-900">{fmtMeasureVal(val, measure)}</p>
          <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
            <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
              <span>Share of total</span>
              <span className="font-medium text-gray-700">{pct}%</span>
            </div>
            {delta !== null && (
              <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
                <span>vs prev period</span>
                <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {delta >= 0 ? '▲' : '▼'} {fmtMeasureVal(Math.abs(delta), measure)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
              <span>vs avg</span>
              <span className={`font-medium ${val >= avg ? 'text-emerald-600' : 'text-red-500'}`}>
                {val >= avg ? '+' : ''}{fmtMeasureVal(val - avg, measure)}
              </span>
            </div>
          </div>
        </div>
      );
    };

    const CustomDot = (props: { cx?: number; cy?: number; value?: number }) => {
      const { cx = 0, cy = 0, value = 0 } = props;
      const isMax = value === maxRow?.value;
      const isMin = value === minRow?.value;
      if (isMax) return <circle cx={cx} cy={cy} r={6} fill="#b20202" stroke="#fff" strokeWidth={2} />;
      if (isMin) return <circle cx={cx} cy={cy} r={5} fill="#f97316" stroke="#fff" strokeWidth={2} />;
      if (!showDots) return <g />;
      return <circle cx={cx} cy={cy} r={2.5} fill="#fff" stroke="#b20202" strokeWidth={1.5} />;
    };

    const statCls = 'flex flex-col items-center gap-0.5';
    const statLabel = 'text-[10px] font-semibold uppercase tracking-wider text-gray-400';
    const statVal   = 'text-sm font-bold tabular-nums text-gray-900';

    return (
      <div className={`flex w-full flex-col ${h}`}>
        {/* Stats strip */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-1 border-b border-gray-100 px-4 pb-3 pt-1">
          <div className={statCls}>
            <span className={statLabel}>Total</span>
            <span className={statVal}>{fmtMeasureVal(total, measure)}</span>
          </div>
          <div className={statCls}>
            <span className={statLabel}>{isTimeSeries ? 'Avg / period' : 'Avg / group'}</span>
            <span className={statVal}>{fmtMeasureVal(avg, measure)}</span>
          </div>
          <div className={statCls}>
            <span className={statLabel}>Peak</span>
            <span className="text-sm font-bold tabular-nums text-[#b20202]">
              {fmtMeasureVal(maxRow?.value ?? 0, measure)}
              <span className="ml-1 text-[10px] font-normal text-gray-400">{maxRow?.label}</span>
            </span>
          </div>
          <div className={statCls}>
            <span className={statLabel}>Trough</span>
            <span className="text-sm font-bold tabular-nums text-orange-500">
              {fmtMeasureVal(minRow?.value ?? 0, measure)}
              <span className="ml-1 text-[10px] font-normal text-gray-400">{minRow?.label}</span>
            </span>
          </div>
          <div className={`${statCls} ml-auto`}>
            <span className={statLabel}>Trend</span>
            <span className={`text-sm font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '▲' : '▼'} {fmtMeasureVal(Math.abs(trend), measure)}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}
              margin={{ top: 16, right: 32, left: -4, bottom: 0 }}
              className="[&_.recharts-cartesian-grid-vertical]:opacity-0"
              style={{ cursor: onBarClick ? 'pointer' : undefined }}
              onClick={(d) => {
                if (!onBarClick || !d?.activePayload?.length) return;
                const row = d.activePayload[0].payload as GroupRow;
                if (row?.orderList) onBarClick(row.label, row.orderList);
              }}>
              <defs>
                <linearGradient id="oaAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#b20202" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#b20202" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval={data.length > 14 ? Math.floor(data.length / 8) : 0}
                dy={6} />
              <YAxis axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtAxisVal(v, measure)}
                tick={{ fontSize: 11, fill: '#94a3b8' }} width={58} />
              <Tooltip content={<LineTooltip />}
                cursor={{ stroke: '#b20202', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <ReferenceLine y={avg} stroke="#cbd5e1" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: `Avg ${fmtAxisVal(avg, measure)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8', dy: -8 }} />
              <Area dataKey="value" type="monotone"
                fill="url(#oaAreaFill)" stroke="none" />
              <Line dataKey="value" name={measureLabel} type="monotone"
                stroke="#b20202" strokeWidth={2.5}
                dot={<CustomDot />}
                activeDot={{ r: 7, fill: '#b20202', stroke: '#fff', strokeWidth: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ── time-series bar ───────────────────────────────────────────────────────────
  if (isTimeSeries) {
    const barSz         = data.length > 30 ? 6 : data.length > 15 ? 12 : 20;
    const showTopLabels = data.length <= 12;
    const maxRow        = data.reduce((b, r) => r.value > b.value ? r : b, data[0]);
    const minRow        = data.reduce((b, r) => r.value < b.value ? r : b, data[0]);
    const trend         = (data[data.length - 1]?.value ?? 0) - (data[0]?.value ?? 0);
    const sc = 'flex flex-col items-center gap-0.5';
    const sl = 'text-[10px] font-semibold uppercase tracking-wider text-gray-400';
    const sv = 'text-sm font-bold tabular-nums text-gray-900';
    return (
      <div className={`flex w-full flex-col ${h}`}>
        <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-1 border-b border-gray-100 px-4 pb-3 pt-1">
          <div className={sc}><span className={sl}>Total</span><span className={sv}>{fmtMeasureVal(total, measure)}</span></div>
          <div className={sc}><span className={sl}>Avg / period</span><span className={sv}>{fmtMeasureVal(avg, measure)}</span></div>
          <div className={sc}>
            <span className={sl}>Peak</span>
            <span className="text-sm font-bold tabular-nums text-[#b20202]">
              {fmtMeasureVal(maxRow?.value ?? 0, measure)}
              <span className="ml-1 text-[10px] font-normal text-gray-400">{maxRow?.label}</span>
            </span>
          </div>
          <div className={sc}>
            <span className={sl}>Trough</span>
            <span className="text-sm font-bold tabular-nums text-orange-500">
              {fmtMeasureVal(minRow?.value ?? 0, measure)}
              <span className="ml-1 text-[10px] font-normal text-gray-400">{minRow?.label}</span>
            </span>
          </div>
          <div className={`${sc} ml-auto`}>
            <span className={sl}>Trend</span>
            <span className={`text-sm font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '▲' : '▼'} {fmtMeasureVal(Math.abs(trend), measure)}
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} barSize={barSz}
              margin={{ top: showTopLabels ? 24 : 8, right: 24, left: -4, bottom: 0 }}
              className="[&_.recharts-cartesian-grid-vertical]:opacity-0">
              <defs>
                <linearGradient id="oaMainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#b20202" stopOpacity={1} />
                  <stop offset="100%" stopColor="#b20202" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval={data.length > 14 ? Math.floor(data.length / 8) : 0}
                dy={6} />
              <YAxis axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtAxisVal(v, measure)}
                tick={{ fontSize: 11, fill: '#94a3b8' }} width={58} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
              <ReferenceLine y={avg} stroke="#cbd5e1" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: `Avg ${fmtAxisVal(avg, measure)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8', dy: -8 }} />
              <Bar dataKey="value" name={measureLabel} fill="url(#oaMainGrad)" radius={[5, 5, 0, 0]}
                style={{ cursor: onBarClick ? 'pointer' : undefined }}>
                {data.map((row, i) => (
                  <Cell key={i} onClick={() => onBarClick?.(row.label, row.orderList)} />
                ))}
                {showTopLabels && (
                  <LabelList dataKey="value" position="top" fontSize={10} fill="#64748b"
                    formatter={(v: number) => fmtAxisVal(v, measure)} />
                )}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ── horizontal bar (≤ 20 items) ─────────────────────────────────────────────
  if (data.length <= 20) {
    const maxVal  = data[0]?.value ?? 1;
    const barSz   = Math.max(14, Math.min(28, Math.floor(400 / data.length)));
    const yWidth  = Math.min(200, Math.max(120, data.reduce((m, r) => Math.max(m, r.label.length * 6.5), 0)));
    return (
      <div className={`w-full ${h}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barSize={barSz}
            margin={{ top: 4, right: 80, left: 0, bottom: 4 }}>
            <defs>
              {data.map((_, i) => (
                <linearGradient key={i} id={`hbar${i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={true} horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false}
              tickFormatter={(v) => fmtAxisVal(v, measure)}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              domain={[0, maxVal * 1.25]} />
            <YAxis type="category" dataKey="label" axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: '#475569' }} width={yWidth} />
            <ReferenceLine x={avg} stroke="#cbd5e1" strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: `Avg ${fmtAxisVal(avg, measure)}`, position: 'top', fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="value" name={measureLabel} radius={[0, 6, 6, 0]}
              style={{ cursor: onBarClick ? 'pointer' : undefined }}>
              {data.map((row, i) => (
                <Cell key={i} fill={`url(#hbar${i})`}
                  onClick={() => onBarClick?.(row.label, row.orderList)} />
              ))}
              <LabelList dataKey="value" position="right" fontSize={11} fill="#475569"
                formatter={(v: number) => fmtMeasureVal(v, measure)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── vertical bar (many items) ────────────────────────────────────────────────
  const display   = data.slice(0, 50);
  const overflow  = data.length - display.length;
  const barSzMany = display.length > 35 ? 7 : display.length > 20 ? 11 : 15;
  const topColor  = PALETTE[0];

  return (
    <div className={`flex w-full flex-col ${h}`}>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={display} barSize={barSzMany}
            margin={{ top: 20, right: 12, left: -4, bottom: display.length > 20 ? 56 : 32 }}>
            <defs>
              <linearGradient id="oaVBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={topColor} stopOpacity={1} />
                <stop offset="100%" stopColor={topColor} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false}
              tick={{ fontSize: display.length > 30 ? 8 : 10, fill: '#94a3b8' }}
              angle={display.length > 15 ? -40 : 0}
              textAnchor={display.length > 15 ? 'end' : 'middle'}
              interval={0} dy={display.length > 15 ? 4 : 6} />
            <YAxis axisLine={false} tickLine={false}
              tickFormatter={(v) => fmtAxisVal(v, measure)}
              tick={{ fontSize: 11, fill: '#94a3b8' }} width={58} />
            <ReferenceLine y={avg} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: `Avg ${fmtAxisVal(avg, measure)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8', dy: -6 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
            <Bar dataKey="value" name={measureLabel} radius={[4, 4, 0, 0]}
              style={{ cursor: onBarClick ? 'pointer' : undefined }}>
              {display.map((row, i) => (
                <Cell key={i}
                  fill={i === 0 ? topColor : `${topColor}${Math.round((1 - i * 0.015) * 255).toString(16).padStart(2, '0')}`}
                  onClick={() => onBarClick?.(row.label, row.orderList)} />
              ))}
              {display.length <= 20 && (
                <LabelList dataKey="value" position="top" fontSize={10} fill="#64748b"
                  formatter={(v: number) => fmtAxisVal(v, measure)} />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {overflow > 0 && (
        <p className="shrink-0 pb-1 text-center text-[11px] text-gray-400">
          Showing top {display.length} of {data.length} groups
        </p>
      )}
    </div>
  );
}

// ── Collapsible filter list ────────────────────────────────────────────────────

function FilterListSection({
  label, items, activeFilters, prefix, onToggle, maxVisible = 6, filter = '',
}: {
  label: string;
  items: { _id: string; name: string }[];
  activeFilters: string[];
  prefix: string;
  onToggle: (key: string) => void;
  maxVisible?: number;
  filter?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const lc = filter.toLowerCase();
  const matched  = filter ? items.filter(i => i.name.toLowerCase().includes(lc)) : items;
  const visible  = showAll ? matched : matched.slice(0, maxVisible);
  const activeCount = items.filter(i => activeFilters.includes(`${prefix}${i._id}`)).length;

  // Auto-open when search is filtering
  const isOpen = filter ? matched.length > 0 : open;

  if (filter && matched.length === 0) return null;

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
        <span className="flex items-center gap-2">
          {label}
          {activeCount > 0 && (
            <span className="rounded-full bg-[#b20202] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
              {activeCount}
            </span>
          )}
        </span>
        {!filter && <PiCaretDown className={`h-3 w-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {isOpen && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
          {visible.map(item => {
            const key = `${prefix}${item._id}`;
            const active = activeFilters.includes(key);
            return (
              <button key={item._id} type="button" onClick={() => onToggle(key)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs text-left transition-colors ${
                  active ? 'bg-[#fef2f2] font-medium text-[#b20202]' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                  active ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'
                }`}>
                  {active && <PiCheck className="h-2.5 w-2.5 text-white" />}
                </span>
                {item.name}
              </button>
            );
          })}
          {matched.length > maxVisible && !filter && (
            <button type="button" onClick={() => setShowAll(s => !s)}
              className="px-2 py-0.5 text-xs text-[#b20202] hover:underline">
              {showAll ? 'Show less' : `+ ${matched.length - maxVisible} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stacked bar chart (two Group Bys) ─────────────────────────────────────────

function StackedChart({ rows, series, measure, chartType, className, onBarClick, orderMap, groupBy }: {
  rows: GroupRow2[]; series: string[]; measure: Measure; chartType: ChartType; className?: string;
  onBarClick?: (rowLabel: string, seriesKey: string, orders: PosOrder[]) => void;
  orderMap?: Record<string, Record<string, PosOrder[]>>;
  groupBy?: GroupByKey | null;
}) {
  const measureLabel = MEASURES.find(m => m.key === measure)?.label ?? 'Value';
  const h = className ?? 'h-72';

  if (rows.length === 0) {
    return <div className={`flex items-center justify-center text-sm text-gray-400 ${h}`}>No data for the selected filters</div>;
  }

  if (chartType === 'table') {
    const grandTotal = rows.reduce((s, r) => s + r.__total__, 0);
    return (
      <div className={`overflow-x-auto overflow-y-auto ${h}`}>
        <table className="w-full min-w-[400px] text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-200">
              <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Group</th>
              {series.map(s => (
                <th key={s} className="py-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">{s}</th>
              ))}
              <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.isoKey} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/40' : ''}`}>
                <td className="py-2 pr-4 text-gray-700">{row.label}</td>
                {series.map(s => {
                  const cellOrds = orderMap?.[row.isoKey]?.[s] ?? [];
                  return (
                    <td key={s}
                      className={`py-2 pr-3 text-right tabular-nums text-gray-700 ${cellOrds.length > 0 && onBarClick ? 'cursor-pointer hover:bg-gray-100 rounded' : ''}`}
                      onClick={() => { if (cellOrds.length > 0) onBarClick?.(row.label, s, cellOrds); }}>
                      {fmtMeasureVal((row[s] as number) || 0, measure)}
                    </td>
                  );
                })}
                <td className={`py-2 text-right tabular-nums font-semibold text-gray-900 ${onBarClick ? 'cursor-pointer hover:bg-gray-100 rounded' : ''}`}
                  onClick={() => {
                    const allOrds = Object.values(orderMap?.[row.isoKey] ?? {}).flat();
                    if (allOrds.length > 0) onBarClick?.(row.label, '', allOrds);
                  }}>
                  {fmtMeasureVal(row.__total__, measure)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-white">
              <td className="py-2 pr-4 text-xs font-bold uppercase text-gray-700">Total</td>
              {series.map(s => {
                const colTotal = rows.reduce((acc, r) => acc + ((r[s] as number) || 0), 0);
                return <td key={s} className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-gray-900">{fmtMeasureVal(colTotal, measure)}</td>;
              })}
              <td className="py-2 text-right text-sm font-bold tabular-nums text-gray-900">{fmtMeasureVal(grandTotal, measure)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (chartType === 'pie') {
    const seriesPieRows: PieRow[] = series
      .map(s => {
        const value = rows.reduce((sum, r) => sum + ((r[s] as number) || 0), 0);
        const ords  = Object.values(orderMap ?? {}).flatMap(rowMap => rowMap[s] ?? []);
        return { label: s, value, orders: ords.length, isoKey: s, orderList: ords };
      })
      .sort((a, b) => b.value - a.value);
    return (
      <PiePanelView
        allRows={seriesPieRows}
        measure={measure}
        h={h}
        onDrill={(label, orders) => onBarClick?.(label, label, orders)}
      />
    );
  }

  if (chartType === 'line') {
    const TIME_KEYS = new Set<GroupByKey>(['order_day','order_week','order_month','order_quarter','order_year']);
    const isTimeSeries = groupBy ? TIME_KEYS.has(groupBy) : false;
    const grandTotal  = rows.reduce((s, r) => s + r.__total__, 0);
    const avg         = rows.length > 0 ? grandTotal / rows.length : 0;
    const trend       = (rows[rows.length - 1]?.__total__ ?? 0) - (rows[0]?.__total__ ?? 0);

    const MultiLineTooltip = ({ active, payload, label }: {
      active?: boolean;
      payload?: { name: string; value: number; stroke: string; dataKey: string }[];
      label?: string;
    }) => {
      if (!active || !payload?.length) return null;
      const sorted   = [...payload].sort((a, b) => b.value - a.value);
      const rowTotal = sorted.reduce((s, p) => s + (p.value || 0), 0);
      return (
        <div className="min-w-[200px] rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xl">
          <p className="mb-2 truncate text-xs font-semibold text-gray-500">{label}</p>
          <div className="space-y-1.5">
            {sorted.map((p) => (
              <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.stroke }} />
                  <span className="max-w-[140px] truncate text-gray-600">{p.name}</span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-gray-800">{fmtMeasureVal(p.value, measure)}</span>
              </div>
            ))}
          </div>
          {series.length > 1 && (
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-[10px]">
              <span className="text-gray-400">Total</span>
              <span className="font-semibold tabular-nums text-gray-700">{fmtMeasureVal(rowTotal, measure)}</span>
            </div>
          )}
        </div>
      );
    };

    const sc  = 'flex flex-col items-center gap-0.5';
    const sl  = 'text-[10px] font-semibold uppercase tracking-wider text-gray-400';
    const sv  = 'text-sm font-bold tabular-nums text-gray-900';

    return (
      <div className={`flex w-full flex-col ${h}`}>
        {/* Stats strip */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-1 border-b border-gray-100 px-4 pb-3 pt-1">
          <div className={sc}>
            <span className={sl}>Total</span>
            <span className={sv}>{fmtMeasureVal(grandTotal, measure)}</span>
          </div>
          <div className={sc}>
            <span className={sl}>{isTimeSeries ? 'Avg / period' : 'Avg / group'}</span>
            <span className={sv}>{fmtMeasureVal(avg, measure)}</span>
          </div>
          <div className={sc}>
            <span className={sl}>Series</span>
            <span className={sv}>{series.length}</span>
          </div>
          {isTimeSeries && (
            <div className={`${sc} ml-auto`}>
              <span className={sl}>Trend</span>
              <span className={`text-sm font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {trend >= 0 ? '▲' : '▼'} {fmtMeasureVal(Math.abs(trend), measure)}
              </span>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows}
              margin={{ top: 16, right: 32, left: -4, bottom: rows.length > 10 ? 48 : 8 }}
              className="[&_.recharts-cartesian-grid-vertical]:opacity-0"
              style={{ cursor: onBarClick ? 'pointer' : undefined }}
              onClick={(d) => {
                if (!onBarClick || !d?.activePayload?.length) return;
                const row = d.activePayload[0].payload as GroupRow2;
                const sk  = d.activePayload[0].dataKey as string;
                const ords = orderMap?.[row.isoKey]?.[sk] ?? Object.values(orderMap?.[row.isoKey] ?? {}).flat();
                if (ords.length > 0) onBarClick(row.label, sk, ords);
              }}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s} id={`lineArea${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                angle={rows.length > 10 ? -40 : 0}
                textAnchor={rows.length > 10 ? 'end' : 'middle'}
                interval={rows.length > 14 ? Math.floor(rows.length / 7) : 0} dy={6} />
              <YAxis axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtAxisVal(v, measure)}
                tick={{ fontSize: 10, fill: '#94a3b8' }} width={54} />
              <Tooltip content={<MultiLineTooltip />}
                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <ReferenceLine y={avg} stroke="#cbd5e1" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: `Avg ${fmtAxisVal(avg, measure)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8', dy: -8 }} />
              {series.map((s, i) => (
                <Area key={`area-${s}`} dataKey={s} type="monotone"
                  fill={`url(#lineArea${i})`} stroke="none" isAnimationActive={false} />
              ))}
              {series.map((s, i) => (
                <Line key={s} dataKey={s} type="monotone"
                  stroke={PALETTE[i % PALETTE.length]} strokeWidth={2}
                  dot={rows.length <= 30 ? { r: 3, fill: '#fff', stroke: PALETTE[i % PALETTE.length], strokeWidth: 2 } : false}
                  activeDot={{ r: 6, stroke: PALETTE[i % PALETTE.length], strokeWidth: 2, fill: '#fff' }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const isHorizontal = chartType === 'bar' && rows.length > 1 && rows.length <= 12;
  const grandTotal   = rows.reduce((s, r) => s + r.__total__, 0);
  const grandAvg     = rows.length > 0 ? grandTotal / rows.length : 0;
  const yWidth       = isHorizontal
    ? Math.min(200, Math.max(100, rows.reduce((m, r) => Math.max(m, r.label.length * 6.5), 0)))
    : 54;

  const StackedBarTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; fill: string; dataKey: string; payload: GroupRow2 }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const segments   = payload.filter(p => p.dataKey !== '__total__' && (p.value || 0) > 0).sort((a, b) => b.value - a.value);
    const rowTotal   = segments.reduce((s, p) => s + (p.value || 0), 0);
    const pct        = grandTotal > 0 ? ((rowTotal / grandTotal) * 100).toFixed(1) : '0.0';
    const row        = payload[0]?.payload;
    const ordCount   = Object.values(orderMap?.[row?.isoKey] ?? {}).flat().length;
    const diff       = rowTotal - grandAvg;
    return (
      <div className="min-w-[200px] rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xl">
        <p className="mb-2 truncate text-xs font-semibold text-gray-500">{label}</p>
        <div className="space-y-1.5">
          {segments.map(p => (
            <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[11px]">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.fill }} />
                <span className="max-w-[130px] truncate text-gray-600">{p.name}</span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-gray-800">{fmtMeasureVal(p.value, measure)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
          {series.length > 1 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-bold tabular-nums text-gray-900">{fmtMeasureVal(rowTotal, measure)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
            <span>Share</span>
            <span className="font-medium text-gray-700">{pct}%</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
            <span>vs avg</span>
            <span className={`font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {diff >= 0 ? '+' : ''}{fmtMeasureVal(diff, measure)}
            </span>
          </div>
          {ordCount > 0 && (
            <div className="flex items-center justify-between gap-4 text-[11px] text-gray-500">
              <span>Orders</span>
              <span className="font-medium text-gray-700">{ordCount.toLocaleString()}</span>
            </div>
          )}
        </div>
        {onBarClick && <p className="mt-2 text-[10px] font-medium text-[#b20202]">Click to drill through</p>}
      </div>
    );
  };

  const sc = 'flex flex-col items-center gap-0.5';
  const sl = 'text-[10px] font-semibold uppercase tracking-wider text-gray-400';
  const sv = 'text-sm font-bold tabular-nums text-gray-900';

  return (
    <div className={`flex w-full flex-col ${h}`}>
      {/* Stats strip */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-1 border-b border-gray-100 px-4 pb-2 pt-1">
        <div className={sc}><span className={sl}>Total</span><span className={sv}>{fmtMeasureVal(grandTotal, measure)}</span></div>
        <div className={sc}><span className={sl}>Avg / group</span><span className={sv}>{fmtMeasureVal(grandAvg, measure)}</span></div>
        <div className={sc}><span className={sl}>Groups</span><span className={sv}>{rows.length}</span></div>
        <div className={sc}><span className={sl}>Series</span><span className={sv}>{series.length}</span></div>
      </div>

      {/* Chart */}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            layout={isHorizontal ? 'vertical' : 'horizontal'}
            barSize={isHorizontal ? 18 : (rows.length > 20 ? 8 : 14)}
            margin={isHorizontal
              ? { top: 4, right: 80, left: 0, bottom: 4 }
              : { top: 8, right: 20, left: -8, bottom: rows.length > 10 ? 48 : 8 }
            }
            className="[&_.recharts-cartesian-grid-vertical]:opacity-0">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

            {isHorizontal ? (
              <>
                <XAxis type="number" axisLine={false} tickLine={false}
                  tickFormatter={(v) => fmtAxisVal(v, measure)} tick={{ fontSize: 10, fill: '#94a3b8' }}
                  domain={[0, (rows.reduce((m, r) => Math.max(m, r.__total__), 0)) * 1.2]} />
                <YAxis type="category" dataKey="label" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b' }} width={yWidth} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  angle={rows.length > 10 ? -40 : 0}
                  textAnchor={rows.length > 10 ? 'end' : 'middle'}
                  interval={rows.length > 14 ? Math.floor(rows.length / 7) : 0} />
                <YAxis axisLine={false} tickLine={false}
                  tickFormatter={(v) => fmtAxisVal(v, measure)}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} width={54} />
              </>
            )}

            <Tooltip content={<StackedBarTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend
              iconType="square" iconSize={10}
              formatter={(value) => value === '__total__' ? 'Sum' : value}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

            {isHorizontal
              ? <ReferenceLine x={grandAvg} stroke="#cbd5e1" strokeDasharray="5 4" strokeWidth={1.5} />
              : <ReferenceLine y={grandAvg} stroke="#cbd5e1" strokeDasharray="5 4" strokeWidth={1.5}
                  label={{ value: `Avg ${fmtAxisVal(grandAvg, measure)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8', dy: -8 }} />
            }

            {series.map((s, i) => (
              <Bar key={s} dataKey={s} stackId="stack"
                fill={PALETTE[i % PALETTE.length]}
                radius={i === series.length - 1 ? (isHorizontal ? [0, 4, 4, 0] : [3, 3, 0, 0]) : [0, 0, 0, 0]}>
                {rows.map((row, ri) => (
                  <Cell key={ri}
                    style={{ cursor: onBarClick ? 'pointer' : undefined }}
                    onClick={() => {
                      const ords = orderMap?.[row.isoKey]?.[s] ?? [];
                      if (ords.length > 0) onBarClick?.(row.label, s, ords);
                    }} />
                ))}
              </Bar>
            ))}

            {series.length > 1 && !isHorizontal && (
              <Line dataKey="__total__" name="Sum" type="monotone"
                stroke="#1e293b" strokeWidth={2} dot={{ r: 2.5, fill: '#fff', stroke: '#1e293b', strokeWidth: 2 }}
                activeDot={{ r: 5 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function POSOrderAnalysis() {
  const { data: session, status: sessionStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? null;
  const [orders, setOrders]                 = useState<PosOrder[]>([]);
  const [loading, setLoading]               = useState(true);
  const [categories, setCategories]         = useState<CatItem[]>([]);
  const [brands, setBrands]                 = useState<BrandItem[]>([]);
  const [prodMeta, setProdMeta]             = useState<Record<string, ProdMeta>>({});

  // Search / filter state
  const [activeFilters, setActiveFilters]   = useState<string[]>([]);
  const [groupByStack, setGroupByStack]      = useState<GroupByKey[]>([]);
  const [appliedSearchName, setAppliedSearchName] = useState<string | null>(null);
  const [measure, setMeasure]               = useState<Measure>('total_price');
  const [chartType, setChartType]           = useState<ChartType>('bar');
  const [sortStack, setSortStack]           = useState<SortCriterion[]>([{ field: 'value', dir: 'desc' }]);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  // Custom date range filter
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd]     = useState('');
  const [customFilterOpen, setCustomFilterOpen] = useState(false);

  // Dropdown state
  const [searchOpen, setSearchOpen]         = useState(false);
  const [panelSearch, setPanelSearch]       = useState('');
  const [dateSubOpen, setDateSubOpen]   = useState(false);
  const [measuresOpen, setMeasuresOpen] = useState(false);
  const [savedSearches, setSavedSearches]   = useState<SavedSearch[]>([]);
  const [savingSearch, setSavingSearch]     = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  // Drill-down drawer
  const [drillData, setDrillData] = useState<{ orders: PosOrder[]; title: string } | null>(null);

  // View mode
  const [viewMode, setViewMode]             = useState<ViewMode>('graph');
  const [pivotRowDims, setPivotRowDims]     = useState<GroupByKey[]>(['cashier']);
  const [pivotColDims, setPivotColDims]     = useState<GroupByKey[]>([]);
  const [pivotHeatMap, setPivotHeatMap]     = useState(true);
  const [pivotShowOrders, setPivotShowOrders] = useState(false);
  const [pivotRowSearch, setPivotRowSearch] = useState('');
  const [expandedRows, setExpandedRows]     = useState<Set<string>>(new Set());
  const [expandedCols, setExpandedCols]     = useState<Set<string>>(new Set());
  const [pivotAddRowOpen, setPivotAddRowOpen] = useState(false);
  const [pivotAddColOpen, setPivotAddColOpen] = useState(false);
  const pivotAddRowRef = useRef<HTMLDivElement>(null);
  const pivotAddColRef = useRef<HTMLDivElement>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const measRef   = useRef<HTMLDivElement>(null);
  const sortRef   = useRef<HTMLDivElement>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  useEffect(() => {
    try { setSavedSearches(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as SavedSearch[]); } catch { /* */ }
  }, []);

  useEffect(() => {
    if (!token) return; // keep spinner while session loads; middleware redirects if truly unauthed
    setLoading(true);
    posApi.getAllOrders(token, { limit: 500 })
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch((err) => { console.error('[OrderAnalysis] fetch failed:', err); setOrders([]); })
      .finally(() => setLoading(false));
  }, [token]);

  // Fetch categories and brands (no auth needed)
  useEffect(() => {
    posApi.getCategories()
      .then(d => setCategories(d.categories || []))
      .catch(() => {});
    posApi.getBrands({ limit: 200 })
      .then(d => setBrands(d.brands || []))
      .catch(() => {});
  }, []);

  // Fetch products to build name→category/brand map
  useEffect(() => {
    if (!token) return;
    posApi.getProducts(token, { limit: 500 })
      .then(d => {
        const meta: Record<string, ProdMeta> = {};
        (d.products || []).forEach(p => {
          const name = p.product?.name;
          if (!name) return;
          // find parent category for subcategory logic
          const catId   = p.product?.category?._id   || '';
          const catName = p.product?.category?.name   || '';
          const brandId   = p.product?.brand?._id   || '';
          const brandName = p.product?.brand?.name   || '';
          meta[name] = { catId, catName, brandId, brandName };
        });
        setProdMeta(meta);
      })
      .catch(() => {});
  }, [token]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setDateSubOpen(false); setPanelSearch('');
      }
      if (measRef.current && !measRef.current.contains(e.target as Node)) {
        setMeasuresOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortPickerOpen(false);
      }
      if (pivotAddRowRef.current && !pivotAddRowRef.current.contains(e.target as Node)) {
        setPivotAddRowOpen(false);
      }
      if (pivotAddColRef.current && !pivotAddColRef.current.contains(e.target as Node)) {
        setPivotAddColOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Stack aliases — used in useMemos below and in derived UI state
  const groupBy  = groupByStack[0] ?? null;
  const groupBy2 = groupByStack[1] ?? null;
  const groupBy3 = groupByStack[2] ?? null;

  // Dynamic date filter items (from current date)
  const dateFilterItems = useMemo(() => buildDateFilterItems(new Date()), []);

  // Top-level categories (level 0 or no parent) for display
  const topCategories  = useMemo(() => categories.filter(c => !c.parent || c.level === 0), [categories]);
  const subCategories  = useMemo(() => categories.filter(c => c.parent && c.level !== 0), [categories]);

  // Filtered orders (with custom date range applied outside applyFilters for state access)
  const filtered = useMemo(() => {
    let r = applyFilters(orders, activeFilters, prodMeta);
    if (activeFilters.includes('date_custom') && customDateStart && customDateEnd) {
      const s = new Date(customDateStart);
      const e = new Date(customDateEnd); e.setHours(23, 59, 59, 999);
      r = r.filter(o => { const d = new Date(o.placedAt || o.createdAt); return d >= s && d <= e; });
    }
    // Live text search — cross-field match while typing (affects all widgets)
    const q = panelSearch.trim().toLowerCase();
    if (q) {
      r = r.filter(o =>
        cashierLabel(o.posStaff).toLowerCase().includes(q) ||
        `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.trim().toLowerCase().includes(q) ||
        (o.customer?.phone ?? '').toLowerCase().includes(q) ||
        (o.items || []).some(i =>
          i.name.toLowerCase().includes(q) ||
          (i.variant ?? '').toLowerCase().includes(q) ||
          (prodMeta[i.name]?.catName   ?? '').toLowerCase().includes(q) ||
          (prodMeta[i.name]?.brandName ?? '').toLowerCase().includes(q)
        )
      );
    }
    return r;
  }, [orders, activeFilters, prodMeta, customDateStart, customDateEnd, panelSearch]);

  // Item-level filter derived from product chips + live search.
  // When active, only items that match contribute to every metric.
  const itemFilter = useMemo((): ((item: OrderItem) => boolean) | null => {
    const pVals = activeFilters.filter(f => f.startsWith('product_search:')).map(f => f.slice(15).toLowerCase());
    const cVals = activeFilters.filter(f => f.startsWith('catname_search:')).map(f => f.slice(15).toLowerCase());
    const liveQ = panelSearch.trim().toLowerCase();
    if (pVals.length === 0 && cVals.length === 0 && !liveQ) return null;
    return (item: OrderItem) => {
      const pOk = pVals.length === 0 || pVals.some(q =>
        item.name.toLowerCase().includes(q) || (item.variant ?? '').toLowerCase().includes(q)
      );
      const cOk = cVals.length === 0 || cVals.some(q => {
        const m = prodMeta[item.name];
        return m && (m.catName.toLowerCase().includes(q) || (m.subCatName ?? '').toLowerCase().includes(q));
      });
      const lOk = !liveQ || (
        item.name.toLowerCase().includes(liveQ) ||
        (item.variant ?? '').toLowerCase().includes(liveQ) ||
        (prodMeta[item.name]?.catName   ?? '').toLowerCase().includes(liveQ) ||
        (prodMeta[item.name]?.brandName ?? '').toLowerCase().includes(liveQ)
      );
      return pOk && cOk && lOk;
    };
  }, [activeFilters, prodMeta, panelSearch]);

  // filteredScoped: each order's items narrowed to matching items, totals recomputed.
  // Orders that matched via cashier/customer (no matching items) keep all their items.
  // Used by analytics (KPI cards, charts) and order-level groupings in chartData.
  const filteredScoped = useMemo((): PosOrder[] => {
    if (!itemFilter) return filtered;
    return filtered.map(o => {
      const filtItems = (o.items || []).filter(itemFilter);
      if (filtItems.length === 0) return o; // matched via cashier/customer — keep full order
      const filtSubtotal = filtItems.reduce((s, i) => s + (i.itemSubtotal ?? i.priceAtPurchase * i.quantity), 0);
      const allSubtotal  = (o.items || []).reduce((s, i) => s + (i.itemSubtotal ?? i.priceAtPurchase * i.quantity), 0);
      const discShare    = allSubtotal > 0 ? filtSubtotal / allSubtotal : 0;
      return {
        ...o,
        items:         filtItems,
        total:         filtSubtotal,
        subtotal:      filtSubtotal,
        discountTotal: Math.round((o.discountTotal ?? 0) * discShare * 100) / 100,
      } as PosOrder;
    });
  }, [filtered, itemFilter]);

  // Chart data
  const chartData = useMemo(() => {
    const effectiveGroupBy = groupBy ?? 'order_day';
    const isItemGroupBy = ['product','product_category','subcategory','brand'].includes(effectiveGroupBy);

    // Item groupings: pass itemFilter so each item goes into its own product/category bucket.
    // Order-level groupings: use filteredScoped (items + totals already narrowed).
    const data = computeGroupData(
      isItemGroupBy ? filtered : filteredScoped,
      effectiveGroupBy, measure, prodMeta,
      isItemGroupBy ? (itemFilter ?? undefined) : undefined,
    );
    const isTimeSeries = ['order_day','order_week','order_month','order_quarter','order_year'].includes(effectiveGroupBy);
    if (isTimeSeries) return [...data].sort((a, b) => a.isoKey.localeCompare(b.isoKey));
    const stack = sortStack.length > 0 ? sortStack : [{ field: 'value' as SortField, dir: 'desc' as const }];
    return [...data].sort((a, b) => {
      for (const { field, dir } of stack) {
        const m = dir === 'desc' ? -1 : 1;
        let diff = 0;
        if (field === 'value')       diff = a.value - b.value;
        else if (field === 'label')  diff = a.label.localeCompare(b.label);
        else if (field === 'orders') diff = a.orders - b.orders;
        if (diff !== 0) return m * diff;
      }
      return 0;
    });
  }, [filtered, filteredScoped, itemFilter, groupBy, measure, sortStack, prodMeta]);

  // Multi-series (stacked) data — only when two Group Bys are active
  const multiSeriesData = useMemo(() => {
    if (!groupBy || !groupBy2) return null;
    const result = computeMultiSeries(filteredScoped, groupBy, groupBy2, measure, prodMeta, groupBy3);
    const timeKeys = ['order_day','order_week','order_month','order_quarter','order_year'];
    if (!timeKeys.includes(groupBy)) {
      const stack = sortStack.length > 0 ? sortStack : [{ field: 'value' as SortField, dir: 'desc' as const }];
      result.rows = [...result.rows].sort((a, b) => {
        for (const { field, dir } of stack) {
          const m = dir === 'desc' ? -1 : 1;
          let diff = 0;
          if (field === 'value')       diff = a.__total__ - b.__total__;
          else if (field === 'label')  diff = a.label.localeCompare(b.label);
          if (diff !== 0) return m * diff;
        }
        return 0;
      });
    }
    return result;
  }, [filteredScoped, groupBy, groupBy2, groupBy3, measure, prodMeta, sortStack]);

  // Summary analytics
  const analytics = useMemo(() => {
    const active  = filteredScoped.filter(o => !o.isVoided && o.status !== 'voided');
    const voided  = filteredScoped.filter(o => o.isVoided || o.status === 'voided');

    const totalRevenue  = active.reduce((s, o) => s + (o.total ?? 0), 0);
    const grossRevenue  = active.reduce((s, o) => s + (o.subtotal ?? o.total ?? 0), 0);
    const totalOrders   = active.length;
    const avgOrder      = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalRefunds  = active.reduce((s, o) => s + (o.refunds || []).reduce((r, ref) => r + ref.totalRefunded, 0), 0);
    const totalDiscount = active.reduce((s, o) => s + (o.discountTotal ?? 0), 0);
    const itemsSold     = active.reduce((s, o) => s + (o.items || []).reduce((si, i) => si + i.quantity, 0), 0);
    const avgItemsPerOrder = totalOrders > 0 ? itemsSold / totalOrders : 0;
    const refundRate    = totalOrders > 0 ? (active.filter(o => (o.refunds?.length ?? 0) > 0).length / totalOrders) * 100 : 0;
    const discountRate  = grossRevenue > 0 ? (totalDiscount / grossRevenue) * 100 : 0;
    const customerKeys  = new Set<string>();
    active.forEach(o => {
      if (o.customer?.phone) customerKeys.add(o.customer.phone);
      else if (o.customer?.firstName) customerKeys.add(`${o.customer.firstName}${o.customer.lastName ?? ''}`);
    });
    const uniqueCustomers = customerKeys.size;

    const withRefunds = active.filter(o => (o.refunds?.length ?? 0) > 0);
    const clean       = active.filter(o => !(o.refunds?.length));
    const statusData  = [
      { name: 'Paid',     value: clean.length,       revenue: clean.reduce((s, o) => s + o.total, 0) },
      { name: 'Refunded', value: withRefunds.length,  revenue: withRefunds.reduce((s, o) => s + o.total, 0) },
      { name: 'Voided',   value: voided.length,       revenue: 0 },
    ].filter(s => s.value > 0);

    const methodMap: Record<string, { revenue: number; count: number }> = {};
    active.forEach(o => {
      if (o.paymentDetails?.splitPayments?.length) {
        o.paymentDetails.splitPayments.forEach(sp => {
          if (!methodMap[sp.method]) methodMap[sp.method] = { revenue: 0, count: 0 };
          methodMap[sp.method].revenue += sp.amount; methodMap[sp.method].count += 1;
        });
      } else {
        const m = o.paymentMethod || 'other';
        if (!methodMap[m]) methodMap[m] = { revenue: 0, count: 0 };
        methodMap[m].revenue += o.total ?? 0; methodMap[m].count += 1;
      }
    });
    const methodData = Object.entries(methodMap)
      .map(([method, { revenue, count }]) => ({ method, name: METHOD_LABEL[method] || method, revenue, count }))
      .sort((a, b) => b.revenue - a.revenue);

    const productMap: Record<string, { name: string; revenue: number; qty: number }> = {};
    active.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.variant ? `${item.name} · ${item.variant}` : item.name;
        if (!productMap[key]) productMap[key] = { name: key, revenue: 0, qty: 0 };
        productMap[key].revenue += item.itemSubtotal ?? item.priceAtPurchase * item.quantity;
        productMap[key].qty     += item.quantity;
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const hourOrders: Record<number, number>  = {};
    const hourRevenue: Record<number, number> = {};
    for (let h = 0; h < 24; h++) { hourOrders[h] = 0; hourRevenue[h] = 0; }
    active.forEach(o => {
      const h = new Date(o.placedAt || o.createdAt).getHours();
      hourOrders[h]++; hourRevenue[h] += o.total ?? 0;
    });
    const hourData = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, '0')}:00`, orders: hourOrders[h], revenue: hourRevenue[h],
    }));

    const cashierMap: Record<string, { name: string; revenue: number; orders: number }> = {};
    active.forEach(o => {
      const name = cashierLabel(o.posStaff);
      if (!cashierMap[name]) cashierMap[name] = { name, revenue: 0, orders: 0 };
      cashierMap[name].revenue += o.total ?? 0;
      cashierMap[name].orders++;
    });
    const cashierData = Object.values(cashierMap)
      .map(c => ({ ...c, avgOrder: c.orders > 0 ? c.revenue / c.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowBuckets: Record<number, { orders: number; revenue: number }> = {};
    for (let d = 0; d < 7; d++) dowBuckets[d] = { orders: 0, revenue: 0 };
    active.forEach(o => {
      const d = new Date(o.placedAt || o.createdAt).getDay();
      dowBuckets[d].orders++;
      dowBuckets[d].revenue += o.total ?? 0;
    });
    const dayOfWeekData = DOW_LABELS.map((day, i) => ({ day, ...dowBuckets[i] }));

    return {
      totalRevenue, grossRevenue, totalOrders, avgOrder, itemsSold, avgItemsPerOrder,
      totalRefunds, refundRate, totalDiscount, discountRate, uniqueCustomers,
      statusData, methodData, topProducts, hourData, cashierData, dayOfWeekData,
    };
  }, [filteredScoped]);

  // Pivot data (hierarchical)
  const pivotData = useMemo(() => {
    if (viewMode !== 'pivot') return null;
    return computeHierarchicalPivot(filteredScoped, pivotRowDims, pivotColDims, measure, prodMeta, itemFilter);
  }, [viewMode, filteredScoped, pivotRowDims, pivotColDims, measure, prodMeta, itemFilter]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const toggleFilter = useCallback((key: string) => {
    setAppliedSearchName(null);
    setActiveFilters(prev => {
      const has = prev.includes(key);
      if (has) return prev.filter(f => f !== key);
      // date_custom is exclusive of all other date filters
      if (key === 'date_custom') return [...prev.filter(f => !isDateKey(f)), key];
      // regular date filters: multi-select OR, but remove date_custom
      if (isDateKey(key)) return [...prev.filter(f => f !== 'date_custom'), key];
      // invoiced / not_invoiced are mutually exclusive
      if (key === 'invoiced')     return [...prev.filter(f => f !== 'not_invoiced'), key];
      if (key === 'not_invoiced') return [...prev.filter(f => f !== 'invoiced'), key];
      // smart search: allow multiple values per type (OR logic)
      return [...prev, key];
    });
  }, []);

  const toggleGroupBy = useCallback((key: GroupByKey) => {
    setAppliedSearchName(null);
    setGroupByStack(prev =>
      prev.includes(key) ? prev.filter(g => g !== key) : [...prev, key]
    );
  }, []);

  const applyCustomDate = useCallback(() => {
    if (!customDateStart || !customDateEnd) return;
    setActiveFilters(prev => [...prev.filter(f => !isDateKey(f)), 'date_custom']);
    setCustomFilterOpen(false);
  }, [customDateStart, customDateEnd]);

  const saveSearch = useCallback(() => {
    if (!saveSearchName.trim()) return;
    const s: SavedSearch = { id: Date.now().toString(), name: saveSearchName.trim(), filters: activeFilters, groupBy: groupByStack[0] ?? null, groupBy2: groupByStack[1] ?? null, measure };
    const list = [...savedSearches, s];
    setSavedSearches(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    setSavingSearch(false); setSaveSearchName('');
  }, [saveSearchName, activeFilters, groupByStack, measure, savedSearches]);

  const applySavedSearch = useCallback((s: SavedSearch) => {
    setActiveFilters(s.filters);
    const stack: GroupByKey[] = [];
    if (s.groupBy) stack.push(s.groupBy);
    if (s.groupBy2) stack.push(s.groupBy2);
    setGroupByStack(stack);
    setMeasure(s.measure);
    setAppliedSearchName(s.name);
    setSearchOpen(false);
  }, []);

  const deleteSavedSearch = useCallback((id: string) => {
    const list = savedSearches.filter(s => s.id !== id);
    setSavedSearches(list); localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }, [savedSearches]);

  const clearAll = useCallback(() => { setActiveFilters([]); setGroupByStack([]); setAppliedSearchName(null); }, []);

  const addSort = useCallback((field: SortField) => {
    setSortStack(prev => prev.some(s => s.field === field) ? prev : [...prev, { field, dir: 'desc' }]);
    setSortPickerOpen(false);
  }, []);

  const removeSort = useCallback((field: SortField) => {
    setSortStack(prev => prev.filter(s => s.field !== field));
  }, []);

  const toggleSortDir = useCallback((field: SortField) => {
    setSortStack(prev => prev.map(s => s.field === field ? { ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' } : s));
  }, []);

  // ── Derived UI state ─────────────────────────────────────────────────────────

  const effectiveGroupBy  = groupBy ?? 'order_day';
  const measureLabel      = MEASURES.find(m => m.key === measure)?.label ?? 'Total Price';
  const groupByLabel      = ALL_GROUP_ITEMS.find(g => g.key === effectiveGroupBy)?.label ?? 'Day';
  const groupBy2Label     = groupBy2 ? (ALL_GROUP_ITEMS.find(g => g.key === groupBy2)?.label ?? groupBy2) : null;

  // Regular (non-search) filter chips
  const regularFilterTags = activeFilters
    .filter(k => !isSearchFilter(k))
    .map(k => {
      if (k === 'date_custom' && customDateStart && customDateEnd) {
        const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { key: k, label: `${fmt(customDateStart)} – ${fmt(customDateEnd)}` };
      }
      return { key: k, label: getFilterLabel(k, categories, brands) };
    });

  // Search filter chips — grouped by type, values joined with " or "
  const searchChipGroups = SEARCH_DEFS.map(({ prefix, label }) => {
    const keys = activeFilters.filter(f => f.startsWith(prefix));
    if (keys.length === 0) return null;
    return { prefix, label, keys, values: keys.map(k => k.slice(prefix.length)) };
  }).filter((g): g is NonNullable<typeof g> => g !== null);

  const isTimeSeries      = ['order_day','order_week','order_month','order_quarter','order_year'].includes(effectiveGroupBy);
  const logicalFilterCount = regularFilterTags.length + searchChipGroups.length;
  const hasActiveState    = activeFilters.length > 0 || groupByStack.length > 0 || !!appliedSearchName;

  const isSearchMatch = useCallback((s: SavedSearch) => {
    const sortArr = (a: string[]) => [...a].sort();
    return (
      JSON.stringify(sortArr(s.filters)) === JSON.stringify(sortArr(activeFilters)) &&
      (s.groupBy ?? null) === (groupByStack[0] ?? null) &&
      (s.groupBy2 ?? null) === (groupByStack[1] ?? null) &&
      s.measure === measure
    );
  }, [activeFilters, groupByStack, measure]);

  const CHART_TYPES: { type: ChartType; icon: React.ReactNode; title: string }[] = [
    { type: 'bar',   icon: <PiChartBar className="h-4 w-4" />, title: 'Bar chart' },
    { type: 'line',  icon: <PiTrendUp  className="h-4 w-4" />, title: 'Line chart' },
    { type: 'pie',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 0 0-10 10h10V2Z" opacity={.5}/>
          <path d="M12 2v10h10A10 10 0 0 0 12 2Z"/>
          <path d="M2 12a10 10 0 1 0 10-10v10H2Z" opacity={.3}/>
        </svg>
      ), title: 'Pie chart' },
    { type: 'table', icon: <PiList className="h-4 w-4" />, title: 'Table view' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <POSNavHeader />

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="space-y-4 px-6 pt-5 pb-3">

        {/* Page title */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Order Analysis</h1>
          {loading && <PiArrowsClockwise className="h-4 w-4 animate-spin text-gray-400" />}
        </div>

        {/* ── Search / filter bar ─────────────────────────────────────────── */}
        <div ref={searchRef} className="relative">
          <div className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border bg-white px-3 py-2 shadow-sm transition-shadow ${
            searchOpen ? 'border-gray-300 shadow-md' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />

            {/* ── Saved search chip ── */}
            {appliedSearchName && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                <PiStar className="h-3 w-3 shrink-0" />
                {appliedSearchName}
                <button onClick={() => { clearAll(); setPanelSearch(''); }}
                  className="ml-0.5 rounded-full opacity-80 transition-opacity hover:opacity-100">
                  <PiX className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* ── Regular filter chips (status, date, category, brand) ── */}
            {regularFilterTags.map(f => (
              <span key={f.key}
                className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                <PiFunnel className="h-2.5 w-2.5 shrink-0" />
                {f.label}
                <button onClick={() => toggleFilter(f.key)}
                  className="ml-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100 hover:text-red-500">
                  <PiX className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* ── Search type chips — bold label + italic "val1 or val2" ── */}
            {searchChipGroups.map(group => (
              <span key={group.prefix}
                className="flex items-center gap-1 rounded-full bg-[#4f2d7f] px-2.5 py-0.5 text-xs font-medium text-white shadow-sm">
                <span className="font-bold">{group.label}</span>
                <span className="opacity-80">
                  {group.values.map((v, i) => (
                    <span key={v}>
                      {i > 0 && <span className="mx-1 opacity-60 italic">or</span>}
                      <em className="not-italic">{v}</em>
                    </span>
                  ))}
                </span>
                <button
                  onClick={() => { setAppliedSearchName(null); setActiveFilters(prev => prev.filter(f => !f.startsWith(group.prefix))); }}
                  className="ml-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100">
                  <PiX className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* ── Group By chip — single combined "Label1 > Label2" pill ── */}
            {groupByStack.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-medium text-white shadow-sm">
                <PiStack className="h-3 w-3 shrink-0" />
                {groupByStack
                  .map(k => ALL_GROUP_ITEMS.find(g => g.key === k)?.label ?? k)
                  .join(' > ')}
                <button onClick={() => setGroupByStack([])}
                  className="ml-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100">
                  <PiX className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Real text input — filters panel items live */}
            <input
              value={panelSearch}
              onChange={e => { setPanelSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setPanelSearch(''); } }}
              placeholder={!hasActiveState && !panelSearch ? 'Search orders, products, cashiers…' : ''}
              className="min-w-[120px] flex-1 border-none bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />

            {/* Active filter count badge — counts unique search groups + regular filters */}
            {(regularFilterTags.length + searchChipGroups.length) > 0 && (
              <span className="shrink-0 rounded-full bg-[#b20202] px-1.5 py-px text-[10px] font-bold leading-4 text-white">
                {regularFilterTags.length + searchChipGroups.length}
              </span>
            )}

            {/* Clear all */}
            {(hasActiveState || panelSearch) && (
              <button onClick={() => { clearAll(); setPanelSearch(''); }}
                title="Clear all filters"
                className="shrink-0 rounded-md p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Panel toggle */}
            <button type="button" onClick={() => { setSearchOpen(o => !o); if (searchOpen) setPanelSearch(''); }}
              className="flex items-center justify-center rounded-lg border border-gray-200 p-1 transition-colors hover:bg-gray-50">
              <PiCaretDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${searchOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* ── Quick search suggestions (shown while typing) ──────────────── */}
          {panelSearch.trim() && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
              {SEARCH_DEFS.map(({ prefix, label }) => {
                const key     = `${prefix}${panelSearch.trim()}`;
                const already = activeFilters.includes(key);
                const existing = activeFilters.filter(f => f.startsWith(prefix)).map(f => f.slice(prefix.length));
                return (
                  <button key={prefix} type="button"
                    onClick={() => { toggleFilter(key); setPanelSearch(''); setSearchOpen(false); }}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-sm transition-colors ${
                      already ? 'bg-purple-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                    <PiCaretDown className="h-3.5 w-3.5 -rotate-90 text-gray-400 shrink-0" />
                    <span>
                      Search <span className="font-semibold text-gray-900">{label}</span> for:{' '}
                      <em className="font-semibold not-italic text-[#4f2d7f]">{panelSearch.trim()}</em>
                    </span>
                    {existing.length > 0 && (
                      <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                        {already ? 'active' : `+ add to: ${existing.join(', ')}`}
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="border-t border-gray-100">
                <button type="button"
                  onClick={() => { setCustomFilterOpen(true); setSearchOpen(true); setPanelSearch(''); }}
                  className="flex w-full items-center gap-3 px-5 py-3 text-sm font-medium text-teal-600 hover:bg-gray-50 transition-colors">
                  Add Custom Filter
                </button>
              </div>
            </div>
          )}

          {/* ── Filter / Group By / Favorites panel ──────────────────────── */}
          {searchOpen && !panelSearch.trim() && (
            <div className="absolute left-0 top-full z-50 mt-1.5 grid w-full min-w-[640px] grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">

              {/* ── Filters column ── */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
                  <PiFunnel className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filters</span>
                  {logicalFilterCount > 0 && (
                    <span className="ml-auto rounded-full bg-violet-100 px-1.5 py-px text-[10px] font-bold text-violet-700">
                      {logicalFilterCount}
                    </span>
                  )}
                </div>
                <div className="max-h-[420px] space-y-0.5 overflow-y-auto p-3">

                  {/* Status filters */}
                  {FILTER_STATIC
                    .filter(f => !panelSearch || f.label.toLowerCase().includes(panelSearch.toLowerCase()))
                    .map(f => {
                      const active = activeFilters.includes(f.key);
                      return (
                        <button key={f.key} type="button" onClick={() => toggleFilter(f.key)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors ${
                            active ? 'bg-[#fef2f2] font-medium text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'
                          }`}>
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            active ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'
                          }`}>
                            {active && <PiCheck className="h-3 w-3 text-white" />}
                          </span>
                          {f.label}
                        </button>
                      );
                    })}

                  {/* Order Date */}
                  {(!panelSearch || 'order date today yesterday week month quarter year'.includes(panelSearch.toLowerCase())) && (
                    <>
                      <div className="my-1.5 h-px bg-gray-100" />
                      <button type="button" onClick={() => setDateSubOpen(o => !o)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <span className="flex items-center gap-2">
                          <PiCalendarBlank className="h-3.5 w-3.5 text-gray-400" />
                          Order Date
                          {activeFilters.some(isDateKey) && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#b20202]" />
                          )}
                        </span>
                        <PiCaretDown className={`h-3 w-3 text-gray-400 transition-transform ${dateSubOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </>
                  )}
                  {(dateSubOpen || panelSearch) && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-gray-100 pl-3">
                      {/* Quick: Today / Yesterday / This Week */}
                      {[
                        { key: 'date_today',     label: 'Today' },
                        { key: 'date_yesterday', label: 'Yesterday' },
                        { key: 'date_week',      label: 'This Week' },
                      ]
                        .filter(d => !panelSearch || d.label.toLowerCase().includes(panelSearch.toLowerCase()))
                        .map(d => {
                          const active = activeFilters.includes(d.key);
                          return (
                            <button key={d.key} type="button" onClick={() => toggleFilter(d.key)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left transition-colors ${
                                active ? 'bg-[#fef2f2] font-medium text-[#b20202]' : 'text-gray-600 hover:bg-gray-50'
                              }`}>
                              <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                active ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'
                              }`}>
                                {active && <PiCheck className="h-2.5 w-2.5 text-white" />}
                              </span>
                              {d.label}
                            </button>
                          );
                        })}

                      {/* Months / Quarters / Years */}
                      {!panelSearch && <div className="my-1 h-px bg-gray-100" />}
                      {[
                        ...dateFilterItems.months,
                        ...dateFilterItems.quarters,
                        ...dateFilterItems.years,
                      ]
                        .filter(d => !panelSearch || d.label.toLowerCase().includes(panelSearch.toLowerCase()))
                        .map((d, idx, arr) => {
                          const isMonth   = d.key.startsWith('date_m_');
                          const isQuarter = d.key.startsWith('date_q_');
                          const prevIsMonth   = idx > 0 && arr[idx - 1].key.startsWith('date_m_');
                          const prevIsQuarter = idx > 0 && arr[idx - 1].key.startsWith('date_q_');
                          const showDiv = !panelSearch && ((isQuarter && prevIsMonth) || (!isMonth && !isQuarter && prevIsQuarter));
                          const active = activeFilters.includes(d.key);
                          return (
                            <div key={d.key}>
                              {showDiv && <div className="my-1 h-px bg-gray-100" />}
                              <button type="button" onClick={() => toggleFilter(d.key)}
                                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left transition-colors ${
                                  active ? 'bg-[#fef2f2] font-medium text-[#b20202]' : 'text-gray-600 hover:bg-gray-50'
                                }`}>
                                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                  active ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'
                                }`}>
                                  {active && <PiCheck className="h-2.5 w-2.5 text-white" />}
                                </span>
                                {d.label}
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Categories */}
                  {topCategories.length > 0 && (
                    <>
                      <div className="my-1.5 h-px bg-gray-100" />
                      <FilterListSection label="Product Category" items={topCategories}
                        activeFilters={activeFilters} prefix="category_" onToggle={toggleFilter} filter={panelSearch} />
                    </>
                  )}
                  {subCategories.length > 0 && (
                    <FilterListSection label="Subcategory" items={subCategories}
                      activeFilters={activeFilters} prefix="category_" onToggle={toggleFilter} filter={panelSearch} />
                  )}
                  {brands.length > 0 && (
                    <>
                      <div className="my-1.5 h-px bg-gray-100" />
                      <FilterListSection label="Brand" items={brands}
                        activeFilters={activeFilters} prefix="brand_" onToggle={toggleFilter} filter={panelSearch} />
                    </>
                  )}

                  {/* Custom date range */}
                  {!panelSearch && (
                    <>
                      <div className="my-1.5 h-px bg-gray-100" />
                      <button type="button" onClick={() => setCustomFilterOpen(o => !o)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-gray-500 hover:bg-gray-50">
                        <span className="flex items-center gap-2">
                          <PiCalendarBlank className="h-3.5 w-3.5" />
                          Custom date range
                        </span>
                        <PiCaretDown className={`h-3 w-3 text-gray-400 transition-transform ${customFilterOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {customFilterOpen && (
                        <div className="mx-1 mt-1 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">From</label>
                              <input type="date" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#b20202]" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">To</label>
                              <input type="date" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#b20202]" />
                            </div>
                          </div>
                          <button type="button" onClick={applyCustomDate}
                            disabled={!customDateStart || !customDateEnd}
                            className="w-full rounded-lg bg-[#b20202] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#8b0101] disabled:opacity-40">
                            Apply range
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── Group By column ── */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
                  <PiStack className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Group By</span>
                  {groupByStack.length > 0 && (
                    <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-bold text-emerald-700">
                      {groupByStack.length}
                    </span>
                  )}
                </div>
                <div className="max-h-[420px] space-y-0.5 overflow-y-auto p-3">
                  {ALL_GROUP_ITEMS
                    .filter(g => !panelSearch || g.label.toLowerCase().includes(panelSearch.toLowerCase()))
                    .map((g, idx, arr) => {
                      const stackIdx = groupByStack.indexOf(g.key);
                      const active   = stackIdx !== -1;
                      const isDate   = GROUP_BY_DATE_ITEMS.some(d => d.key === g.key);
                      const prevIsDate = idx > 0 && GROUP_BY_DATE_ITEMS.some(d => d.key === arr[idx - 1].key);
                      const showDiv = !panelSearch && isDate && !prevIsDate;

                      const dotCls = [
                        'border-emerald-500 bg-emerald-500 text-white',
                        'border-teal-400 bg-teal-400 text-white',
                        'border-blue-400 bg-blue-400 text-white',
                      ][stackIdx] ?? 'border-gray-300';

                      const badgeLabels = ['', '2nd', '3rd'];
                      const badgeCls = [
                        '',
                        'rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-600',
                        'rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600',
                      ];

                      return (
                        <div key={g.key}>
                          {showDiv && (
                            <div className="my-1.5 flex items-center gap-2 px-2">
                              <div className="h-px flex-1 bg-gray-100" />
                              <span className="text-[10px] uppercase tracking-wider text-gray-400">Order Date</span>
                              <div className="h-px flex-1 bg-gray-100" />
                            </div>
                          )}
                          <button type="button" onClick={() => toggleGroupBy(g.key)}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors ${
                              active ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-gray-700 hover:bg-gray-50'
                            }`}>
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                              active ? dotCls : 'border-gray-300'
                            }`}>
                              {active ? stackIdx + 1 : ''}
                            </span>
                            {g.label}
                            {active && stackIdx > 0 && (
                              <span className={`ml-auto ${badgeCls[stackIdx] ?? badgeCls[2]}`}>
                                {badgeLabels[stackIdx] ?? `${stackIdx + 1}th`}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  {panelSearch && ALL_GROUP_ITEMS.filter(g => g.label.toLowerCase().includes(panelSearch.toLowerCase())).length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-gray-400">No groups match</p>
                  )}
                </div>
              </div>

              {/* ── Favorites column ── */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
                  <PiStar className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Favorites</span>
                  {savedSearches.length > 0 && (
                    <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-600">
                      {savedSearches.length}
                    </span>
                  )}
                </div>
                <div className="max-h-[420px] flex-1 space-y-1 overflow-y-auto p-3">
                  {savedSearches.length === 0 && !savingSearch && (
                    <div className="py-6 text-center">
                      <PiStar className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                      <p className="text-xs text-gray-400">No saved searches yet</p>
                      <p className="mt-0.5 text-[11px] text-gray-300">Save your current filters for quick access</p>
                    </div>
                  )}
                  {savedSearches.map(s => {
                    const active = isSearchMatch(s);
                    const filterCount = s.filters.length;
                    const grpLabel = s.groupBy ? ALL_GROUP_ITEMS.find(g => g.key === s.groupBy)?.label : null;
                    const grp2Label = s.groupBy2 ? ALL_GROUP_ITEMS.find(g => g.key === s.groupBy2)?.label : null;
                    return (
                      <div key={s.id}
                        className={`group rounded-xl border p-3 transition-colors ${
                          active ? 'border-teal-200 bg-teal-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" onClick={() => applySavedSearch(s)}
                            className="flex flex-1 items-center gap-2 text-left">
                            {active && <PiCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" />}
                            <span className={`truncate text-sm font-medium ${active ? 'text-teal-700' : 'text-gray-800'}`}>
                              {s.name}
                            </span>
                          </button>
                          <button type="button" onClick={() => deleteSavedSearch(s.id)}
                            className="shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:text-red-400">
                            <PiTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {filterCount > 0 && (
                            <span className="flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                              <PiFunnel className="h-2.5 w-2.5" />{filterCount} filter{filterCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {grpLabel && (
                            <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                              <PiStack className="h-2.5 w-2.5" />
                              {grpLabel}{grp2Label ? ` › ${grp2Label}` : ''}
                            </span>
                          )}
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {MEASURES.find(m => m.key === s.measure)?.label ?? s.measure}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {savingSearch ? (
                    <div className="mt-1 space-y-2 rounded-xl border border-gray-200 p-3">
                      <p className="text-xs font-semibold text-gray-600">Name this search</p>
                      <input type="text" value={saveSearchName} onChange={e => setSaveSearchName(e.target.value)}
                        placeholder="e.g. This month · Cashier" autoFocus
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#b20202]"
                        onKeyDown={e => { if (e.key === 'Enter') saveSearch(); if (e.key === 'Escape') setSavingSearch(false); }} />
                      <div className="flex gap-1.5">
                        <button type="button" onClick={saveSearch}
                          className="flex-1 rounded-lg bg-[#b20202] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#8b0101]">
                          Save
                        </button>
                        <button type="button" onClick={() => { setSavingSearch(false); setSaveSearchName(''); }}
                          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setSavingSearch(true)}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600">
                      <PiFloppyDisk className="h-4 w-4" />
                      Save current search
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Measures */}
          <div ref={measRef} className="relative">
            <button type="button" onClick={() => setMeasuresOpen(o => !o)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors hover:bg-gray-50 ${
                measuresOpen ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'
              }`}>
              <PiSlidersHorizontal className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">Measure</span>
              <span className="font-semibold text-gray-800">{measureLabel}</span>
              <PiCaretDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${measuresOpen ? 'rotate-180' : ''}`} />
            </button>
            {measuresOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
                {MEASURES.map(m => (
                  <div key={m.key}>
                    {m.separator && <div className="my-1 h-px bg-gray-100" />}
                    <button type="button" onClick={() => { setMeasure(m.key); setMeasuresOpen(false); }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors ${
                        measure === m.key ? 'bg-[#fef2f2] font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'
                      }`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        measure === m.key ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'
                      }`}>
                        {measure === m.key && <PiCheck className="h-3 w-3 text-white" />}
                      </span>
                      {m.label}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Chart type buttons */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {CHART_TYPES.map(ct => (
              <button key={ct.type} type="button" onClick={() => setChartType(ct.type)} title={ct.title}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  chartType === ct.type
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                }`}>
                {ct.icon}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Sort — locked to chronological for time-series, multi-criteria for others */}
          <div ref={sortRef} className="relative flex flex-wrap items-center gap-1.5">
            {isTimeSeries ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-400 shadow-sm">
                <PiCalendarBlank className="h-3 w-3" />
                Chronological
              </span>
            ) : (
              <>
                {sortStack.map((s, rank) => {
                  const lbl = s.field === 'value' ? measureLabel : s.field === 'label' ? 'Name' : 'Orders';
                  return (
                    <span key={s.field}
                      className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                      {sortStack.length > 1 && (
                        <span className="mr-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-200 text-[9px] font-bold text-sky-700">{rank + 1}</span>
                      )}
                      <button type="button" onClick={() => toggleSortDir(s.field)}
                        className="flex items-center gap-0.5 transition-colors hover:text-sky-900" title="Toggle direction">
                        {s.dir === 'desc' ? <PiArrowDown className="h-3 w-3" /> : <PiArrowUp className="h-3 w-3" />}
                        {lbl}
                      </button>
                      <button type="button" onClick={() => removeSort(s.field)}
                        className="ml-0.5 rounded transition-colors hover:text-red-500">
                        <PiX className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  );
                })}

                {sortStack.length < 3 && (
                  <button type="button" onClick={() => setSortPickerOpen(o => !o)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm transition-colors ${
                      sortPickerOpen ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                    } text-gray-500`}>
                    <PiSlidersHorizontal className="h-3 w-3 text-gray-400" />
                    Sort
                    <PiCaretDown className={`h-2.5 w-2.5 transition-transform ${sortPickerOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {sortPickerOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Add sort criterion</p>
                    {([
                      { field: 'value'  as SortField, label: measureLabel, icon: <PiArrowDown className="h-3.5 w-3.5 text-gray-400" /> },
                      { field: 'label'  as SortField, label: 'Name (A–Z)',  icon: <PiArrowUp   className="h-3.5 w-3.5 text-gray-400" /> },
                      { field: 'orders' as SortField, label: 'Order Count', icon: <PiShoppingCart className="h-3.5 w-3.5 text-gray-400" /> },
                    ] as { field: SortField; label: string; icon: React.ReactNode }[])
                      .filter(f => !sortStack.some(s => s.field === f.field))
                      .map(f => (
                        <button key={f.field} type="button" onClick={() => addSort(f.field)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                          {f.icon}
                          {f.label}
                        </button>
                      ))}
                    {sortStack.length === 3 && (
                      <p className="px-3 py-2 text-center text-xs text-gray-400">All 3 criteria active</p>
                    )}
                    {sortStack.length > 0 && (
                      <div className="border-t border-gray-100 mt-1">
                        <button type="button" onClick={() => { setSortStack([{ field: 'value', dir: 'desc' }]); setSortPickerOpen(false); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600">
                          <PiArrowCounterClockwise className="h-3.5 w-3.5" />
                          Reset sort
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* View toggle: Graph / Pivot */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setViewMode('graph')} title="Graph view"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'graph' ? 'bg-[#b20202] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              <PiChartBar className="h-3.5 w-3.5" />
              Graph
            </button>
            <button type="button" onClick={() => setViewMode('pivot')} title="Pivot table"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'pivot' ? 'bg-[#b20202] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              <PiTable className="h-3.5 w-3.5" />
              Pivot
            </button>
          </div>

          {/* Stats */}
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
            {activeFilters.includes('date_custom') && customDateStart && customDateEnd && (
              <span className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                <PiCalendarBlank className="h-3 w-3" />
                {new Date(customDateStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(customDateEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            <span>
              <span className="font-semibold text-gray-700">{filtered.length.toLocaleString()}</span>
              {' '}order{filtered.length !== 1 ? 's' : ''}
              {orders.length !== filtered.length && (
                <span className="ml-1 text-gray-400">of {orders.length.toLocaleString()}</span>
              )}
            </span>
            {logicalFilterCount > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600">
                <PiFunnel className="h-3 w-3" />
                {logicalFilterCount} filter{logicalFilterCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

      </div>{/* end controls */}

      {/* ══════════════════════════════════════════════════════════════════
           PIVOT VIEW
          ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'pivot' && (() => {
        const p = pivotData;

        const toggleRow = (key: string) => setExpandedRows(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
        const toggleCol = (key: string) => setExpandedCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
        const canExpandRow = pivotRowDims.length >= 2;
        const canExpandCol = pivotColDims.length >= 2;

        // Row search filter
        const searchQ = pivotRowSearch.trim().toLowerCase();
        const visibleRows = p
          ? (searchQ ? p.rowVals0.filter(rk => fmtDimKey(rk, pivotRowDims[0]).toLowerCase().includes(searchQ)) : p.rowVals0)
          : [];

        // Visible columns (col dim0 values, each optionally expanded to sub-cols)
        const visibleCols: { colPath: string[]; label: string; isSubCol: boolean }[] = [];
        if (p) {
          p.colVals0.forEach(ck => {
            if (canExpandCol && expandedCols.has(ck)) {
              (p.subColValsMap[ck] ?? []).forEach(sk => {
                visibleCols.push({ colPath: [ck, sk], label: fmtDimKey(sk, pivotColDims[1]), isSubCol: true });
              });
            } else {
              visibleCols.push({ colPath: [ck], label: fmtDimKey(ck, pivotColDims[0]), isSubCol: false });
            }
          });
        }

        const cellVal  = (rowPath: string[], colPath: string[]) => p ? p.getValue(rowPath, colPath) : 0;
        const ordCount = (rowPath: string[], colPath: string[]) => p ? p.getOrderCount(rowPath, colPath) : 0;

        const heatStyle = (val: number) => {
          if (!pivotHeatMap || !p || val <= 0) return {};
          const share = p.maxCellVal > 0 ? val / p.maxCellVal : 0;
          return { backgroundColor: `rgba(178,2,2,${Math.max(0.04, share * 0.26)})` };
        };

        const buildCellTitle = (rPath: string[], cPath: string[]): string => {
          const rLabel = rPath.length === 0 ? 'All' : rPath.map((k, i) => fmtDimKey(k, pivotRowDims[i])).join(' › ');
          const cLabel = cPath.length === 0 ? 'Total' : cPath.map((k, i) => fmtDimKey(k, pivotColDims[i])).join(' › ');
          if (rPath.length === 0 && cPath.length === 0) return 'Grand Total';
          if (cPath.length === 0) return rLabel;
          if (rPath.length === 0) return cLabel;
          return `${rLabel} × ${cLabel}`;
        };

        const DataCell = ({ rowPath, colPath, isTotal = false }: { rowPath: string[]; colPath: string[]; isTotal?: boolean }) => {
          const val = cellVal(rowPath, colPath);
          const pct = p && p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
          const share = p && p.maxCellVal > 0 ? val / p.maxCellVal : 0;
          const darkText = pivotHeatMap && share > 0.55;
          const ords = pivotShowOrders ? ordCount(rowPath, colPath) : 0;
          const handleClick = val > 0 ? () => {
            const cellOrders = p?.getOrders(rowPath, colPath) ?? [];
            if (cellOrders.length > 0) setDrillData({ orders: cellOrders, title: buildCellTitle(rowPath, colPath) });
          } : undefined;
          if (val === 0) {
            return (
              <td className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums ${isTotal ? 'bg-gray-50' : ''}`}>
                <span className="text-gray-200">—</span>
              </td>
            );
          }
          return (
            <td className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums transition-colors ${isTotal ? 'bg-gray-50' : ''} ${handleClick ? 'cursor-pointer hover:brightness-95' : ''}`}
              style={isTotal ? {} : heatStyle(val)}
              onClick={handleClick}>
              <div className={`text-xs font-semibold ${darkText ? 'text-[#6b0000]' : isTotal ? 'text-gray-800' : 'text-gray-700'}`}>
                {fmtMeasureVal(val, measure)}
              </div>
              {pct >= 1 && !isTotal && <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>}
              {pivotShowOrders && ords > 0 && !isTotal && <div className="text-[10px] text-gray-300">{ords} ord</div>}
            </td>
          );
        };

        return (
          <div className="border-y border-gray-100 bg-white shadow-sm">

            {/* ── Pivot toolbar ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 px-6 py-2.5">

              {/* Row groupings */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Rows</span>
                {pivotRowDims.map((d, i) => (
                  <span key={d} className="flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                    {ALL_GROUP_ITEMS.find(g => g.key === d)?.label ?? d}
                    <button onClick={() => { setPivotRowDims(prev => prev.filter((_, j) => j !== i)); setExpandedRows(new Set()); }}
                      className="ml-0.5 rounded opacity-60 hover:opacity-100 hover:text-red-500">
                      <PiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {pivotRowDims.length < 3 && (
                  <PivotDimDropdown open={pivotAddRowOpen} refEl={pivotAddRowRef}
                    title="Add row grouping" existing={pivotRowDims} otherDims={pivotColDims}
                    onToggle={() => setPivotAddRowOpen(o => !o)}
                    onAdd={k => { setPivotRowDims(prev => [...prev, k]); setExpandedRows(new Set()); }} />
                )}
                {canExpandRow && p && p.rowVals0.length > 0 && (
                  <div className="flex gap-0.5">
                    <button type="button" title="Expand all rows"
                      onClick={() => setExpandedRows(new Set(p.rowVals0))}
                      className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all+</button>
                    <button type="button" title="Collapse all rows"
                      onClick={() => setExpandedRows(new Set())}
                      className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all−</button>
                  </div>
                )}
              </div>

              {/* Flip button */}
              <button type="button" title="Transpose rows ↔ cols"
                onClick={() => {
                  const r = pivotRowDims; const c = pivotColDims;
                  setPivotRowDims(c.length > 0 ? c : ['cashier']);
                  setPivotColDims(r);
                  setExpandedRows(new Set()); setExpandedCols(new Set());
                }}
                className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]">
                ⇄
              </button>

              {/* Column groupings */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cols</span>
                {pivotColDims.map((d, i) => (
                  <span key={d} className="flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {ALL_GROUP_ITEMS.find(g => g.key === d)?.label ?? d}
                    <button onClick={() => { setPivotColDims(prev => prev.filter((_, j) => j !== i)); setExpandedCols(new Set()); }}
                      className="ml-0.5 rounded opacity-60 hover:opacity-100 hover:text-red-500">
                      <PiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {pivotColDims.length < 2 && (
                  <PivotDimDropdown open={pivotAddColOpen} refEl={pivotAddColRef}
                    title="Add column grouping" existing={pivotColDims} otherDims={pivotRowDims}
                    onToggle={() => setPivotAddColOpen(o => !o)}
                    onAdd={k => { setPivotColDims(prev => [...prev, k]); setExpandedCols(new Set()); }} />
                )}
                {canExpandCol && p && p.colVals0.length > 0 && (
                  <div className="flex gap-0.5">
                    <button type="button" title="Expand all columns"
                      onClick={() => setExpandedCols(new Set(p.colVals0))}
                      className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all+</button>
                    <button type="button" title="Collapse all columns"
                      onClick={() => setExpandedCols(new Set())}
                      className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all−</button>
                  </div>
                )}
              </div>

              <div className="h-4 w-px bg-gray-200" />

              {/* Heat map toggle */}
              <button type="button" onClick={() => setPivotHeatMap(h => !h)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  pivotHeatMap ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: pivotHeatMap ? 'linear-gradient(to right, #fef2f2, #b20202)' : '#e5e7eb' }} />
                Heat map
              </button>

              {/* Show orders toggle */}
              <button type="button" onClick={() => setPivotShowOrders(s => !s)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  pivotShowOrders ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}>
                <PiShoppingCart className="h-3 w-3" />
                Orders
              </button>

              {/* Row search */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm">
                <PiMagnifyingGlass className="h-3 w-3 shrink-0 text-gray-400" />
                <input
                  type="text" value={pivotRowSearch} onChange={e => setPivotRowSearch(e.target.value)}
                  placeholder="Filter rows…" className="w-24 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-300" />
                {pivotRowSearch && (
                  <button onClick={() => setPivotRowSearch('')} className="text-gray-300 hover:text-gray-500">
                    <PiX className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Export buttons */}
              {p && p.rowVals0.length > 0 && (
                <div className="flex items-center gap-1">
                  <button type="button"
                    onClick={() => exportPivotCSV(p, pivotRowDims, pivotColDims, measure, expandedRows, expandedCols)}
                    className="flex items-center gap-1.5 rounded-l-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700">
                    <PiFloppyDisk className="h-3 w-3" />
                    CSV
                  </button>
                  <button type="button"
                    onClick={() => exportPivotExcel(p, pivotRowDims, pivotColDims, measure, expandedRows, expandedCols)}
                    className="flex items-center gap-1.5 rounded-r-lg border border-l-0 border-gray-200 bg-white px-2.5 py-1.5 text-xs text-emerald-600 shadow-sm transition-colors hover:bg-emerald-50">
                    <PiFloppyDisk className="h-3 w-3" />
                    Excel
                  </button>
                </div>
              )}

              <div className="ml-auto text-xs text-gray-400">
                {p
                  ? <><span className="font-semibold text-gray-700">{visibleRows.length}</span>{visibleRows.length !== p.rowVals0.length && ` / ${p.rowVals0.length}`} rows · <span className="font-semibold text-gray-700">{fmtMeasureVal(p.grandTotal, measure)}</span></>
                  : 'Loading…'}
              </div>
            </div>

            {/* ── Pivot table ───────────────────────────────────────────────── */}
            {(!p || p.rowVals0.length === 0) ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20">
                <PiTable className="h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-400">
                  {pivotRowDims.length === 0 ? 'Add a row grouping to start' : 'No data for the selected filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
                {visibleRows.length === 0 && searchQ && (
                  <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                    No rows match <span className="ml-1 font-medium text-gray-600">"{pivotRowSearch}"</span>
                  </div>
                )}
                <table className="border-collapse text-xs" style={{ minWidth: '100%', display: visibleRows.length === 0 ? 'none' : undefined }}>
                  <thead>
                    {/* ── Header row 0 ── */}
                    <tr>
                      <th className="sticky left-0 top-0 z-30 min-w-[260px] border-b border-r border-gray-100 bg-gray-50 px-4 py-3 text-left align-bottom">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#b20202]">
                          {pivotRowDims.map(d => ALL_GROUP_ITEMS.find(g => g.key === d)?.label ?? d).join(' › ')}
                        </div>
                      </th>
                      <th className="sticky top-0 z-20 min-w-[120px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-right align-bottom">
                        <div className="text-xs font-bold text-gray-700">Total</div>
                        <div className="mt-0.5 text-[10px] tabular-nums text-gray-500">{fmtMeasureVal(p.grandTotal, measure)}</div>
                        {pivotShowOrders && <div className="text-[10px] text-gray-300">{p.getOrderCount([], [])} ord</div>}
                      </th>
                      {p.colVals0.map(ck => {
                        const isExpanded = canExpandCol && expandedCols.has(ck);
                        const subCols = isExpanded ? (p.subColValsMap[ck] ?? []) : [];
                        const colSpan  = isExpanded ? subCols.length : 1;
                        return (
                          <th key={ck} colSpan={colSpan}
                            className="sticky top-0 z-20 min-w-[110px] border-b border-l border-gray-100 bg-white px-3 py-3 text-center align-bottom">
                            <div className="flex items-center justify-center gap-1">
                              {canExpandCol && (
                                <button onClick={() => toggleCol(ck)}
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]">
                                  {isExpanded ? '−' : '+'}
                                </button>
                              )}
                              <span className="font-semibold text-gray-700 leading-tight">{fmtDimKey(ck, pivotColDims[0])}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] tabular-nums text-gray-400">{fmtMeasureVal(p.colTotals[ck], measure)}</div>
                          </th>
                        );
                      })}
                    </tr>

                    {/* ── Header row 1: sub-col labels ── */}
                    {canExpandCol && expandedCols.size > 0 && (
                      <tr>
                        <th className="sticky left-0 top-[52px] z-30 border-b border-r border-gray-100 bg-gray-50" />
                        <th className="sticky top-[52px] z-20 border-b border-r border-gray-200 bg-gray-50" />
                        {p.colVals0.map(ck => {
                          if (!expandedCols.has(ck)) {
                            return <th key={ck} className="sticky top-[52px] z-20 min-w-[110px] border-b border-r border-gray-100 bg-white" />;
                          }
                          return (p.subColValsMap[ck] ?? []).map(sk => (
                            <th key={`${ck}:${sk}`}
                              className="sticky top-[52px] z-20 min-w-[100px] border-b border-r border-gray-100 bg-white px-3 py-2 text-right">
                              <span className="text-[11px] font-medium text-gray-600">{fmtDimKey(sk, pivotColDims[1])}</span>
                            </th>
                          ));
                        })}
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {/* ── Grand total row (pinned) ── */}
                    <tr className="border-b-2 border-gray-200 bg-gray-50/80">
                      <td className="sticky left-0 z-10 border-b-2 border-r border-gray-200 bg-gray-50 px-4 py-2.5">
                        <span className="text-xs font-bold text-gray-700">Total</span>
                      </td>
                      <DataCell rowPath={[]} colPath={[]} isTotal />
                      {visibleCols.map(({ colPath, isSubCol }) => (
                        <DataCell key={colPath.join(':')} rowPath={[]} colPath={colPath} isTotal={isSubCol} />
                      ))}
                    </tr>

                    {/* ── Data rows ── */}
                    {visibleRows.map((rk, ri) => {
                      const rowTotal      = p.rowTotals[rk];
                      const rowShare      = p.grandTotal > 0 ? (rowTotal / p.grandTotal) * 100 : 0;
                      const isRowExpanded = canExpandRow && expandedRows.has(rk);
                      const subRows       = isRowExpanded ? (p.subRowValsMap[rk] ?? []) : [];

                      return (
                        <Fragment key={rk}>
                          <tr className={ri % 2 === 0 ? 'bg-white hover:bg-gray-50/60' : 'bg-gray-50/30 hover:bg-gray-50/80'}>
                            <td className="sticky left-0 z-10 border-b border-r border-gray-100 px-4 py-2.5"
                              style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <div className="flex items-center gap-2">
                                {canExpandRow ? (
                                  <button onClick={() => toggleRow(rk)}
                                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]">
                                    {isRowExpanded ? '−' : '+'}
                                  </button>
                                ) : (
                                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-200 text-[10px] text-gray-300">□</span>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-800 leading-snug break-words" style={{ maxWidth: 220 }}>
                                    {fmtDimKey(rk, pivotRowDims[0])}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-1">
                                    <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-gray-100" style={{ width: 80 }}>
                                      <div className="h-full rounded-full bg-[#b20202] opacity-30" style={{ width: `${rowShare}%` }} />
                                    </div>
                                    <span className="text-[9px] text-gray-400">{rowShare.toFixed(1)}%</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <DataCell rowPath={[rk]} colPath={[]} isTotal />
                            {visibleCols.map(({ colPath, isSubCol }) => (
                              <DataCell key={colPath.join(':')} rowPath={[rk]} colPath={colPath} isTotal={isSubCol} />
                            ))}
                          </tr>

                          {/* ── Sub-rows (dim1 breakdown) ── */}
                          {subRows.map(srk => (
                            <tr key={`${rk}:${srk}`} className="bg-[#fafbff] hover:bg-blue-50/20">
                              <td className="sticky left-0 z-10 border-b border-r border-gray-100 bg-[#fafbff] px-4 py-2">
                                <div className="flex items-center gap-2 pl-7">
                                  <span className="h-px w-3 shrink-0 bg-gray-300" />
                                  <span className="text-gray-600 leading-snug break-words" style={{ maxWidth: 200 }}>
                                    {fmtDimKey(srk, pivotRowDims[1])}
                                  </span>
                                </div>
                              </td>
                              <DataCell rowPath={[rk, srk]} colPath={[]} isTotal />
                              {visibleCols.map(({ colPath, isSubCol }) => (
                                <DataCell key={colPath.join(':')} rowPath={[rk, srk]} colPath={colPath} isTotal={isSubCol} />
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>

                  {/* ── Column totals footer ── */}
                  {p.colVals0.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-700">Total</td>
                        <td className="border-r border-gray-200 bg-gray-100 px-3 py-2.5 text-right tabular-nums">
                          <div className="text-sm font-bold text-gray-900">{fmtMeasureVal(p.grandTotal, measure)}</div>
                        </td>
                        {visibleCols.map(({ colPath }) => {
                          const val = cellVal([], colPath);
                          const pct = p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
                          return (
                            <td key={colPath.join(':')} className="border-r border-gray-100 bg-gray-50 px-3 py-2.5 text-right tabular-nums">
                              <div className="font-bold text-gray-800">{fmtMeasureVal(val, measure)}</div>
                              {pct > 0 && <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════
           GRAPH VIEW
          ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'graph' && <>

      {/* ── Main dynamic chart — full width, 100vh ─────────────────────── */}
      <div className="flex w-full flex-col border-y border-gray-100 bg-white shadow-sm" style={{ height: '70vh' }}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">
              <PiChartBar className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-gray-800">
              {measureLabel} by{' '}
              {groupByStack.length > 0
                ? groupByStack.map((g, i) => {
                    const lbl = ALL_GROUP_ITEMS.find(item => item.key === g)?.label ?? g;
                    return (
                      <Fragment key={g}>
                        {i > 0 && <span className="text-gray-400"> › </span>}
                        <span className={i === 0 ? 'text-emerald-700' : i === 1 ? 'text-teal-600' : 'text-violet-600'}>{lbl}</span>
                      </Fragment>
                    );
                  })
                : groupByLabel
              }
            </h3>
          </div>
          {multiSeriesData
            ? multiSeriesData.rows.length > 0 && (
                <span className="text-xs tabular-nums text-gray-400">
                  {fmtMeasureVal(multiSeriesData.rows.reduce((s, r) => s + r.__total__, 0), measure)} total
                </span>
              )
            : chartData.length > 0 && (
                <span className="text-xs tabular-nums text-gray-400">
                  {fmtMeasureVal(chartData.reduce((s, r) => s + r.value, 0), measure)} total
                </span>
              )
          }
        </div>
        <div className="min-h-0 flex-1 p-5">
          {multiSeriesData
            ? <StackedChart rows={multiSeriesData.rows} series={multiSeriesData.series} measure={measure} chartType={chartType} className="h-full"
                orderMap={multiSeriesData.orderMap} groupBy={groupBy}
                onBarClick={(rowLabel, seriesKey, orders) =>
                  setDrillData({ orders, title: seriesKey ? `${rowLabel} — ${seriesKey}` : rowLabel })
                } />
            : <MainChart data={chartData} measure={measure} chartType={chartType} effectiveGroupBy={effectiveGroupBy} className="h-full"
                onBarClick={(label, orders) => setDrillData({ orders, title: label })} />
          }
        </div>
      </div>

      {/* ── Secondary analytics ─────────────────────────────────────────── */}
      <div className="space-y-5 px-6 py-5">

        {/* ── KPI cards — 6 metrics ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={<PiCurrencyNgn className="h-5 w-5" />}
            label="Net Revenue"
            value={fmtCompact(analytics.totalRevenue)}
            sub={analytics.grossRevenue !== analytics.totalRevenue
              ? `Gross ${fmtCompact(analytics.grossRevenue)}`
              : formatCurrency(analytics.totalRevenue)}
          />
          <KpiCard
            icon={<PiShoppingCart className="h-5 w-5" />}
            label="Total Orders"
            value={analytics.totalOrders.toLocaleString()}
            sub={analytics.uniqueCustomers > 0
              ? `${analytics.uniqueCustomers} unique customer${analytics.uniqueCustomers !== 1 ? 's' : ''}`
              : 'non-voided orders'}
            accentColor="#4f46e5"
          />
          <KpiCard
            icon={<PiTrendUp className="h-5 w-5" />}
            label="Avg Order Value"
            value={fmtCompact(analytics.avgOrder)}
            sub={formatCurrency(analytics.avgOrder)}
            accentColor="#059669"
          />
          <KpiCard
            icon={<PiPackage className="h-5 w-5" />}
            label="Items Sold"
            value={analytics.itemsSold.toLocaleString()}
            sub={`${analytics.avgItemsPerOrder.toFixed(1)} per order`}
            accentColor="#f97316"
          />
          <KpiCard
            icon={<PiTag className="h-5 w-5" />}
            label="Discounts Given"
            value={fmtCompact(analytics.totalDiscount)}
            badge={analytics.discountRate > 0 ? `${analytics.discountRate.toFixed(1)}% of gross` : undefined}
            sub={analytics.totalDiscount === 0 ? 'None applied' : formatCurrency(analytics.totalDiscount)}
            accentColor="#eab308"
          />
          <KpiCard
            icon={<PiArrowCounterClockwise className="h-5 w-5" />}
            label="Refunds"
            value={fmtCompact(analytics.totalRefunds)}
            badge={analytics.refundRate > 0 ? `${analytics.refundRate.toFixed(1)}% rate` : undefined}
            sub={analytics.totalRefunds === 0 ? 'None issued' : formatCurrency(analytics.totalRefunds)}
            accentColor="#ef4444"
          />
        </div>

        {/* ── Payment methods + Order status ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Payment Methods — inline bar list */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">
                  <PiReceipt className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-gray-800">Revenue by Payment Method</h3>
              </div>
              <span className="text-xs tabular-nums text-gray-400">
                {analytics.methodData.reduce((s, m) => s + m.count, 0)} transactions
              </span>
            </div>
            {analytics.methodData.length === 0 ? (
              <p className="mt-6 text-center text-sm text-gray-400">No data</p>
            ) : (() => {
              const totalRev = analytics.methodData.reduce((s, m) => s + m.revenue, 0);
              return (
                <div className="mt-4 space-y-3">
                  {analytics.methodData.map((m, i) => {
                    const pct = totalRev > 0 ? (m.revenue / totalRev) * 100 : 0;
                    return (
                      <div key={m.method}>
                        <div className="mb-1.5 flex items-center gap-2 text-xs">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                          <span className="flex-1 font-medium text-gray-700">{m.name}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                            {m.count} txn{m.count !== 1 ? 's' : ''}
                          </span>
                          <span className="w-[5.5rem] text-right tabular-nums font-semibold text-gray-800">
                            {formatCurrency(m.revenue)}
                          </span>
                          <span className="w-9 text-right tabular-nums text-gray-400">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                    <span className="font-semibold text-gray-500">Total</span>
                    <span className="tabular-nums font-bold text-gray-900">{formatCurrency(totalRev)}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Order Status — stat cards */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <SectionHeader icon={<PiChartBar className="h-4 w-4" />} title="Order Status Breakdown" />
            {analytics.statusData.length === 0 ? (
              <p className="mt-6 text-center text-sm text-gray-400">No data</p>
            ) : (() => {
              const statusTotal = analytics.statusData.reduce((acc, x) => acc + x.value, 0);
              const STATUS_COLORS = ['#22c55e', '#f97316', '#94a3b8'];
              return (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {analytics.statusData.map((s, i) => {
                      const pct = statusTotal > 0 ? Math.round((s.value / statusTotal) * 100) : 0;
                      return (
                        <div key={s.name} className="rounded-xl border p-3 text-center"
                          style={{ borderColor: `${STATUS_COLORS[i]}35`, backgroundColor: `${STATUS_COLORS[i]}08` }}>
                          <p className="text-2xl font-bold tabular-nums" style={{ color: STATUS_COLORS[i] }}>
                            {s.value.toLocaleString()}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-gray-600">{s.name}</p>
                          <p className="mt-0.5 text-[10px] font-semibold" style={{ color: STATUS_COLORS[i] }}>{pct}%</p>
                          {s.revenue > 0 && (
                            <p className="mt-1 text-[10px] tabular-nums text-gray-400">{formatCurrency(s.revenue)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Stacked bar */}
                  <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full">
                    {analytics.statusData.map((s, i) => {
                      const pct = statusTotal > 0 ? (s.value / statusTotal) * 100 : 0;
                      return (
                        <div key={s.name} className="h-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: STATUS_COLORS[i] }} />
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">{statusTotal.toLocaleString()} total orders</p>
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Top products ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">
                <PiPackage className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-gray-800">Top Products by Revenue</h3>
            </div>
            {analytics.topProducts.length > 0 && (
              <span className="text-xs tabular-nums text-gray-400">
                top {analytics.topProducts.length} of {Object.keys(analytics.topProducts).length > 0 ? 'many' : '0'} products
              </span>
            )}
          </div>
          {analytics.topProducts.length === 0 ? (
            <p className="mt-6 text-center text-sm text-gray-400">No product data available</p>
          ) : (
            <div className="mt-4 space-y-1">
              {analytics.topProducts.map((p, i) => {
                const maxRev  = analytics.topProducts[0].revenue;
                const pct     = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0;
                const meta    = prodMeta[p.name.split(' · ')[0]];
                const avgUnit = p.qty > 0 ? p.revenue / p.qty : 0;
                const MEDALS  = ['🥇', '🥈', '🥉'];
                return (
                  <div key={p.name} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center text-base leading-none">
                      {i < 3
                        ? <span>{MEDALS[i]}</span>
                        : <span className="text-xs font-bold tabular-nums text-gray-400">{i + 1}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-gray-800">{p.name}</span>
                        <span className="shrink-0 tabular-nums text-sm font-bold text-gray-900">
                          {formatCurrency(p.revenue)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                        {meta?.catName && (
                          <span className="flex items-center gap-0.5"><PiTag className="h-3 w-3" />{meta.catName}</span>
                        )}
                        {meta?.brandName && (
                          <span className="flex items-center gap-0.5"><PiStorefront className="h-3 w-3" />{meta.brandName}</span>
                        )}
                        <span className="ml-auto shrink-0">
                          {p.qty.toLocaleString()} sold · avg {formatCurrency(avgUnit)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-[#b20202] transition-all duration-500"
                          style={{ width: `${pct}%`, opacity: Math.max(0.35, 1 - i * 0.055) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sales by Day of Week ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">
                <PiChartBar className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-gray-800">Sales by Day of Week</h3>
            </div>
            {(() => {
              const peak = analytics.dayOfWeekData.reduce((b, d) => d.revenue > b.revenue ? d : b, analytics.dayOfWeekData[0]);
              return peak?.orders > 0
                ? <span className="text-xs text-gray-400">Best day: <span className="font-semibold text-gray-700">{peak.day}</span> · {fmtCompact(peak.revenue)}</span>
                : null;
            })()}
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {(() => {
              const maxRev = Math.max(...analytics.dayOfWeekData.map(d => d.revenue), 1);
              const maxOrd = Math.max(...analytics.dayOfWeekData.map(d => d.orders), 1);
              return analytics.dayOfWeekData.map((d, i) => {
                const revPct = (d.revenue / maxRev) * 100;
                const ordPct = (d.orders / maxOrd) * 100;
                const isWeekend = i === 0 || i === 6;
                const isPeak = d.revenue === maxRev && d.orders > 0;
                return (
                  <div key={d.day} className="group flex flex-col items-center gap-1">
                    {/* Revenue bar */}
                    <div className="relative flex h-24 w-full items-end overflow-hidden rounded-lg bg-gray-50">
                      <div className="w-full rounded-t-sm transition-all duration-500"
                        style={{
                          height: `${Math.max(revPct, 4)}%`,
                          background: isPeak
                            ? '#b20202'
                            : isWeekend
                              ? 'rgba(178,2,2,0.55)'
                              : 'rgba(178,2,2,0.30)',
                        }} />
                      {isPeak && (
                        <span className="absolute top-1 right-0 left-0 text-center text-[8px] font-bold text-[#b20202]">★</span>
                      )}
                    </div>
                    {/* Orders dot */}
                    <div className="flex h-2.5 w-full items-center justify-center">
                      <div className="rounded-full bg-indigo-400 transition-all duration-500"
                        style={{ width: `${Math.max(ordPct * 0.7, 10)}%`, height: 6 }} />
                    </div>
                    <span className={`text-[11px] font-semibold ${isPeak ? 'text-[#b20202]' : isWeekend ? 'text-gray-600' : 'text-gray-400'}`}>
                      {d.day}
                    </span>
                    <span className="text-[10px] tabular-nums text-gray-400">{d.orders}</span>
                  </div>
                );
              });
            })()}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#b20202] opacity-40" />
              Revenue (bar height)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-indigo-400" />
              Order volume (strip width)
            </span>
          </div>
        </div>

        {/* ── Peak hours + Cashier performance ──────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Peak Hours */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">
                  <PiClock className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-gray-800">Peak Hours</h3>
              </div>
              {(() => {
                const peak = analytics.hourData.reduce((b, h) => h.orders > b.orders ? h : b, analytics.hourData[0]);
                return peak?.orders > 0
                  ? <span className="text-xs text-gray-400">Peak at <span className="font-semibold text-gray-700">{peak.hour}</span> · {peak.orders} orders</span>
                  : null;
              })()}
            </div>
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.hourData} barSize={9}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  className="[&_.recharts-cartesian-grid-vertical]:opacity-0">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: '#94a3b8' }} interval={2} dy={4} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      name === 'revenue' ? formatCurrency(v) : v,
                      name === 'revenue' ? 'Revenue' : 'Orders',
                    ]}
                    labelFormatter={(l) => `Hour ${l}`}
                    contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }} />
                  <Bar dataKey="orders" name="orders" radius={[3, 3, 0, 0]}>
                    {(() => {
                      const maxOrd = Math.max(...analytics.hourData.map(h => h.orders), 1);
                      return analytics.hourData.map((d, i) => (
                        <Cell key={i} fill={`rgba(178,2,2,${0.12 + (d.orders / maxOrd) * 0.88})`} />
                      ));
                    })()}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cashier Performance */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b20202]">
                  <PiUsers className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-gray-800">Cashier Performance</h3>
              </div>
              {analytics.cashierData.length > 0 && (
                <span className="text-xs text-gray-400">{analytics.cashierData.length} cashier{analytics.cashierData.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {analytics.cashierData.length === 0 ? (
              <p className="mt-6 text-center text-sm text-gray-400">No data</p>
            ) : (
              <div className="mt-4 space-y-1">
                {analytics.cashierData.slice(0, 8).map((c, i) => {
                  const maxRev  = analytics.cashierData[0].revenue;
                  const pct     = maxRev > 0 ? (c.revenue / maxRev) * 100 : 0;
                  const MEDALS  = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={c.name} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center text-base leading-none">
                        {i < 3
                          ? <span>{MEDALS[i]}</span>
                          : <span className="text-xs font-bold tabular-nums text-gray-400">{i + 1}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-gray-800">{c.name}</span>
                          <span className="shrink-0 tabular-nums text-sm font-bold text-gray-900">
                            {formatCurrency(c.revenue)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-gray-400">
                          <span>{c.orders} order{c.orders !== 1 ? 's' : ''}</span>
                          <span>avg {formatCurrency(c.avgOrder)}/order</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>{/* end secondary analytics */}

      </>}{/* end graph view */}

      {/* ── Drill-down drawer ─────────────────────────────────────────── */}
      {drillData && (
        <OrderDrillDrawer
          orders={drillData.orders}
          title={drillData.title}
          measure={measure}
          onClose={() => setDrillData(null)}
        />
      )}

    </div>
  );
}
