'use client';

import {
  PiFunnel,
  PiStack,
  PiStar,
  PiTrash,
  PiCheck,
  PiMagnifyingGlass,
} from 'react-icons/pi';
import {
  FILTER_STATIC,
  GROUP_BY_ITEMS,
  GROUP_BY_DATE_ITEMS,
  ALL_GROUP_ITEMS,
  buildDateFilterItems,
  type GroupByKey,
  type SavedSearch,
  type CatItem,
  type BrandItem,
} from './purchases-analytics-helpers';
import {
  DropItem,
  DropSection,
  FilterListSection,
} from './purchases-analytics-charts';

export type DateFilterItems = ReturnType<typeof buildDateFilterItems>;

/**
 * The Filters / Group By / Favorites panel of the purchase analysis screen.
 * Purely presentational — every piece of state is owned by the orchestrator
 * (purchases-analytics.tsx) and passed down, so saved searches keep working
 * across panel open/close.
 */
export function AnalyticsFilterPanel({
  filters,
  toggleFilter,
  dateItems,
  topCategories,
  subCategories,
  brands,
  panelSearch,
  setPanelSearch,
  groupByStack,
  toggleGroupBy,
  savedSearches,
  applySavedSearch,
  deleteSavedSearch,
  isSearchMatch,
  savingSearch,
  setSavingSearch,
  saveSearchName,
  setSaveSearchName,
  saveSearch,
}: {
  filters: string[];
  toggleFilter: (key: string) => void;
  dateItems: DateFilterItems;
  topCategories: CatItem[];
  subCategories: CatItem[];
  brands: BrandItem[];
  panelSearch: string;
  setPanelSearch: (v: string) => void;
  groupByStack: GroupByKey[];
  toggleGroupBy: (key: GroupByKey) => void;
  savedSearches: SavedSearch[];
  applySavedSearch: (s: SavedSearch) => void;
  deleteSavedSearch: (id: string) => void;
  isSearchMatch: (s: SavedSearch) => boolean;
  savingSearch: boolean;
  setSavingSearch: (v: boolean) => void;
  saveSearchName: string;
  setSaveSearchName: (v: string) => void;
  saveSearch: () => void;
}) {
  const dimBadge = (idx: number) =>
    idx >= 0 ? (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
        {idx + 1}
      </span>
    ) : undefined;

  const cancelSave = () => {
    setSavingSearch(false);
    setSaveSearchName('');
  };

  return (
    <div className="mb-4 grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-3">
      {/* Filters column */}
      <div className="flex flex-col border-b border-gray-100 md:border-b-0 md:border-r">
        <PanelTitle icon={<PiFunnel className="h-3.5 w-3.5 text-[#b20202]" />} label="Filters" />
        <div className="max-h-[420px] flex-1 overflow-y-auto p-3">
          <div className="relative mb-2">
            <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input
              value={panelSearch}
              onChange={(e) => setPanelSearch(e.target.value)}
              placeholder="Filter categories / brands…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#b20202] focus:bg-white"
            />
          </div>
          <DropSection title="Status" />
          {FILTER_STATIC.map((f) => (
            <DropItem
              key={f.key}
              label={f.label}
              selected={filters.includes(f.key)}
              onClick={() => toggleFilter(f.key)}
            />
          ))}
          <DropSection title="Date" />
          <DropItem
            label="Today"
            selected={filters.includes('date_today')}
            onClick={() => toggleFilter('date_today')}
          />
          <DropItem
            label="This Week"
            selected={filters.includes('date_week')}
            onClick={() => toggleFilter('date_week')}
          />
          <DropSection title="Months" />
          {dateItems.months.map((m) => (
            <DropItem
              key={m.key}
              label={m.label}
              selected={filters.includes(m.key)}
              onClick={() => toggleFilter(m.key)}
            />
          ))}
          <DropSection title="Quarters" />
          {dateItems.quarters.map((q) => (
            <DropItem
              key={q.key}
              label={q.label}
              selected={filters.includes(q.key)}
              onClick={() => toggleFilter(q.key)}
            />
          ))}
          <DropSection title="Years" />
          {dateItems.years.map((y) => (
            <DropItem
              key={y.key}
              label={y.label}
              selected={filters.includes(y.key)}
              onClick={() => toggleFilter(y.key)}
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
                onToggle={toggleFilter}
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
                onToggle={toggleFilter}
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
                onToggle={toggleFilter}
                filter={panelSearch}
              />
            </>
          )}
        </div>
      </div>

      {/* Group By column */}
      <div className="flex flex-col border-b border-gray-100 md:border-b-0 md:border-r">
        <PanelTitle
          icon={<PiStack className="h-3.5 w-3.5 text-emerald-500" />}
          label="Group By"
          badge={
            groupByStack.length > 0 ? (
              <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-bold text-emerald-700">
                {groupByStack.length}
              </span>
            ) : undefined
          }
        />
        <div className="max-h-[420px] flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-1 text-[11px] text-gray-400">
            Select up to 2 dimensions. Click a selected dimension again to remove
            it.
          </p>
          <DropSection title="Dimensions" />
          {GROUP_BY_ITEMS.map((g) => (
            <DropItem
              key={g.key}
              label={g.label}
              selected={groupByStack.includes(g.key)}
              onClick={() => toggleGroupBy(g.key)}
              badge={dimBadge(groupByStack.indexOf(g.key))}
            />
          ))}
          <DropSection title="Order Date" />
          {GROUP_BY_DATE_ITEMS.map((g) => (
            <DropItem
              key={g.key}
              label={g.label}
              selected={groupByStack.includes(g.key)}
              onClick={() => toggleGroupBy(g.key)}
              badge={dimBadge(groupByStack.indexOf(g.key))}
            />
          ))}
        </div>
      </div>

      {/* Favorites column */}
      <div className="flex flex-col">
        <PanelTitle
          icon={<PiStar className="h-3.5 w-3.5 text-amber-400" />}
          label="Favorites"
          badge={
            savedSearches.length > 0 ? (
              <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-600">
                {savedSearches.length}
              </span>
            ) : undefined
          }
        />
        <div className="max-h-[420px] flex-1 space-y-1.5 overflow-y-auto p-3">
          {savedSearches.length === 0 && !savingSearch && (
            <div className="py-6 text-center">
              <PiStar className="mx-auto mb-2 h-8 w-8 text-gray-200" />
              <p className="text-xs text-gray-400">No saved searches yet</p>
              <p className="mt-0.5 text-[11px] text-gray-300">
                Save your current filters for quick access
              </p>
            </div>
          )}
          {savedSearches.map((s) => {
            const active = isSearchMatch(s);
            return (
              <div
                key={s.id}
                className={`group rounded-xl border p-2.5 transition-colors ${
                  active
                    ? 'border-teal-200 bg-teal-50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => applySavedSearch(s)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {active && (
                      <PiCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                    )}
                    <span
                      className={`truncate text-sm font-medium ${
                        active ? 'text-teal-700' : 'text-gray-800'
                      }`}
                    >
                      {s.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedSearch(s.id)}
                    className="shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:text-red-400"
                  >
                    <PiTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 truncate text-[11px] text-gray-400">
                  {s.filters.length} filter
                  {s.filters.length === 1 ? '' : 's'}
                  {s.groupBy
                    ? ` · ${[s.groupBy, s.groupBy2]
                        .filter(Boolean)
                        .map(
                          (k) =>
                            ALL_GROUP_ITEMS.find((g) => g.key === k)?.label ?? k
                        )
                        .join(' > ')}`
                    : ''}
                </p>
              </div>
            );
          })}

          {savingSearch ? (
            <div className="rounded-xl border border-gray-200 p-2.5">
              <input
                autoFocus
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveSearch();
                  if (e.key === 'Escape') cancelSave();
                }}
                placeholder="Search name…"
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#b20202]"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveSearch}
                  className="flex-1 rounded-lg bg-[#b20202] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#7a0101]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelSave}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSavingSearch(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-2.5 py-2 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
            >
              <PiStar className="h-3.5 w-3.5" />
              Save current view
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelTitle({
  icon,
  label,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
      {icon}
      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      {badge}
    </div>
  );
}
