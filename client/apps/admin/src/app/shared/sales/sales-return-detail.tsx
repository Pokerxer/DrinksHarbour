'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowLeft } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export default function SalesReturnDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />
    );
  if (!so)
    return (
      <div className="py-20 text-center text-sm text-gray-500">Not found</div>
    );

  const returnedLines = so.items.filter((it) => (it.returnedQty || 0) > 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesReturns}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Returns
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Return — {so.soNumber}
        </h1>
        <Link
          href={routes.eCommerce.salesDetails(so._id)}
          className="text-sm text-brand hover:underline"
        >
          View order
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Product
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Fulfilled
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Returned
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Unit Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                Refund Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {returnedLines.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-16 text-center text-sm text-gray-400"
                >
                  No returned units on this order
                </td>
              </tr>
            ) : (
              returnedLines.map((item) => {
                const unit = Math.max(0, item.unitPrice - item.discount);
                return (
                  <tr key={item._id}>
                    <td className="px-4 py-3 text-gray-900">
                      {item.name}
                      {item.sku && (
                        <span className="ml-2 font-mono text-xs text-gray-400">
                          {item.sku}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {item.fulfilledQty}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-amber-600">
                      {item.returnedQty}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fmtCur(item.unitPrice, so.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtCur(unit * (item.returnedQty || 0), so.currency)}
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
