'use client';
import NotificationTimeframe from '../notification-timeframe';
import { useState } from 'react';
import type {
  InsightPlan,
  InsightLine,
} from '@/services/notificationInsights.service';
import { useInsightPlan } from '../insights/use-insight-plan';
import { usePlanningFilters } from '../insights/insight-controls';
import PerformanceHeader from './performance-header';
import InsightShell from '../insights/insight-shell';
import PerformanceSummary from './performance-summary';
import PerformanceToolbar from './performance-toolbar';
import PerformanceProductGrid from './performance-product-grid';
import { selectProducts, type Segment, type Sort } from './performance-rules';
function PerformanceResults({
  lines,
  plan,
  filters,
}: {
  lines: InsightLine[];
  plan: InsightPlan;
  filters: ReturnType<typeof usePlanningFilters>;
}) {
  const [search, setSearch] = useState(''),
    [segment, setSegment] = useState<Segment>('all'),
    [sort, setSort] = useState<Sort>('fastest'),
    [page, setPage] = useState(1);
  const selected = selectProducts(lines, search, segment, sort),
    pages = Math.max(1, Math.ceil(selected.length / 24)),
    activePage = Math.min(page, pages);
  const through = plan.historyEnd
    ? new Date(Date.parse(plan.historyEnd) - 86400000).toLocaleDateString(
        'en-NG',
        {
          timeZone: 'Africa/Lagos',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }
      )
    : null;
  return (
    <>
      <PerformanceSummary
        customPeriod={!!plan.period}
        lines={lines}
        segment={segment}
        onSelect={(value) => {
          setSegment(value);
          setPage(1);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>
          {plan.period
            ? `${plan.period.startDate} – ${plan.period.endDate}`
            : `Last 30 completed days${through ? ` · Through ${through}` : ''}`}{' '}
          · Customer sales only
        </p>
        <p>
          {plan.period
            ? 'Trends compare the selected period with the preceding equal-duration period.'
            : 'Weekly trends compare the last 7 days with the previous 7.'}
        </p>
      </div>
      <PerformanceToolbar
        customPeriod={!!plan.period}
        search={search}
        setSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        segment={segment}
        setSegment={(value) => {
          setSegment(value);
          setPage(1);
        }}
        sort={sort}
        setSort={(value) => {
          setSort(value);
          setPage(1);
        }}
        count={selected.length}
        warehouseId={filters.warehouseId}
        warehouses={plan.warehouses}
        setWarehouse={(value) => filters.set('warehouseId', value)}
        reset={() => {
          setSearch('');
          setSegment('all');
          setSort('fastest');
          setPage(1);
        }}
        clearProduct={
          filters.hasProductFilter ? filters.clearProduct : undefined
        }
      />
      {!selected.length ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <h2 className="font-semibold text-gray-900">
            {lines.length
              ? 'No products match these filters'
              : 'No product sales entries yet'}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {lines.length
              ? 'Change the search or performance filter to see more products.'
              : 'Add products and record completed customer sales to build this view.'}
          </p>
        </div>
      ) : (
        <PerformanceProductGrid
          key={`${search}:${segment}:${sort}:${activePage}`}
          lines={selected.slice((activePage - 1) * 24, activePage * 24)}
          stock={!!plan.canSeeStock}
          purchase={!!(plan.canReviewRestock ?? plan.canPurchase)}
        />
      )}
      {pages > 1 && (
        <nav
          aria-label="Performance pages"
          className="flex items-center justify-end gap-3 text-sm"
        >
          <button
            disabled={activePage === 1}
            onClick={() => setPage(activePage - 1)}
            className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            {activePage} / {pages}
          </span>
          <button
            disabled={activePage === pages}
            onClick={() => setPage(activePage + 1)}
            className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
export default function PerformancePage() {
  const filters = usePlanningFilters(),
    inbox = useInsightPlan('demand', filters.query);
  const lines = filters.warehouseId
    ? (inbox.data?.lines || []).filter(
        (line) => line.warehouseId === filters.warehouseId
      )
    : (inbox.data?.summaries ?? inbox.data?.lines ?? []);
  return (
    <InsightShell
      title="Sales performance"
      description="See what is selling, what is picking up and which products need a closer look."
      plan={inbox.data}
      loading={inbox.loading}
      error={inbox.error}
      header={
        <PerformanceHeader
          period={
            filters.startDate
              ? `Customer net sales · ${filters.startDate} – ${filters.endDate}`
              : undefined
          }
          warehouse={
            filters.warehouseId
              ? inbox.data?.warehouses.find(
                  (warehouse) => warehouse._id === filters.warehouseId
                )?.name || 'Selected warehouse'
              : 'All warehouses'
          }
          updatedAt={inbox.data?.generatedAt}
          loading={inbox.loading}
          refresh={inbox.refresh}
        />
      }
    >
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
      {inbox.data?.canSeeDemand ? (
        <PerformanceResults
          key={inbox.scope}
          lines={lines}
          plan={inbox.data}
          filters={filters}
        />
      ) : (
        inbox.data &&
        !inbox.loading &&
        !inbox.error && (
          <p className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            Report access is required to view product sales performance.
          </p>
        )
      )}
    </InsightShell>
  );
}
