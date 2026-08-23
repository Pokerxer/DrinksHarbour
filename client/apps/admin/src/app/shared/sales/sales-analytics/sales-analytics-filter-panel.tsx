// Filters & Group By panel for /sales/analytics — status, payment, doc type,
// date presets, catalog dimensions, plus saved searches. Presentational; all
// state lives in the orchestrator.

'use client';

import { useMemo } from 'react';
import { PiMagnifyingGlass, PiStar, PiX } from 'react-icons/pi';
import {
  ALL_SALES_GROUP_ITEMS,
  buildDateFilterItems,
  type SavedSearch,
  type SalesGroupByKey,
} from './sales-analytics-helpers';

type CatItem = { _id: string; name: string; parent?: string; level?: number };
type DateItems = ReturnType<typeof buildDateFilterItems>;
type SearchPrefix =
  | 'customer_search:'
  | 'product_search:'
  | 'catname_search:'
  | 'salesperson_search:';

function Section({
  title,
  active,
  children,
}: {
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {title}
        {active && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-[#b20202]"
            title="This section has active filters"
          />
        )}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
        active
          ? 'bg-[#b20202]/10 font-semibold text-[#b20202]'
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

export default function SalesAnalyticsFilterPanel({
  filters,
  toggleFilter,
  onQuickFilter,
  onClearAll,
  matchesSavedId,
  dateItems,
  statusItems,
  paymentItems,
  categories,
  brands,
  panelSearch,
  setPanelSearch,
  groupByStack,
  toggleGroupBy,
  savedSearches,
  applySavedSearch,
  deleteSavedSearch,
  savingSearch,
  setSavingSearch,
  saveSearchName,
  setSaveSearchName,
  saveSearch,
}: {
  filters: string[];
  toggleFilter: (key: string) => void;
  /** Adds a free-text filter (customer/product/category/salesperson). */
  onQuickFilter: (prefix: SearchPrefix, query: string) => void;
  onClearAll: () => void;
  /** Id of the saved view that IS the current page state, if any. */
  matchesSavedId: string | null;
  dateItems: DateItems;
  statusItems: { key: string; label: string }[];
  paymentItems: { key: string; label: string }[];
  categories: CatItem[];
  brands: { _id: string; name: string }[];
  panelSearch: string;
  setPanelSearch: (v: string) => void;
  groupByStack: SalesGroupByKey[];
  toggleGroupBy: (key: SalesGroupByKey) => void;
  savedSearches: SavedSearch[];
  applySavedSearch: (s: SavedSearch) => void;
  deleteSavedSearch: (id: string) => void;
  savingSearch: boolean;
  setSavingSearch: (v: boolean) => void;
  saveSearchName: string;
  setSaveSearchName: (v: string) => void;
  saveSearch: () => void;
}) {
  const q = panelSearch.trim();
  const ql = q.toLowerCase();
  const match = (label: string) => !ql || label.toLowerCase().includes(ql);

  // Typing in "Find a filter…" also offers free-text filter actions — the
  // only way to reach product/category/salesperson filters by keyboard alone.
  const quickActions = useMemo(
    () =>
      q
        ? (
            [
              { prefix: 'customer_search:', label: 'Customer' },
              { prefix: 'product_search:', label: 'Product' },
              { prefix: 'catname_search:', label: 'Category' },
              { prefix: 'salesperson_search:', label: 'Salesperson' },
            ] as { prefix: SearchPrefix; label: string }[]
          ).filter(({ prefix }) => !filters.includes(`${prefix}${q}`))
        : [],
    [q, filters]
  );

  const activeBySection = useMemo(
    () => ({
      docs: filters.some((f) => f === 'not_cancelled' || f.startsWith('type_')),
      status: filters.some((f) => f.startsWith('status_')),
      payment: filters.some((f) => f.startsWith('pay_')),
      period: filters.some((f) => f.startsWith('date_')),
      catalog: filters.some(
        (f) => f.startsWith('category_') || f.startsWith('brand_')
      ),
    }),
    [filters]
  );

  const topCats = useMemo(
    () => categories.filter((c) => !c.parent || c.level === 0),
    [categories]
  );

  return (
    <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-[#ece4d6] bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-5">
      <div className="col-span-2 md:col-span-3 lg:col-span-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={panelSearch}
              onChange={(e) => setPanelSearch(e.target.value)}
              placeholder="Find a filter, or type a customer / product / category / salesperson to filter by…"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-xs focus:border-[#b20202] focus:outline-none"
            />
          </div>
          {filters.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              Clear all ({filters.length})
            </button>
          )}
        </div>

        {quickActions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickActions.map(({ prefix, label }) => (
              <button
                key={prefix}
                type="button"
                onClick={() => {
                  onQuickFilter(prefix, q);
                  setPanelSearch('');
                }}
                className="flex items-center gap-1.5 rounded-full border border-[#b20202]/25 bg-[#b20202]/5 px-3 py-1 text-[11px] font-medium text-[#b20202] transition-colors hover:bg-[#b20202]/10"
              >
                Filter <strong>{label}</strong> &ldquo;{q}&rdquo;
              </button>
            ))}
          </div>
        )}
      </div>

      <Section title="Documents" active={activeBySection.docs}>
        <Chip
          active={filters.includes('not_cancelled')}
          label="Not Cancelled"
          onClick={() => toggleFilter('not_cancelled')}
        />
        <Chip
          active={filters.includes('type_order')}
          label="Orders only"
          onClick={() => toggleFilter('type_order')}
        />
        <Chip
          active={filters.includes('type_quotation')}
          label="Quotations only"
          onClick={() => toggleFilter('type_quotation')}
        />
      </Section>

      <Section title="Status" active={activeBySection.status}>
        {statusItems
          .filter((s) => match(s.label))
          .map((s) => (
            <Chip
              key={s.key}
              active={filters.includes(s.key)}
              label={s.label}
              onClick={() => toggleFilter(s.key)}
            />
          ))}
      </Section>

      <Section title="Payment" active={activeBySection.payment}>
        {paymentItems
          .filter((s) => match(s.label))
          .map((s) => (
            <Chip
              key={s.key}
              active={filters.includes(s.key)}
              label={s.label}
              onClick={() => toggleFilter(s.key)}
            />
          ))}
      </Section>

      <Section title="Period" active={activeBySection.period}>
        <Chip
          active={filters.includes('date_today')}
          label="Today"
          onClick={() => toggleFilter('date_today')}
        />
        <Chip
          active={filters.includes('date_week')}
          label="This Week"
          onClick={() => toggleFilter('date_week')}
        />
        {dateItems.months
          .filter((m) => match(m.label))
          .map((m) => (
            <Chip
              key={m.key}
              active={filters.includes(m.key)}
              label={m.label}
              onClick={() => toggleFilter(m.key)}
            />
          ))}
        {dateItems.quarters
          .filter((x) => match(x.label))
          .map((x) => (
            <Chip
              key={x.key}
              active={filters.includes(x.key)}
              label={`${x.label} ${new Date().getFullYear()}`}
              onClick={() => toggleFilter(x.key)}
            />
          ))}
        {dateItems.years.map((y) => (
          <Chip
            key={y.key}
            active={filters.includes(y.key)}
            label={y.label}
            onClick={() => toggleFilter(y.key)}
          />
        ))}
      </Section>

      <Section title="Catalog" active={activeBySection.catalog}>
        {topCats
          .filter((c) => match(c.name))
          .slice(0, 8)
          .map((c) => (
            <Chip
              key={c._id}
              active={filters.includes(`category_${c._id}`)}
              label={c.name}
              onClick={() => toggleFilter(`category_${c._id}`)}
            />
          ))}
        {brands
          .filter((b) => match(b.name))
          .slice(0, 8)
          .map((b) => (
            <Chip
              key={b._id}
              active={filters.includes(`brand_${b._id}`)}
              label={b.name}
              onClick={() => toggleFilter(`brand_${b._id}`)}
            />
          ))}
      </Section>

      <Section title="Group By">
        <p className="px-2.5 pb-1 text-[11px] text-gray-400">
          One or two dimensions; the second powers the Breakdown view.
        </p>
        {ALL_SALES_GROUP_ITEMS.map((g) => {
          const idx = groupByStack.indexOf(g.key);
          const tag = idx === 0 ? '1st' : idx === 1 ? '2nd' : '';
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggleGroupBy(g.key)}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                idx >= 0
                  ? 'bg-teal-700/10 font-semibold text-teal-800'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {g.label}
              {tag && (
                <span className="rounded-full bg-teal-700 px-1.5 text-[9px] font-bold text-white">
                  {tag}
                </span>
              )}
            </button>
          );
        })}
      </Section>

      <Section title="Saved Views">
        {savedSearches.length === 0 && !savingSearch && (
          <p className="px-2.5 py-1 text-[11px] text-gray-400">
            Configure the page, then save it as a view.
          </p>
        )}
        {savedSearches.map((s) => {
          const isCurrent = s.id === matchesSavedId;
          return (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${
                isCurrent ? 'bg-teal-700/5' : 'hover:bg-gray-50'
              }`}
            >
              <PiStar
                className={`h-3 w-3 shrink-0 ${
                  isCurrent ? 'text-teal-600' : 'text-amber-400'
                }`}
              />
              <button
                type="button"
                onClick={() => applySavedSearch(s)}
                className="flex-1 truncate text-left text-xs text-gray-700"
              >
                {s.name}
              </button>
              {isCurrent && (
                <span className="shrink-0 rounded-full bg-teal-700 px-1.5 py-px text-[9px] font-bold text-white">
                  Current
                </span>
              )}
              <button
                type="button"
                onClick={() => deleteSavedSearch(s.id)}
                className="opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                aria-label={`Delete ${s.name}`}
              >
                <PiX className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {savingSearch ? (
          <div className="flex gap-1 px-2.5 pt-1">
            <input
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSearch()}
              placeholder="View name…"
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
            />
            <button
              type="button"
              onClick={saveSearch}
              className="rounded-md bg-[#b20202] px-2 py-1 text-xs font-semibold text-white"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSavingSearch(true)}
            className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#b20202] hover:bg-[#b20202]/5"
          >
            + Save current view
          </button>
        )}
      </Section>
    </div>
  );
}
