'use client';

import { useMemo, useState } from 'react';
import { PiMagnifyingGlass, PiSpinner, PiX } from 'react-icons/pi';
import {
  catalogFacets,
  catalogFacetLabel,
  catalogProductName,
  type CatalogProduct,
  type ScopeSelection,
} from './inventory-pricelist-print';

type FacetKey = 'categories' | 'subCategories' | 'brands' | 'products';

const TABS: { key: FacetKey; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'subCategories', label: 'Sub-categories' },
  { key: 'brands', label: 'Brands' },
  { key: 'products', label: 'Products' },
];

interface ScopePickerProps {
  catalog: CatalogProduct[];
  loading: boolean;
  selection: ScopeSelection;
  onChange: (s: ScopeSelection) => void;
}

export default function ScopePicker({
  catalog,
  loading,
  selection,
  onChange,
}: ScopePickerProps) {
  const [tab, setTab] = useState<FacetKey>('categories');
  const [query, setQuery] = useState('');

  const facets = useMemo(() => catalogFacets(catalog), [catalog]);

  const facetList = useMemo(() => {
    if (tab === 'products') return [];
    const map =
      tab === 'categories'
        ? facets.categories
        : tab === 'subCategories'
          ? facets.subCategories
          : facets.brands;
    const q = query.trim().toLowerCase();
    return Array.from(map.entries())
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [tab, facets, query]);

  const productList = useMemo(() => {
    if (tab !== 'products') return [];
    const q = query.trim().toLowerCase();
    return catalog
      .filter(
        (p) =>
          !q ||
          catalogProductName(p).toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          catalogFacetLabel(p, 'brand').toLowerCase().includes(q)
      )
      .slice(0, 200);
  }, [tab, catalog, query]);

  const selectedOf = (key: FacetKey): number =>
    key === 'products'
      ? selection.productIds.length
      : selection[key].length;
  const totalSelected =
    selection.categories.length +
    selection.subCategories.length +
    selection.brands.length +
    selection.productIds.length;

  function toggle(facet: FacetKey, value: string) {
    if (facet === 'products') {
      const cur = new Set(selection.productIds);
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      onChange({ ...selection, productIds: Array.from(cur) });
      return;
    }
    const cur = new Set(selection[facet]);
    if (cur.has(value)) cur.delete(value);
    else cur.add(value);
    onChange({ ...selection, [facet]: Array.from(cur) });
  }

  function clearTab() {
    onChange({ ...selection, [tab === 'products' ? 'productIds' : tab]: [] });
  }

  const activeSet = useMemo(
    () => new Set(tab === 'products' ? selection.productIds : selection[tab]),
    [tab, selection]
  );

  return (
    <div className="rounded-xl border border-gray-100">
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setQuery('');
            }}
            className={`flex shrink-0 items-center gap-1 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'border-[#b20202] text-[#b20202]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
            {selectedOf(t.key) > 0 && (
              <span className="rounded-full bg-[#b20202] px-1.5 text-[9px] font-bold text-white">
                {selectedOf(t.key)}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1.5">
          {totalSelected > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  categories: [],
                  subCategories: [],
                  brands: [],
                  productIds: [],
                })
              }
              className="text-[11px] font-medium text-gray-400 hover:text-[#b20202]"
            >
              Clear all ({totalSelected})
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-gray-50 px-3 py-2">
        <div className="relative">
          <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === 'products'
                ? 'Search products by name, SKU or brand…'
                : `Filter ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}…`
            }
            aria-label={`Filter ${tab}`}
            className="h-[32px] w-full rounded-lg border border-gray-100 bg-gray-50 pl-8 pr-7 text-xs text-gray-800 focus:border-[#b20202] focus:bg-white focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"
            >
              <PiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-52 overflow-y-auto p-1.5">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
            <PiSpinner className="h-4 w-4 animate-spin" /> Loading catalogue…
          </p>
        ) : tab === 'products' ? (
          productList.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">
              No products match “{query}”
            </p>
          ) : (
            productList.map((p) => {
              const id = String(p._id);
              const checked = selection.productIds.includes(id);
              const cat = catalogFacetLabel(p, 'category');
              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle('products', id)}
                    className="h-3.5 w-3.5 accent-[#b20202]"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">
                    {catalogProductName(p)}
                  </span>
                  {cat && (
                    <span className="hidden shrink-0 text-[10px] text-gray-400 sm:inline">
                      {cat}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-gray-400">
                    {p.sku}
                  </span>
                </label>
              );
            })
          )
        ) : facetList.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">Nothing here</p>
        ) : (
          <>
            {facetList.map(([name, count]) => {
              const checked = activeSet.has(name);
              return (
                <label
                  key={name}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(tab, name)}
                    className="h-3.5 w-3.5 accent-[#b20202]"
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-xs ${checked ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                  >
                    {name}
                  </span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-1.5 text-[10px] font-bold tabular-nums text-gray-500">
                    {count}
                  </span>
                </label>
              );
            })}
            {selectedOf(tab) > 0 && (
              <button
                type="button"
                onClick={clearTab}
                className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-[#b20202] hover:bg-red-50"
              >
                Clear {selectedOf(tab)} selected {tab === 'brands' ? 'brand' : tab.slice(0, -1)}
                {selectedOf(tab) > 1 ? 's' : ''}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
