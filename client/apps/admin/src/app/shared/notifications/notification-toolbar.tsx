'use client';
import { PiArrowsClockwise, PiMagnifyingGlass, PiX } from 'react-icons/pi';
import type { NotificationCategory } from '@/services/notification.service';
import {
  emptyFilters,
  type InboxFilters,
  type InboxChip,
} from './inbox-filters';
const tabs: [NotificationCategory, string][] = [
  ['all', 'All'],
  ['stock', 'Stock'],
  ['performance', 'Selling well'],
  ['suggestions', 'Suggestions'],
  ['products', 'Products'],
  ['expiry', 'Expiry'],
];
const chips: [InboxChip, string][] = [
  ['unread', 'Unread only'],
  ['urgent', 'Urgent'],
  ['today', 'Today'],
  ['week', 'This week'],
];
export function hasFilters(f: InboxFilters) {
  return f.category !== 'all' || !!f.query || !!f.priority || f.chips.size > 0;
}
export default function NotificationToolbar({
  filters,
  onChange,
  counts,
  count,
  total,
  busy,
  loading,
  refresh,
  order,
  setOrder,
}: {
  filters: InboxFilters;
  onChange: (f: InboxFilters) => void;
  counts: Record<NotificationCategory, number>;
  count: number;
  total: number;
  busy: boolean;
  loading: boolean;
  refresh: () => void;
  order: string;
  setOrder: (value: string) => void;
}) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <div className="mr-auto">
          <h2 className="font-bold text-gray-900">Your inbox</h2>
          <p className="text-xs text-gray-500">
            {count} of {total} notices
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Notification category"
          className="flex max-w-full flex-wrap gap-1 rounded-2xl bg-gray-100 p-1"
        >
          {tabs.map(([category, label]) => (
            <button
              role="tab"
              id={`notice-tab-${category}`}
              aria-controls="notification-results"
              tabIndex={filters.category === category ? 0 : -1}
              onKeyDown={(event) => {
                const index = tabs.findIndex(([value]) => value === category);
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                onChange({ ...filters, category: tabs[next][0] });
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus();
              }}
              aria-selected={filters.category === category}
              key={category}
              onClick={() => onChange({ ...filters, category })}
              className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202] ${filters.category === category ? 'bg-[#b20202] text-white' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              {label}
              {counts[category] > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                  {counts[category]}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          aria-label="Refresh inbox"
          disabled={loading || busy}
          onClick={refresh}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
        >
          <PiArrowsClockwise className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 p-4">
        {chips.map(([chip, label]) => (
          <button
            key={chip}
            aria-pressed={filters.chips.has(chip)}
            onClick={() => {
              const next = new Set(filters.chips);
              next.has(chip) ? next.delete(chip) : next.add(chip);
              onChange({ ...filters, chips: next });
            }}
            className={`min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold ${filters.chips.has(chip) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 text-gray-600'}`}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-xs">
          <PiMagnifyingGlass
            aria-hidden
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
          />
          <input
            aria-label="Search notifications"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search notifications…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20"
          />
          {filters.query && (
            <button
              aria-label="Clear search"
              onClick={() => onChange({ ...filters, query: '' })}
              className="absolute right-3 top-2.5"
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Priority
          </span>
          <select
            aria-label="Priority"
            value={filters.priority}
            onChange={(e) => onChange({ ...filters, priority: e.target.value })}
            className="h-11 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All priorities</option>
            {['low', 'normal', 'high', 'urgent'].map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          Sort by
          <select
            aria-label="Order notifications"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
          >
            <option value="date">Newest first</option>
            <option value="urgency">Most urgent first</option>
          </select>
        </label>
        {(hasFilters(filters) || order !== 'date') && (
          <button
            onClick={() => {
              onChange(emptyFilters());
              setOrder('date');
            }}
            className="px-2 text-xs font-bold text-[#b20202]"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
