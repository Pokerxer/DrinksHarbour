// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  PiFunnel,
  PiStack,
  PiStar,
  PiFloppyDisk,
  PiTrash,
  PiX,
  PiCaretDown,
  PiCaretUp,
} from 'react-icons/pi';
import type { FilterConfig } from './AdvancedFilters';

// ── Odoo-style search panel types & constants ──────────────────────────────────
export type SPFilterKey =
  | 'featured'
  | 'new_arrival'
  | 'best_seller'
  | 'on_sale'
  | 'low_stock'
  | 'out_of_stock'
  | 'needs_reorder'
  | 'published'
  | 'available_in_pos'
  | 'available_online'
  | 'has_sales'
  | 'no_sales'
  | 'archived';

export type SPGroupKey =
  | 'product_type'
  | 'category'
  | 'brand'
  | 'status'
  | 'stock_level';

export interface SPSavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SPFilterKey[];
  groupBy: SPGroupKey | null;
  chips: SPSearchChip[];
}

export type SPChipField =
  | 'product'
  | 'category'
  | 'vendor'
  | 'pos_category'
  | 'tags'
  | 'attributes';

export interface SPSearchChip {
  id: string;
  field: SPChipField;
  label: string;
  query: string;
}

export const SP_CHIP_FIELDS: { field: SPChipField; label: string }[] = [
  { field: 'product', label: 'Product' },
  { field: 'category', label: 'Product Category' },
  { field: 'vendor', label: 'Vendor' },
  { field: 'pos_category', label: 'POS Product Category' },
  { field: 'tags', label: 'Tags' },
  { field: 'attributes', label: 'Attributes' },
];

export const SP_SAVED_KEY = 'dh-subproduct-searches';

export function spLoadSaved(): SPSavedSearch[] {
  try {
    return JSON.parse(
      localStorage.getItem(SP_SAVED_KEY) || '[]'
    ) as SPSavedSearch[];
  } catch {
    return [];
  }
}

export function spPersistSaved(list: SPSavedSearch[]) {
  localStorage.setItem(SP_SAVED_KEY, JSON.stringify(list));
}

export const SP_FILTER_LABELS: Record<SPFilterKey, string> = {
  featured: 'Featured',
  new_arrival: 'New Arrivals',
  best_seller: 'Best Sellers',
  on_sale: 'On Sale',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  needs_reorder: 'Needs Reorder',
  published: 'Published',
  available_in_pos: 'Available in POS',
  available_online: 'Available Online',
  has_sales: 'Has Sales',
  no_sales: 'Never Sold',
  archived: 'Archived',
};

export const SP_GROUP_LABELS: Record<SPGroupKey, string> = {
  product_type: 'Product Type',
  category: 'Product Category',
  brand: 'Brand',
  status: 'Status',
  stock_level: 'Stock Level',
};

// ── OdooSearchPanel component ─────────────────────────────────────────────────
export default function OdooSearchPanel({
  activeFilters,
  groupBy,
  savedSearches,
  onToggleFilter,
  onSetGroupBy,
  onSave,
  onLoadSaved,
  onDeleteSaved,
  onClose,
  advancedFilters,
  onAdvancedFilterChange,
  onReset,
  activeFilterCount,
  onAddCustomFilter,
}: {
  activeFilters: Set<SPFilterKey>;
  groupBy: SPGroupKey | null;
  savedSearches: SPSavedSearch[];
  onToggleFilter: (f: SPFilterKey) => void;
  onSetGroupBy: (g: SPGroupKey | null) => void;
  onSave: (name: string) => void;
  onLoadSaved: (s: SPSavedSearch) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
  advancedFilters: FilterConfig;
  onAdvancedFilterChange: (f: FilterConfig) => void;
  onReset: () => void;
  activeFilterCount: number;
  onAddCustomFilter: () => void;
}) {
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advTab, setAdvTab] = useState<
    'basic' | 'beverage' | 'performance' | 'dates'
  >('basic');
  const ref = useRef<HTMLDivElement>(null);

  function upd<K extends keyof FilterConfig>(key: K, value: FilterConfig[K]) {
    onAdvancedFilterChange({ ...advancedFilters, [key]: value });
  }

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [onClose]);

  function FilterItem({ fkey, label }: { fkey: SPFilterKey; label: string }) {
    const on = activeFilters.has(fkey);
    return (
      <button
        type="button"
        onClick={() => onToggleFilter(fkey)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-[#b20202]/8 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${on ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`}
        >
          {on && <span className="h-2 w-2 rounded-sm bg-white" />}
        </span>
        {label}
      </button>
    );
  }

  function GroupItem({ gkey, label }: { gkey: SPGroupKey; label: string }) {
    const on = groupBy === gkey;
    return (
      <button
        type="button"
        onClick={() => onSetGroupBy(on ? null : gkey)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-[#b20202]/8 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${on ? 'border-[#b20202]' : 'border-gray-300'}`}
        >
          {on && <span className="h-2 w-2 rounded-full bg-[#b20202]" />}
        </span>
        {label}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="ring-black/8 absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 sm:min-w-[660px]"
    >
      <div className="flex flex-col divide-y divide-gray-100 sm:flex-row sm:divide-x sm:divide-y-0">
        {/* Filters */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiFunnel className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="space-y-0.5">
            <FilterItem fkey="featured" label="Featured" />
            <FilterItem fkey="new_arrival" label="New Arrivals" />
            <FilterItem fkey="best_seller" label="Best Sellers" />
            <FilterItem fkey="on_sale" label="On Sale" />
            <div className="my-1.5 border-t border-gray-100" />
            <FilterItem fkey="low_stock" label="Low Stock" />
            <FilterItem fkey="out_of_stock" label="Out of Stock" />
            <FilterItem fkey="needs_reorder" label="Needs Reorder" />
            <div className="my-1.5 border-t border-gray-100" />
            <FilterItem fkey="published" label="Published" />
            <FilterItem fkey="available_in_pos" label="Available in POS" />
            <FilterItem fkey="available_online" label="Available Online" />
            <div className="my-1.5 border-t border-gray-100" />
            <FilterItem fkey="has_sales" label="Has Sales" />
            <FilterItem fkey="no_sales" label="Never Sold" />
            <div className="my-1.5 border-t border-gray-100" />
            <FilterItem fkey="archived" label="Archived" />
            <div className="my-1.5 border-t border-gray-100" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#b20202] transition-colors hover:bg-red-50"
              >
                {showAdvanced ? (
                  <PiCaretUp className="h-3.5 w-3.5" />
                ) : (
                  <PiCaretDown className="h-3.5 w-3.5" />
                )}
                Filter Presets
                {activeFilterCount > 0 && (
                  <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-[#b20202]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onAddCustomFilter}
                className="whitespace-nowrap rounded-lg border border-[#b20202]/30 px-2.5 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-50"
              >
                + Custom Filter
              </button>
            </div>
          </div>
        </div>

        {/* Group By */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStack className="h-3.5 w-3.5" /> Group By
          </div>
          <div className="space-y-0.5">
            <GroupItem gkey="product_type" label="Product Type" />
            <GroupItem gkey="category" label="Product Category" />
            <GroupItem gkey="brand" label="Brand" />
            <GroupItem gkey="status" label="Status" />
            <GroupItem gkey="stock_level" label="Stock Level" />
          </div>
        </div>

        {/* Favorites */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <PiStar className="h-3.5 w-3.5" /> Favorites
          </div>
          <div className="space-y-1">
            {!showSaveInput ? (
              <button
                type="button"
                onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <PiFloppyDisk className="h-4 w-4 text-gray-400" /> Save current
                search
              </button>
            ) : (
              <div className="space-y-2 px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveName.trim()) {
                      onSave(saveName.trim());
                      setSaveName('');
                      setShowSaveInput(false);
                    }
                    if (e.key === 'Escape') setShowSaveInput(false);
                  }}
                  placeholder="Search name…"
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-[#b20202]"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (saveName.trim()) {
                        onSave(saveName.trim());
                        setSaveName('');
                        setShowSaveInput(false);
                      }
                    }}
                    disabled={!saveName.trim()}
                    className="flex-1 rounded-lg bg-[#b20202] py-1.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveName('');
                      setShowSaveInput(false);
                    }}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {savedSearches.length > 0 && (
              <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-2">
                {savedSearches.map((s) => (
                  <div key={s.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadSaved(s);
                        onClose();
                      }}
                      className="flex flex-1 items-center gap-2 truncate rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <PiStar className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{s.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSaved(s.id)}
                      className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 hover:text-red-500 group-hover:flex"
                    >
                      <PiTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced filter panel — full-width below 3 columns */}
      {showAdvanced && (
        <div className="border-t border-gray-100">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50 px-2">
            {(['basic', 'beverage', 'performance', 'dates'] as const).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAdvTab(tab)}
                  className={`relative px-4 py-2 text-xs font-medium capitalize transition-colors ${advTab === tab ? 'border-b-2 border-[#b20202] text-[#b20202]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {tab}
                </button>
              )
            )}
            <div className="ml-auto flex items-center pr-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Reset all
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
            {advTab === 'basic' && (
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                {/* Left: Status + Stock */}
                <div className="space-y-4 p-4">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Product Status
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'active', l: 'Active' },
                        { v: 'draft', l: 'Draft' },
                        { v: 'pending', l: 'Pending' },
                        { v: 'discontinued', l: 'Discontinued' },
                        { v: 'archived', l: 'Archived' },
                      ].map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() =>
                            upd(
                              'status',
                              advancedFilters.status.includes(o.v)
                                ? advancedFilters.status.filter(
                                    (x) => x !== o.v
                                  )
                                : [...advancedFilters.status, o.v]
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.status.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Stock Status
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'in_stock', l: 'In Stock' },
                        { v: 'low_stock', l: 'Low Stock' },
                        { v: 'out_of_stock', l: 'Out of Stock' },
                        { v: 'pre_order', l: 'Pre-Order' },
                      ].map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() =>
                            upd(
                              'stockStatus',
                              advancedFilters.stockStatus.includes(o.v)
                                ? advancedFilters.stockStatus.filter(
                                    (x) => x !== o.v
                                  )
                                : [...advancedFilters.stockStatus, o.v]
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.stockStatus.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Right: Flags + Channels */}
                <div className="space-y-3 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Product Flags
                  </p>
                  {[
                    { k: 'isFeatured' as const, l: 'Featured' },
                    { k: 'isBestSeller' as const, l: 'Best Seller' },
                    { k: 'isNewArrival' as const, l: 'New Arrival' },
                    { k: 'onSale' as const, l: 'On Sale' },
                    { k: 'needsReorder' as const, l: 'Needs Reorder' },
                    { k: 'visibleInPOS' as const, l: 'Visible in POS' },
                    { k: 'visibleInOnlineStore' as const, l: 'Visible Online' },
                  ].map(({ k, l }) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-xs text-gray-700">{l}</span>
                      <div className="flex">
                        <button
                          type="button"
                          onClick={() =>
                            upd(k, advancedFilters[k] === true ? null : true)
                          }
                          className={`rounded-l border px-2 py-0.5 text-[10px] font-semibold transition-all ${advancedFilters[k] === true ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            upd(k, advancedFilters[k] === false ? null : false)
                          }
                          className={`rounded-r border-b border-r border-t px-2 py-0.5 text-[10px] font-semibold transition-all ${advancedFilters[k] === false ? 'border-red-500 bg-red-500 text-white' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {advTab === 'beverage' && (
              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Beverage Type
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { v: 'wine', l: 'Wine🍷' },
                      { v: 'beer', l: 'Beer🍺' },
                      { v: 'whiskey', l: 'Whiskey🥃' },
                      { v: 'vodka', l: 'Vodka🍸' },
                      { v: 'gin', l: 'Gin🍸' },
                      { v: 'rum', l: 'Rum🍹' },
                      { v: 'tequila', l: 'Tequila🌵' },
                      { v: 'champagne', l: 'Champagne🥂' },
                      { v: 'soft_drink', l: 'Soft Drink🥤' },
                      { v: 'juice', l: 'Juice🧃' },
                      { v: 'water', l: 'Water💧' },
                      { v: 'cocktail', l: 'Cocktail🍹' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() =>
                          upd(
                            'beverageTypes',
                            advancedFilters.beverageTypes.includes(o.v)
                              ? advancedFilters.beverageTypes.filter(
                                  (x) => x !== o.v
                                )
                              : [...advancedFilters.beverageTypes, o.v]
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.beverageTypes.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Origin Country
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { v: 'NG', l: '🇳🇬 Nigeria' },
                      { v: 'FR', l: '🇫🇷 France' },
                      { v: 'IT', l: '🇮🇹 Italy' },
                      { v: 'ES', l: '🇪🇸 Spain' },
                      { v: 'US', l: '🇺🇸 USA' },
                      { v: 'GB', l: '🇬🇧 UK' },
                      { v: 'DE', l: '🇩🇪 Germany' },
                      { v: 'ZA', l: '🇿🇦 S.Africa' },
                      { v: 'AU', l: '🇦🇺 Australia' },
                      { v: 'SC', l: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() =>
                          upd(
                            'originCountries',
                            advancedFilters.originCountries.includes(o.v)
                              ? advancedFilters.originCountries.filter(
                                  (x) => x !== o.v
                                )
                              : [...advancedFilters.originCountries, o.v]
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${advancedFilters.originCountries.includes(o.v) ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {advTab === 'performance' && (
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="space-y-3 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Total Sales
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { l: 'No sales', r: [0, 0] },
                      { l: '1–10', r: [1, 10] },
                      { l: '11–50', r: [11, 50] },
                      { l: '51–100', r: [51, 100] },
                      { l: '100+', r: [100, 1000000] },
                    ].map((p) => {
                      const on =
                        advancedFilters.salesRange[0] === p.r[0] &&
                        advancedFilters.salesRange[1] === p.r[1];
                      return (
                        <button
                          key={p.l}
                          type="button"
                          onClick={() =>
                            upd(
                              'salesRange',
                              on ? [0, 0] : (p.r as [number, number])
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${on ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                        >
                          {p.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Price Range
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { l: 'Under ₦5k', r: [0, 5000] },
                      { l: '₦5k–10k', r: [5000, 10000] },
                      { l: '₦10k–25k', r: [10000, 25000] },
                      { l: '₦25k–50k', r: [25000, 50000] },
                      { l: '₦50k+', r: [50000, 10000000] },
                    ].map((p) => {
                      const on =
                        advancedFilters.priceRange[0] === p.r[0] &&
                        advancedFilters.priceRange[1] === p.r[1];
                      return (
                        <button
                          key={p.l}
                          type="button"
                          onClick={() =>
                            upd(
                              'priceRange',
                              on ? [0, 0] : (p.r as [number, number])
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${on ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#b20202]/40'}`}
                        >
                          {p.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {advTab === 'dates' && (
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="space-y-2 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Date Added
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={advancedFilters.dateRange.from}
                      onChange={(e) =>
                        upd('dateRange', {
                          ...advancedFilters.dateRange,
                          from: e.target.value,
                        })
                      }
                      className="h-8 flex-1 rounded border border-gray-200 px-2 text-xs outline-none focus:border-[#b20202]"
                    />
                    <span className="self-center text-xs text-gray-400">–</span>
                    <input
                      type="date"
                      value={advancedFilters.dateRange.to}
                      onChange={(e) =>
                        upd('dateRange', {
                          ...advancedFilters.dateRange,
                          to: e.target.value,
                        })
                      }
                      className="h-8 flex-1 rounded border border-gray-200 px-2 text-xs outline-none focus:border-[#b20202]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { l: 'Today', d: 0 },
                      { l: '7d', d: 7 },
                      { l: '30d', d: 30 },
                      { l: '90d', d: 90 },
                    ].map((p) => (
                      <button
                        key={p.l}
                        type="button"
                        onClick={() => {
                          const to = new Date();
                          const from = new Date();
                          from.setDate(from.getDate() - p.d);
                          upd('dateRange', {
                            from: from.toISOString().split('T')[0],
                            to: to.toISOString().split('T')[0],
                          });
                        }}
                        className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 transition-colors hover:bg-red-50 hover:text-[#b20202]"
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Last Sold
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={advancedFilters.lastSoldRange.from}
                      onChange={(e) =>
                        upd('lastSoldRange', {
                          ...advancedFilters.lastSoldRange,
                          from: e.target.value,
                        })
                      }
                      className="h-8 flex-1 rounded border border-gray-200 px-2 text-xs outline-none focus:border-[#b20202]"
                    />
                    <span className="self-center text-xs text-gray-400">–</span>
                    <input
                      type="date"
                      value={advancedFilters.lastSoldRange.to}
                      onChange={(e) =>
                        upd('lastSoldRange', {
                          ...advancedFilters.lastSoldRange,
                          to: e.target.value,
                        })
                      }
                      className="h-8 flex-1 rounded border border-gray-200 px-2 text-xs outline-none focus:border-[#b20202]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}