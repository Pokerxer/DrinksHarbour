'use client';
import NotificationTimeframe from '../notification-timeframe';
import { useState } from 'react';
import NotificationProductControls from '../notification-product-controls';
import type { InsightPlan } from '@/services/notificationInsights.service';
import { useInsightPlan } from '../insights/use-insight-plan';
import InsightShell from '../insights/insight-shell';
import { usePlanningFilters } from '../insights/insight-controls';
import WarehouseSummary from './warehouse-summary';
import WarehouseProductGrid from './warehouse-product-grid';
import {
  selectRows,
  type StockFilter,
  type StockSort,
} from './warehouse-rules';
const tabs: Array<{ value: StockFilter; label: string }> = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'out', label: 'Out of stock' },
  { value: 'low', label: 'Below minimum' },
  { value: 'risk', label: 'Stockout risk' },
  { value: 'transfers', label: 'Transfer follow-ups' },
  { value: 'unknown', label: 'Stock unknown' },
  { value: 'all', label: 'All stock' },
];
export default function WarehousePage() {
  const filters = usePlanningFilters(),
    params = new URLSearchParams(filters.query);
  params.delete('warehouseId');
  const inbox = useInsightPlan('warehouse-risk', params.toString());
  return (
    <InsightShell
      title="Warehouse alerts"
      description="Spot shortages at each location, prioritize fast-selling products and review what needs replenishing."
      plan={inbox.data}
      loading={inbox.loading}
      error={inbox.error}
      refresh={inbox.refresh}
      warehouse={
        filters.warehouseId === 'unassigned'
          ? 'Unassigned location'
          : inbox.data?.warehouses.find((w) => w._id === filters.warehouseId)
              ?.name
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <p className="text-xs text-gray-500">
          Stock belongs to each location. Incoming goods elsewhere cannot cover
          its shortage.
        </p>
        <div className="flex gap-3">
          {filters.hasProductFilter && (
            <button
              onClick={filters.clearProduct}
              className="text-xs font-semibold underline"
            >
              Show all products
            </button>
          )}
        </div>
      </div>
      <NotificationTimeframe
        completed
        startDate={filters.startDate}
        endDate={filters.endDate}
        onApply={(start, end) => filters.setRange?.(start, end)}
        disabled={inbox.loading}
      />
      {filters.startDate && (
        <p className="text-xs text-gray-500">
          Sales sorting uses the selected timeframe. Stock, forecasts and
          restock recommendations show current needs.
        </p>
      )}
      {inbox.data && (
        <WarehouseStock
          key={`${inbox.scope}:${filters.query}`}
          plan={inbox.data}
          selected={filters.warehouseId}
          onSelect={(id) => filters.set('warehouseId', id)}
        />
      )}
    </InsightShell>
  );
}
function WarehouseStock({
  plan,
  selected,
  onSelect,
}: {
  plan: InsightPlan;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [status, setStatus] = useState<StockFilter>(
      selected === 'unassigned' ? 'unknown' : 'attention'
    ),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState<StockSort>('priority'),
    [page, setPage] = useState(1);
  const rows = selectRows(plan.lines, {
    warehouseId: selected,
    status,
    search,
    sort,
  });
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    active = Math.min(page, pages);
  const location =
    selected === 'unassigned'
      ? 'Unassigned location'
      : plan.warehouses.find((w) => w._id === selected)?.name ||
        'All warehouses';
  const invalid =
    !!selected &&
    selected !== 'unassigned' &&
    !plan.warehouses.some((w) => w._id === selected);
  return (
    <div className="space-y-5">
      <WarehouseSummary
        plan={plan}
        selected={selected}
        onSelect={onSelect}
        status={status}
        onStatus={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      {invalid && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          This warehouse is unavailable. Select an active warehouse above.
        </p>
      )}
      <section className="space-y-4" aria-label="Warehouse product alerts">
        <h2 className="font-bold text-gray-900">{location} · product alerts</h2>
        <NotificationProductControls
          label="Search warehouse products"
          query={search}
          setQuery={(value) => {
            setSearch(value);
            setPage(1);
          }}
          status={status}
          setStatus={(value) => {
            setStatus(value as StockFilter);
            setPage(1);
          }}
          statuses={tabs.map((t) => [t.value, t.label])}
          sort={sort}
          setSort={(value) => {
            setSort(value as StockSort);
            setPage(1);
          }}
          sorts={
            [
              ['priority', 'Most urgent first'],
              ...(plan.canSeeDemand
                ? [['sales', 'Fastest stock movement']]
                : []),
              ['stock', 'Lowest available stock'],
            ] as Array<[string, string]>
          }
          count={rows.length}
          reset={() => {
            setSearch('');
            setStatus('attention');
            setSort('priority');
            setPage(1);
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Warehouse
            <select
              aria-label="Warehouse"
              value={selected}
              onChange={(e) => onSelect(e.target.value)}
              className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-normal"
            >
              <option value="">All warehouses</option>
              {plan.warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
              {plan.lines.some((l) => !l.warehouseId) && (
                <option value="unassigned">Unassigned location</option>
              )}
            </select>
          </label>
        </NotificationProductControls>
        {!rows.length && !invalid && (
          <div className="rounded-xl border bg-white p-8 text-center">
            <p className="font-semibold text-gray-800">
              {!plan.lines.length
                ? 'No stock records in this scope'
                : status === 'attention' && !search
                  ? 'No stock entries currently need attention'
                  : 'No matching stock entries'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {status === 'attention'
                ? 'Check All stock or Stock unknown to review other entries.'
                : 'Change the warehouse, status or search to see more entries.'}
            </p>
            <button
              onClick={() => {
                setStatus('all');
                setSearch('');
                setPage(1);
              }}
              className="mt-4 text-sm font-bold text-[#b20202]"
            >
              Show all stock in this location
            </button>
          </div>
        )}
        <WarehouseProductGrid
          key={`${status}:${search}:${sort}:${active}`}
          lines={rows.slice((active - 1) * 25, active * 25)}
          demand={!!plan.canSeeDemand}
          purchase={!!plan.canReviewRestock || !!plan.canPurchase}
          manageTransfers={!!plan.canManageTransfers}
          coverDays={plan.coverDays}
        />
        {pages > 1 && (
          <nav
            aria-label="Warehouse product pages"
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-xs text-gray-500">
              Showing {(active - 1) * 25 + 1}–
              {Math.min(active * 25, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPage(active - 1)}
                disabled={active === 1}
                className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                {active} / {pages}
              </span>
              <button
                onClick={() => setPage(active + 1)}
                disabled={active === pages}
                className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
