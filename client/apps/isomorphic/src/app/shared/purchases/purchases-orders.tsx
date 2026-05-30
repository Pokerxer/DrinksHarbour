'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiArrowClockwise,
  PiEye,
  PiPencilSimple,
  PiTrash,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from './types';
import { STATUS_BADGE, statusLabel } from './types';

export default function PurchasesOrders() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status') ?? '';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await purchaseOrderService.getPurchaseOrders(token, params);
      setOrders(res.data ?? res.purchaseOrders ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
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

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      !q ||
      o.poNumber?.toLowerCase().includes(q) ||
      o.vendorName?.toLowerCase().includes(q)
    );
  });

  const pageTitle = statusFilter === 'confirmed' ? 'Purchase Orders' : 'Requests for Quotation';

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={routes.eCommerce.createPurchase}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" />
            New
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PO# or vendor…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-gray-500">No orders found</p>
            <Link
              href={routes.eCommerce.createPurchase}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiPlus className="h-4 w-4" />
              Create your first order
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">PO Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Currency</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Expected Arrival</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">
                    {order.poNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{order.vendorName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{order.currency}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {order.expectedArrival
                      ? new Date(order.expectedArrival).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={routes.eCommerce.purchaseDetails(order._id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="View"
                      >
                        <PiEye className="h-4 w-4" />
                      </Link>
                      {order.status === 'draft' && !order.isLocked && (
                        <Link
                          href={routes.eCommerce.editPurchase(order._id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <PiPencilSimple className="h-4 w-4" />
                        </Link>
                      )}
                      {order.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(order._id)}
                          disabled={deleting === order._id}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          title="Delete"
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
