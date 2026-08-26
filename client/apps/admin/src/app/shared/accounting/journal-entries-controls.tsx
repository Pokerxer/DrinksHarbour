'use client';

import {
  PiArrowsClockwise,
  PiDownloadSimple,
  PiMagnifyingGlass,
  PiPlus,
} from 'react-icons/pi';
import type { JournalEntry } from '@/services/accounting.service';
import { exportEntriesCsv } from './journal-entry-detail';

/** Every posted entry type — kept in ledger-report order for the pill row. */
export const TYPE_TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'sales_revenue', label: 'Sales Revenue' },
  { key: 'customer_payment', label: 'Customer Payments' },
  { key: 'vendor_payment', label: 'Vendor Payments' },
  { key: 'expense_accrual', label: 'Expense Accrual' },
  { key: 'cogs', label: 'COGS' },
  { key: 'tax_collected', label: 'Tax Collected' },
  { key: 'tax_paid', label: 'Tax Paid' },
  { key: 'refund', label: 'Refunds' },
  { key: 'inventory_adjust', label: 'Inventory Adjust' },
  { key: 'reversal', label: 'Reversals' },
  { key: 'manual', label: 'Manual' },
];

export const DATE_PRESETS = [
  { key: 'mtd', label: 'This Month' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
];

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

/** Control bar (type tabs · refresh · export · new) + filter row. */
export default function JournalEntriesControls({
  tabFilter,
  onTab,
  statusFilter,
  onStatus,
  search,
  onSearch,
  preset,
  onPreset,
  from,
  to,
  onFrom,
  onTo,
  rangeLabel,
  entries,
  loading,
  onRefresh,
  onNewEntry,
}: {
  tabFilter: string;
  onTab: (key: string) => void;
  statusFilter: string;
  onStatus: (v: string) => void;
  search: string;
  onSearch: (v: string) => void;
  preset: string;
  onPreset: (key: string) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  rangeLabel: string;
  entries: JournalEntry[];
  loading: boolean;
  onRefresh: () => void;
  onNewEntry: () => void;
}) {
  return (
    <>
      {/* Control bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tabFilter === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500" aria-live="polite">
            {loading ? 'Loading…' : rangeLabel ? `${rangeLabel} entries` : '0 entries'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:text-gray-900"
            aria-label="Refresh"
          >
            <PiArrowsClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            disabled={loading || entries.length === 0}
            onClick={() => exportEntriesCsv(entries)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <PiDownloadSimple size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={onNewEntry}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
          >
            <PiPlus size={14} /> New Entry
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPreset(p.key === preset ? '' : p.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              preset === p.key
                ? 'bg-[#fef2f2] text-[#b20202]'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          className={SELECT_CLS}
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          aria-label="From date"
        />
        <input
          type="date"
          className={SELECT_CLS}
          value={to}
          onChange={(e) => onTo(e.target.value)}
          aria-label="To date"
        />
        <select
          className={SELECT_CLS}
          value={statusFilter}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="posted">Posted</option>
          <option value="draft">Draft</option>
        </select>
        <div className="relative ml-auto">
          <PiMagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Search memo or account code…"
            className={`${SELECT_CLS} w-56 pl-8`}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
