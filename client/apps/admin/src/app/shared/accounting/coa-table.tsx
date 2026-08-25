'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { PiPencilSimple } from 'react-icons/pi';
import type { Account } from '@/services/accounting.service';
import { groupAccountsByType } from './accounting-helpers';

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

/** Chart of Accounts table grouped by account type with activate/deactivate. */
export default function CoaTable({
  accounts,
  onEdit,
  onToggleActive,
}: {
  accounts: Account[];
  onEdit: (a: Account) => void;
  onToggleActive: (a: Account) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const groups = groupAccountsByType(accounts);

  const toggle = async (a: Account) => {
    setBusyId(a._id);
    try {
      await onToggleActive(a);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.type}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {g.label}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {g.rows.map((a) => (
                  <tr key={a._id} className={a.isActive ? '' : 'opacity-50'}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{a.code}</td>
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-gray-500">{a.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {a.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {a.isSystem && (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                          System
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(a)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-label={`Edit ${a.name}`}
                      >
                        <PiPencilSimple size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === a._id}
                        onClick={() => toggle(a)}
                        className="ml-1 rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        {a.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {accounts.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          No accounts yet — they are seeded automatically on first load.
        </p>
      )}
    </div>
  );
}
