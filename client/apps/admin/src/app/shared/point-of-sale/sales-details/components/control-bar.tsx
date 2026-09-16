'use client';

import type { RefObject } from 'react';
import {
  PiArrowsClockwise,
  PiList,
  PiRows,
} from 'react-icons/pi';
import { CustomSelect } from './custom-select';
import { DateTimeRange } from './date-time-range';
import { FilterChip } from './filter-chip';
import { ColumnPicker } from './column-picker';
import { ExportDropdown } from './export-dropdown';
import { StatusTabs } from './status-tabs';
import { SalesSearchBox } from './sales-search-box';
import {
  DATE_PRESETS,
  GROUP_BY_OPTIONS,
  PAYMENT_OPTIONS,
} from '../constants';
import type {
  StatusFilter,
  ViewMode,
  GroupByKey,
  ToggleableCol,
  SelectOption,
} from '../types';

interface ControlBarProps {
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  setAllHiddenCols: () => void;
  statusCounts: { all: number; active: number; voided: number };
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  groupBy: GroupByKey;
  setGroupBy: (g: GroupByKey) => void;
  showProfit: boolean;
  setShowProfit: (v: boolean) => void;
  hiddenCols: Set<ToggleableCol>;
  toggleCol: (k: ToggleableCol) => void;
  vis: (k: ToggleableCol) => boolean;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  timeFrom: string;
  setTimeFrom: (v: string) => void;
  timeTo: string;
  setTimeTo: (v: string) => void;
  activePreset: string;
  applyPreset: (p: (typeof DATE_PRESETS)[0]) => void;
  clearDateRange: () => void;
  cashierFilter: string;
  setCashierFilter: (v: string) => void;
  methodFilter: string;
  setMethodFilter: (v: string) => void;
  cashierOptions: SelectOption[];
  hasCostData: boolean;
  search: string;
  setSearch: (v: string) => void;
  debouncedSearch: string;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  filterChips: { label: string; onRemove: () => void }[];
  clearAll: () => void;
  orderCount: number;
  filteredCount: number;
  allRowCount: number;
  truncated: boolean;
  loading: boolean;
  onRefresh: () => void;
  onFetchAll: () => void;
  showExport: boolean;
  setShowExport: (v: boolean | ((prev: boolean) => boolean)) => void;
  exportRef: RefObject<HTMLDivElement | null>;
  onExport: (fmt: 'csv' | 'excel' | 'pdf') => void;
  hasData: boolean;
}

export function ControlBar({
  statusFilter, setStatusFilter, setAllHiddenCols, statusCounts,
  viewMode, setViewMode, groupBy, setGroupBy,
  showProfit, setShowProfit,
  hiddenCols, toggleCol, vis,
  dateFrom, setDateFrom, dateTo, setDateTo,
  timeFrom, setTimeFrom, timeTo, setTimeTo,
  activePreset, applyPreset, clearDateRange,
  cashierFilter, setCashierFilter,
  methodFilter, setMethodFilter,
  cashierOptions, hasCostData,
  search, setSearch, debouncedSearch,
  searchFocused, setSearchFocused, searchRef,
  filterChips, clearAll,
  orderCount, filteredCount, allRowCount, truncated, loading,
  onRefresh, onFetchAll,
  showExport, setShowExport, exportRef, onExport, hasData,
}: ControlBarProps) {

  return (
    <div className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white shadow-sm">
      <div className="flex h-14 items-center gap-4 px-5">
        <div className="flex min-w-0 shrink-0 flex-col justify-center">
          <h1 className="text-[15px] font-bold tracking-tight text-gray-900">
            Sales Details
          </h1>
          <p className="text-[11px] leading-none text-gray-400">
            {loading ? (
              'Loading…'
            ) : (
              <>
                {orderCount.toLocaleString()} orders
                {truncated && (
                  <> ·{' '}
                    <button
                      type="button"
                      onClick={onFetchAll}
                      className="text-[#b20202] underline hover:no-underline"
                    >
                      Load all
                    </button>
                  </>
                )}
                {filteredCount !== allRowCount && (
                  <> ·{' '}
                    <span className="font-medium text-gray-600">
                      {filteredCount.toLocaleString()} shown
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <StatusTabs
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            statusCounts={statusCounts}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['lines', 'grouped'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  viewMode === m
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {m === 'lines' ? (
                  <><PiList className="h-3.5 w-3.5" />Lines</>
                ) : (
                  <><PiRows className="h-3.5 w-3.5" />Grouped</>
                )}
              </button>
            ))}
          </div>

          {viewMode === 'grouped' && (
            <CustomSelect
              value={groupBy}
              onChange={(v) => setGroupBy((v || 'product') as GroupByKey)}
              options={GROUP_BY_OPTIONS}
              placeholder="Group by…"
              minWidth={120}
              required
            />
          )}

          <div className="mx-1 h-5 w-px bg-gray-200" />

          <ColumnPicker
            hiddenCols={hiddenCols}
            toggleCol={toggleCol}
            vis={vis}
            setAllHiddenCols={setAllHiddenCols}
          />

          <div className="mx-1 h-5 w-px bg-gray-200" />

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-[7px] text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <PiArrowsClockwise className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <ExportDropdown
            showExport={showExport}
            setShowExport={setShowExport}
            exportRef={exportRef}
            onExport={onExport}
            hasData={hasData}
          />
        </div>
      </div>

      {/* Row 2 — date presets + datetime range */}
      <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              activePreset === preset.label
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-[#b20202] hover:text-[#b20202]'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <div className="mx-1 h-5 w-px shrink-0 bg-gray-200" />
        <DateTimeRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          timeFrom={timeFrom}
          timeTo={timeTo}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onTimeFrom={setTimeFrom}
          onTimeTo={setTimeTo}
          onClear={clearDateRange}
        />
      </div>

      {/* Row 3 — field filters + search */}
      <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2">
        <CustomSelect
          value={cashierFilter}
          onChange={setCashierFilter}
          options={cashierOptions}
          placeholder="All cashiers"
          minWidth={140}
        />
        <CustomSelect
          value={methodFilter}
          onChange={setMethodFilter}
          options={PAYMENT_OPTIONS}
          placeholder="All payments"
          minWidth={140}
        />
        {hasCostData && (
          <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showProfit}
              onChange={(e) => setShowProfit(e.target.checked)}
              className="accent-[#b20202]"
            />
            Show profit
          </label>
        )}
        {filterChips.length > 0 && (
          <div className="ml-1 flex items-center gap-1.5">
            {filterChips.map((chip) => (
              <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </div>
        )}
          <SalesSearchBox
            search={search}
            setSearch={setSearch}
            debouncedSearch={debouncedSearch}
            searchFocused={searchFocused}
            setSearchFocused={setSearchFocused}
            searchRef={searchRef}
            filteredCount={filteredCount}
            hasActiveFilters={
              filterChips.length > 0 ||
              !!cashierFilter ||
              !!methodFilter ||
              statusFilter !== 'active'
            }
            clearAll={clearAll}
          />
      </div>
    </div>
  );
}