'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import { orderService, type Order, type OrderListParams } from '@/services/order.service';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import {
  PiMagnifyingGlassBold, PiArrowsClockwiseBold, PiFunnelBold,
  PiShoppingCartBold, PiClockBold, PiTruckBold, PiCheckCircleBold,
  PiXCircleBold, PiWarningBold, PiArrowRightBold, PiCaretRightBold,
  PiCaretLeftBold, PiCaretUpBold, PiCaretDownBold, PiCaretUpDownBold,
  PiArrowLineUpBold, PiStorefrontBold, PiGlobeBold,
} from 'react-icons/pi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
    .format(Number.isFinite(n) ? n : 0);

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Status keys mirror the Order model enum — every one of them needs a config
 *  entry, otherwise the badge falls back to a raw grey string (which is what
 *  `confirmed`, `hold` and `partially_shipped` orders used to render as). */
const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:           { label: 'Pending',       dot: 'bg-orange-400',  badge: 'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400' },
  confirmed:         { label: 'Confirmed',     dot: 'bg-sky-400',     badge: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400' },
  hold:              { label: 'On Hold',       dot: 'bg-gray-400',    badge: 'bg-gray-500/10 text-gray-600 ring-gray-500/20 dark:text-gray-400' },
  processing:        { label: 'Processing',    dot: 'bg-blue-400',    badge: 'bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400' },
  partially_shipped: { label: 'Part. Shipped', dot: 'bg-purple-400',  badge: 'bg-purple-500/10 text-purple-600 ring-purple-500/20 dark:text-purple-400' },
  shipped:           { label: 'Shipped',       dot: 'bg-indigo-400',  badge: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-400' },
  delivered:         { label: 'Delivered',     dot: 'bg-green-500',   badge: 'bg-green-500/10 text-green-600 ring-green-500/20 dark:text-green-400' },
  cancelled:         { label: 'Cancelled',     dot: 'bg-red-400',     badge: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400' },
  refunded:          { label: 'Refunded',      dot: 'bg-gray-400',    badge: 'bg-gray-500/10 text-gray-600 ring-gray-500/20 dark:text-gray-400' },
};

const PAY_CONFIG: Record<string, { label: string; badge: string }> = {
  pending:            { label: 'Unpaid',         badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  paid:               { label: 'Paid',           badge: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  failed:             { label: 'Failed',         badge: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  refunded:           { label: 'Refunded',       badge: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
  partially_refunded: { label: 'Part. Refunded', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
};

const PAY_FILTER_OPTIONS = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'];

const SOURCE_CONFIG: Record<string, { label: string; Icon: React.ElementType }> = {
  web:    { label: 'Web',    Icon: PiGlobeBold },
  app:    { label: 'App',    Icon: PiGlobeBold },
  pos:    { label: 'POS',    Icon: PiStorefrontBold },
  manual: { label: 'Manual', Icon: PiStorefrontBold },
};

function humanize(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        cfg?.badge ?? 'bg-gray-500/10 text-gray-600 ring-gray-500/20 dark:text-gray-400'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg?.dot ?? 'bg-gray-400')} />
      {cfg?.label ?? humanize(status)}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  const cfg = PAY_CONFIG[status];
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium', cfg?.badge ?? 'bg-gray-500/10 text-gray-600 dark:text-gray-400')}>
      {cfg?.label ?? humanize(status)}
    </span>
  );
}

/** Customer identity lives in three different places depending on where the
 *  order came from: shippingAddress (web checkout), paymentDetails.customer
 *  (POS till) or the linked user account (signed-in checkout). */
function customerOf(order: Order) {
  const addr = order.shippingAddress;
  if (addr?.fullName || addr?.email) {
    return { name: addr.fullName || '—', contact: addr.email || addr.phone || '' };
  }
  const pos = order.paymentDetails?.customer;
  if (pos?.firstName || pos?.phone) {
    return {
      name: [pos.firstName, pos.lastName].filter(Boolean).join(' ') || 'Walk-in customer',
      contact: pos.phone || '',
    };
  }
  if (order.user) {
    return {
      name: `${order.user.firstName ?? ''} ${order.user.lastName ?? ''}`.trim() || '—',
      contact: order.user.email || '',
    };
  }
  return { name: '—', contact: '' };
}

// ── CSV export ────────────────────────────────────────────────────────────────

const CSV_COLUMNS: { header: string; value: (o: Order) => string | number }[] = [
  { header: 'Order Number',     value: (o) => o.orderNumber },
  { header: 'Receipt Number',   value: (o) => o.receiptNumber ?? '' },
  { header: 'Placed At',        value: (o) => (o.placedAt || o.createdAt || '') },
  { header: 'Customer',         value: (o) => customerOf(o).name },
  { header: 'Contact',          value: (o) => customerOf(o).contact },
  { header: 'Source',           value: (o) => o.source ?? 'web' },
  { header: 'Items',            value: (o) => o.items.reduce((s, i) => s + i.quantity, 0) },
  { header: 'Subtotal',         value: (o) => o.subtotal ?? 0 },
  { header: 'Discount',         value: (o) => o.discountTotal ?? 0 },
  { header: 'Shipping',         value: (o) => o.shippingFee ?? 0 },
  { header: 'Tax',              value: (o) => o.taxAmount ?? 0 },
  { header: 'Total',            value: (o) => o.totalAmount ?? 0 },
  { header: 'Platform Profit',  value: (o) => o.platformCommissionTotal ?? 0 },
  { header: 'Currency',         value: (o) => o.currency ?? 'NGN' },
  { header: 'Status',           value: (o) => o.status },
  { header: 'Payment Status',   value: (o) => o.paymentStatus },
  { header: 'Payment Method',   value: (o) => o.paymentMethod ?? '' },
  { header: 'Vendors',          value: (o) => Array.from(new Set(o.items.map((i) => i.tenant?.name).filter(Boolean))).join(' | ') },
];

/** RFC-4180 quoting. The shared exportToCSV helper joins raw values with commas,
 *  which shifts every column the moment a customer name or address contains one. */
function toCSV(orders: Order[]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    CSV_COLUMNS.map((c) => escape(c.header)).join(','),
    ...orders.map((o) => CSV_COLUMNS.map((c) => escape(c.value(o))).join(',')),
  ].join('\r\n');
}

function downloadCSV(orders: Order[], fileName: string) {
  // A Blob URL keeps commas/newlines intact — encodeURI(data:) mangles them.
  // The BOM makes Excel read the ₦-friendly UTF-8 correctly.
  const blob = new Blob(['\ufeff', toCSV(orders)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ── Stats cards ───────────────────────────────────────────────────────────────

const STAT_CARDS = [
  { id: '',           label: 'All Orders', icon: PiShoppingCartBold, color: 'blue'   },
  { id: 'pending',    label: 'Pending',    icon: PiClockBold,        color: 'orange' },
  { id: 'processing', label: 'Processing', icon: PiArrowRightBold,   color: 'indigo' },
  { id: 'shipped',    label: 'Shipped',    icon: PiTruckBold,        color: 'purple' },
  { id: 'delivered',  label: 'Delivered',  icon: PiCheckCircleBold,  color: 'green'  },
  { id: 'cancelled',  label: 'Cancelled',  icon: PiXCircleBold,      color: 'red'    },
] as const;

const CARD_COLORS: Record<string, { grad: string; icon: string; ring: string; text: string }> = {
  blue:   { grad: 'from-blue-500/10 to-blue-500/5',     icon: 'bg-blue-500',   ring: 'ring-blue-400/50',   text: 'text-blue-600 dark:text-blue-400' },
  orange: { grad: 'from-orange-500/10 to-orange-500/5', icon: 'bg-orange-500', ring: 'ring-orange-400/50', text: 'text-orange-600 dark:text-orange-400' },
  indigo: { grad: 'from-indigo-500/10 to-indigo-500/5', icon: 'bg-indigo-500', ring: 'ring-indigo-400/50', text: 'text-indigo-600 dark:text-indigo-400' },
  purple: { grad: 'from-purple-500/10 to-purple-500/5', icon: 'bg-purple-500', ring: 'ring-purple-400/50', text: 'text-purple-600 dark:text-purple-400' },
  green:  { grad: 'from-green-500/10 to-green-500/5',   icon: 'bg-green-500',  ring: 'ring-green-400/50',  text: 'text-green-600 dark:text-green-400' },
  red:    { grad: 'from-red-500/10 to-red-500/5',       icon: 'bg-red-500',    ring: 'ring-red-400/50',    text: 'text-red-600 dark:text-red-400' },
};

function StatsCards({
  counts, active, loading, onFilter,
}: {
  counts: Record<string, number>;
  active: string;
  loading: boolean;
  onFilter: (s: string) => void;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STAT_CARDS.map((c, i) => {
        const col = CARD_COLORS[c.color];
        const Icon = c.icon;
        const isActive = active === c.id;
        return (
          <motion.button
            key={c.id || 'all'}
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilter(c.id)}
            aria-pressed={isActive}
            className={cn(
              'relative rounded-2xl bg-gradient-to-br p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              col.grad,
              isActive && `ring-4 ${col.ring}`
            )}
          >
            <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white', col.icon)}>
              <Icon className="h-5 w-5" />
            </div>
            {loading ? (
              <div className="h-8 w-10 animate-pulse rounded bg-gray-200" />
            ) : (
              <p className="text-2xl font-black text-gray-900">{counts[c.id || 'all'] ?? 0}</p>
            )}
            <p className={cn('mt-0.5 text-xs font-semibold opacity-80', col.text)}>{c.label}</p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Skeleton (table body only — the toolbar must stay mounted so the search
//    input keeps focus between keystrokes) ───────────────────────────────────

function RowSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-muted">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 flex-1 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function OrderTable({
  className,
  hideFilters = false,
  hidePagination = false,
}: {
  className?: string;
  hideFilters?: boolean;
  hidePagination?: boolean;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [counts,     setCounts]     = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [error,      setError]      = useState('');

  // `search` drives the input; `debouncedSearch` drives the request, so typing
  // no longer fires one request (and one full re-render) per keystroke.
  const [search,         setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [paymentFilter,  setPaymentFilter]  = useState('');
  const [sourceFilter,   setSourceFilter]   = useState('');
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [sortField,      setSortField]      = useState('placedAt');
  const [sortDir,        setSortDir]        = useState<'asc' | 'desc'>('desc');
  const [page,           setPage]           = useState(1);

  const token = (session?.user as any)?.token || '';

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params: OrderListParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch,
    status: statusFilter || undefined,
    payment: paymentFilter || undefined,
    source: sourceFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    sort: sortField,
    order: sortDir,
  }), [page, debouncedSearch, statusFilter, paymentFilter, sourceFilter, fromDate, toDate, sortField, sortDir]);

  // Any filter change resets to page 1. Kept out of the fetch effect so it
  // can't cause a second request for the page we're abandoning.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setPage(1);
  }, [debouncedSearch, statusFilter, paymentFilter, sourceFilter, fromDate, toDate, sortField, sortDir]);

  const [reloadToken, setReloadToken] = useState(0);

  // Single source of truth for fetching: one request per settled param set.
  useEffect(() => {
    if (sessionStatus === 'unauthenticated' || (sessionStatus === 'authenticated' && !token)) {
      // Nothing will ever arrive — don't leave the skeleton spinning forever.
      setLoading(false);
      setRefreshing(false);
      setError('You are not signed in.');
      return;
    }
    if (sessionStatus !== 'authenticated') return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setError('');
      try {
        const res = await orderService.getOrders(token, params, controller.signal);
        if (cancelled) return;
        setOrders(res.orders);
        setCounts(res.counts);
        setPagination(res.pagination);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError') return;
        setError(e.message || 'Failed to load orders');
        toast.error('Failed to load orders');
      } finally {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [sessionStatus, token, params, reloadToken]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadToken((t) => t + 1);
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      // Export what the filters describe, not just the visible page.
      const { page: _p, limit: _l, ...filters } = params;
      const all = await orderService.getAllMatchingOrders(token, filters);
      if (!all.length) {
        toast.error('No orders to export');
        return;
      }
      downloadCSV(all, `orders-${new Date().toISOString().slice(0, 10)}`);
      toast.success(`Exported ${all.length} order${all.length === 1 ? '' : 's'}`);
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setPaymentFilter('');
    setSourceFilter(''); setFromDate(''); setToDate('');
  };

  const hasFilters = Boolean(search || statusFilter || paymentFilter || sourceFilter || fromDate || toDate);
  const busy = loading || sessionStatus === 'loading';

  const SortHeader = ({ field, label, className: cls }: { field: string; label: string; className?: string }) => {
    const active = sortField === field;
    const Icon = !active ? PiCaretUpDownBold : sortDir === 'asc' ? PiCaretUpBold : PiCaretDownBold;
    return (
      <th scope="col" className={cn('px-5 py-3.5 text-left', cls)}>
        <button
          type="button"
          onClick={() => handleSort(field)}
          aria-label={`Sort by ${label}`}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-900"
        >
          {label}
          <Icon className={cn('h-3 w-3', active ? 'text-primary' : 'text-gray-400')} />
        </button>
      </th>
    );
  };

  const selectClass =
    'rounded-xl border border-muted bg-gray-50 px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-primary focus:bg-gray-0 focus:outline-none';

  return (
    <div className={className}>
      <StatsCards counts={counts} active={statusFilter} loading={busy} onFilter={setStatusFilter} />

      {!hideFilters && (
        <div className="mb-4 rounded-2xl border border-muted bg-gray-0 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <PiMagnifyingGlassBold className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, receipt, customer, email, phone…"
                aria-label="Search orders"
                className="w-full rounded-xl border border-muted bg-gray-50 py-2.5 pe-4 ps-9 text-sm text-gray-900 transition-all focus:border-primary focus:bg-gray-0 focus:outline-none"
              />
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by order status" className={selectClass}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} aria-label="Filter by payment status" className={selectClass}>
              <option value="">All payments</option>
              {PAY_FILTER_OPTIONS.map((k) => (
                <option key={k} value={k}>{PAY_CONFIG[k].label}</option>
              ))}
            </select>

            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label="Filter by order source" className={selectClass}>
              <option value="">All sources</option>
              {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="date" value={fromDate} max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Orders placed from" className={selectClass}
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date" value={toDate} min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="Orders placed until" className={selectClass}
              />
            </div>

            <span className="whitespace-nowrap text-sm text-gray-500">
              {pagination.total} order{pagination.total === 1 ? '' : 's'}
            </span>

            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-muted px-3 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-primary hover:text-gray-900 disabled:opacity-60"
            >
              <motion.span
                animate={refreshing ? { rotate: 360 } : {}}
                transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
                className="inline-flex"
              >
                <PiArrowsClockwiseBold className="h-4 w-4" />
              </motion.span>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={handleExport}
              disabled={exporting || busy}
              className="flex items-center gap-2 rounded-xl border border-muted px-3 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-primary hover:text-gray-900 disabled:opacity-60"
            >
              <PiArrowLineUpBold className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export'}
            </motion.button>
          </div>

          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-muted pt-3">
              <PiFunnelBold className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
              {[
                search       && { label: `"${search}"`,                            clear: () => setSearch('') },
                statusFilter && { label: STATUS_CONFIG[statusFilter]?.label ?? statusFilter, clear: () => setStatusFilter('') },
                paymentFilter&& { label: PAY_CONFIG[paymentFilter]?.label ?? paymentFilter,  clear: () => setPaymentFilter('') },
                sourceFilter && { label: SOURCE_CONFIG[sourceFilter]?.label ?? sourceFilter, clear: () => setSourceFilter('') },
                fromDate     && { label: `From ${fromDate}`,                       clear: () => setFromDate('') },
                toDate       && { label: `To ${toDate}`,                           clear: () => setToDate('') },
              ]
                .filter(Boolean)
                .map((f: any, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {f.label}
                    <button type="button" onClick={f.clear} aria-label={`Remove filter ${f.label}`} className="font-bold hover:text-red-500">
                      ×
                    </button>
                  </span>
                ))}
              <button type="button" onClick={clearFilters} className="ms-auto text-xs font-medium text-red-500 hover:text-red-600">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-gray-0 p-12 text-center">
          <PiWarningBold className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <p className="mb-2 text-lg font-bold text-red-600">Failed to load orders</p>
          <p className="mb-6 text-sm text-gray-500">{error}</p>
          <button type="button" onClick={refresh} className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700">
            Try Again
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-muted bg-gray-0 shadow-sm">
          {busy ? (
            <RowSkeleton />
          ) : orders.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-16 text-center">
              <PiShoppingCartBold className="mx-auto mb-4 h-16 w-16 text-gray-200" />
              <p className="mb-1 text-xl font-bold text-gray-700">No orders found</p>
              <p className="text-sm text-gray-400">
                {hasFilters ? 'Try adjusting your filters.' : 'Orders will appear here once customers place them.'}
              </p>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="mt-5 rounded-xl border border-muted px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary">
                  Clear filters
                </button>
              )}
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted bg-gray-50">
                    <SortHeader field="orderNumber" label="Order #" className="whitespace-nowrap" />
                    <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</th>
                    <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Items</th>
                    <SortHeader field="total" label="Total" className="whitespace-nowrap" />
                    <th scope="col" className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Platform Profit</th>
                    <SortHeader field="status" label="Status" />
                    <SortHeader field="paymentStatus" label="Payment" />
                    <SortHeader field="placedAt" label="Date" className="whitespace-nowrap" />
                    <th scope="col" className="px-5 py-3.5"><span className="sr-only">View</span></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, i) => {
                    const { name, contact } = customerOf(order);
                    const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);
                    const src = SOURCE_CONFIG[order.source ?? 'web'] ?? SOURCE_CONFIG.web;
                    const open = () => router.push(routes.eCommerce.orderDetails(order._id));

                    // Per-vendor payout summary — what the platform owes each vendor
                    const vendorMap = new Map<string, { name: string; payout: number }>();
                    for (const item of order.items) {
                      const id = item.tenant?._id ?? '__unknown__';
                      const prev = vendorMap.get(id) ?? { name: item.tenant?.name ?? 'Unknown', payout: 0 };
                      vendorMap.set(id, { name: prev.name, payout: prev.payout + (item.tenantRevenueShare ?? 0) });
                    }
                    const vendors = Array.from(vendorMap.values()).filter((v) => v.payout > 0);

                    return (
                      <React.Fragment key={order._id}>
                        <motion.tr
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.2) }}
                          onClick={open}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`View order ${order.orderNumber}`}
                          className="group cursor-pointer border-t border-muted transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="font-mono text-xs font-semibold text-gray-900">#{order.orderNumber}</span>
                            <span className="mt-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                              <src.Icon className="h-3 w-3" />
                              {src.label}
                              {order.receiptNumber ? ` · ${order.receiptNumber}` : ''}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-gray-900">{name}</p>
                            {contact && <p className="mt-0.5 text-xs text-gray-400">{contact}</p>}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                            {itemCount} item{itemCount === 1 ? '' : 's'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-900">{fmt(order.totalAmount)}</td>
                          <td className="whitespace-nowrap px-5 py-4">
                            {order.platformCommissionTotal ? (
                              <span className="inline-flex items-center rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
                                {fmt(order.platformCommissionTotal)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                          <td className="px-5 py-4"><PayBadge status={order.paymentStatus} /></td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-gray-500">
                            {fmtDate(order.placedAt || order.createdAt)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <PiCaretRightBold className="inline h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-900" />
                          </td>
                        </motion.tr>

                        {vendors.length > 0 && (
                          <tr className="bg-gray-50/60">
                            <td colSpan={9} className="px-5 pb-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="me-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Vendors:</span>
                                {vendors.map((v, vi) => (
                                  <span key={vi} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs">
                                    <span className="font-semibold text-blue-700 dark:text-blue-300">{v.name}</span>
                                    <span className="text-blue-600 dark:text-blue-400">{fmt(v.payout)}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!hidePagination && !busy && !error && pagination.pages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-muted px-5 py-4">
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages} · {pagination.total} orders
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                  className="rounded-lg border border-muted p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PiCaretLeftBold className="h-4 w-4" />
                </button>
                {(() => {
                  const span = Math.min(5, pagination.pages);
                  const start = Math.max(1, Math.min(pagination.pages - span + 1, page - 2));
                  return [...Array(span)].map((_, i) => {
                    const pg = start + i;
                    return (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setPage(pg)}
                        aria-label={`Page ${pg}`}
                        aria-current={pg === page ? 'page' : undefined}
                        className={cn(
                          'h-9 w-9 rounded-lg text-sm font-semibold transition-colors',
                          pg === page ? 'bg-gray-900 text-gray-0' : 'border border-muted text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {pg}
                      </button>
                    );
                  });
                })()}
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  aria-label="Next page"
                  className="rounded-lg border border-muted p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <PiCaretRightBold className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
