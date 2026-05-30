'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiPlus, PiTrash, PiCheck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorPricelistService } from '@/services/vendorPricelist.service';

interface Line { productName: string; unitPrice: number; minQuantity: number; }

export default function PurchasesPricelistCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [name, setName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  function addLine() { setLines((p) => [...p, { productName: '', unitPrice: 0, minQuantity: 1 }]); }
  function removeLine(i: number) { setLines((p) => p.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, f: keyof Line, v: string | number) {
    setLines((p) => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l));
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error('Pricelist name is required'); return; }
    setSaving(true);
    try {
      const res = await vendorPricelistService.createPricelist({ name, vendorName, currency, isActive: true, items: lines.map((l) => ({ ...l, subProductId: '' })) }, token);
      toast.success('Pricelist created');
      router.push(routes.eCommerce.vendorPricelistDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-gray-900">New Vendor Pricelist</h1>
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Pricelist Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Vendor</label>
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20">
                {['NGN','USD','EUR','GBP'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Price Lines</h2>
            <button type="button" onClick={addLine} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <PiPlus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>
          {lines.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No price lines yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Min Qty</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <input value={line.productName} onChange={(e) => updateLine(i, 'productName', e.target.value)} placeholder="Product name"
                        className="w-48 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', Number(e.target.value))}
                        className="w-28 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" value={line.minQuantity} onChange={(e) => updateLine(i, 'minQuantity', Number(e.target.value))}
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeLine(i)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <PiTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={handleCreate} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
            <PiCheck className="h-4 w-4" />{saving ? 'Creating…' : 'Create Pricelist'}
          </button>
        </div>
      </div>
    </div>
  );
}
