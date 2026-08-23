'use client';

// Odoo-style search field for the sub-products toolbar: active quick-filter /
// group / custom-rule / term chips, free-text input, suggestion dropdown.
// Purely presentational + controlled — all state lives in the parent table.

import { PiFunnelBold, PiMagnifyingGlass, PiCaretDown, PiCaretUp, PiCaretRight, PiX } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  SP_CHIP_FIELDS,
  SP_FILTER_LABELS,
  type SPChipField,
  type SPSearchChip,
  type SPFilterKey,
} from './OdooSearchPanel';
import type { ActiveCustomRules } from './CustomFilterModal';

interface SubProductSearchFieldProps {
  query: string;
  onQueryChange: (value: string) => void;
  /** Shown while the user types — "search <field> for: …" suggestions. */
  showSuggestions: boolean;
  panelOpen: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  activeFilters: Set<SPFilterKey>;
  onRemoveFilter: (filter: SPFilterKey) => void;
  groupByLabel: string | null;
  onRemoveGroupBy: () => void;
  customRules: ActiveCustomRules | null;
  onRemoveCustomRules: () => void;
  chips: SPSearchChip[];
  onRemoveChip: (id: string) => void;
  onRemoveLastChip: () => void;
  onAddTermAsChip: (field?: SPChipField, label?: string) => void;
  onClearAll: () => void;
  onTogglePanel: () => void;
  onCloseOverlays: () => void;
  onFocusInput: (hasText: boolean) => void;
  onOpenCustomFilterModal: () => void;
}

export default function SubProductSearchField({
  query,
  onQueryChange,
  showSuggestions,
  panelOpen,
  inputRef,
  activeFilters,
  onRemoveFilter,
  groupByLabel,
  onRemoveGroupBy,
  customRules,
  onRemoveCustomRules,
  chips,
  onRemoveChip,
  onRemoveLastChip,
  onAddTermAsChip,
  onClearAll,
  onTogglePanel,
  onCloseOverlays,
  onFocusInput,
  onOpenCustomFilterModal,
}: SubProductSearchFieldProps) {
  const hasContent =
    Boolean(query) || activeFilters.size > 0 || Boolean(groupByLabel) || chips.length > 0;

  // NOTE: no `position` on this root — the parent provides the relative
  // container so the panel and this dropdown share one positioning context.
  return (
    <>
      <div
        className={`flex h-9 flex-wrap items-center gap-1 rounded-lg border bg-white px-3 transition-all ${panelOpen ? 'border-[#b20202] ring-2 ring-[#b20202]/10' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />

        {/* Quick-filter chips */}
        {Array.from(activeFilters)
          .filter((f) => SP_FILTER_LABELS[f])
          .map((f) => (
            <span
              key={f}
              className="flex items-center gap-1 rounded-md bg-[#b20202]/10 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]"
            >
              <PiFunnelBold className="h-2.5 w-2.5" />
              {SP_FILTER_LABELS[f]}
              <button
                type="button"
                aria-label={`Remove filter ${SP_FILTER_LABELS[f]}`}
                onClick={() => onRemoveFilter(f)}
                className="opacity-60 hover:opacity-100"
              >
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}

        {/* Group-by chip */}
        {groupByLabel && (
          <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]">
            {groupByLabel}
            <button
              type="button"
              aria-label="Remove grouping"
              onClick={onRemoveGroupBy}
              className="opacity-60 hover:opacity-100"
            >
              <PiX className="h-3 w-3" />
            </button>
          </span>
        )}

        {/* Custom-rule chip */}
        {customRules && (
          <span className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
            Custom Filter ({customRules.rules.length} rule
            {customRules.rules.length > 1 ? 's' : ''})
            <button
              type="button"
              aria-label="Remove custom filter"
              onClick={onRemoveCustomRules}
              className="opacity-60 hover:opacity-100"
            >
              <PiX className="h-3 w-3" />
            </button>
          </span>
        )}

        {/* Search-term chips */}
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="flex items-center gap-0 overflow-hidden rounded-md border border-gray-200 text-[11px] font-semibold"
          >
            <span className="bg-gray-800 px-2 py-0.5 text-white">{chip.label}</span>
            <span className="bg-white px-2 py-0.5 italic text-gray-700">{chip.query}</span>
            <button
              type="button"
              aria-label={`Remove ${chip.label} term`}
              onClick={() => onRemoveChip(chip.id)}
              className="bg-white px-1.5 py-0.5 text-gray-400 hover:text-red-500"
            >
              <PiX className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          aria-label="Search sub-products"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => onFocusInput(Boolean(query.trim()))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) onAddTermAsChip();
            if (e.key === 'Backspace' && !query && chips.length > 0) onRemoveLastChip();
            if (e.key === 'Escape') onCloseOverlays();
          }}
          placeholder={
            activeFilters.size === 0 && !groupByLabel && chips.length === 0
              ? 'Search products, SKU…'
              : 'Search…'
          }
          className="min-w-[80px] flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />

        {hasContent && (
          <button
            type="button"
            onClick={onClearAll}
            aria-label="Clear search and filters"
            className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
          >
            <PiX className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-label={panelOpen ? 'Hide filter panel' : 'Show filter panel'}
          className={cn(
            'ml-1 shrink-0 transition-colors',
            panelOpen ? 'text-[#b20202]' : 'text-gray-400 hover:text-gray-600'
          )}
        >
          {panelOpen ? (
            <PiCaretUp className="h-3.5 w-3.5" />
          ) : (
            <PiCaretDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Typing suggestions dropdown */}
      {showSuggestions && query.trim() && (
        <div className="ring-black/8 absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1">
          {SP_CHIP_FIELDS.map((cf, i) => (
            <button
              key={cf.field}
              type="button"
              onClick={() => onAddTermAsChip(cf.field, cf.label)}
              className={cn(
                'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50',
                i === 0 && 'bg-gray-50'
              )}
            >
              {i === 0 ? (
                <PiCaretRight className="h-3 w-3 text-gray-400" />
              ) : (
                <span className="w-3" />
              )}
              <span>
                Search <strong>{cf.label}</strong> for:{' '}
                <em className="text-[#b20202]">{query.trim()}</em>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenCustomFilterModal}
            className="flex w-full items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-medium text-[#b20202] transition-colors hover:bg-red-50"
          >
            Add Custom Filter
          </button>
        </div>
      )}
    </>
  );
}
