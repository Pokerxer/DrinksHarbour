'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { PiPlus, PiArrowClockwise, PiTrash } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { uomConversionService } from '@/services/uomConversion.service';
import type { UomConversion } from './types';

export default function PurchasesUom() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [conversions, setConversions] = useState<UomConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fromUom, setFromUom] = useState('');
  const [toUom, setToUom] = useState('');
  const [factor, setFactor] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await uomConversionService.getConversions(token);
      setConversions(res.data ?? res.conversions ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!fromUom.trim() || !toUom.trim()) { toast.error('From and To UOM required'); return; }
    setSaving(true);
    try {
      await uomConversionService.createConversion({ fromUom, toUom, factor: parseFloat(factor), notes }, token);
      toast.success('UOM conversion created');
      setShowForm(false); setFromUom(''); setToUom(''); setFactor('1'); setNotes('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this conversion?')) return;
    try {
      await uomConversionService.deleteConversion(id, token);
      toast.success('Deleted');
      setConversions((p) => p.filter((c) => c._id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">UOM Conversions</h1>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]">
            <PiPlus className="h-4 w-4" /> New Conversion
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From UOM</label>
              <input value={fromUom} onChange={(e) => setFromUom(e.target.value)} placeholder="e.g. case"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">To UOM</label>
              <input value={toUom} onChange={(e) => setToUom(e.target.value)} placeholder="e.g. unit"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Factor</label>
              <input type="number" min="0" step="0.001" value={factor} onChange={(e) => setFactor(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none" />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={saving}
              className="rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading…</div>
        ) : conversions.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No UOM conversions defined</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">To</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Factor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversions.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.fromUom}</td>
                  <td className="px-4 py-3 text-gray-700">{c.toUom}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{c.factor}</td>
                  <td className="px-4 py-3 text-gray-500">{c.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => handleDelete(c._id)}
                      className="inline-flex rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <PiTrash className="h-4 w-4" />
                    </button>
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
