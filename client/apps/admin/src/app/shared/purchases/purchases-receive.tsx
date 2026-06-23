'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  PiPackage,
  PiArrowRight,
  PiMagnifyingGlass,
  PiArrowClockwise,
  PiWarning,
  PiClockCountdown,
  PiCheckCircle,
  PiTruck,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from './types';

type FilterKey = 'all' | 'overdue' | 'partial';

function isOverdue(order: PurchaseOrder) {
  if (!order.expectedArrival) return false;
  return new Date(order.expectedArrival) < new Date();
}

function isPartial(order: PurchaseOrder) {
  return order.items.some(
    (i) => i.receivedQty > 0 && i.receivedQty < i.quantity
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-4 w-28 rounded bg-gray-100" />
            <div className="h-4 w-20 rounded bg-gray-100" />
          </div>
          <div className="mt-3 h-2 w-52 rounded-full bg-gray-100" />
          <div className="mt-2 flex gap-2">
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-3 w-32 rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-9 w-24 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

export default function PurchasesReceive() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const poId = searchParams.get('po');

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [confirmedRes, receivedRes] = await Promise.all([
        purchaseOrderService.getPurchaseOrders(token, { status: 'confirmed' }),
        purchaseOrderService.getPurchaseOrders(token, { status: 'received' }),
      ]);
      const confirmed: PurchaseOrder[] =
        confirmedRes.data ?? confirmedRes.purchaseOrders ?? [];
      const received: PurchaseOrder[] =
        receivedRes.data ?? receivedRes.purchaseOrders ?? [];
      const partiallyReceived = received.filter((o) =>
        o.items.some((i) => i.receivedQty < i.quantity)
      );
      const all = [...confirmed, ...partiallyReceived];
      // Sort: overdue first, then by expected arrival ascending
      all.sort((a, b) => {
        if (isOverdue(a) && !isOverdue(b)) return -1;
        if (!isOverdue(a) && isOverdue(b)) return 1;
        const da = a.expectedArrival
          ? new Date(a.expectedArrival).getTime()
          : Infinity;
        const db = b.expectedArrival
          ? new Date(b.expectedArrival).getTime()
          : Infinity;
        return da - db;
      });
      setOrders(all);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const displayOrders = useMemo(() => {
    let list = poId ? orders.filter((o) => o._id === poId) : orders;
    if (filter === 'overdue') list = list.filter(isOverdue);
    if (filter === 'partial') list = list.filter(isPartial);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.poNumber?.toLowerCase().includes(q) ||
          o.vendorName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, poId, filter, search]);

  const overdueCount = orders.filter(isOverdue).length;
  const partialCount = orders.filter(isPartial).length;
  const totalPending = orders.reduce((s, o) => {
    const total = o.items.reduce((a, i) => a + i.quantity, 0);
    const received = o.items.reduce((a, i) => a + i.receivedQty, 0);
    return s + (total - received);
  }, 0);

  const FILTERS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'overdue', label: 'Overdue', count: overdueCount },
    { key: 'partial', label: 'In Progress', count: partialCount },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Receive Goods</h1>
          <p className="text-sm text-gray-500">
            Record incoming stock against purchase orders
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          title="Refresh"
        >
          <PiArrowClockwise className="h-4 w-4" />
        </button>
      </div>

      {/* Summary cards */}
      {!loading && orders.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <PiTruck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">Orders Pending</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">
              {orders.length}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <PiWarning className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xs text-gray-500">Overdue</p>
            <p
              className={`mt-0.5 text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}
            >
              {overdueCount}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <PiPackage className="h-4 w-4 text-gray-600" />
            </div>
            <p className="text-xs text-gray-500">Units Awaited</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">
              {totalPending}
            </p>
          </div>
        </div>
      )}

      {/* Filters + search */}
      {!loading && orders.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      filter === f.key
                        ? 'bg-white/20 text-white'
                        : f.key === 'overdue' && f.count > 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO or vendor…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
            />
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <PiPackage className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {search || filter !== 'all'
                ? 'No matching orders'
                : 'Nothing to receive'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {search || filter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'All confirmed orders have been fully received'}
            </p>
          </div>
          {!search && filter === 'all' && (
            <Link
              href={routes.eCommerce.purchases}
              className="mt-1 text-sm font-medium text-[#b20202] hover:underline"
            >
              View all purchase orders
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayOrders.map((order) => {
            const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
            const receivedQty = order.items.reduce(
              (s, i) => s + i.receivedQty,
              0
            );
            const remainingQty = totalQty - receivedQty;
            const pct =
              totalQty > 0 ? Math.round((receivedQty / totalQty) * 100) : 0;
            const overdue = isOverdue(order);
            const partial = isPartial(order);
            const daysOverdue =
              overdue && order.expectedArrival
                ? Math.floor(
                    (Date.now() - new Date(order.expectedArrival).getTime()) /
                      86400000
                  )
                : 0;

            return (
              <div
                key={order._id}
                className={`rounded-xl border bg-white transition-shadow hover:shadow-sm ${
                  overdue ? 'border-red-200' : 'border-gray-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* PO number + status badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-semibold text-gray-900">
                          {order.poNumber}
                        </span>
                        {partial && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            <PiClockCountdown className="h-3 w-3" /> In Progress
                          </span>
                        )}
                        {overdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            <PiWarning className="h-3 w-3" />
                            {daysOverdue === 1
                              ? '1 day overdue'
                              : `${daysOverdue} days overdue`}
                          </span>
                        )}
                      </div>

                      {/* Vendor */}
                      {order.vendorName && (
                        <p className="mt-0.5 text-sm text-gray-500">
                          {order.vendorName}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {receivedQty} of {totalQty} units received
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              pct === 100 ? 'text-green-600' : 'text-gray-700'
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct === 100
                                ? 'bg-green-500'
                                : overdue
                                  ? 'bg-red-400'
                                  : 'bg-[#b20202]'
                            }`}
                            style={{
                              width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>
                          {order.items.length} line
                          {order.items.length !== 1 ? 's' : ''}
                        </span>
                        <span className="font-medium text-gray-600">
                          {remainingQty} unit{remainingQty !== 1 ? 's' : ''}{' '}
                          remaining
                        </span>
                        {order.expectedArrival && (
                          <span
                            className={
                              overdue ? 'font-medium text-red-600' : ''
                            }
                          >
                            Expected{' '}
                            {new Date(
                              order.expectedArrival
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Line items preview chips */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {order.items.slice(0, 4).map((item, idx) => {
                          const name =
                            (item as any).subProductName ??
                            item.productName ??
                            '';
                          const size = (item as any).sizeName;
                          const label =
                            size && !name.includes(size)
                              ? `${name} – ${size}`
                              : name;
                          const done = item.receivedQty >= item.quantity;
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                done
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {done && (
                                <PiCheckCircle className="h-3 w-3 shrink-0" />
                              )}
                              <span className="max-w-[120px] truncate">
                                {label || item.sku || 'Item'}
                              </span>
                              <span className="opacity-60">
                                ×{item.quantity}
                              </span>
                            </span>
                          );
                        })}
                        {order.items.length > 4 && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            +{order.items.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                      <Link
                        href={routes.eCommerce.purchaseReceipt(order._id)}
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                          overdue
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-[#b20202] hover:bg-[#9a0101]'
                        }`}
                      >
                        {partial ? 'Continue' : 'Receive'}
                        <PiArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href={routes.eCommerce.purchaseDetails(order._id)}
                        className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
                      >
                        View PO
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
