'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiArrowClockwise,
  PiEye,
  PiPencilSimple,
  PiTrash,
  PiPackage,
  PiReceipt,
  PiClockCountdown,
  PiCurrencyDollar,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from './types';
import { STATUS_BADGE, statusLabel } from './types';

type TabKey = 'all' | 'rfq' | 'po' | 'to_receive' | 'to_bill';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'rfq', label: 'Requests for Quotation' },
  { key: 'po', label: 'Purchase Orders' },
  { key: 'to_receive', label: 'To Receive' },
  { key: 'to_bill', label: 'To Bill' },
];

const EMPTY_MESSAGES: Record<TabKey, string> = {
  all: 'No purchase orders yet',
  rfq: 'No open quotation requests',
  po: 'No confirmed purchase orders',
  to_receive: 'All goods have been received',
  to_bill: 'No orders pending billing',
};

function orderTotal(order: PurchaseOrder): number {
  return order.items.reduce(
    (sum, item) => sum + (item.totalCost ?? item.unitPrice * item.quantity),
    0
  );
}

function isToReceive(order: PurchaseOrder): boolean {
  return (
    order.status === 'confirmed' &&
    order.items.some((item) => item.receivedQty < item.quantity)
  );
}

function isToBill(order: PurchaseOrder): boolean {
  return (
    order.status === 'received' ||
    order.status === 'done' ||
    order.status === 'validated'
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-3.5 animate-pulse rounded-md bg-gray-100"
            style={{ width: `${[60, 80, 50, 45, 55, 50, 30][i]}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function PurchasesOrders() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrders(token, {});
      const data: PurchaseOrder[] = res.data ?? res.purchaseOrders ?? [];
      data.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
      setOrders(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this purchase order?')) return;
    setDeleting(id);
    try {
      await purchaseOrderService.deletePurchaseOrder(id, token);
      toast.success('Purchase order deleted');
      setOrders((prev) => prev.filter((o) => o._id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  const tabCounts = useMemo(
    () => ({
      all: orders.length,
      rfq: orders.filter((o) => o.status === 'draft').length,
      po: orders.filter((o) => o.status === 'confirmed').length,
      to_receive: orders.filter(isToReceive).length,
      to_bill: orders.filter(isToBill).length,
    }),
    [orders]
  );

  const totalSpend = useMemo(
    () => orders.reduce((s, o) => s + orderTotal(o), 0),
    [orders]
  );

  const filtered = useMemo(() => {
    let list = orders;
    if (activeTab === 'rfq') list = list.filter((o) => o.status === 'draft');
    else if (activeTab === 'po')
      list = list.filter((o) => o.status === 'confirmed');
    else if (activeTab === 'to_receive') list = list.filter(isToReceive);
    else if (activeTab === 'to_bill') list = list.filter(isToBill);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.poNumber?.toLowerCase().includes(q) ||
          o.vendorName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, activeTab, search]);

  const currency = orders[0]?.currency ?? 'NGN';

  return (
    <div>
      {/* Page header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Requests for Quotation
          </h1>
          <p className="text-sm text-gray-500">
            Manage your purchase orders and vendor quotations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            title="Refresh"
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={routes.eCommerce.createPurchase}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" />
            New Order
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
            <PiPackage className="h-4 w-4 text-gray-600" />
          </div>
          <p className="text-xs text-gray-500">Total Orders</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">
            {loading ? (
              <span className="inline-block h-7 w-10 animate-pulse rounded bg-gray-100" />
            ) : (
              orders.length
            )}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            <PiReceipt className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-xs text-gray-500">Pending Confirmation</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">
            {loading ? (
              <span className="inline-block h-7 w-8 animate-pulse rounded bg-gray-100" />
            ) : (
              tabCounts.rfq
            )}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <PiClockCountdown className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xs text-gray-500">Awaiting Receipt</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900">
            {loading ? (
              <span className="inline-block h-7 w-8 animate-pulse rounded bg-gray-100" />
            ) : (
              tabCounts.to_receive
            )}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
            <PiCurrencyDollar className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-xs text-gray-500">Total Spend</p>
          <p className="mt-0.5 text-xl font-bold text-gray-900">
            {loading ? (
              <span className="inline-block h-7 w-20 animate-pulse rounded bg-gray-100" />
            ) : (
              `${currency} ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            )}
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {!loading && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                    activeTab === tab.key
                      ? 'bg-[#b20202]/10 text-[#b20202]'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PO# or vendor…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
          />
        </div>
        {!loading && (
          <p className="shrink-0 text-sm text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                PO Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Vendor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Total Value
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Expected Arrival
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <PiPackage className="h-10 w-10 text-gray-300" />
                    <p className="text-sm text-gray-500">
                      {EMPTY_MESSAGES[activeTab]}
                    </p>
                    {activeTab === 'all' && (
                      <Link
                        href={routes.eCommerce.createPurchase}
                        className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
                      >
                        <PiPlus className="h-4 w-4" />
                        Create Purchase Order
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((order) => {
                const total = orderTotal(order);
                const canEdit = order.status === 'draft' && !order.isLocked;
                const canDelete = order.status === 'draft';
                return (
                  <tr
                    key={order._id}
                    onClick={() =>
                      router.push(routes.eCommerce.purchaseDetails(order._id))
                    }
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">
                          {order.poNumber}
                        </span>
                        {order.isLocked && (
                          <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
                            Locked
                          </span>
                        )}
                        {order.isBackorder && (
                          <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                            Backorder
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {order.vendorName ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[order.status] ??
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-gray-900">
                      {order.currency}{' '}
                      {total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">
                      {order.expectedArrival ? (
                        new Date(order.expectedArrival).toLocaleDateString()
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">
                      {order.createdAt ? (
                        new Date(order.createdAt).toLocaleDateString()
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={routes.eCommerce.purchaseDetails(order._id)}
                          title="View"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <PiEye className="h-4 w-4" />
                        </Link>
                        {canEdit && (
                          <Link
                            href={routes.eCommerce.editPurchase(order._id)}
                            title="Edit"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </Link>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={(e) => handleDelete(e, order._id)}
                            disabled={deleting === order._id}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          >
                            <PiTrash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
