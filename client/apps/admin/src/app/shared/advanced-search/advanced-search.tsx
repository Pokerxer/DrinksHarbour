'use client';

import { useEffect, useRef, useState } from 'react';
import { PiCheck, PiCaretDown, PiCaretRight, PiCalendar } from 'react-icons/pi';
import type {
  FilterValue,
  CustomGroup,
  SavedSearch,
  FilterConfig,
  GroupByOption,
} from './advanced-search-types';
import { DOC_TYPE_FILTERS } from './filter-config-data';
import AdvancedSearchFilterList from './advanced-search-filter-list';
import AdvancedSearchDatePresets from './advanced-search-date-presets';
import AdvancedSearchGroupBy from './advanced-search-group-by';
import AdvancedSearchFavorites from './advanced-search-favorites';

interface AdvancedSearchProps {
  open: boolean;
  onClose: () => void;
  activeFilters: FilterValue[];
  onAddFilter: (filter: FilterValue) => void;
  onRemoveFilter: (fieldId: string) => void;
  onClearFilters: () => void;
  groupBy: string;
  groupBySubOption?: string;
  onSetGroupBy: (id: string, subOption?: string) => void;
  customGroups: CustomGroup[];
  onAddCustomGroup: (group: CustomGroup) => void;
  onRemoveCustomGroup: (id: string) => void;
  favorites: SavedSearch[];
  onSaveFavorite: (name: string) => void;
  onApplyFavorite: (search: SavedSearch) => void;
  onDeleteFavorite: (id: string) => void;
  docTypeFilters: { id: string; label: string; field: string; value?: string }[];
  onToggleDocType: (id: string) => void;
  activeDocTypes: string[];
  onSetDatePreset: (presetId: string | null) => void;
  activeDatePreset: string | null;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  // ── Per-module configuration ─────────────────────────────────────────────
  // These default to the SalesOrder set so /sales keeps the exact behaviour it
  // had when it was the only consumer. A second module (inventory stock) passes
  // its own; without these props the panel would offer sales filters, sales
  // groupings and a "Create Date" control over rows that have none of them.
  /** Filters offered in the "Add filter" list. */
  filterConfigs?: FilterConfig[];
  /** Options offered in the Group By column. */
  groupOptions?: GroupByOption[];
  /** Heading on the date section — e.g. "Expiry" for stock lines. */
  dateSectionLabel?: string;
  /** Presets offered inside the date section. */
  datePresets?: { id: string; label: string }[];
  /** Hide the date section entirely, for a row type with no meaningful date. */
  showDateSection?: boolean;
  /** Heading above the top checkbox group. */
  docTypeLabel?: string;
}

export default function AdvancedSearch({
  open,
  onClose,
  activeFilters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  groupBy,
  groupBySubOption,
  onSetGroupBy,
  customGroups,
  onAddCustomGroup,
  onRemoveCustomGroup,
  favorites,
  onSaveFavorite,
  onApplyFavorite,
  onDeleteFavorite,
  docTypeFilters = DOC_TYPE_FILTERS,
  onToggleDocType,
  activeDocTypes,
  onSetDatePreset,
  activeDatePreset,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  triggerRef,
  filterConfigs,
  groupOptions,
  dateSectionLabel = 'Create Date',
  datePresets,
  showDateSection = true,
  docTypeLabel,
}: AdvancedSearchProps) {
  const [createDateOpen, setCreateDateOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const isDocActive = (id: string) => activeDocTypes.includes(id);

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-50 mt-2 min-w-[820px] max-w-[1000px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/8"
      role="dialog"
      aria-label="Advanced search panel"
    >
      <div className="grid grid-cols-[1.2fr_240px_200px] divide-x divide-gray-100">
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
              <span>Filters</span>
            </p>
            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-[10px] font-semibold text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear all ({activeFilters.length})
              </button>
            )}
          </div>

          {docTypeLabel && docTypeFilters.length > 0 && (
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
              {docTypeLabel}
            </p>
          )}
          <div className="mb-3 space-y-0.5">
            {docTypeFilters.map((item) => {
              const active = isDocActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggleDocType(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all hover:bg-gray-50 ${
                    active ? 'font-semibold text-brand bg-brand/5' : 'text-gray-700'
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      active ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {active && <PiCheck className="h-3 w-3 text-white" />}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>

          {showDateSection && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setCreateDateOpen((v) => !v)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50 ${
                  createDateOpen || activeDatePreset ? 'text-brand bg-brand/5' : 'text-gray-500'
                }`}
              >
                <PiCalendar className="h-4 w-4" />
                {dateSectionLabel}
                <PiCaretRight
                  className={`ml-auto h-3.5 w-3.5 transition-transform ${createDateOpen ? 'rotate-90' : ''}`}
                />
              </button>
              {createDateOpen && (
                <div className="ml-3 mt-1.5 border-l-2 border-gray-100 pl-3">
                  <AdvancedSearchDatePresets
                    activeDatePreset={activeDatePreset}
                    onSetDatePreset={onSetDatePreset}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateFrom={onDateFrom}
                    onDateTo={onDateTo}
                    presets={datePresets}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
              Add filter
            </p>
            <AdvancedSearchFilterList
              activeFilters={activeFilters}
              onAddFilter={onAddFilter}
              onRemoveFilter={onRemoveFilter}
              configs={filterConfigs}
            />
          </div>
        </div>

        <div className="p-4">
          <AdvancedSearchGroupBy
            groupBy={groupBy}
            groupBySubOption={groupBySubOption}
            onSetGroupBy={onSetGroupBy}
            customGroups={customGroups}
            onAddCustomGroup={onAddCustomGroup}
            onRemoveCustomGroup={onRemoveCustomGroup}
            groupOptions={groupOptions}
          />
        </div>

        <div className="p-4">
          <AdvancedSearchFavorites
            favorites={favorites}
            onApplyFavorite={onApplyFavorite}
            onDeleteFavorite={onDeleteFavorite}
            onSaveFavorite={onSaveFavorite}
          />
        </div>
      </div>
    </div>
  );
}
