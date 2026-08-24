'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiPencilSimple, PiTrash } from 'react-icons/pi';
import { taxService, type Tax } from '@/services/tax.service';
import { appliesToLabel } from './tax-helpers';

// ─── Rates tab: config table with active toggle + row actions ───────────────

export default function TaxRatesTable({
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
      {/* Re-renders this table when the form modal saves elsewhere in the parent. */}
      <Reloader token={token} reload={load} />
    </div>
  );
}

function Reloader({ token, reload }: { token: string; reload: () => void }) {
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('taxes:changed', handler);
    return () => window.removeEventListener('taxes:changed', handler);
  }, [reload, token]);
  return null;
}
