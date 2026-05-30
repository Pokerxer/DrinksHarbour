'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { PiPlus, PiArrowClockwise, PiPencilSimple, PiTrash, PiX, PiCheck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from './types';

function VendorModal({ vendor, onClose, onSaved, token }: { vendor: Vendor | null; onClose: () => void; onSaved: () => void; token: string }) {
  const [name, setName] = useState(vendor?.name ?? '');
  const [email, setEmail] = useState(vendor?.email ?? '');
  const [phone, setPhone] = useState(vendor?.phone ?? '');
  const [paymentTerms, setPaymentTerms] = useState(vendor?.paymentTerms ?? 'net_30');
  const [notes, setNotes] = useState(vendor?.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      if (vendor) {
        await vendorService.update(vendor._id, { name, email, phone, paymentTerms, notes }, token);
        toast.success('Vendor updated');
      } else {
        await vendorService.create({ name, email, phone, paymentTerms, notes }, token);
        toast.success('Vendor created');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <span className="text-base font-semibold text-gray-900">{vendor ? 'Edit Vendor' : 'New Vendor'}</span>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Payment Terms</label>
            <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as Vendor['paymentTerms'])}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20">
              {['prepaid','net_7','net_14','net_30','net_60'].map((t) => <option key={t} value={t}>{t.replace('_',' ').toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
              <PiCheck className="h-4 w-4" />{saving ? 'Saving…' : 'Save Vendor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PurchasesVendors() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Vendor | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorService.getAll(token);
      setVendors(res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this vendor?')) return;
    try {
      await vendorService.delete(id, token);
      toast.success('Vendor deleted');
      setVendors((p) => p.filter((v) => v._id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]">
            <PiPlus className="h-4 w-4" /> New Vendor
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-sm text-gray-500">No vendors yet</p>
            <button type="button" onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]">
              <PiPlus className="h-4 w-4" /> Add first vendor
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Payment Terms</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendors.map((v) => (
                <tr key={v._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                  <td className="px-4 py-3 text-gray-600">{v.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{v.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{v.paymentTerms?.replace('_',' ').toUpperCase() ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditing(v)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                        <PiPencilSimple className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(v._id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== undefined && (
        <VendorModal vendor={editing} token={token} onClose={() => setEditing(undefined)} onSaved={load} />
      )}
    </div>
  );
}
