'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PiX,
  PiMagnifyingGlass,
  PiSpinner,
  PiArrowDownLeft,
} from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';

interface SOLine {
  _id: string;
  subproduct?: string;
  product?: string;
  name: string;
  sku?: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'fixed' | 'percentage';
  taxRate?: number;
  lineType?: string;
}

interface SalesOrderRow {
  _id: string;
  soNumber: string;
  docType: 'quotation' | 'order';
  quoteStatus?: string;
  orderStatus?: string;
  customerSnapshot?: { name?: string };
  total: number;
  createdAt: string;
  items: SOLine[];
  pricelist?: string;
  warehouseId?: string;
}

interface Props {
  token: string;
  onLoad: (order: SalesOrderRow) => void;
  onClose: () => void;
}

function statusLabel(so: SalesOrderRow): string {
  if (so.docType === 'quotation') return so.quoteStatus ?? 'draft';
  return so.orderStatus ?? 'draft';
}

function statusColor(so: SalesOrderRow): string {
  const s = statusLabel(so);
  if (['draft', 'sent'].includes(s)) return 'bg-yellow-100 text-yellow-700';
  if (['confirmed', 'accepted'].includes(s)) return 'bg-blue-100 text-blue-700';
  if (['fulfilled', 'converted'].includes(s))
    return 'bg-emerald-100 text-emerald-700';
  if (['rejected', 'cancelled', 'expired'].includes(s))
    return 'bg-red-100 text-red-600';
  return 'bg-gray-100 text-gray-600';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function POSOrderPickerModal({ token, onLoad, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const data = await posApi.getSalesOrdersForPOS(token, {
          search: q || undefined,
          limit: 50,
        });
        setOrders((data as any)?.salesOrders ?? (data as any)?.data ?? []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetch('');
  }, [fetch]);

  useEffect(() => {
    const t = setTimeout(() => fetch(search), 300);
    return () => clearTimeout(t);
  }, [search, fetch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Quotations &amp; Orders
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <PiMagnifyingGlass className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <PiSpinner className="h-6 w-6 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">
              No orders found
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
                  <th className="px-4 py-2.5 text-left">Number</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Customer</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((so) => (
                  <tr key={so._id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">
                      {so.soNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {fmtDate(so.createdAt)}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-gray-700">
                      {so.customerSnapshot?.name ?? 'Walk-in'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                      ₦
                      {so.total?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor(so)}`}
                      >
                        {statusLabel(so)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onLoad(so)}
                        className="flex items-center gap-1 rounded-lg bg-[#b20202] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#9a0101]"
                      >
                        <PiArrowDownLeft className="h-3.5 w-3.5" /> Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
