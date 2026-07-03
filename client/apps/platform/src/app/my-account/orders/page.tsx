'use client';

import React from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { useOrders } from '../_hooks/useOrders';
import { ORDER_STATUSES } from '../_constants';
import OrderCard from '../_components/OrderCard';
import OrderCardSkeleton from '../_components/OrderCardSkeleton';
import StatusFilter from '../_components/StatusFilter';
import DateRangeFilter from '../_components/DateRangeFilter';

const btnCls = 'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed';
const pageCls = 'w-8 h-8 rounded-lg border text-xs font-semibold transition-all';

export default function OrdersPage() {
  const { token, user } = useAccount();
  const { orders, loading, error, pagination, filters, setFilters, goToPage, refetch } = useOrders(token);

  const counts = ORDER_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'all' ? pagination.total : orders.filter(o => o.status?.toLowerCase() === s).length;
    return acc;
  }, {});

  const { page, totalPages, total } = pagination;

  const pages: (number | '...')[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900">My Orders</h1>
        <p className="text-sm text-stone-500 mt-0.5">{total} order{total !== 1 ? 's' : ''} placed</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <StatusFilter active={filters.status} counts={counts} onChange={(s) => setFilters({ status: s })} />
        <DateRangeFilter dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={(from, to) => setFilters({ dateFrom: from, dateTo: to })} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <OrderCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <Icon.PiWarningCircleBold size={36} className="mx-auto text-red-400 mb-3" />
          <p className="font-semibold text-red-700 mb-1">{error}</p>
          <p className="text-sm text-red-500 mb-4">We couldn&apos;t load your orders. Please try again.</p>
          <button onClick={refetch} className="inline-flex items-center gap-1.5 bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-red-800 transition-all">
            <Icon.PiArrowClockwiseBold size={14} /> Try Again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-14 text-center">
          {filters.status === 'all' && !filters.dateFrom && !filters.dateTo ? (
            <>
              <Icon.PiPackageBold size={44} className="mx-auto text-stone-200 mb-4" />
              <p className="font-black text-stone-800 text-lg mb-1">No orders yet</p>
              <p className="text-sm text-stone-400 mb-6">Your order history will appear here once you place an order.</p>
              <Link href="/shop" className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all">
                <Icon.PiShoppingCartBold size={15} /> Start Shopping
              </Link>
            </>
          ) : (
            <>
              <Icon.PiFunnelBold size={44} className="mx-auto text-stone-200 mb-4" />
              <p className="font-black text-stone-800 text-lg mb-1">No{filters.status !== 'all' ? ` ${filters.status}` : ''} orders found</p>
              <p className="text-sm text-stone-400 mb-6">Try a different filter or date range above.</p>
              <button onClick={() => setFilters({ status: 'all', dateFrom: '', dateTo: '' })} className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-600 px-5 py-2 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all">
                <Icon.PiXBold size={13} /> Clear Filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {orders.map((order) => <OrderCard key={order._id} order={order} userEmail={user?.email} />)}
            </div>
          </AnimatePresence>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-stone-500">Page {page} of {totalPages} ({total} orders)</p>
              <div className="flex gap-2 items-center">
                <button disabled={page <= 1} onClick={() => goToPage(page - 1)} className={`${btnCls} bg-white border-stone-200 text-stone-600 hover:border-red-200`}>Prev</button>
                {pages.map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} className="text-xs text-stone-400 w-4 text-center">...</span>
                  ) : (
                    <button key={p} onClick={() => goToPage(p)} className={`${pageCls} ${p === page ? 'bg-red-700 border-red-700 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-red-200'}`}>{p}</button>
                  )
                )}
                <button disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className={`${btnCls} bg-white border-stone-200 text-stone-600 hover:border-red-200`}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
