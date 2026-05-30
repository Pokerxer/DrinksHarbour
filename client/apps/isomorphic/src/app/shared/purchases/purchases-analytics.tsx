'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { PiArrowClockwise } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { purchaseAnalyticsService } from '@/services/purchaseAnalytics.service';
import type { PurchaseAnalyticsSummary } from './types';

export default function PurchasesAnalytics() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [summary, setSummary] = useState<PurchaseAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseAnalyticsService.getSummary(token);
      setSummary(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const cards = summary ? [
    { label: 'Total Orders', value: summary.totalOrders, color: 'text-blue-600' },
    { label: 'Total Spend', value: summary.totalSpend?.toFixed(2), color: 'text-gray-900', prefix: '₦' },
    { label: 'Pending Bills', value: summary.pendingBills, color: 'text-yellow-600' },
    { label: 'Overdue Amount', value: summary.overdueAmount?.toFixed(2), color: 'text-red-600', prefix: '₦' },
  ] : [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Purchase Analysis</h1>
        <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
          <PiArrowClockwise className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cards.map(({ label, value, color, prefix }) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${color}`}>{prefix}{value}</p>
              </div>
            ))}
          </div>

          {summary?.topVendors && summary.topVendors.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-700">Top Vendors by Spend</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vendor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.topVendors.map((v, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{v.vendorName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{v.orderCount}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₦{v.totalSpend?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
