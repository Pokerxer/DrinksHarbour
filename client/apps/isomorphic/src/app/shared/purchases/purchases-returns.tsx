'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowClockwise, PiEye } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorReturnService } from '@/services/vendorReturn.service';
import type { VendorReturn } from './types';
import { STATUS_BADGE, statusLabel } from './types';

export default function PurchasesReturns() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [returns, setReturns] = useState<VendorReturn[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorReturnService.getVendorReturns(token);
      setReturns(res.data ?? res.returns ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vendor Returns</h1>
          <p className="text-sm text-gray-500">{returns.length} return{returns.length !== 1 ? 's' : ''}</p>
        </div>
        <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
          <PiArrowClockwise className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
        ) : returns.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No vendor returns found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Return #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Refund Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((ret) => (
                <tr key={ret._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{ret.returnNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{ret.vendorName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[ret.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel(ret.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {ret.refundAmount ? ret.refundAmount.toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={routes.eCommerce.vendorReturnDetails(ret._id)}
                      className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <PiEye className="h-4 w-4" />
                    </Link>
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
