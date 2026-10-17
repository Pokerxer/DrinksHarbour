'use client';
import { useEffect, useState } from 'react';
import type { BatchSummary } from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';
import { emptyBatchFilters, type BatchFilters } from './use-batch-workspace';
const accountNames: Record<string, string> = {
  '1000': 'Cash',
  '1100': 'Bank',
  '2200': 'Wallet',
};
export const batchAccountName = (value: string) => accountNames[value] || value;
const input =
  'mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300';
export default function BatchWorkspaceToolbar({
  filters,
  update,
  summary,
  loading,
  busy,
  refresh,
  create,
}: {
  filters: BatchFilters;
  update: (values: BatchFilters) => void;
  summary: BatchSummary | null;
  loading: boolean;
  busy: boolean;
  refresh: () => void;
  create: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    setDraft(filters);
  }, [filters]);
  const invalid = !!draft.from && !!draft.to && draft.from > draft.to;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-500">
          Group recorded payments and verified Sales/POS receipt portions by
          Cash, Bank or Wallet. Completion records reconciliation.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Refresh batches"
            disabled={loading || busy}
            onClick={refresh}
            className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={create}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            New batch
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-1 overflow-hidden rounded-xl border bg-white sm:grid-cols-3">
        {(['open', 'completed', 'cancelled'] as const).map((status) => (
          <div key={status} className="border-gray-100 p-4 sm:border-r">
            <dt className="text-xs capitalize text-gray-500">
              {status} batches
            </dt>
            <dd className="mt-2 text-xl font-semibold tabular-nums">
              {loading || !summary ? '—' : fmtMoney(summary[`${status}Amount`])}
            </dd>
            <p className="mt-1 text-xs text-gray-500">
              {loading || !summary
                ? 'Unavailable'
                : `${summary[`${status}Count`]} matching batches`}
            </p>
          </div>
        ))}
      </dl>
      <form
        aria-label="Batch filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) update({ ...draft, search: draft.search.trim() });
        }}
        className="rounded-xl border bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs text-gray-500">
            Search batches
            <input
              aria-label="Search batches"
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              placeholder="Batch, receipt or name"
              className={input}
            />
          </label>
          <label className="text-xs text-gray-500">
            Status
            <select
              aria-label="Batch status"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className={input}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="deposited">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Account
            <select
              aria-label="Batch account"
              value={draft.account}
              onChange={(e) => setDraft({ ...draft, account: e.target.value })}
              className={input}
            >
              <option value="">All accounts</option>
              {['1000', '1100', '2200'].map((a) => (
                <option key={a} value={a}>
                  {batchAccountName(a)}
                </option>
              ))}
            </select>
          </label>
          {(['from', 'to'] as const).map((key) => (
            <label key={key} className="text-xs text-gray-500">
              {key === 'from' ? 'From' : 'To'}
              <input
                type="date"
                value={draft[key]}
                aria-invalid={invalid}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className={input}
              />
            </label>
          ))}
        </div>
        {invalid && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            End date must be on or after start date.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Totals cover all matching batches.
          </p>
          <div className="flex gap-2">
            {Object.values(draft).some(Boolean) && (
              <button
                type="button"
                onClick={() => {
                  setDraft(emptyBatchFilters);
                  update(emptyBatchFilters);
                }}
                className="px-3 py-2 text-sm underline"
              >
                Clear filters
              </button>
            )}
            <button
              type="submit"
              disabled={invalid || busy}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Apply filters
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
