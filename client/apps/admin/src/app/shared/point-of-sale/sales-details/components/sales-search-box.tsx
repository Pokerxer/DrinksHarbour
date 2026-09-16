'use client';

import type { RefObject } from 'react';
import { PiMagnifyingGlass, PiX } from 'react-icons/pi';

export function SalesSearchBox({
  search,
  setSearch,
  debouncedSearch,
  searchFocused,
  setSearchFocused,
  searchRef,
  filteredCount,
  hasActiveFilters,
  clearAll,
}: {
  search: string;
  setSearch: (v: string) => void;
  debouncedSearch: string;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  filteredCount: number;
  hasActiveFilters: boolean;
  clearAll: () => void;
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <div className={`relative transition-all duration-200 ${searchFocused || search ? 'w-72' : 'w-56'}`}>
        <PiMagnifyingGlass
          className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors duration-150 ${
            searchFocused ? 'text-[#b20202]' : 'text-gray-400'
          }`}
        />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search product, cashier, order #…"
          className={`w-full rounded-lg border py-1.5 pl-8 text-sm outline-none transition-all duration-150 ${
            search
              ? 'border-[#b20202]/50 bg-red-50/40 pr-14 text-gray-800 ring-2 ring-[#b20202]/10'
              : searchFocused
                ? 'border-[#b20202] bg-white pr-8 ring-2 ring-[#b20202]/10'
                : 'border-gray-200 bg-white pr-16 hover:border-gray-300'
          }`}
        />
        {debouncedSearch && (
          <span className="absolute right-7 top-1/2 -translate-y-1/2 rounded-full bg-[#b20202]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#b20202]">
            {filteredCount}
          </span>
        )}
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <PiX className="h-3.5 w-3.5" />
          </button>
        ) : !searchFocused ? (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[9px] leading-none text-gray-300">
            ⌘K
          </kbd>
        ) : null}
      </div>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-[#b20202] transition-colors hover:bg-red-100"
        >
          <PiX className="h-3.5 w-3.5" />
          Clear all
        </button>
      )}
    </div>
  );
}