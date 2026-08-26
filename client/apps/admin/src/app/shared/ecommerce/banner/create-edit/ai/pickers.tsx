// @ts-nocheck
'use client';

/**
 * Context target pickers for the AI generator: product (live server search),
 * category (select), subcategory + brand (shared searchable list).
 */

import {
  PiMagnifyingGlass,
  PiX,
  PiSpinnerBold,
  PiPackage,
  PiStorefrontBold,
  PiCheckBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder-gray-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        >
          <PiX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
      <PiSpinnerBold className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

function CheckMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
      <PiCheckBold className="h-3 w-3" />
    </span>
  );
}

// ─── Product picker ──────────────────────────────────────────────────────────

export function ProductPicker({
  search,
  onSearchChange,
  results,
  searching,
  popularProducts,
  selectedId,
  onSelect,
  isLoadingContext,
  isPartial,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  results: any[];
  searching: boolean;
  popularProducts: any[];
  selectedId: string;
  onSelect: (p: any) => void;
  isLoadingContext: boolean;
  /** True when the preloaded set is a head of the catalogue, not all of it. */
  isPartial?: boolean;
}) {
  if (isLoadingContext) return <LoadingRow label="Loading products..." />;

  const q = search.trim();
  // 2+ chars → live server search across ALL products; 1 char → instant local
  // filter of the preloaded set; empty → the preloaded popular set.
  const list =
    q.length >= 2
      ? results
      : q
        ? popularProducts.filter((p) =>
            `${p.name} ${p.brand || ''}`.toLowerCase().includes(q.toLowerCase())
          )
        : popularProducts;

  return (
    <div className="space-y-2">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search products by name or brand..."
      />
      <div className="max-h-72 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-200">
        {searching ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <PiSpinnerBold className="h-4 w-4 animate-spin" /> Searching…
          </div>
        ) : list.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            {q.length >= 2 ? (
              <>No products match &ldquo;{search}&rdquo;</>
            ) : (
              'No products available'
            )}
          </div>
        ) : (
          list.map((p) => {
            const selected = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'bg-purple-50 ring-1 ring-purple-300'
                    : 'hover:bg-gray-50'
                )}
              >
                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <PiPackage className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      selected ? 'text-purple-700' : 'text-gray-900'
                    )}
                  >
                    {p.name}
                  </p>
                  {p.brand && (
                    <p className="truncate text-xs text-gray-400">{p.brand}</p>
                  )}
                </div>
                <CheckMark show={selected} />
              </button>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        {q.length >= 2
          ? `${results.length} live product${results.length === 1 ? '' : 's'} match — searching the full catalogue by name or brand`
          : isPartial
            ? `Showing the top ${popularProducts.length} products by sales and views — type 2+ characters to search the full catalogue`
            : `Showing all ${popularProducts.length} live products`}
      </p>
    </div>
  );
}

// ─── Category select ─────────────────────────────────────────────────────────

export function CategorySelect({
  categories,
  selectedId,
  onSelect,
  isLoadingContext,
}: {
  categories: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoadingContext: boolean;
}) {
  if (isLoadingContext) return <LoadingRow label="Loading..." />;
  return (
    <select
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
    >
      <option value="">Choose a category...</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

// ─── Generic searchable list (subcategory / brand) ───────────────────────────

interface ListPickerProps {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder: string;
  items: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoadingContext: boolean;
  loadingLabel: string;
  emptyLabel: string;
  countNoun: string;
  /** Total available server-side, so a filtered view can say "12 of 360". */
  totalCount?: number;
  /** Renders leading thumbnail + name lines for an item. */
  renderItem: (item: any, selected: boolean) => React.ReactNode;
}

export function SearchableListPicker({
  search,
  onSearchChange,
  placeholder,
  items,
  selectedId,
  onSelect,
  isLoadingContext,
  loadingLabel,
  emptyLabel,
  countNoun,
  totalCount,
  renderItem,
}: ListPickerProps) {
  if (isLoadingContext) return <LoadingRow label={loadingLabel} />;

  const q = search.trim().toLowerCase();
  // Matches name plus whichever secondary line the item renders — parent
  // category for subcategories, country of origin for brands. Both of those
  // fields have to be in the payload for this to do anything.
  const list = q
    ? items.filter((i) =>
        `${i.name || ''} ${i.parentName || ''} ${i.countryOfOrigin || ''}`
          .toLowerCase()
          .includes(q)
      )
    : items;

  const plural = (n: number) =>
    countNoun === 'subcategor'
      ? `subcategor${n === 1 ? 'y' : 'ies'}`
      : `${countNoun}${n === 1 ? '' : 's'}`;
  const total = totalCount ?? items.length;
  const countWord =
    list.length === total
      ? `${total} ${plural(total)}`
      : `${list.length} of ${total} ${plural(total)}`;

  return (
    <div className="space-y-2">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={placeholder}
      />
      {/* Matches the product picker's height — these lists now carry the whole
          catalogue (612 subcategories, 360 brands), and 48 showed ~3 rows. */}
      <div className="max-h-72 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-200">
        {list.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            {/* Without the guard an unfiltered empty list reads `No brands
                match ""`, which blames the search for a data problem. */}
            {q ? (
              <>
                {emptyLabel} &ldquo;{search}&rdquo;
              </>
            ) : (
              `No ${plural(0)} available`
            )}
          </div>
        ) : (
          list.map((item) => {
            const selected = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'bg-purple-50 ring-1 ring-purple-300'
                    : 'hover:bg-gray-50'
                )}
              >
                {renderItem(item, selected)}
                <CheckMark show={selected} />
              </button>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-gray-400">{countWord}</p>
    </div>
  );
}

export function SubcategoryItem({
  s,
  selected,
}: {
  s: any;
  selected: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          'truncate text-sm font-medium',
          selected ? 'text-purple-700' : 'text-gray-900'
        )}
      >
        {s.name}
      </p>
      {s.parentName && (
        <p className="truncate text-xs text-gray-400">{s.parentName}</p>
      )}
    </div>
  );
}

export function BrandItem({ b, selected }: { b: any; selected: boolean }) {
  return (
    <>
      {b.logo?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.logo.url}
          alt={b.name}
          className="h-8 w-8 flex-shrink-0 rounded-lg border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <PiStorefrontBold className="h-4 w-4 text-gray-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            selected ? 'text-purple-700' : 'text-gray-900'
          )}
        >
          {b.name}
        </p>
        {b.countryOfOrigin && (
          <p className="truncate text-xs text-gray-400">{b.countryOfOrigin}</p>
        )}
      </div>
    </>
  );
}
