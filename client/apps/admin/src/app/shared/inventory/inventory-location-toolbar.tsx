'use client';
import Link from 'next/link';
import { PiArrowClockwise, PiMagnifyingGlass } from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  EMPTY_LOCATION_FILTERS,
  LOCATION_TYPES,
  type LocationFilters,
} from './inventory-location-report';
export default function LocationToolbar({
  filters,
  change,
  loading,
  stockAvailable,
  count,
  total,
  refresh,
}: {
  filters: LocationFilters;
  change: (filters: LocationFilters) => void;
  loading: boolean;
  stockAvailable: boolean;
  count: number;
  total: number;
  refresh: () => void;
}) {
  const update = (key: keyof LocationFilters, value: string) =>
    change({ ...filters, [key]: value });
  const active = Boolean(
    filters.search || filters.type || filters.status || filters.stock || filters.sort !== 'name',
  );
  const inputClass =
    'h-[34px] w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20 disabled:opacity-40';
  const labelClass =
    'flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400';
  return (
    <div className="shrink-0 border-b border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gray-100 px-4 pb-2.5 pt-3 sm:gap-x-4 sm:gap-y-2 sm:px-5 sm:pb-3 sm:pt-4">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <h1 className="text-lg font-bold leading-tight text-gray-900">Inventory locations</h1>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {loading ? 'Loading locations…' : `${count} of ${total} shown`} · warehouses, stores and
            distribution centers
          </p>
        </div>
        <div
          aria-label="Location status"
          className="flex items-center overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-0.5"
        >
          {[
            ['', 'All'],
            ['active', 'Active'],
            ['inactive', 'Inactive'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={label}
              aria-pressed={filters.status === value}
              onClick={() => update('status', value)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${filters.status === value ? 'bg-[#b20202] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            aria-label="Refresh"
            title="Refresh locations"
            disabled={loading}
            onClick={refresh}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <PiArrowClockwise className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href={routes.warehouses.list}
            className="rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101]"
          >
            Manage locations
          </Link>
        </div>
      </header>
      <section
        aria-label="Location filters"
        className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5"
      >
        <label className={`${labelClass} min-w-[130px]`}>
          Location type
          <select
            aria-label="Location type"
            value={filters.type}
            onChange={(e) => update('type', e.target.value)}
            className={inputClass}
          >
            <option value="">All types</option>
            {Object.entries(LOCATION_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} min-w-[180px] flex-1`}>
          Search
          <div className="relative">
            <PiMagnifyingGlass className="absolute left-2.5 top-2.5 h-3.5 w-3.5" />
            <input
              type="search"
              aria-label="Search locations or products"
              value={filters.search}
              onChange={(e) => update('search', e.target.value)}
              placeholder="Location, product, SKU or address…"
              className={`${inputClass} pl-8 font-normal normal-case tracking-normal`}
            />
          </div>
        </label>
        <label className={`${labelClass} min-w-[140px]`}>
          Stock
          <select
            aria-label="Stock filter"
            disabled={!stockAvailable}
            value={stockAvailable ? filters.stock : ''}
            onChange={(e) => update('stock', e.target.value)}
            className={inputClass}
          >
            <option value="">All stock levels</option>
            <option value="stocked">Has positive stock</option>
            <option value="empty">No positive stock</option>
            <option value="alerts">Has stock alerts</option>
          </select>
        </label>
        <label className={`${labelClass} min-w-[140px]`}>
          Sort
          <select
            aria-label="Sort locations"
            value={stockAvailable ? filters.sort : 'name'}
            onChange={(e) => update('sort', e.target.value)}
            className={inputClass}
          >
            <option value="name">Name A–Z</option>
            <option value="units" disabled={!stockAvailable}>
              Most units first
            </option>
            <option value="value" disabled={!stockAvailable}>
              Highest stock value
            </option>
          </select>
        </label>
        <button
          type="button"
          disabled={!active}
          onClick={() => change(EMPTY_LOCATION_FILTERS)}
          className="h-[34px] rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        >
          Clear filters
        </button>
        <p className="basis-full text-[10px] text-gray-400">
          Separate names with commas to match more than one location or product. Other filters
          narrow those results.
        </p>
      </section>
    </div>
  );
}
