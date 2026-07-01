// client/apps/admin/src/app/shared/sales/sales-catalog-filters.tsx
'use client';

import type { ReactNode } from 'react';
import {
  PiFunnel,
  PiArrowCounterClockwise,
  PiCheck,
} from 'react-icons/pi';

export type SortKey = 'name' | 'priceAsc' | 'priceDesc' | 'stock';

export interface FilterOption {
  id: string;
  name: string;
}

export interface SalesCatalogFiltersProps {
  categories: FilterOption[];
  brands: FilterOption[];
  types: FilterOption[];
  selectedCategories: string[];
  selectedBrands: string[];
  selectedTypes: string[];
  inStockOnly: boolean;
  sort: SortKey;
  resultCount: number;
  totalCount: number;
  onToggleCategory: (id: string) => void;
  onToggleBrand: (id: string) => void;
  onToggleType: (id: string) => void;
  onInStockOnlyChange: (v: boolean) => void;
  onSortChange: (v: SortKey) => void;
  onClear: () => void;
}

const SELECT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-brand focus:outline-none';

const SELECT_CLS_MOB =
  'rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-brand focus:outline-none';

function CheckboxList({
  options,
  selected,
  onToggle,
  emptyLabel,
}: {
  options: FilterOption[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  if (options.length === 0) {
    return <p className="text-[11px] italic text-gray-400">{emptyLabel}</p>;
  }
  // Cap height; becomes scrollable when long (e.g. many beverage types).
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
      {options.map((o) => {
        const checked = selected.includes(o.id);
        return (
          <label
            key={o.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                checked
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-300 bg-white'
              }`}
            >
              {checked && <PiCheck className="h-3 w-3" />}
            </span>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(o.id)}
              className="sr-only"
            />
            <span className="truncate">{o.name}</span>
          </label>
        );
      })}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Left sidebar for the Sales catalogue modal. Category, brand, and beverage
 * type are multi-select checkbox lists (OR within a group; AND across groups).
 * Plus an in-stock toggle and a sort dropdown, with a result count + clear.
 */
export function SalesCatalogFilters({
  categories,
  brands,
  types,
  selectedCategories,
  selectedBrands,
  selectedTypes,
  inStockOnly,
  sort,
  resultCount,
  totalCount,
  onToggleCategory,
  onToggleBrand,
  onToggleType,
  onInStockOnlyChange,
  onSortChange,
  onClear,
}: SalesCatalogFiltersProps) {
  const hasActive =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    selectedTypes.length > 0 ||
    inStockOnly;

  return (
    <div className="space-y-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <PiFunnel className="h-3.5 w-3.5" /> Filters
        </h3>
        {hasActive && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
          >
            <PiArrowCounterClockwise className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <Section label="Category">
        <CheckboxList
          options={categories}
          selected={selectedCategories}
          onToggle={onToggleCategory}
          emptyLabel="No categories"
        />
      </Section>

      <Section label="Brand">
        <CheckboxList
          options={brands}
          selected={selectedBrands}
          onToggle={onToggleBrand}
          emptyLabel="No brands"
        />
      </Section>

      <Section label="Beverage type">
        <CheckboxList
          options={types}
          selected={selectedTypes}
          onToggle={onToggleType}
          emptyLabel="No beverage types"
        />
      </Section>

      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => onInStockOnlyChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand/20"
        />
        In stock only
      </label>

      <div className="border-t border-gray-200 pt-3">
        <Section label="Sort by">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className={SELECT_CLS}
          >
            <option value="name">Name A–Z</option>
            <option value="priceAsc">Price ↑</option>
            <option value="priceDesc">Price ↓</option>
            <option value="stock">Stock (high → low)</option>
          </select>
        </Section>
      </div>

      <div className="border-t border-gray-200 pt-3 text-[11px] text-gray-400">
        {resultCount} of {totalCount} products
      </div>
    </div>
  );
}

/** Compact horizontal bar for small screens (sidebar is hidden below sm). */
export function SalesCatalogFiltersCompact({
  categories,
  brands,
  types,
  selectedCategories,
  selectedBrands,
  selectedTypes,
  inStockOnly,
  onToggleCategory,
  onToggleBrand,
  onToggleType,
  onInStockOnlyChange,
}: Pick<
  SalesCatalogFiltersProps,
  | 'categories'
  | 'brands'
  | 'types'
  | 'selectedCategories'
  | 'selectedBrands'
  | 'selectedTypes'
  | 'inStockOnly'
  | 'onToggleCategory'
  | 'onToggleBrand'
  | 'onToggleType'
  | 'onInStockOnlyChange'
>) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2 sm:hidden">
      <MultiSelectChips
        label="Category"
        options={categories}
        selected={selectedCategories}
        onToggle={onToggleCategory}
      />
      <MultiSelectChips
        label="Brand"
        options={brands}
        selected={selectedBrands}
        onToggle={onToggleBrand}
      />
      <MultiSelectChips
        label="Type"
        options={types}
        selected={selectedTypes}
        onToggle={onToggleType}
      />
      <label className="flex items-center gap-1.5 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => onInStockOnlyChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-brand"
        />
        In stock
      </label>
    </div>
  );
}

/** A small dropdown that lists checkboxes for mobile (multi-select in a popover). */
function MultiSelectChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  // Simple native <select multiple> for compact mobile UX.
  return (
    <select
      multiple
      value={selected}
      onChange={(e) => {
        const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
        // Toggle the last-changed value (native multi-select diff is awkward;
        // treat each change as toggling the option that differs from current).
        const added = vals.find((v) => !selected.includes(v));
        const removed = selected.find((v) => !vals.includes(v));
        if (added) onToggle(added);
        else if (removed) onToggle(removed);
      }}
      size={1}
      className={SELECT_CLS_MOB}
      title={label}
    >
      <option disabled>{label}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {selected.includes(o.id) ? '✓ ' : ''}
          {o.name}
        </option>
      ))}
    </select>
  );
}