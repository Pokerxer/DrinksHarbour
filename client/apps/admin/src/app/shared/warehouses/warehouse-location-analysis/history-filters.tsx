import { useEffect, useState } from 'react';
import { PiArrowsClockwiseBold, PiDownloadSimpleBold, PiFunnelBold } from 'react-icons/pi';
import type { HistoryFilters } from '@/services/warehouseHistory.service';
import ProductFilter from './product-filter';
import { historyStatuses } from './filter-statuses';
import { datePreset } from './history-tools';
export default function HistoryFiltersBar({
  filters,
  resetKey,
  products,
  productLoading,
  productError,
  retryProducts,
  transfer,
  loading,
  canExport,
  change,
  clear,
  refresh,
  download,
}: {
  filters: HistoryFilters;
  resetKey: number;
  products: { id: string; label: string }[];
  productLoading: boolean;
  productError: string;
  retryProducts: () => void;
  transfer: boolean;
  loading: boolean;
  canExport: boolean;
  change: (patch: Partial<HistoryFilters>) => void;
  clear: () => void;
  refresh: () => void;
  download: () => void;
}) {
  const [draftSearch, setDraftSearch] = useState(filters.search || '');
  useEffect(() => {
    setDraftSearch(filters.search || '');
  }, [filters.search, resetKey]);
  useEffect(() => {
    if (draftSearch === (filters.search || '')) return;
    const timer = setTimeout(() => change({ search: draftSearch }), 250);
    return () => clearTimeout(timer);
  }, [draftSearch, filters.search, change]);
  const field =
    'mt-1.5 block min-h-11 w-full rounded-lg border border-[#e7e1d8] bg-white px-3 py-2 text-sm font-normal text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]';
  const action =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#e7e1d8] bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-[#f8f5f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202] disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="rounded-xl border border-[#ece4d6] bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#65594e]">
          <PiFunnelBold aria-hidden="true" />
          Filter history
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} onClick={clear}>
            Clear filters
          </button>
          <button type="button" className={action} onClick={refresh} disabled={loading}>
            <PiArrowsClockwiseBold className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            className={action}
            disabled={!canExport || loading}
            onClick={download}
            title="Download the records displayed on this page"
          >
            <PiDownloadSimpleBold aria-hidden="true" />
            Export page
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {transfer && (
          <label className="text-xs font-semibold text-gray-500">
            History view
            <select
              aria-label="Transfer history view"
              className={field}
              value={filters.kind}
              onChange={(event) =>
                change({ kind: event.target.value as HistoryFilters['kind'], status: '' })
              }
            >
              <option value="transfer_movements">Stock transfers and returns</option>
              <option value="transfers">Transfer documents</option>
            </select>
          </label>
        )}
        <ProductFilter
          key={resetKey}
          value={filters.product}
          products={products}
          loading={productLoading}
          error={productError}
          retry={retryProducts}
          change={(product) => change({ product })}
        />
        <label className="text-xs font-semibold text-gray-500">
          {filters.kind === 'movements' ? 'Movement type' : 'Status'}
          <select
            aria-label={filters.kind === 'movements' ? 'Movement type' : 'Status'}
            className={field}
            value={filters.status || ''}
            onChange={(event) => change({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {historyStatuses[filters.kind].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-500">
          {filters.kind === 'purchases' ? 'Reference or supplier' : 'Reference'}
          <input
            type="search"
            aria-label={
              filters.kind === 'purchases' ? 'Search reference or supplier' : 'Search reference'
            }
            maxLength={200}
            className={field}
            placeholder={
              filters.kind === 'purchases'
                ? 'Order number or supplier…'
                : filters.kind === 'movements' || filters.kind === 'transfer_movements'
                  ? 'Movement reference or note…'
                  : 'Transfer number or reference…'
            }
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Created from
          <input
            aria-label="Created from"
            type="date"
            className={field}
            value={filters.start}
            max={filters.end || undefined}
            onChange={(event) => change({ start: event.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Created to
          <input
            aria-label="Created to"
            type="date"
            className={field}
            value={filters.end}
            min={filters.start || undefined}
            onChange={(event) => change({ end: event.target.value })}
          />
        </label>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Products match any selection. Status, dates and reference narrow those results.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-1 text-gray-400">Date shortcuts</span>
        {(
          [
            ['week', 'Last 7 days'],
            ['month', 'This month'],
            ['all', 'All dates'],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => change(datePreset(key))}
            className="rounded-full border border-[#e7e1d8] px-3 py-1.5 font-medium text-[#75695d] hover:border-[#b20202] hover:text-[#b20202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-gray-400">Dates use UTC</span>
      </div>
    </div>
  );
}
