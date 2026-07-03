'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiArrowSquareOut,
  PiShoppingCart,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  reorderService,
  type ReorderSuggestion,
} from '@/services/reorder.service';

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const URGENCY_BADGE: Record<ReorderSuggestion['urgency'], string> = {
  critical: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200',
  high: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200',
  normal: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200',
};

/**
 * Procurement: what to buy right now. Reorder suggestions computed from stock
 * levels vs reorder points, handing off to the Purchases module to raise POs.
 */
export default function InventoryProcurement() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = (await reorderService.getSuggestions(token)) as {
        data?: ReorderSuggestion[];
      };
      setSuggestions(res.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load suggestions'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCost = suggestions.reduce((s, x) => s + (x.estimatedCost || 0), 0);

  return (
    <div className="p-4 md:p-5 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Procurement</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Products at or below their reorder point —{' '}
            {loading
              ? '…'
              : `${suggestions.length} to order, est. ${ngn.format(totalCost)}`}
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={routes.eCommerce.createPurchase}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiShoppingCart className="h-4 w-4" />
            New purchase order
          </Link>
          <Link
            href={routes.eCommerce.purchases}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <PiArrowSquareOut className="h-4 w-4" />
            Purchase orders
          </Link>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Urgency</th>
                <th className="px-4 py-3 text-right font-medium">On hand</th>
                <th className="px-4 py-3 text-right font-medium">Reorder at</th>
                <th className="px-4 py-3 text-right font-medium">
                  Suggested qty
                </th>
                <th className="px-4 py-3 text-right font-medium">Lead time</th>
                <th className="px-4 py-3 text-right font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Loading suggestions…
                  </td>
                </tr>
              ) : suggestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <PiShoppingCart className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-400">
                      Nothing needs ordering — all stock is above its reorder
                      point.
                    </p>
                  </td>
                </tr>
              ) : (
                suggestions.map((s) => (
                  <tr
                    key={s.subProductId}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">
                        {(s.product as { name?: string })?.name ?? s.sku}
                      </span>
                      <span className="ml-1.5 text-xs text-gray-400">
                        {s.sku}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${URGENCY_BADGE[s.urgency]}`}
                      >
                        {s.urgency}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        s.currentStock <= 0 ? 'text-red-600' : 'text-gray-800'
                      }`}
                    >
                      {s.currentStock}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {s.reorderPoint}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {s.suggestedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {s.leadTimeDays ? `${s.leadTimeDays}d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {ngn.format(s.estimatedCost || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
