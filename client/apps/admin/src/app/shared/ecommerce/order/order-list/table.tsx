'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import {
  orderService,
  type Order,
  type OrderListParams,
} from '@/services/order.service';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import {
  PiCaretRightBold,
  PiShoppingCartBold,
  PiWarningBold,
} from 'react-icons/pi';
import StatsCards from './stats-cards';
import TableToolbar from './table-toolbar';
import TablePagination from './table-pagination';
import OrderTableRow from './order-table-row';
import OrderTableHead from './order-table-head';
import { downloadCSV } from './csv-export';

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

  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // `search` drives the input; `debouncedSearch` drives the request, so typing
  // no longer fires one request (and one full re-render) per keystroke.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortField, setSortField] = useState('placedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const token =
    (session?.user as { token?: string } | undefined)?.token ?? '';

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params: OrderListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      status: statusFilter || undefined,
      payment: paymentFilter || undefined,
      paymentMethod: methodFilter || undefined,
      source: sourceFilter || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      sort: sortField,
      order: sortDir,
    }),
    [
      page,
      debouncedSearch,
      statusFilter,
      paymentFilter,
      methodFilter,
      sourceFilter,
      fromDate,
      toDate,
      sortField,
      sortDir,
    ]
  );

  // Any filter change resets to page 1. Kept out of the fetch effect so it
  // can't cause a second request for the page we're abandoning.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
  }, [
    debouncedSearch,
    statusFilter,
    paymentFilter,
    methodFilter,
    sourceFilter,
    fromDate,
    toDate,
    sortField,
    sortDir,
  ]);

  const [reloadToken, setReloadToken] = useState(0);

  // Single source of truth for fetching: one request per settled param set.
  useEffect(() => {
    if (
      sessionStatus === 'unauthenticated' ||
      (sessionStatus === 'authenticated' && !token)
    ) {
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
        const res = await orderService.getOrders(
          token,
          params,
          controller.signal
        );
        if (cancelled) return;
        setOrders(res.orders);
        setCounts(res.counts);
        setPagination(res.pagination);
      } catch (e: any) {
        if (cancelled || e?.name === 'AbortError') return;
        setError(e.message || 'Failed to load orders');
        toast.error('Failed to load orders');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionStatus, token, params, reloadToken]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadToken((t) => t + 1);
  }, []);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field)
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField]
  );

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
      toast.success(
        `Exported ${all.length} order${all.length === 1 ? '' : 's'}`
      );
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPaymentFilter('');
    // BUGFIX: methodFilter was never reset here — "Clear all" left the payment
    // method filter active and its chip permanently stuck in the toolbar.
    setMethodFilter('');
    setSourceFilter('');
    setFromDate('');
    setToDate('');
  };

  const hasFilters = Boolean(
    search ||
      statusFilter ||
      paymentFilter ||
      methodFilter ||
      sourceFilter ||
      fromDate ||
      toDate
  );
  const busy = loading || sessionStatus === 'loading';

  return (
    <div className={className}>
      <StatsCards
        counts={counts}
        active={statusFilter}
        loading={busy}
        onFilter={setStatusFilter}
      />

      {!hideFilters && (
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          paymentFilter={paymentFilter}
          onPaymentFilterChange={setPaymentFilter}
          methodFilter={methodFilter}
          onMethodFilterChange={setMethodFilter}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          totalOrders={pagination.total}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          refreshing={refreshing}
          onRefresh={refresh}
          exporting={exporting}
          busy={busy}
          onExport={handleExport}
        />
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-gray-0 p-12 text-center">
          <PiWarningBold className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <p className="mb-2 text-lg font-bold text-red-600">
            Failed to load orders
          </p>
          <p className="mb-6 text-sm text-gray-500">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className={cn(
              'rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold',
              'text-white transition-colors hover:bg-red-700'
            )}
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-muted bg-gray-0 shadow-sm">
          {busy ? (
            <RowSkeleton />
          ) : orders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-16 text-center"
            >
              <PiShoppingCartBold className="mx-auto mb-4 h-16 w-16 text-gray-200" />
              <p className="mb-1 text-xl font-bold text-gray-700">
                No orders found
              </p>
              <p className="text-sm text-gray-400">
                {hasFilters
                  ? 'Try adjusting your filters.'
                  : 'Orders will appear here once customers place them.'}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={cn(
                    'mt-5 rounded-xl border border-muted px-4 py-2 text-sm',
                    'font-medium text-gray-700 hover:border-primary'
                  )}
                >
                  Clear filters
                </button>
              )}
            </motion.div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <OrderTableHead
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <tbody>
                  {orders.map((order, i) => (
                    <OrderTableRow
                      key={order._id}
                      order={order}
                      index={i}
                      onView={(id) =>
                        router.push(routes.eCommerce.orderDetails(id))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!hidePagination && !busy && !error && pagination.pages > 1 && (
            <TablePagination
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
