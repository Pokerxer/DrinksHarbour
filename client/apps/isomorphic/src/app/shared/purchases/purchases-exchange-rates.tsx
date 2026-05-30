'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { PiPlus, PiArrowClockwise, PiTrash } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { exchangeRateService } from '@/services/exchangeRate.service';
import type { ExchangeRate } from './types';

export default function PurchasesExchangeRates() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('NGN');
  const [rate, setRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await exchangeRateService.getRates(token);
      setRates(res.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!rate || parseFloat(rate) <= 0) { toast.error('Enter a valid rate'); return; }
    setSaving(true);
    try {
      await exchangeRateService.createRate({ fromCurrency, toCurrency, rate: parseFloat(rate), effectiveDate, isActive: true }, token);
      toast.success('Exchange rate created');
      setShowForm(false); setRate('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rate?')) return;
    try {
      await exchangeRateService.deleteRate(id, token);
      toast.success('Deleted');
      setRates((p) => p.filter((r) => r._id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP', 'ZAR', 'GHS'];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Exchange Rates</h1>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]">
            <PiPlus className="h-4 w-4" /> New Rate
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
              <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
              <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Rate (1 {fromCurrency} = ? {toCurrency})</label>
              <input type="number" min="0" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 1550"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Effective Date</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
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
        ) : rates.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No exchange rates defined</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">To</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Rate</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Effective Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.fromCurrency}</td>
                  <td className="px-4 py-3 text-gray-700">{r.toCurrency}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{r.rate}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.effectiveDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => handleDelete(r._id)}
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
