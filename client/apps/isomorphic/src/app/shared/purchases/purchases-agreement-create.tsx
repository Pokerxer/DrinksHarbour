'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiCheck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseAgreementService } from '@/services/purchaseAgreement.service';

export default function PurchasesAgreementCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [vendorName, setVendorName] = useState('');
  const [agreementType, setAgreementType] = useState<'blanket_order' | 'call_for_tender'>('blanket_order');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!vendorName.trim()) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      const res = await purchaseAgreementService.createAgreement({ vendorName, agreementType, startDate: startDate || undefined, endDate: endDate || undefined, notes }, token);
      toast.success('Agreement created');
      router.push(routes.eCommerce.purchaseAgreementDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-gray-900">New Purchase Agreement</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Vendor Name</label>
            <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Agreement Type</label>
            <select value={agreementType} onChange={(e) => setAgreementType(e.target.value as 'blanket_order' | 'call_for_tender')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20">
              <option value="blanket_order">Blanket Order</option>
              <option value="call_for_tender">Call for Tender</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={handleCreate} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
            <PiCheck className="h-4 w-4" />{saving ? 'Creating…' : 'Create Agreement'}
          </button>
        </div>
      </div>
    </div>
  );
}
