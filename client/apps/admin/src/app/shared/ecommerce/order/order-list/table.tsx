// @ts-nocheck
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import { orderService, type Order } from '@/services/order.service';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiMagnifyingGlassBold, PiArrowsClockwiseBold, PiFunnelBold,
  PiShoppingCartBold, PiClockBold, PiTruckBold, PiCheckCircleBold,
  PiXCircleBold, PiWarningBold, PiArrowRightBold, PiEyeBold,
  PiCaretLeftBold, PiCaretRightBold, PiCaretUpDownBold,
} from 'react-icons/pi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  pending:           { label: 'Pending',    dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  processing:        { label: 'Processing', dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  partially_shipped: { label: 'Part. Shipped', dot: 'bg-purple-400', text: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  shipped:           { label: 'Shipped',    dot: 'bg-indigo-400', text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  delivered:         { label: 'Delivered',  dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  cancelled:         { label: 'Cancelled',  dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  refunded:          { label: 'Refunded',   dot: 'bg-gray-400',   text: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
};

const PAY_CONFIG: Record<string, { label: string; text: string; bg: string }> = {
  pending:             { label: 'Unpaid',    text: 'text-amber-700', bg: 'bg-amber-50' },
  paid:                { label: 'Paid',      text: 'text-green-700', bg: 'bg-green-50' },
  failed:              { label: 'Failed',    text: 'text-red-700',   bg: 'bg-red-50' },
  refunded:            { label: 'Refunded',  text: 'text-gray-600',  bg: 'bg-gray-50' },
  partially_refunded:  { label: 'Part. Refunded', text: 'text-orange-700', bg: 'bg-orange-50' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  const cfg = PAY_CONFIG[status] ?? { label: status, text: 'text-gray-600', bg: 'bg-gray-50' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ── Stats Cards ───────────────────────────────────────────────────────────────

function StatsCards({
  counts, active, onFilter,
}: {
  counts: Record<string, number>; active: string; onFilter: (s: string) => void;
}) {
  const cards = [
    { id: '',          label: 'All Orders',  value: counts.all || 0,       icon: PiShoppingCartBold, color: 'blue' },
    { id: 'pending',   label: 'Pending',     value: counts.pending || 0,   icon: PiClockBold,        color: 'amber' },
    { id: 'processing',label: 'Processing',  value: counts.processing || 0,icon: PiArrowRightBold,   color: 'indigo' },
    { id: 'shipped',   label: 'Shipped',     value: counts.shipped || 0,   icon: PiTruckBold,        color: 'purple' },
    { id: 'delivered', label: 'Delivered',   value: counts.delivered || 0, icon: PiCheckCircleBold,  color: 'green' },
    { id: 'cancelled', label: 'Cancelled',   value: counts.cancelled || 0, icon: PiXCircleBold,      color: 'red' },
  ];

  const colorMap: Record<string, { grad: string; icon: string; ring: string; text: string }> = {
    blue:   { grad: 'from-blue-500/10 to-blue-500/5',   icon: 'bg-blue-500',   ring: 'ring-blue-400/40',   text: 'text-blue-600' },
    amber:  { grad: 'from-amber-500/10 to-amber-500/5', icon: 'bg-amber-500',  ring: 'ring-amber-400/40',  text: 'text-amber-600' },
    indigo: { grad: 'from-indigo-500/10 to-indigo-500/5',icon:'bg-indigo-500', ring: 'ring-indigo-400/40', text: 'text-indigo-600' },
    purple: { grad: 'from-purple-500/10 to-purple-500/5',icon:'bg-purple-500', ring: 'ring-purple-400/40', text: 'text-purple-600' },
    green:  { grad: 'from-green-500/10 to-green-500/5', icon: 'bg-green-500',  ring: 'ring-green-400/40',  text: 'text-green-600' },
    red:    { grad: 'from-red-500/10 to-red-500/5',     icon: 'bg-red-500',    ring: 'ring-red-400/40',    text: 'text-red-600' },
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((c, i) => {
        const col = colorMap[c.color];
        const Icon = c.icon;
        const isActive = active === c.id;
        return (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilter(c.id)}
            className={`relative p-4 rounded-2xl bg-gradient-to-br text-left transition-all ${col.grad} ${isActive ? `ring-4 ${col.ring}` : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3 ${col.icon}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className={`text-2xl font-black`}>{c.value}</p>
            <p className={`text-xs font-semibold mt-0.5 ${col.text} opacity-80`}>{c.label}</p>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(8)].map((_, i) => (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
          className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100">
          <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="w-20 h-6 bg-gray-200 rounded-full animate-pulse" />
          <div className="w-16 h-6 bg-gray-200 rounded animate-pulse" />
        </motion.div>
      ))}
    </div>
  );
}

// ── Main Table ────────────────────────────────────────────────────────────────

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

  const [orders,      setOrders]      = useState<Order[]>([]);
  const [counts,      setCounts]      = useState<Record<string, number>>({});
  const [pagination,  setPagination]  = useState({ page: 1, pages: 1, total: 0 });
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [page,        setPage]        = useState(1);
  const [sortField,   setSortField]   = useState('placedAt');
  const [sortDir,     setSortDir]     = useState<'asc'|'desc'>('desc');

  const token = session?.user?.token || '';

  const fetch_ = useCallback(async (opts: { refresh?: boolean; pg?: number } = {}) => {
    if (!token) return;
    const { refresh = false, pg = page } = opts;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await orderService.getOrders(token, {
        page: pg, limit: 20,
        search: search.trim(),
        status: statusFilter || undefined,
        sort: sortField, order: sortDir,
      });
      setOrders(res.orders);
      setCounts(res.counts);
      setPagination(res.pagination);
    } catch (e: any) {
      setError(e.message || 'Failed to load orders');
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, page, search, statusFilter, sortField, sortDir]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') fetch_();
  }, [sessionStatus, fetch_]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const updated = await orderService.updateStatus(token, id, status);
      setOrders(prev => prev.map(o => o._id === id ? { ...o, status: updated.status } : o));
      toast.success(`Order status updated to ${status}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update status');
    }
  };

  if (sessionStatus === 'loading' || loading) return <Skeleton />;

  if (error) return (
    <div className="bg-white rounded-2xl border border-red-200 p-12 text-center">
      <PiWarningBold className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <p className="text-red-600 font-bold text-lg mb-2">Failed to load orders</p>
      <p className="text-gray-500 text-sm mb-6">{error}</p>
      <button onClick={() => fetch_({ refresh: true })} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors">
        Try Again
      </button>
    </div>
  );

  const SortIcon = ({ field }: { field: string }) => (
    <PiCaretUpDownBold className={`w-3 h-3 ml-1 inline ${sortField === field ? 'text-blue-500' : 'text-gray-300'}`} />
  );

  return (
    <div className={className}>
      {/* Stats */}
      <StatsCards counts={counts} active={statusFilter} onFilter={(s) => setStatusFilter(s)} />

      {/* Toolbar */}
      {!hideFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <PiMagnifyingGlassBold className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by order #, customer name, email…"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
              )}
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* Results */}
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {pagination.total} order{pagination.total !== 1 ? 's' : ''}
            </span>

            {/* Refresh */}
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => fetch_({ refresh: true })}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm font-medium"
            >
              <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0 }}>
                <PiArrowsClockwiseBold className="w-4 h-4" />
              </motion.div>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </motion.button>
          </div>

          {/* Active filters */}
          {(search || statusFilter) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
              <PiFunnelBold className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">Filters:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  "{search}" <button onClick={() => setSearch('')} className="hover:text-red-500 font-bold">×</button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium capitalize">
                  {STATUS_CONFIG[statusFilter]?.label || statusFilter}
                  <button onClick={() => setStatusFilter('')} className="hover:text-red-500 font-bold">×</button>
                </span>
              )}
              <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="ml-auto text-xs font-medium text-red-500 hover:text-red-700">Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {orders.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <PiShoppingCartBold className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-700 font-bold text-xl mb-1">No orders found</p>
          <p className="text-gray-400 text-sm">
            {search || statusFilter ? 'Try adjusting your filters.' : 'Orders will appear here once customers place them.'}
          </p>
        </motion.div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap" onClick={() => handleSort('orderNumber')}>
                    Order # <SortIcon field="orderNumber" />
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap" onClick={() => handleSort('total')}>
                    Total <SortIcon field="total" />
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Platform Profit</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap" onClick={() => handleSort('placedAt')}>
                    Date <SortIcon field="placedAt" />
                  </th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => {
                  const customer  = order.customer || (order.user ? { firstName: order.user.firstName, lastName: order.user.lastName, email: order.user.email, phone: '' } : null);
                  const name      = customer ? `${customer.firstName} ${customer.lastName}`.trim() : '—';
                  const email     = customer?.email || '—';
                  const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);

                  // Build per-vendor payout map
                  const vendorMap = new Map();
                  for (const item of order.items) {
                    const id   = item.tenant?._id ?? '__unknown__';
                    const vname = item.tenant?.name ?? 'Unknown';
                    const prev = vendorMap.get(id) ?? { name: vname, payout: 0 };
                    vendorMap.set(id, { name: vname, payout: prev.payout + (item.tenantRevenueShare ?? 0) });
                  }
                  const vendors = [...vendorMap.values()].filter(v => v.payout > 0);

                  return (
                    <React.Fragment key={order._id}>
                      <motion.tr
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="hover:bg-gray-50/70 transition-colors group border-t border-gray-50"
                      >
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-gray-700 whitespace-nowrap">
                          #{order.orderNumber}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-800 text-sm">{name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{email}</p>
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {itemCount} item{itemCount !== 1 ? 's' : ''}
                        </td>
                        <td className="px-5 py-4 font-semibold text-gray-900 whitespace-nowrap">
                          {fmt(order.totalAmount)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {order.platformCommissionTotal != null && order.platformCommissionTotal > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-xs font-semibold">
                              {fmt(order.platformCommissionTotal)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-5 py-4">
                          <PayBadge status={order.paymentStatus} />
                        </td>
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap text-xs">
                          {fmtDate(order.placedAt || order.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => router.push(routes.eCommerce.orderDetails(order._id))}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-700"
                          >
                            <PiEyeBold className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </motion.tr>
                      {vendors.length > 0 && (
                        <tr className="bg-gray-50/60 border-t border-gray-50">
                          <td colSpan={9} className="px-5 py-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-1">Vendors:</span>
                              {vendors.map((v, vi) => (
                                <span key={vi} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-xs">
                                  <span className="font-semibold text-blue-700">{v.name}</span>
                                  <span className="text-blue-500">{fmt(v.payout)}</span>
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

          {/* Pagination */}
          {!hidePagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages} · {pagination.total} orders
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => { setPage(p => p - 1); fetch_({ pg: page - 1 }); }}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <PiCaretLeftBold className="w-4 h-4" />
                </button>
                {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                  const pg = Math.max(1, Math.min(pagination.pages - 4, page - 2)) + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => { setPage(pg); fetch_({ pg }); }}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${pg === page ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  disabled={page >= pagination.pages}
                  onClick={() => { setPage(p => p + 1); fetch_({ pg: page + 1 }); }}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <PiCaretRightBold className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
