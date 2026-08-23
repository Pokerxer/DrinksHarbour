'use client';

// app/shared/warehouses/warehouse-detail/stock-toolbar.tsx
// Search (debounced + URL-synced by the parent), the active status-filter chip,
// result count and the grid/table view toggle.

import { useEffect, useState } from 'react';
import {
  PiMagnifyingGlass,
  PiX,
  PiSlidersBold,
  PiSquaresFourBold,
  PiRowsBold,
} from 'react-icons/pi';

export type DetailView = 'grid' | 'table';

export default function StockToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  view,
  onViewChange,
  shownCount,
  totalCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  view: DetailView;
  onViewChange: (v: DetailView) => void;
  shownCount: number;
  totalCount: number;
}) {
  // Local mirror of the search box so typing feels instant; the committed
  // value propagates upward (and into the URL) only after the debounce.
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);

  useEffect(() => {
    if (draft === search) return;
    const t = setTimeout(() => onSearchChange(draft), 250);
    return () => clearTimeout(t);
  }, [draft, search, onSearchChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 sm:max-w-xs">
        <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search product, SKU or size…"
          aria-label="Search stock lines"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-800 outline-none transition-all focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/20"
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onSearchChange('');
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {filter === 'low_out' && (
        <button
          type="button"
          onClick={() => onFilterChange('')}
          className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
        >
          <PiSlidersBold className="h-3.5 w-3.5" />
          Low / Out only
          <PiX className="h-3.5 w-3.5" />
        </button>
      )}

      <span className="ml-auto text-sm text-gray-400">
        {shownCount} of {totalCount} lines
      </span>

      {/* View toggle */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-[#ece4d6] bg-white p-1">
        <button
          type="button"
          onClick={() => onViewChange('grid')}
          aria-pressed={view === 'grid'}
          title="Grid view"
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'grid'
              ? 'bg-[#b20202] text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <PiSquaresFourBold className="h-4 w-4" />
          Grid
        </button>
        <button
          type="button"
          onClick={() => onViewChange('table')}
          aria-pressed={view === 'table'}
          title="Table view"
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'table'
              ? 'bg-[#b20202] text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <PiRowsBold className="h-4 w-4" />
          Table
        </button>
      </div>
    </div>
  );
}
