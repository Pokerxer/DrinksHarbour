'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  PiArrowsClockwise, PiCurrencyNgn, PiShoppingCart, PiTag,
  PiArrowUp, PiArrowDown, PiArrowsDownUp, PiDownloadSimple, PiX,
  PiMagnifyingGlass, PiCaretLeft, PiCaretRight, PiPercent,
  PiTrendUp, PiList, PiRows,
} from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  sizeCostPrice?: number;
}

interface PosOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  isVoided?: boolean;
  placedAt: string;
  createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  items?: OrderItem[];
}

interface LineRow {
  orderId: string;
  orderNumber: string;
  receiptNumber: string;
  date: string;        // ISO
  cashier: string;
  product: string;
  variant: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;    // net after discount
  gross: number;       // unitPrice × qty
  costPrice: number;   // sizeCostPrice × qty (0 if unknown)
  profit: number;      // subtotal – costPrice (0 if unknown)
  paymentMethod: string;
  isVoided: boolean;
}

type LineSortField = keyof Pick<
  LineRow,
  'date' | 'orderNumber' | 'cashier' | 'product' | 'variant' |
  'qty' | 'unitPrice' | 'discount' | 'subtotal' | 'gross' | 'profit' | 'paymentMethod'
>;

interface GroupRow {
  key: string;
  qty: number;
  gross: number;
  discount: number;
  revenue: number;    // net
  profit: number;
  lineCount: number;
  orderCount: number; // distinct orders in this group
  share: number;      // % of total net revenue (0–100)
}

type GroupSortField = 'key' | 'qty' | 'revenue' | 'gross' | 'discount' | 'profit' | 'lineCount' | 'orderCount' | 'share';
type GroupByKey = 'product' | 'cashier' | 'payment_method' | 'date' | 'variant';
type ViewMode = 'lines' | 'grouped';

const PAGE_SIZE = 50;

// ── Constants ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card/POS',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  split: 'Split',
  other: 'Other',
};

const METHOD_COLOR: Record<string, string> = {
  cash: 'bg-green-50 text-green-700',
  card: 'bg-blue-50 text-blue-700',
  bank_transfer: 'bg-purple-50 text-purple-700',
  mobile_money: 'bg-yellow-50 text-yellow-700',
  split: 'bg-orange-50 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch { return true; }
}

function dateKey(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 10); }
  catch { return iso; }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// Quick date preset helpers
function todayStr()     { return new Date().toISOString().slice(0, 10); }
function offsetDay(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function startOfLastMonth() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}
function endOfLastMonth() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  return d.toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: 'Today',       from: () => todayStr(),       to: () => todayStr() },
  { label: 'Yesterday',   from: () => offsetDay(-1),    to: () => offsetDay(-1) },
  { label: 'Last 7 days', from: () => offsetDay(-6),    to: () => todayStr() },
  { label: 'This week',   from: () => startOfWeek(),    to: () => todayStr() },
  { label: 'This month',  from: () => startOfMonth(),   to: () => todayStr() },
  { label: 'Last month',  from: () => startOfLastMonth(), to: () => endOfLastMonth() },
];

function exportLineCsv(rows: LineRow[], hasCost: boolean) {
  const headers = [
    'Date/Time', 'Order #', 'Receipt', 'Cashier', 'Product', 'Variant',
    'Qty', 'Unit Price', 'Gross', 'Discount', 'Net Total',
    ...(hasCost ? ['Cost', 'Profit', 'Margin %'] : []),
    'Payment Method', 'Voided',
  ];
  const lines = rows.map(r => {
    const margin = r.profit > 0 && r.subtotal > 0 ? ((r.profit / r.subtotal) * 100).toFixed(1) + '%' : '—';
    return [
      fmtDateTime(r.date),
      r.orderNumber, r.receiptNumber,
      `"${r.cashier}"`,
      `"${r.product}"`, `"${r.variant}"`,
      r.qty,
      r.unitPrice.toFixed(2),
      r.gross.toFixed(2),
      r.discount.toFixed(2),
      r.subtotal.toFixed(2),
      ...(hasCost ? [r.costPrice.toFixed(2), r.profit.toFixed(2), margin] : []),
      METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod,
      r.isVoided ? 'Yes' : 'No',
    ].join(',');
  });
  triggerCsvDownload([headers.join(','), ...lines].join('\n'), 'sales-details');
}

function exportGroupedCsv(rows: GroupRow[], groupLabel: string, hasCost: boolean) {
  const headers = [
    groupLabel, 'Qty Sold', 'Gross Revenue', 'Discount', 'Net Revenue',
    ...(hasCost ? ['Profit', 'Margin %'] : []),
    'Line Count', 'Distinct Orders', 'Revenue Share %',
  ];
  const lines = rows.map(r => {
    const margin = r.profit > 0 && r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) + '%' : '—';
    return [
      `"${r.key}"`, r.qty,
      r.gross.toFixed(2), r.discount.toFixed(2), r.revenue.toFixed(2),
      ...(hasCost ? [r.profit.toFixed(2), margin] : []),
      r.lineCount, r.orderCount, r.share.toFixed(1) + '%',
    ].join(',');
  });
  triggerCsvDownload([headers.join(','), ...lines].join('\n'), 'sales-grouped');
}

function triggerCsvDownload(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function POSSalesDetails() {
  const { data: session, status: sessionStatus } = useSession();
  const token = useMemo(() => {
    const t = (session?.user as { token?: string })?.token ?? null;
    return isTokenExpired(t) ? null : t;
  }, [session]);

  const [orders, setOrders]     = useState<PosOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [truncated, setTruncated] = useState(false); // true when exactly 500 returned

  // Filters
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [activePreset, setActivePreset]   = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [methodFilter, setMethodFilter]   = useState('');
  const [showVoided, setShowVoided]       = useState(false);
  const [search, setSearch]               = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Sort (line view)
  const [lineSortField, setLineSortField] = useState<LineSortField>('date');
  const [lineSortDir, setLineSortDir]     = useState<'asc' | 'desc'>('desc');

  // Sort (grouped view)
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('revenue');
  const [groupSortDir, setGroupSortDir]     = useState<'asc' | 'desc'>('desc');

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('lines');
  const [groupBy, setGroupBy]   = useState<GroupByKey>('product');
  const [showProfit, setShowProfit] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  const fetchOrders = useCallback((all = false) => {
    if (sessionStatus === 'loading') return;
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError('');
    posApi.getAllOrders(token, { limit: all ? 2000 : 500 })
      .then(data => {
        const rows = (data || []) as PosOrder[];
        setOrders(rows);
        setTruncated(!all && rows.length === 500);
      })
      .catch(() => setError('Failed to load orders. Please try again.'))
      .finally(() => setLoading(false));
  }, [token, sessionStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Reset to page 1 whenever filters/sort change
  useEffect(() => { setPage(1); }, [dateFrom, dateTo, cashierFilter, methodFilter, showVoided, search, lineSortField, lineSortDir]);

  // ── Build flat line rows ───────────────────────────────────────────────────

  const allRows = useMemo<LineRow[]>(() => {
    const rows: LineRow[] = [];
    for (const o of orders) {
      if (!o.items?.length) continue;
      const cashier = o.posStaff
        ? (o.posStaff.posName || `${o.posStaff.firstName} ${o.posStaff.lastName}`.trim())
        : 'Unknown';
      for (const item of o.items) {
        const gross     = item.priceAtPurchase * item.quantity;
        const discount  = item.discountAmount ?? 0;
        const subtotal  = item.itemSubtotal;
        const costPrice = (item.sizeCostPrice ?? 0) * item.quantity;
        const profit    = costPrice > 0 ? subtotal - costPrice : 0;
        rows.push({
          orderId:       o._id,
          orderNumber:   o.orderNumber ?? o._id.slice(-6).toUpperCase(),
          receiptNumber: o.receiptNumber ?? '',
          date:          o.placedAt || o.createdAt,
          cashier,
          product:       item.name,
          variant:       item.variant ?? '',
          qty:           item.quantity,
          unitPrice:     item.priceAtPurchase,
          discount,
          subtotal,
          gross,
          costPrice,
          profit,
          paymentMethod: o.paymentMethod,
          isVoided:      !!(o.isVoided || o.status === 'voided'),
        });
      }
    }
    return rows;
  }, [orders]);

  const hasCostData = useMemo(() => allRows.some(r => r.costPrice > 0), [allRows]);

  // Unique cashiers for dropdown
  const cashiers = useMemo(() => {
    return Array.from(new Set(allRows.map(r => r.cashier))).sort();
  }, [allRows]);

  // ── Apply filters ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(r => {
      if (!showVoided && r.isVoided) return false;
      if (cashierFilter && r.cashier !== cashierFilter) return false;
      if (methodFilter  && r.paymentMethod !== methodFilter) return false;
      if (dateFrom && dateKey(r.date) < dateFrom) return false;
      if (dateTo   && dateKey(r.date) > dateTo)   return false;
      if (q) {
        const haystack = `${r.product} ${r.variant} ${r.cashier} ${r.orderNumber} ${r.receiptNumber}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, showVoided, cashierFilter, methodFilter, dateFrom, dateTo, search]);

  // ── Sort (line view) ──────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[lineSortField] as string | number;
      const bv = b[lineSortField] as string | number;
      if (typeof av === 'number' && typeof bv === 'number') {
        return lineSortDir === 'asc' ? av - bv : bv - av;
      }
      return lineSortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, lineSortField, lineSortDir]);

  // ── Grouped rows ──────────────────────────────────────────────────────────

  const grouped = useMemo<GroupRow[]>(() => {
    const totalRev = filtered.reduce((s, r) => s + r.subtotal, 0);
    const map = new Map<string, { row: GroupRow; orderIds: Set<string> }>();

    for (const r of filtered) {
      const key =
        groupBy === 'product'        ? (r.product + (r.variant ? ` (${r.variant})` : '')) :
        groupBy === 'variant'        ? (r.variant || '(no variant)') :
        groupBy === 'cashier'        ? r.cashier :
        groupBy === 'payment_method' ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) :
        /* date */                     fmtDate(r.date);

      const entry = map.get(key);
      if (entry) {
        entry.row.qty       += r.qty;
        entry.row.gross     += r.gross;
        entry.row.discount  += r.discount;
        entry.row.revenue   += r.subtotal;
        entry.row.profit    += r.profit;
        entry.row.lineCount += 1;
        entry.orderIds.add(r.orderId);
      } else {
        map.set(key, {
          row: {
            key, qty: r.qty, gross: r.gross, discount: r.discount,
            revenue: r.subtotal, profit: r.profit, lineCount: 1, orderCount: 0, share: 0,
          },
          orderIds: new Set([r.orderId]),
        });
      }
    }

    const rows: GroupRow[] = Array.from(map.entries()).map(([, { row, orderIds }]) => ({
      ...row,
      orderCount: orderIds.size,
      share: totalRev > 0 ? (row.revenue / totalRev) * 100 : 0,
    }));

    return rows.sort((a, b) => {
      const av = a[groupSortField] as number | string;
      const bv = b[groupSortField] as number | string;
      if (typeof av === 'number' && typeof bv === 'number') {
        return groupSortDir === 'asc' ? av - bv : bv - av;
      }
      return groupSortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, groupBy, groupSortField, groupSortDir]);

  // ── Summary ────────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const revenue   = filtered.reduce((s, r) => s + r.subtotal, 0);
    const items     = filtered.reduce((s, r) => s + r.qty, 0);
    const discount  = filtered.reduce((s, r) => s + r.discount, 0);
    const gross     = filtered.reduce((s, r) => s + r.gross, 0);
    const profit    = filtered.reduce((s, r) => s + r.profit, 0);
    const orderIds  = new Set(filtered.map(r => r.orderId));
    const orders    = orderIds.size;
    const avgOrder  = orders > 0 ? revenue / orders : 0;
    return { revenue, items, discount, gross, profit, orders, avgOrder };
  }, [filtered]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Sort helpers ───────────────────────────────────────────────────────────

  function toggleLineSort(field: LineSortField) {
    if (lineSortField === field) setLineSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setLineSortField(field); setLineSortDir(field === 'date' ? 'desc' : 'asc'); }
  }

  function toggleGroupSort(field: GroupSortField) {
    if (groupSortField === field) setGroupSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setGroupSortField(field); setGroupSortDir('desc'); }
  }

  function SortChevron({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
    if (!active) return <PiArrowsDownUp className="h-3 w-3 text-gray-350 opacity-50" />;
    return dir === 'asc'
      ? <PiArrowUp className="h-3 w-3 text-[#b20202]" />
      : <PiArrowDown className="h-3 w-3 text-[#b20202]" />;
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    setDateFrom(preset.from());
    setDateTo(preset.to());
    setActivePreset(preset.label);
  }

  function clearFilters() {
    setDateFrom(''); setDateTo(''); setActivePreset('');
    setCashierFilter(''); setMethodFilter('');
    setShowVoided(false); setSearch('');
  }

  const hasFilters = dateFrom || dateTo || cashierFilter || methodFilter || showVoided || search;

  // ── Group label ────────────────────────────────────────────────────────────

  const groupLabel =
    groupBy === 'product'        ? 'Product / Variant' :
    groupBy === 'variant'        ? 'Variant' :
    groupBy === 'cashier'        ? 'Cashier' :
    groupBy === 'payment_method' ? 'Payment Method' :
    'Date';

  // ── Export ─────────────────────────────────────────────────────────────────

  function handleExport() {
    if (viewMode === 'grouped') exportGroupedCsv(grouped, groupLabel, hasCostData && showProfit);
    else exportLineCsv(sorted, hasCostData && showProfit);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <POSNavHeader />

      <div className="mx-auto max-w-screen-2xl px-4 py-6">

        {/* ── Page header ── */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Sales Details</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Line-item breakdown of all POS sales
              {orders.length > 0 && (
                <span className="ml-1 text-gray-400">
                  — {orders.length.toLocaleString()} order{orders.length !== 1 ? 's' : ''} loaded
                  {truncated && (
                    <button
                      type="button"
                      onClick={() => fetchOrders(true)}
                      className="ml-2 text-[#b20202] underline hover:no-underline"
                    >
                      Load all
                    </button>
                  )}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchOrders()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={(viewMode === 'lines' ? sorted.length : grouped.length) === 0}
              className="flex items-center gap-1.5 rounded-md bg-[#b20202] px-3 py-1.5 text-sm text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiDownloadSimple className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: PiCurrencyNgn,  label: 'Gross Revenue',   value: formatCurrency(summary.gross),    sub: `before ${formatCurrency(summary.discount)} disc.`, color: 'text-gray-500' },
            { icon: PiTrendUp,      label: 'Net Revenue',      value: formatCurrency(summary.revenue),  sub: 'after discounts',                                   color: 'text-green-600' },
            { icon: PiTag,          label: 'Total Discount',   value: formatCurrency(summary.discount), sub: summary.gross > 0 ? `${((summary.discount / summary.gross) * 100).toFixed(1)}% of gross` : '', color: 'text-orange-500' },
            { icon: PiShoppingCart, label: 'Items Sold',       value: summary.items.toLocaleString(),   sub: `${filtered.length} line${filtered.length !== 1 ? 's' : ''}`, color: 'text-blue-600' },
            { icon: PiRows,         label: 'Distinct Orders',  value: summary.orders.toLocaleString(),  sub: `avg ${formatCurrency(summary.avgOrder)}/order`,     color: 'text-purple-600' },
            ...(hasCostData
              ? [{ icon: PiPercent, label: 'Est. Profit', value: formatCurrency(summary.profit), sub: summary.revenue > 0 ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}% margin` : '', color: 'text-teal-600' }]
              : [{ icon: PiCurrencyNgn, label: 'Avg Order Value', value: formatCurrency(summary.avgOrder), sub: `across ${summary.orders} orders`, color: 'text-indigo-500' }]
            ),
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-3.5">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <p className="mt-1.5 text-base font-semibold text-gray-900 leading-tight">{value}</p>
              {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Filters row ── */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 space-y-3">

          {/* Quick date presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 mr-1">Quick:</span>
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                  activePreset === preset.label
                    ? 'bg-[#b20202] text-white'
                    : 'border border-gray-200 text-gray-600 hover:border-[#b20202] hover:text-[#b20202]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Detailed filters */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Date range */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setActivePreset(''); }}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              />
            </div>

            {/* Cashier */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Cashier</label>
              <select
                value={cashierFilter}
                onChange={e => setCashierFilter(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              >
                <option value="">All cashiers</option>
                {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Payment method */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Payment</label>
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              >
                <option value="">All methods</option>
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Include voided */}
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={e => setShowVoided(e.target.checked)}
                className="accent-[#b20202]"
              />
              Include voided
            </label>

            {/* Show profit */}
            {hasCostData && (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={showProfit}
                  onChange={e => setShowProfit(e.target.checked)}
                  className="accent-[#b20202]"
                />
                Show profit
              </label>
            )}

            {/* Clear filters */}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-[#b20202] hover:bg-red-100"
              >
                <PiX className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}

            {/* View toggle (right-aligned) */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="flex rounded-md border border-gray-200 bg-gray-50">
                {(['lines', 'grouped'] as ViewMode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === m
                        ? 'rounded-md bg-[#b20202] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {m === 'lines' ? <><PiList className="h-3.5 w-3.5" />Line Items</> : <><PiRows className="h-3.5 w-3.5" />Grouped</>}
                  </button>
                ))}
              </div>

              {viewMode === 'grouped' && (
                <select
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value as GroupByKey)}
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
                >
                  <option value="product">By Product</option>
                  <option value="variant">By Variant</option>
                  <option value="cashier">By Cashier</option>
                  <option value="payment_method">By Payment</option>
                  <option value="date">By Date</option>
                </select>
              )}
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product, cashier, order #…"
              className="w-full rounded-md border border-gray-200 py-1.5 pl-9 pr-8 text-sm focus:border-[#b20202] focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          /* Skeleton */
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b border-gray-50 px-4 py-3">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div key={j} className="h-4 flex-1 animate-pulse rounded bg-gray-100" style={{ maxWidth: j === 0 ? 90 : undefined }} />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
            {error}
            <button onClick={() => fetchOrders()} className="ml-3 underline">Retry</button>
          </div>
        ) : viewMode === 'lines' ? (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
                      {(
                        [
                          { field: 'date'          as LineSortField, label: 'Date/Time',     align: 'text-left'   },
                          { field: 'orderNumber'   as LineSortField, label: 'Order #',       align: 'text-left'   },
                          { field: 'cashier'       as LineSortField, label: 'Cashier',       align: 'text-left'   },
                          { field: 'product'       as LineSortField, label: 'Product',       align: 'text-left'   },
                          { field: 'variant'       as LineSortField, label: 'Variant',       align: 'text-left'   },
                          { field: 'qty'           as LineSortField, label: 'Qty',           align: 'text-center' },
                          { field: 'unitPrice'     as LineSortField, label: 'Unit Price',    align: 'text-right'  },
                          { field: 'gross'         as LineSortField, label: 'Gross',         align: 'text-right'  },
                          { field: 'discount'      as LineSortField, label: 'Discount',      align: 'text-right'  },
                          { field: 'subtotal'      as LineSortField, label: 'Net Total',     align: 'text-right'  },
                          ...(showProfit && hasCostData
                            ? [{ field: 'profit' as LineSortField, label: 'Profit', align: 'text-right' }]
                            : []
                          ),
                          { field: 'paymentMethod' as LineSortField, label: 'Payment',       align: 'text-left'   },
                        ]
                      ).map(({ field, label, align }) => (
                        <th
                          key={field}
                          onClick={() => toggleLineSort(field)}
                          className={`cursor-pointer select-none px-4 py-3 ${align} hover:text-gray-700`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <SortChevron active={lineSortField === field} dir={lineSortDir} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-16 text-center text-sm text-gray-400">
                          {allRows.length === 0
                            ? 'No sales data found. Try refreshing.'
                            : 'No line items match the current filters.'}
                        </td>
                      </tr>
                    ) : (
                      paginated.map((row, i) => (
                        <tr
                          key={`${row.orderId}-${i}`}
                          className={`border-b border-gray-50 transition-colors hover:bg-gray-50/60 ${
                            row.isVoided ? 'opacity-40' : ''
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                            {fmtDateTime(row.date)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span className="font-mono text-xs font-medium text-gray-800">{row.orderNumber}</span>
                            {row.isVoided && (
                              <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                VOID
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-700">{row.cashier}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[180px] truncate">{row.product}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-500">{row.variant || '—'}</td>
                          <td className="px-4 py-2.5 text-center text-sm text-gray-700 tabular-nums">{row.qty}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-700 tabular-nums">
                            {formatCurrency(row.unitPrice)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500 tabular-nums">
                            {formatCurrency(row.gross)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                            {row.discount > 0
                              ? <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                            {formatCurrency(row.subtotal)}
                          </td>
                          {showProfit && hasCostData && (
                            <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                              {row.profit > 0 ? (
                                <span className="text-teal-600">{formatCurrency(row.profit)}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${METHOD_COLOR[row.paymentMethod] ?? 'bg-gray-100 text-gray-600'}`}>
                              {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {sorted.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                        <td colSpan={5} className="px-4 py-3 text-gray-500">
                          Page {page} / {totalPages} — {sorted.length} line{sorted.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {sorted.reduce((s, r) => s + r.qty, 0)}
                        </td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(sorted.reduce((s, r) => s + r.gross, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-500 tabular-nums">
                          −{formatCurrency(sorted.reduce((s, r) => s + r.discount, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-[#b20202] tabular-nums">
                          {formatCurrency(sorted.reduce((s, r) => s + r.subtotal, 0))}
                        </td>
                        {showProfit && hasCostData && (
                          <td className="px-4 py-3 text-right text-teal-600 tabular-nums">
                            {formatCurrency(sorted.reduce((s, r) => s + r.profit, 0))}
                          </td>
                        )}
                        <td className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <PiCaretLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    // Show pages around current
                    let p: number;
                    if (totalPages <= 7) p = i + 1;
                    else if (page <= 4) p = i + 1;
                    else if (page >= totalPages - 3) p = totalPages - 6 + i;
                    else p = page - 3 + i;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-[32px] rounded-md border px-2 py-1 text-xs ${
                          page === p
                            ? 'border-[#b20202] bg-[#b20202] text-white'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <PiCaretRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Grouped view ── */
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
                    {(
                      [
                        { field: 'key'        as GroupSortField, label: groupLabel,        align: 'text-left'   },
                        { field: 'qty'        as GroupSortField, label: 'Qty Sold',        align: 'text-center' },
                        { field: 'gross'      as GroupSortField, label: 'Gross Revenue',   align: 'text-right'  },
                        { field: 'discount'   as GroupSortField, label: 'Discount',        align: 'text-right'  },
                        { field: 'revenue'    as GroupSortField, label: 'Net Revenue',     align: 'text-right'  },
                        ...(showProfit && hasCostData
                          ? [{ field: 'profit' as GroupSortField, label: 'Profit', align: 'text-right' }]
                          : []
                        ),
                        { field: 'share'      as GroupSortField, label: 'Revenue Share',  align: 'text-left'   },
                        { field: 'lineCount'  as GroupSortField, label: 'Lines',          align: 'text-center' },
                        { field: 'orderCount' as GroupSortField, label: 'Orders',         align: 'text-center' },
                      ]
                    ).map(({ field, label, align }) => (
                      <th
                        key={field}
                        onClick={() => toggleGroupSort(field)}
                        className={`cursor-pointer select-none px-4 py-3 ${align} hover:text-gray-700`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <SortChevron active={groupSortField === field} dir={groupSortDir} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                        {allRows.length === 0 ? 'No sales data found.' : 'No data matches the current filters.'}
                      </td>
                    </tr>
                  ) : (
                    grouped.map(row => (
                      <tr key={row.key} className="border-b border-gray-50 transition-colors hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[220px] truncate">{row.key}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700 tabular-nums">{row.qty.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">{formatCurrency(row.gross)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.discount > 0
                            ? <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                          {formatCurrency(row.revenue)}
                        </td>
                        {showProfit && hasCostData && (
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {row.profit > 0
                              ? <span className="text-teal-600">{formatCurrency(row.profit)}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                        )}
                        <td className="px-4 py-2.5 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded-full bg-gray-100 h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#b20202]"
                                style={{ width: `${Math.min(100, row.share)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 tabular-nums w-10 text-right">
                              {row.share.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500 tabular-nums">{row.lineCount}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500 tabular-nums">{row.orderCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {grouped.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                      <td className="px-4 py-3 text-gray-500">{grouped.length} group{grouped.length !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{grouped.reduce((s, r) => s + r.qty, 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(grouped.reduce((s, r) => s + r.gross, 0))}</td>
                      <td className="px-4 py-3 text-right text-orange-500 tabular-nums">
                        −{formatCurrency(grouped.reduce((s, r) => s + r.discount, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-[#b20202] tabular-nums">
                        {formatCurrency(grouped.reduce((s, r) => s + r.revenue, 0))}
                      </td>
                      {showProfit && hasCostData && (
                        <td className="px-4 py-3 text-right text-teal-600 tabular-nums">
                          {formatCurrency(grouped.reduce((s, r) => s + r.profit, 0))}
                        </td>
                      )}
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-center tabular-nums">{grouped.reduce((s, r) => s + r.lineCount, 0)}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{new Set(filtered.map(r => r.orderId)).size}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── Truncation notice ── */}
        {truncated && !loading && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 flex items-center justify-between">
            <span>Showing first 500 orders only. Older data may be missing.</span>
            <button
              type="button"
              onClick={() => fetchOrders(true)}
              className="ml-4 font-medium underline hover:no-underline"
            >
              Load all orders
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
