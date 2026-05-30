'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiPlus, PiArrowClockwise, PiEye } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseAgreementService } from '@/services/purchaseAgreement.service';
import type { PurchaseAgreement } from './types';
import { STATUS_BADGE, statusLabel } from './types';

export default function PurchasesAgreements() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [agreements, setAgreements] = useState<PurchaseAgreement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseAgreementService.getAgreements(token);
      setAgreements(res.data ?? res.agreements ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const typeLabel = (t: string) => t === 'blanket_order' ? 'Blanket Order' : t === 'call_for_tender' ? 'Call for Tender' : 'None';

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Purchase Agreements</h1>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link href={routes.eCommerce.createPurchaseAgreement}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]">
            <PiPlus className="h-4 w-4" /> New Agreement
          </Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
        ) : agreements.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No agreements found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Agreement #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">End Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agreements.map((a) => (
                <tr key={a._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{a.agreementNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{a.vendorName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{typeLabel(a.agreementType)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel(a.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.endDate ? new Date(a.endDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={routes.eCommerce.purchaseAgreementDetails(a._id)}
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
