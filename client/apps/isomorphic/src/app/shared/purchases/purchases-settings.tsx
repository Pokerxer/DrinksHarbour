'use client';
import { useState } from 'react';
import { PiFloppyDisk } from 'react-icons/pi';
import toast from 'react-hot-toast';

export default function PurchasesSettings() {
  const [billControl, setBillControl] = useState<'ordered' | 'received'>('received');
  const [defaultCurrency, setDefaultCurrency] = useState('NGN');
  const [requireApproval, setRequireApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setTimeout(() => {
      toast.success('Settings saved');
      setSaving(false);
    }, 500);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Purchase Settings</h1>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
          <PiFloppyDisk className="h-4 w-4" />{saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Order Policy</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Bill Control</label>
              <div className="space-y-2">
                {[
                  { value: 'received', label: 'On received quantities', desc: 'Bills can only be created after goods are received and validated.' },
                  { value: 'ordered', label: 'On ordered quantities', desc: 'Bills can be created as soon as a PO is confirmed.' },
                ].map((opt) => (
                  <label key={opt.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${billControl === opt.value ? 'border-[#b20202] bg-[#fef2f2]' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="billControl" value={opt.value} checked={billControl === opt.value}
                      onChange={() => setBillControl(opt.value as 'ordered' | 'received')} className="mt-0.5 accent-[#b20202]" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Default Currency</label>
              <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20">
                {['NGN','USD','EUR','GBP'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Approval</h2>
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="sr-only" />
              <div className={`h-5 w-9 rounded-full transition-colors ${requireApproval ? 'bg-[#b20202]' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${requireApproval ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Require approval for purchase orders</p>
              <p className="text-xs text-gray-500">POs above a threshold must be approved before confirmation.</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
