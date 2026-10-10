import { PiMagnifyingGlass, PiX, PiSlidersHorizontal } from 'react-icons/pi';
import type { InsightPlan } from '@/services/notificationInsights.service';
import type { Segment, Sort } from './performance-rules';
export default function PerformanceToolbar({
  customPeriod = false,
  search,
  setSearch,
  segment,
  setSegment,
  sort,
  setSort,
  count,
  warehouseId,
  warehouses,
  setWarehouse,
  reset,
  clearProduct,
}: {
  customPeriod?: boolean;
  search: string;
  setSearch: (value: string) => void;
  segment: Segment;
  setSegment: (value: Segment) => void;
  sort: Sort;
  setSort: (value: Sort) => void;
  count: number;
  warehouseId: string;
  warehouses: InsightPlan['warehouses'];
  setWarehouse: (value: string) => void;
  reset: () => void;
  clearProduct?: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1 text-xs font-semibold text-gray-600">
          Find a product
          <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 focus-within:border-[#b20202] focus-within:ring-1 focus-within:ring-[#b20202]/20">
            <PiMagnifyingGlass
              aria-hidden
              className="h-4 w-4 shrink-0 text-gray-400"
            />
            <input
              aria-label="Search performance products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, size or SKU…"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-normal outline-none focus:ring-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear product search"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                <PiX aria-hidden className="h-4 w-4" />
              </button>
            )}
          </span>
        </label>
        <label className="text-xs font-semibold text-gray-600">
          Warehouse
          <select
            aria-label="Warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouse(e.target.value)}
            className="mt-1 block h-11 max-w-full rounded-lg border border-gray-200 px-3 text-sm font-normal sm:max-w-64"
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">
          Show
          <select
            aria-label="Performance filter"
            value={segment}
            onChange={(e) => setSegment(e.target.value as Segment)}
            className="mt-1 block h-11 rounded-lg border border-gray-200 px-3 text-sm font-normal"
          >
            <option value="all">All products</option>
            <option value="rising">Picking up</option>
            <option value="falling">Slowing down</option>
            <option value="no_sales">No recorded sales</option>
            <option value="incomplete">Needs history</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">
          Sort by
          <select
            aria-label="Performance sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="mt-1 block h-11 rounded-lg border border-gray-200 px-3 text-sm font-normal"
          >
            <option value="fastest">
              {customPeriod
                ? 'Most sold · selected period'
                : 'Most sold · 30 days'}
            </option>
            <option value="slowest">
              {customPeriod
                ? 'Least sold · selected period'
                : 'Least sold · 30 days'}
            </option>
            <option value="growth">
              {customPeriod
                ? 'Largest period increase'
                : 'Largest weekly increase'}
            </option>
            <option value="decline">
              {customPeriod
                ? 'Largest period decrease'
                : 'Largest weekly decrease'}
            </option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <p
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-gray-500"
        >
          <PiSlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
          {count} matching product sizes
        </p>
        <div className="flex items-center gap-3">
          {clearProduct && (
            <button
              type="button"
              onClick={clearProduct}
              className="text-xs font-semibold text-[#b20202]"
            >
              Show all products
            </button>
          )}
          {(search || segment !== 'all' || sort !== 'fastest') && (
            <button
              type="button"
              onClick={reset}
              aria-label="Reset performance filters"
              className="text-xs font-semibold text-[#b20202] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
