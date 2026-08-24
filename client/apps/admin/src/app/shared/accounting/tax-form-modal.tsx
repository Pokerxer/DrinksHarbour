'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { taxService, type Tax, type TaxFlow, type TaxType } from '@/services/tax.service';
import { isValidTaxForm } from './tax-helpers';

const ALL_FLOWS: TaxFlow[] = ['sale', 'purchase', 'transfer', 'return'];

const SELECT_CLS =
  'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

// ─── Create/edit modal. Saves dispatch `taxes:changed` so the table reloads ──

export default function TaxFormModal({
  token,
  editing,
  onClose,
}: {
  token: string;
  editing: Tax | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          rate: String(editing.rate),
          type: editing.type,
          appliesTo: [...editing.appliesTo],
          isDefault: editing.isDefault,
          isActive: editing.isActive,
        }
      : {
          name: '',
          rate: '',
          type: 'output' as TaxType,
          appliesTo: [...ALL_FLOWS],
          isDefault: false,
          isActive: true,
        }
  );
  const [saving, setSaving] = useState(false);

  const toggleFlow = (flow: TaxFlow) =>
    setForm((f) => ({
      ...f,
      appliesTo: f.appliesTo.includes(flow)
        ? f.appliesTo.filter((x) => x !== flow)
        : [...f.appliesTo, flow],
    }));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        rate: Number(form.rate),
        type: form.type,
        appliesTo: form.appliesTo,
        isDefault: form.isDefault,
        isActive: form.isActive,
      };
      if (editing) await taxService.update(editing._id, token, body);
      else await taxService.create(token, body);
      toast.success(editing ? 'Tax updated' : 'Tax created');
      window.dispatchEvent(new Event('taxes:changed'));
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">
          {editing ? `Edit ${editing.name}` : 'New Tax'}
        </h2>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block font-medium">Name</span>
            <input
              className={SELECT_CLS}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VAT"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Rate (%)</span>
            <input
              className={SELECT_CLS}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              placeholder="7.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Type</span>
            <select
              className={SELECT_CLS}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TaxType })}
            >
              <option value="output">Output — collected on sales</option>
              <option value="input">Input — paid on purchases</option>
            </select>
          </label>
          <div>
            <span className="mb-1 block font-medium">Applies to</span>
            <div className="flex flex-wrap gap-3">
              {ALL_FLOWS.map((flow) => (
                <label key={flow} className="flex items-center gap-1.5 capitalize">
                  <input
                    type="checkbox"
                    checked={form.appliesTo.includes(flow)}
                    onChange={() => toggleFlow(flow)}
                  />
                  {flow}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Default for its type &amp; flows
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValidTaxForm(form) || saving}
            onClick={save}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
