'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiPencilSimple, PiPlus, PiTrash } from 'react-icons/pi';
import { taxService, type Tax, type TaxFlow, type TaxType } from '@/services/tax.service';
import { appliesToLabel, isValidTaxForm } from './tax-helpers';
import TaxLedgerTable from './tax-ledger-table';
import TaxSummary from './tax-summary';

type Tab = 'rates' | 'ledger' | 'summary';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'rates', label: 'Tax Rates' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'summary', label: 'Summary' },
];

const ALL_FLOWS: TaxFlow[] = ['sale', 'purchase', 'transfer', 'return'];

const SELECT_CLS =
  'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

const emptyForm = {
  name: '',
  rate: '',
  type: 'output' as TaxType,
  appliesTo: [...ALL_FLOWS] as TaxFlow[],
  isDefault: false,
  isActive: true,
};

// ─── Rates tab (table + inline form modal) ──────────────────────────────────

function TaxRatesTable({
  token,
  onEdit,
}: {
  token: string;
  onEdit: (tax: Tax) => void;
}) {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await taxService.list(token, {
        type: filterType || undefined,
      });
      setTaxes(res.data ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, filterType]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (tax: Tax) => {
    setTogglingId(tax._id);
    try {
      await taxService.update(tax._id, token, { isActive: !tax.isActive });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async (tax: Tax) => {
    if (!window.confirm(`Delete "${tax.name}"?`)) return;
    try {
      await taxService.remove(tax._id, token);
      toast.success('Tax deleted');
      await load();
    } catch (e) {
      // Server returns 409 with a "deactivate instead" message once referenced.
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <select
          className="w-44 rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="output">Output (sales)</option>
          <option value="input">Input (purchases)</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Applies to</th>
              <th className="px-4 py-3">Default</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && taxes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No taxes configured yet.
                </td>
              </tr>
            )}
            {taxes.map((tax) => (
              <tr key={tax._id} className={tax.isActive ? '' : 'opacity-60'}>
                <td className="px-4 py-3 font-medium">{tax.name}</td>
                <td className="px-4 py-3">{tax.rate}%</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tax.type === 'output'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {tax.type}
                  </span>
                </td>
                <td className="px-4 py-3 capitalize">{appliesToLabel(tax.appliesTo)}</td>
                <td className="px-4 py-3">
                  {tax.isDefault ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Default
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={togglingId === tax._id}
                    onClick={() => toggleActive(tax)}
                    className={`relative h-5 w-9 rounded-full transition ${
                      tax.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                    } disabled:opacity-50`}
                    aria-label={tax.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                        tax.isActive ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(tax)}
                    className="mr-2 rounded p-1.5 hover:bg-gray-100"
                    aria-label={`Edit ${tax.name}`}
                  >
                    <PiPencilSimple size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(tax)}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${tax.name}`}
                  >
                    <PiTrash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Reloader token={token} reload={load} />
    </div>
  );
}

/** Re-renders the table when a form save happens elsewhere in the parent. */
function Reloader({ token, reload }: { token: string; reload: () => void }) {
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('taxes:changed', handler);
    return () => window.removeEventListener('taxes:changed', handler);
  }, [reload, token]);
  return null;
}

// ─── Form modal ─────────────────────────────────────────────────────────────

function TaxFormModal({
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
      : { ...emptyForm }
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

// ─── Main view ──────────────────────────────────────────────────────────────

export default function TaxesView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'rates';
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'rates'
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);

  const switchTab = (next: Tab) => {
    setTab(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url.toString());
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'rates' && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            <PiPlus size={16} /> New Tax
          </button>
        )}
      </div>

      {tab === 'rates' && (
        <TaxRatesTable
          token={token}
          onEdit={(tax) => {
            setEditing(tax);
            setShowForm(true);
          }}
        />
      )}
      {tab === 'ledger' && <TaxLedgerTable token={token} />}
      {tab === 'summary' && <TaxSummary token={token} />}

      {showForm && (
        <TaxFormModal token={token} editing={editing} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
