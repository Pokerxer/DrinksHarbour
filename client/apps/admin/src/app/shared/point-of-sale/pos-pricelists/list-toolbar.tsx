'use client';

import React from 'react';
import {
  PiPlus,
  PiMagnifyingGlass,
  PiX,
  PiCaretLeft,
  PiCaretRight,
  PiArrowsClockwise,
} from 'react-icons/pi';
import { BRAND } from '@/app/shared/point-of-sale/pricelist-constants';

type StatusFilter = 'all' | 'selectable' | 'website';

interface Props {
  total: number;
  shownCount: number;
  search: string;
  status: StatusFilter;
  page: number;
  totalPages: number;
  loading: boolean;
  onSearchChange(v: string): void;
  onStatusChange(s: StatusFilter): void;
  onPage(p: number): void;
  onReload(): void;
  onCreate(): void;
}

export default function ListToolbar({
  total,
  shownCount,
  search,
  status,
  page,
  totalPages,
  loading,
  onSearchChange,
  onStatusChange,
  onPage,
  onReload,
  onCreate,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
      <button
        type="button"
        onClick={onCreate}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        style={{ backgroundColor: BRAND }}
      >
        <PiPlus className="h-3.5 w-3.5" /> New
      </button>

      <div>
        <h1 className="text-base font-bold text-gray-900">Pricelists</h1>
        <p className="text-[11px] text-gray-400">
          {total} total · {shownCount} shown
        </p>
      </div>

      {/* Search — raw value drives input; debounced value drives load() */}
      <div className="relative max-w-md flex-1">
        <div
          className={`flex overflow-hidden rounded-xl border bg-white transition-all ${
            search ? 'border-[#b20202] ring-1 ring-[#b20202]/10' : 'border-gray-200'
          }`}
        >
          <div className="relative flex-1">
            <PiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              aria-label="Search pricelists"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search pricelists…"
              className="h-9 w-full bg-transparent pl-9 pr-2 text-sm outline-none"
            />
          </div>
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
              className="flex items-center px-2 text-gray-400 hover:text-gray-600"
            >
              <PiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status pills */}
      <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
        {(
          [
            ['all', 'All'],
            ['selectable', 'Selectable'],
            ['website', 'Has Website'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={status === k}
            onClick={() => onStatusChange(k)}
            className={`rounded-lg px-3 py-1.5 capitalize transition-all ${
              status === k ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={status === k ? { backgroundColor: BRAND } : {}}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
        <span className="px-1">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
        >
          <PiCaretLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
        >
          <PiCaretRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        aria-label="Reload"
        onClick={onReload}
        disabled={loading}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 disabled:opacity-40"
      >
        <PiArrowsClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
