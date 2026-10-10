import { PiCaretLeft, PiCaretRight, PiMagnifyingGlass, PiX } from 'react-icons/pi';

import { DATE_PRESETS, DateTimeRange } from './inventory-receipts-support';
import ProductFilter from '../warehouses/warehouse-location-analysis/product-filter';

import InternalRouteFilters from './inventory-internal-filters';
import { movementSourceLabel } from './inventory-delivery-view';
import type { MovementBrowserView } from './use-movement-browser';
const STATUS_OPTIONS = ['confirmed', 'pending', 'cancelled', 'rejected'];
export default function MovementFilters({ view }: { view: MovementBrowserView }) {
  const {
    preset,
    loading,
    errorMsg,
    fetchMoves,
    productFilter,
    setProductFilter,
    search,
    setSearch,
    groupBy,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    setSelected,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    setDateFrom,
    setDateTo,
    setTimeFrom,
    setTimeTo,
    activePreset,
    setActivePreset,
    warehouseFilter,
    setWarehouseFilter,
    supplierFilter,
    setSupplierFilter,
    sourceFilter,
    setSourceFilter,
    fromWarehouse,
    setFromWarehouse,
    toWarehouse,
    setToWarehouse,
    sources,
    warehouses,
    products,
    suppliers,
    applyPreset,
    clearDateRange,
    clearAllFilters,
    totalPages,
    hasAnyFilter,
  } = view;
  return (
    <div className="space-y-2.5 px-4 py-3">
      <ProductFilter
        value={productFilter}
        products={products}
        change={setProductFilter}
        loading={loading}
        error={errorMsg || ''}
        retry={() => void fetchMoves()}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Quick range
        </span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={activePreset === p.label}
            onClick={() => applyPreset(p)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
              activePreset === p.label
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <DateTimeRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          timeFrom={timeFrom}
          timeTo={timeTo}
          onDateFrom={(v) => {
            setDateFrom(v);
            setActivePreset('');
          }}
          onDateTo={(v) => {
            setDateTo(v);
            setActivePreset('');
          }}
          onTimeFrom={(v) => {
            setTimeFrom(v);
            setActivePreset('');
          }}
          onTimeTo={(v) => {
            setTimeTo(v);
            setActivePreset('');
          }}
          onClear={clearDateRange}
        />

        <div className="mx-1 mt-5 w-px self-stretch bg-gray-100" />

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Warehouse
          </span>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            aria-label="Filter by warehouse"
            className="h-[34px] min-w-[140px] max-w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="h-[34px] min-w-[140px] max-w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs capitalize text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {preset.showRoute && (
          <InternalRouteFilters
            warehouses={warehouses}
            fromWarehouse={fromWarehouse}
            toWarehouse={toWarehouse}
            setFromWarehouse={setFromWarehouse}
            setToWarehouse={setToWarehouse}
          />
        )}

        {preset.showSource && (
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Source
            <select
              aria-label="Filter by source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-[34px] min-w-[140px] max-w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs normal-case text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
            >
              <option value="">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {movementSourceLabel(source)}
                </option>
              ))}
            </select>
          </label>
        )}

        {preset.showSupplier && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Supplier
            </span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              aria-label="Filter by supplier"
              className="h-[34px] min-w-[140px] max-w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mx-1 mt-5 w-px self-stretch bg-gray-100" />

        <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Search
          </span>
          <div className="relative">
            <PiMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
              placeholder="Product, SKU, reference… Separate alternatives with commas"
              aria-label="Search movements"
              className="h-[34px] w-full rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {hasAnyFilter && (
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex h-[34px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-100"
            >
              <PiX className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>
        )}

        {!groupBy && totalPages > 1 && (
          <div className="ml-auto flex items-end gap-1">
            <div className="flex h-[34px] items-center gap-1">
              <span className="px-1 text-[11px] text-gray-400">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretLeft className="h-3.5 w-3.5 text-gray-500" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >
                <PiCaretRight className="h-3.5 w-3.5 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
