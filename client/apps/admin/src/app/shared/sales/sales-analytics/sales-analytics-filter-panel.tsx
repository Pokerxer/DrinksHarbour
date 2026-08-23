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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {title}
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
  const q = panelSearch.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);

  const topCats = useMemo(
    () => categories.filter((c) => !c.parent || c.level === 0),
    [categories]
  );

  return (
    <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-[#ece4d6] bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-5">
      <div className="col-span-2 md:col-span-3 lg:col-span-5">
        <div className="relative">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={panelSearch}
            onChange={(e) => setPanelSearch(e.target.value)}
            placeholder="Find a filter…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-xs focus:border-[#b20202] focus:outline-none"
          />
        </div>
      </div>

      <Section title="Documents">
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

      <Section title="Status">
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

      <Section title="Payment">
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

      <Section title="Period">
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

      <Section title="Catalog">
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
        {savedSearches.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-1 rounded-lg px-2.5 py-1 hover:bg-gray-50"
          >
            <PiStar className="h-3 w-3 shrink-0 text-amber-400" />
            <button
              type="button"
              onClick={() => applySavedSearch(s)}
              className="flex-1 truncate text-left text-xs text-gray-700"
            >
              {s.name}
            </button>
            <button
              type="button"
              onClick={() => deleteSavedSearch(s.id)}
              className="opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              aria-label={`Delete ${s.name}`}
            >
              <PiX className="h-3 w-3" />
            </button>
          </div>
        ))}
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
