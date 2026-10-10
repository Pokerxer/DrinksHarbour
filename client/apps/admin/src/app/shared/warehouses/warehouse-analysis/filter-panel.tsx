'use client';

// app/shared/warehouses/warehouse-analysis/filter-panel.tsx
// The 3-column panel: Filters (stock flags, categories, subcategories,
// brands), Group By dimensions and the Favorites (saved searches) column.

import { useMemo, useState } from 'react';
import { PiFunnel, PiMagnifyingGlass, PiStack } from 'react-icons/pi';
import {
  FILTER_STATIC,
  GROUP_BY_ITEMS,
  type BrandItem,
  type CatItem,
  type GroupByKey,
  type SavedSearch,
} from '../warehouse-analysis-helpers';
import AnalysisFavorites from './analysis-favorites';
import { DropItem, DropSection, FilterListSection } from '../warehouse-analysis-charts';

export default function FilterPanel({
  filters,
  onToggleFilter,
  groupByStack,
  onToggleGroupBy,
  categories,
  brands,
  products,
  warehouses,
  savedSearches,
  activeSearchId,
  onApplySearch,
  onDeleteSearch,
  onSaveSearch,
}: {
  filters: string[];
  onToggleFilter: (key: string) => void;
  groupByStack: GroupByKey[];
  onToggleGroupBy: (key: GroupByKey) => void;
  products: { _id: string; name: string }[];
  warehouses: { _id: string; name: string }[];
  categories: CatItem[];
  brands: BrandItem[];
  savedSearches: SavedSearch[];
  /** Name of the currently-matching favorite, if any. */
  activeSearchId: string | null;
  onApplySearch: (s: SavedSearch) => void;
  onDeleteSearch: (id: string) => void;
  onSaveSearch: (name: string) => void;
}) {
  const [panelSearch, setPanelSearch] = useState('');

  // Top-level vs child categories for the two filter sections.
  const topCategories = useMemo(
    () => categories.filter((c) => !c.parent || c.level === 0),
    [categories],
  );
  const subCategories = useMemo(
    () => categories.filter((c) => c.parent && c.level !== 0),
    [categories],
  );

  return (
    <div className="mb-4 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-3">
      {/* ── Filters column ── */}
      <div className="flex flex-col border-b border-gray-100 md:border-b-0 md:border-r">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
          <PiFunnel className="h-3.5 w-3.5 text-[#b20202]" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filters</span>
        </div>
        <div className="max-h-[420px] flex-1 overflow-y-auto p-3">
          <div className="relative mb-2">
            <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input
              value={panelSearch}
              onChange={(e) => setPanelSearch(e.target.value)}
              placeholder="Find products, warehouses, categories or brands…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#b20202] focus:bg-white"
            />
          </div>
          <p className="mb-2 px-1 text-[11px] text-gray-500">
            Choose several options in each section. Different sections narrow the results together.
          </p>
          <FilterListSection
            label="Products"
            items={products}
            activeFilters={filters}
            prefix="product_"
            onToggle={onToggleFilter}
            filter={panelSearch.trim()}
          />
          <FilterListSection
            label="Warehouses"
            items={warehouses}
            activeFilters={filters}
            prefix="warehouse_"
            onToggle={onToggleFilter}
            filter={panelSearch.trim()}
          />
          <DropSection title="Stock" />
          {FILTER_STATIC.map((f) => (
            <DropItem
              key={f.key}
              label={f.label}
              selected={filters.includes(f.key)}
              onClick={() => onToggleFilter(f.key)}
            />
          ))}
          {topCategories.length > 0 && (
            <>
              <DropSection title="Product Category" />
              <FilterListSection
                label="Product Category"
                items={topCategories}
                activeFilters={filters}
                prefix="category_"
                onToggle={onToggleFilter}
                filter={panelSearch}
              />
            </>
          )}
          {subCategories.length > 0 && (
            <>
              <DropSection title="Subcategory" />
              <FilterListSection
                label="Subcategory"
                items={subCategories}
                activeFilters={filters}
                prefix="subcategory_"
                onToggle={onToggleFilter}
                filter={panelSearch}
              />
            </>
          )}
          {brands.length > 0 && (
            <>
              <DropSection title="Brand" />
              <FilterListSection
                label="Brand"
                items={brands}
                activeFilters={filters}
                prefix="brand_"
                onToggle={onToggleFilter}
                filter={panelSearch}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Group By column ── */}
      <div className="flex flex-col border-b border-gray-100 md:border-b-0 md:border-r">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
          <PiStack className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Group By</span>
          {groupByStack.length > 0 && (
            <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-bold text-emerald-700">
              {groupByStack.length}
            </span>
          )}
        </div>
        <div className="max-h-[420px] flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-1 text-[11px] text-gray-400">
            Select up to 2 dimensions. Click a selected dimension again to remove it.
          </p>
          <DropSection title="Dimensions" />
          {GROUP_BY_ITEMS.map((g) => {
            const idx = groupByStack.indexOf(g.key);
            return (
              <DropItem
                key={g.key}
                label={g.label}
                selected={idx >= 0}
                onClick={() => onToggleGroupBy(g.key)}
                badge={
                  idx >= 0 ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                      {idx + 1}
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <AnalysisFavorites
        savedSearches={savedSearches}
        activeSearchId={activeSearchId}
        onApplySearch={onApplySearch}
        onDeleteSearch={onDeleteSearch}
        onSaveSearch={onSaveSearch}
      />
    </div>
  );
}
