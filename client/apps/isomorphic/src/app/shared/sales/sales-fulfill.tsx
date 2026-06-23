'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowClockwise, PiTruck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import {
  ORDER_STATUS_BADGE,
  orderStatusLabel,
  outstanding,
} from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

function outstandingUnits(so: SalesOrder): number {
  return so.items.reduce((s, it) => s + outstanding(it), 0);
}

export default function SalesFulfill() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch confirmed + partially_fulfilled separately (the list endpoint filters by a single status).
      const [confirmed, partial] = await Promise.all([
        salesOrderService.list(token, {
          docType: 'order',
          status: 'confirmed',
        }),
        salesOrderService.list(token, {
          docType: 'order',
          status: 'partially_fulfilled',
        }),
      ]);
      setOrders([...(confirmed.data ?? []), ...(partial.data ?? [])]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const awaiting = useMemo(
    () => orders.filter((o) => outstandingUnits(o) > 0),
    [orders]
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Awaiting Fulfillment
          </h1>
          <p className="text-sm text-gray-500">
            Confirmed orders with units still to ship
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
        >
          <PiArrowClockwise className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Order #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Outstanding Units
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-gray-100">
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 rounded bg-gray-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-32 rounded bg-gray-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 w-16 rounded-full bg-gray-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="ml-auto h-4 w-10 rounded bg-gray-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="ml-auto h-4 w-16 rounded bg-gray-100" />
                  </td>
                </tr>
              ))
            ) : awaiting.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-20 text-center text-sm text-gray-400"
                >
                  <PiTruck className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  Nothing awaiting fulfillment
                </td>
              </tr>
            ) : (
              awaiting.map((o) => (
                <tr
                  key={o._id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    router.push(routes.eCommerce.salesFulfillDetails(o._id))
                  }
                >
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">
                    {o.soNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {o.customerSnapshot?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE[o.orderStatus ?? 'confirmed']}`}
                    >
                      {orderStatusLabel(o.orderStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {outstandingUnits(o)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {fmtCur(o.total, o.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
