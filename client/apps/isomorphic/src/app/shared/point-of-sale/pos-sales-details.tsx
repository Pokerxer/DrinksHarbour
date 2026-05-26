'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  PiArrowsClockwise, PiCurrencyNgn, PiShoppingCart, PiTag,
  PiArrowUp, PiArrowDown, PiArrowsDownUp, PiDownloadSimple, PiX,
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
  date: string;
  cashier: string;
  product: string;
  variant: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  paymentMethod: string;
  isVoided: boolean;
}

interface GroupRow {
  key: string;
  qty: number;
  revenue: number;
  discount: number;
  orders: number;
}

type SortField = keyof LineRow;
type GroupByKey = 'product' | 'cashier' | 'payment_method' | 'date';
type ViewMode = 'lines' | 'grouped';

// ── Helpers ────────────────────────────────────────────────────────────────────

function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (payload.exp ?? 0) * 1000 < Date.now();
  } catch { return true; }
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card/POS', bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money', split: 'Split', other: 'Other',
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function fmtDateInput(iso: string) {
  try { return new Date(iso).toISOString().slice(0, 10); }
  catch { return ''; }
}

function dateKey(iso: string) {
  try { return new Date(iso).toISOString().slice(0, 10); }
  catch { return iso; }
}

function exportCsv(rows: LineRow[]) {
  const headers = ['Date', 'Order #', 'Receipt', 'Cashier', 'Product', 'Variant', 'Qty', 'Unit Price', 'Discount', 'Subtotal', 'Payment Method', 'Voided'];
  const lines = rows.map(r => [
    fmtDate(r.date), r.orderNumber, r.receiptNumber, r.cashier,
    `"${r.product}"`, `"${r.variant}"`,
    r.qty, r.unitPrice.toFixed(2), r.discount.toFixed(2), r.subtotal.toFixed(2),
    METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod,
    r.isVoided ? 'Yes' : 'No',
  ].join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales-details-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [methodFilter, setMethodFilter]   = useState('');
  const [showVoided, setShowVoided]       = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');

  // View
  const [viewMode, setViewMode]   = useState<ViewMode>('lines');
  const [groupBy, setGroupBy]     = useState<GroupByKey>('product');

  const fetchOrders = useCallback(() => {
    if (sessionStatus === 'loading') return;
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError('');
    posApi.getAllOrders(token, { limit: 500 })
      .then(data => setOrders((data || []) as PosOrder[]))
      .catch(() => setError('Failed to load orders. Please try again.'))
      .finally(() => setLoading(false));
  }, [token, sessionStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Build flat line rows from orders
  const allRows = useMemo<LineRow[]>(() => {
    const rows: LineRow[] = [];
    for (const o of orders) {
      if (!o.items?.length) continue;
      const cashier = o.posStaff
        ? (o.posStaff.posName || `${o.posStaff.firstName} ${o.posStaff.lastName}`.trim())
        : 'Unknown';
      for (const item of o.items) {
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
          discount:      item.discountAmount ?? 0,
          subtotal:      item.itemSubtotal,
          paymentMethod: o.paymentMethod,
          isVoided:      !!(o.isVoided || o.status === 'voided'),
        });
      }
    }
    return rows;
  }, [orders]);

  // Unique cashiers for filter dropdown
  const cashiers = useMemo(() => {
    const s = new Set(allRows.map(r => r.cashier));
    return Array.from(s).sort();
  }, [allRows]);

  // Apply filters
  const filtered = useMemo(() => {
    return allRows.filter(r => {
      if (!showVoided && r.isVoided) return false;
      if (cashierFilter && r.cashier !== cashierFilter) return false;
      if (methodFilter && r.paymentMethod !== methodFilter) return false;
      if (dateFrom && dateKey(r.date) < dateFrom) return false;
      if (dateTo   && dateKey(r.date) > dateTo)   return false;
      return true;
    });
  }, [allRows, showVoided, cashierFilter, methodFilter, dateFrom, dateTo]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortField] as string | number;
      const bv = b[sortField] as string | number;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av), bs = String(bv);
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [filtered, sortField, sortDir]);

  // Grouped rows
  const grouped = useMemo<GroupRow[]>(() => {
    const map = new Map<string, GroupRow>();
    for (const r of filtered) {
      const key =
        groupBy === 'product'         ? r.product :
        groupBy === 'cashier'         ? r.cashier :
        groupBy === 'payment_method'  ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) :
        /* date */                      fmtDate(r.date);
      const existing = map.get(key);
      if (existing) {
        existing.qty      += r.qty;
        existing.revenue  += r.subtotal;
        existing.discount += r.discount;
        existing.orders   += 1;
      } else {
        map.set(key, { key, qty: r.qty, revenue: r.subtotal, discount: r.discount, orders: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, groupBy]);

  // Summary
  const summary = useMemo(() => ({
    revenue:  filtered.reduce((s, r) => s + r.subtotal,  0),
    items:    filtered.reduce((s, r) => s + r.qty,       0),
    discount: filtered.reduce((s, r) => s + r.discount,  0),
    orders:   new Set(filtered.map(r => r.orderId)).size,
  }), [filtered]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <PiArrowsDownUp className="h-3 w-3 text-gray-400" />;
    return sortDir === 'asc'
      ? <PiArrowUp className="h-3 w-3 text-[#b20202]" />
      : <PiArrowDown className="h-3 w-3 text-[#b20202]" />;
  }

  function clearFilters() {
    setDateFrom(''); setDateTo('');
    setCashierFilter(''); setMethodFilter('');
    setShowVoided(false);
  }
  const hasFilters = dateFrom || dateTo || cashierFilter || methodFilter || showVoided;

  return (
    <div className="min-h-screen bg-gray-50">
      <POSNavHeader />

      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        {/* Page header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Sales Details</h1>
            <p className="mt-0.5 text-sm text-gray-500">Line-item breakdown of all POS sales</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => exportCsv(sorted)}
              disabled={sorted.length === 0}
              className="flex items-center gap-1.5 rounded-md bg-[#b20202] px-3 py-1.5 text-sm text-white transition hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiDownloadSimple className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: PiCurrencyNgn, label: 'Net Revenue', value: formatCurrency(summary.revenue), color: 'text-green-600' },
            { icon: PiShoppingCart, label: 'Items Sold', value: summary.items.toLocaleString(), color: 'text-blue-600' },
            { icon: PiTag, label: 'Total Discount', value: formatCurrency(summary.discount), color: 'text-orange-500' },
            { icon: PiCurrencyNgn, label: 'Distinct Orders', value: summary.orders.toLocaleString(), color: 'text-purple-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <p className="mt-1.5 text-lg font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Cashier</label>
              <select
                value={cashierFilter}
                onChange={e => setCashierFilter(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              >
                <option value="">All cashiers</option>
                {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Payment</label>
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-[#b20202] focus:outline-none"
              >
                <option value="">All methods</option>
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={e => setShowVoided(e.target.checked)}
                className="accent-[#b20202]"
              />
              Include voided
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-[#b20202] hover:bg-red-100"
              >
                <PiX className="h-3.5 w-3.5" />
                Clear
              </button>
            )}

            {/* View toggle */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">View:</span>
              <div className="flex rounded-md border border-gray-200 bg-gray-50">
                {(['lines', 'grouped'] as ViewMode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      viewMode === m
                        ? 'rounded-md bg-[#b20202] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {m === 'lines' ? 'Line Items' : 'Grouped'}
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
                  <option value="cashier">By Cashier</option>
                  <option value="payment_method">By Payment</option>
                  <option value="date">By Date</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b20202] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
            {error}
            <button onClick={fetchOrders} className="ml-3 underline">Retry</button>
          </div>
        ) : viewMode === 'lines' ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
                    {(
                      [
                        { field: 'date' as SortField, label: 'Date' },
                        { field: 'orderNumber' as SortField, label: 'Order #' },
                        { field: 'cashier' as SortField, label: 'Cashier' },
                        { field: 'product' as SortField, label: 'Product' },
                        { field: 'variant' as SortField, label: 'Variant' },
                        { field: 'qty' as SortField, label: 'Qty' },
                        { field: 'unitPrice' as SortField, label: 'Unit Price' },
                        { field: 'discount' as SortField, label: 'Discount' },
                        { field: 'subtotal' as SortField, label: 'Net Total' },
                        { field: 'paymentMethod' as SortField, label: 'Payment' },
                      ] as { field: SortField; label: string }[]
                    ).map(({ field, label }) => (
                      <th
                        key={field}
                        onClick={() => toggleSort(field)}
                        className="cursor-pointer select-none px-4 py-3 text-left hover:text-gray-700"
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          <SortIcon field={field} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-sm text-gray-400">
                        No line items match the current filters.
                      </td>
                    </tr>
                  ) : (
                    sorted.map((row, i) => (
                      <tr
                        key={`${row.orderId}-${i}`}
                        className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                          row.isVoided ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{fmtDate(row.date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-gray-900">
                          {row.orderNumber}
                          {row.isVoided && (
                            <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                              VOID
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{row.cashier}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.product}</td>
                        <td className="px-4 py-3 text-gray-500">{row.variant || '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{row.qty}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">{formatCurrency(row.unitPrice)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-orange-500">
                          {row.discount > 0 ? `−${formatCurrency(row.discount)}` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.subtotal)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                            {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {sorted.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                      <td colSpan={5} className="px-4 py-3">Total ({sorted.length} lines)</td>
                      <td className="px-4 py-3 text-center">{sorted.reduce((s, r) => s + r.qty, 0)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right text-orange-500">
                        −{formatCurrency(sorted.reduce((s, r) => s + r.discount, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-[#b20202]">
                        {formatCurrency(sorted.reduce((s, r) => s + r.subtotal, 0))}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ) : (
          /* Grouped view */
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
                    <th className="px-4 py-3 text-left">
                      {groupBy === 'product' ? 'Product' : groupBy === 'cashier' ? 'Cashier' : groupBy === 'payment_method' ? 'Payment Method' : 'Date'}
                    </th>
                    <th className="px-4 py-3 text-center">Qty Sold</th>
                    <th className="px-4 py-3 text-right">Total Discount</th>
                    <th className="px-4 py-3 text-right">Net Revenue</th>
                    <th className="px-4 py-3 text-center">Line Count</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-sm text-gray-400">
                        No data for current filters.
                      </td>
                    </tr>
                  ) : (
                    grouped.map(row => (
                      <tr key={row.key} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.key}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{row.qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-orange-500">
                          {row.discount > 0 ? `−${formatCurrency(row.discount)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.revenue)}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{row.orders}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {grouped.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                      <td className="px-4 py-3">Total ({grouped.length} groups)</td>
                      <td className="px-4 py-3 text-center">{grouped.reduce((s, r) => s + r.qty, 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-orange-500">
                        −{formatCurrency(grouped.reduce((s, r) => s + r.discount, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-[#b20202]">
                        {formatCurrency(grouped.reduce((s, r) => s + r.revenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-center">{grouped.reduce((s, r) => s + r.orders, 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Row count hint */}
        {!loading && !error && sorted.length > 0 && viewMode === 'lines' && (
          <p className="mt-2 text-right text-xs text-gray-400">
            Showing {sorted.length} line item{sorted.length !== 1 ? 's' : ''}
            {allRows.length !== sorted.length ? ` (filtered from ${allRows.length})` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
