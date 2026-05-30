'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { PiCheck, PiFloppyDisk } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';

export default function PurchasesBillCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const poId = searchParams.get('po') ?? '';

  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!poId) { toast.error('No purchase order selected. Navigate here from a PO.'); return; }
    setSaving(true);
    try {
      const res = await purchaseOrderService.createBillFromPO(poId, token, { billDate, dueDate: dueDate || undefined, notes, billControlPolicy: 'received' });
      toast.success('Vendor bill created');
      router.push(routes.eCommerce.vendorBillDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-gray-900">Create Vendor Bill</h1>
      {!poId && (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Navigate here from a received Purchase Order to auto-populate bill lines.
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Bill Date</label>
            <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={handleCreate} disabled={saving || !poId}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
            <PiCheck className="h-4 w-4" />{saving ? 'Creating…' : 'Create Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}
