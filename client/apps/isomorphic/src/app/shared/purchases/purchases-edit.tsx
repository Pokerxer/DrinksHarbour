'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiFloppyDisk, PiArrowLeft } from 'react-icons/pi';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseOrder } from './types';

export default function PurchasesEdit({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [vendorReference, setVendorReference] = useState('');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrder(id, token);
      const data = res.data;
      setPO(data);
      setNotes(data.notes ?? '');
      setVendorReference(data.vendorReference ?? '');
      setExpectedArrival(data.expectedArrival ? data.expectedArrival.split('T')[0] : '');
      setTermsConditions(data.termsConditions ?? '');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await purchaseOrderService.updatePurchaseOrder(id, { notes, vendorReference, expectedArrival: expectedArrival || undefined, termsConditions }, token);
      toast.success('Purchase order updated');
      router.push(routes.eCommerce.purchaseDetails(id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>;
  if (!po) return <div className="py-20 text-center text-sm text-gray-500">Not found</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.purchaseDetails(id)} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> {po.poNumber}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">Edit</span>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Edit: {po.poNumber}</h1>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
          <PiFloppyDisk className="h-4 w-4" />{saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Vendor Reference</label>
            <input value={vendorReference} onChange={(e) => setVendorReference(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Expected Arrival</label>
            <input type="date" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Terms &amp; Conditions</label>
            <textarea value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
