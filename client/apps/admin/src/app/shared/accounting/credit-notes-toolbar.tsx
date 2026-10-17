'use client';
import { useState } from 'react';
import { PiArrowClockwise, PiPlus, PiMagnifyingGlass } from 'react-icons/pi';
import type { CreditNoteSummary } from '@/services/arAp.service';
import { fmtMoney } from './accounting-helpers';
const input =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-600 focus:outline-none';
interface Props {
  filters: { status: string; search: string; from: string; to: string };
  filter: (value: Partial<Props['filters']>) => void;
  summary: CreditNoteSummary;
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}
export default function CreditNotesToolbar({
  filters,
  filter,
  summary,
  loading,
  onRefresh,
  onCreate,
}: Props) {
  const [search, setSearch] = useState(filters.search);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-500">
          Review customer adjustments, track available credit and apply it to
          outstanding invoices.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Refresh credit notes"
            disabled={loading}
            onClick={onRefresh}
            className={`${input} flex items-center gap-2 disabled:opacity-50`}
          >
            <PiArrowClockwise /> Refresh
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            <PiPlus /> New credit note
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 md:grid-cols-4">
        {[
          ['Posted credit', summary.postedTotal],
          ['Applied to invoices', summary.appliedTotal],
          ['Available credit', summary.available],
          ['Draft credit', summary.draftTotal],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd
              className={`mt-1 text-lg font-semibold tabular-nums ${label === 'Available credit' ? 'text-emerald-700' : 'text-gray-900'}`}
            >
              {loading ? '—' : fmtMoney(Number(value))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="flex min-w-60 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            filter({ search: search.trim() });
          }}
        >
          <input
            aria-label="Search credit notes"
            placeholder="Number, customer or reason"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${input} w-full`}
          />
          <button type="submit" aria-label="Search" className={input}>
            <PiMagnifyingGlass />
          </button>
        </form>
        <select
          aria-label="Credit status"
          value={filters.status}
          onChange={(e) => filter({ status: e.target.value })}
          className={input}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="applied">All posted</option>
          <option value="available">Available</option>
          <option value="partial">Partially applied</option>
          <option value="full">Fully applied</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {(['from', 'to'] as const).map((key) => (
          <label key={key} className="text-xs text-gray-500">
            {key === 'from' ? 'From' : 'To'}
            <input
              type="date"
              value={filters[key]}
              onChange={(e) => filter({ [key]: e.target.value })}
              className={`${input} ml-2`}
            />
          </label>
        ))}
        {(filters.status || filters.search || filters.from || filters.to) && (
          <button
            type="button"
            className="px-2 py-2 text-sm underline"
            onClick={() => {
              setSearch('');
              filter({ status: '', search: '', from: '', to: '' });
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Totals cover all matching credit notes, including VAT. Cancelled notes
        are excluded from credit balances.
      </p>
    </div>
  );
}
