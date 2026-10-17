'use client';
import { useState } from 'react';
import { PiFunnel, PiX } from 'react-icons/pi';
import type { CatalogueFilters, Option } from './sales-catalog-data';
export type SortKey = CatalogueFilters['sort'];
export type FilterOption = Option;

function Choices({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const visible = options.filter((option) =>
    option.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold text-gray-700">
        {title}
        {selected.length > 0 ? ` (${selected.length})` : ''}
      </legend>
      {options.length > 8 && (
        <input
          aria-label={`Find ${title.toLowerCase()}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Find ${title.toLowerCase()}…`}
          className="mb-2 w-full rounded-lg border-gray-200 text-xs focus:border-brand focus:ring-brand"
        />
      )}
      <div className="max-h-36 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {visible.length ? (
          visible.map((option) => (
            <label
              key={option.id}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-gray-700 hover:bg-white"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() =>
                  onChange(
                    selected.includes(option.id)
                      ? selected.filter((id) => id !== option.id)
                      : [...selected, option.id]
                  )
                }
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              <span className="truncate">
                {option.name.replace(/[_-]/g, ' ')}
              </span>
            </label>
          ))
        ) : (
          <p className="p-2 text-xs text-gray-500">No matching options</p>
        )}
      </div>
    </fieldset>
  );
}

export default function SalesCatalogueFilters({
  filters,
  facets,
  onChange,
}: {
  filters: CatalogueFilters;
  facets: { categories: Option[]; brands: Option[]; types: Option[] };
  onChange: (filters: CatalogueFilters) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active =
    filters.categories.length +
    filters.brands.length +
    filters.types.length +
    Number(filters.inStock);
  return (
    <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="sales-catalogue-filters"
          onClick={() => setExpanded((value) => !value)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${active || expanded ? 'border-brand/30 bg-red-50 text-brand' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          <PiFunnel /> Filters
          {active > 0 && (
            <span className="rounded bg-brand px-1.5 text-xs text-white">
              {active}
            </span>
          )}
        </button>
        <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(event) =>
              onChange({ ...filters, inStock: event.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
          />{' '}
          In stock only
        </label>
        {active > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                categories: [],
                brands: [],
                types: [],
                inStock: false,
                sort: filters.sort,
              })
            }
            className="inline-flex min-h-10 items-center gap-1 text-xs text-gray-500 hover:text-brand"
          >
            <PiX /> Clear filters
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          Sort
          <select
            aria-label="Sort catalogue"
            value={filters.sort}
            onChange={(event) =>
              onChange({ ...filters, sort: event.target.value as SortKey })
            }
            className="min-h-10 rounded-lg border-gray-200 bg-gray-50 py-2 text-xs text-gray-700 focus:border-brand focus:ring-brand"
          >
            <option value="name">Name A–Z</option>
            <option value="priceAsc">Base price: low to high</option>
            <option value="priceDesc">Base price: high to low</option>
            <option value="stock">Availability: high to low</option>
          </select>
        </label>
      </div>
      {expanded && (
        <div
          id="sales-catalogue-filters"
          className="mt-3 grid gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-3"
        >
          <Choices
            title="Categories"
            options={facets.categories}
            selected={filters.categories}
            onChange={(categories) => onChange({ ...filters, categories })}
          />
          <Choices
            title="Brands"
            options={facets.brands}
            selected={filters.brands}
            onChange={(brands) => onChange({ ...filters, brands })}
          />
          <Choices
            title="Beverage types"
            options={facets.types}
            selected={filters.types}
            onChange={(types) => onChange({ ...filters, types })}
          />
        </div>
      )}
    </div>
  );
}
