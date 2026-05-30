'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCheck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseAgreementService } from '@/services/purchaseAgreement.service';
import type { PurchaseAgreement } from './types';
import { STATUS_BADGE, statusLabel } from './types';

export default function PurchasesAgreementDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [agreement, setAgreement] = useState<PurchaseAgreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseAgreementService.getAgreement(id, token);
      setAgreement(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  async function handleActivate() {
    setActing(true);
    try {
      await purchaseAgreementService.activateAgreement(id, token);
      toast.success('Agreement activated');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate');
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>;
  if (!agreement) return <div className="py-20 text-center text-sm text-gray-500">Agreement not found</div>;

  const typeLabel = agreement.agreementType === 'blanket_order' ? 'Blanket Order' : 'Call for Tender';

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.purchaseAgreements} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Purchase Agreements
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{agreement.agreementNumber}</span>
      </div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{agreement.agreementNumber}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[agreement.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {statusLabel(agreement.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{typeLabel}{agreement.vendorName ? ` · ${agreement.vendorName}` : ''}</p>
        </div>
        {agreement.status === 'draft' && (
          <button type="button" onClick={handleActivate} disabled={acting}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
            <PiCheck className="h-4 w-4" /> Activate
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Start Date', value: agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : '—' },
          { label: 'End Date', value: agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : '—' },
          { label: 'Created', value: agreement.createdAt ? new Date(agreement.createdAt).toLocaleDateString() : '—' },
          { label: 'Type', value: typeLabel },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 font-medium text-gray-900">{value}</p>
          </div>
        ))}
      </div>
      {agreement.notes && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Notes</p>
          <p className="mt-1 text-sm text-gray-700">{agreement.notes}</p>
        </div>
      )}
    </div>
  );
}
