'use client';
import { useState } from 'react';
import type { InsightPlan } from '@/services/notificationInsights.service';
import { useInsightPlan } from '../insights/use-insight-plan';
import InsightControls, {
  usePlanningFilters,
} from '../insights/insight-controls';
import InsightShell from '../insights/insight-shell';
import NotificationTimeframe from '../notification-timeframe';
import NotificationSummaryCards from '../notification-summary-cards';
import NotificationProductControls from '../notification-product-controls';
import ForecastProductGrid from './forecast-product-grid';
import {
  matchesForecast,
  selectForecasts,
  type ForecastFilter,
  type ForecastSort,
} from './forecast-rules';
export default function ForecastPage() {
  const filters = usePlanningFilters(),
    inbox = useInsightPlan('demand', filters.query);
  return (
    <InsightShell
      title="Demand forecasts"
      description="Review future demand, test its reliability and plan replenishment for each warehouse."
      plan={inbox.data}
      loading={inbox.loading}
      error={inbox.error}
      refresh={inbox.refresh}
      warehouse={
        inbox.data?.warehouses.find((w) => w._id === filters.warehouseId)?.name
      }
    >
      <NotificationTimeframe
        completed
        startDate={filters.startDate}
        endDate={filters.endDate}
        onApply={(start, end) => filters.setRange(start, end)}
        disabled={inbox.loading}
      />
      <p className="text-xs text-gray-500">
        Past timeframe controls recorded-sales sorting. Future demand uses
        current history; stock and incoming supplies are current.
      </p>
      {inbox.data?.canSeeDemand ? (
        <ForecastResults
          key={`${inbox.scope}:${filters.query}`}
          plan={inbox.data}
          filters={filters}
          loading={inbox.loading}
          refresh={inbox.refresh}
        />
      ) : (
        inbox.data &&
        !inbox.loading && (
          <p className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            Report access is required to view forecasts.
          </p>
        )
      )}
    </InsightShell>
  );
}
function ForecastResults({
  plan,
  filters,
  loading,
  refresh,
}: {
  plan: InsightPlan;
  filters: ReturnType<typeof usePlanningFilters>;
  loading: boolean;
  refresh: () => void;
}) {
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState<ForecastFilter>('all'),
    [sort, setSort] = useState<ForecastSort>('demand'),
    [days, setDays] = useState(30),
    [page, setPage] = useState(1);
  const source = filters.warehouseId
    ? plan.lines.filter((l) => l.warehouseId === filters.warehouseId)
    : (plan.summaries ?? plan.lines);
  const statuses: Array<[ForecastFilter, string]> = [
    ['all', 'All products'],
    ['history', 'Needs history'],
    ['validated', 'Good recent fit'],
    ['weak', 'Review accuracy'],
    ['trained', 'AI forecasts'],
    ['baseline', 'Historical baselines'],
  ];
  if (filters.warehouseId && plan.canSeeStock)
    statuses.splice(1, 0, ['attention', 'Forecast shortfall']);
  const rows = selectForecasts(
      source,
      query,
      status,
      sort,
      days,
      plan.generatedAt
    ),
    pages = Math.max(1, Math.ceil(rows.length / 24)),
    active = Math.min(page, pages);
  const changeStatus = (value: string) => {
    setStatus(value as ForecastFilter);
    setPage(1);
  };
  const cards = statuses
    .filter(([key]) => !['trained', 'baseline'].includes(key))
    .map(([valueId, label]) => ({
      valueId,
      label,
      value: source.filter((l) =>
        matchesForecast(l, valueId, days, plan.generatedAt)
      ).length,
      detail:
        valueId === 'all'
          ? `${days}-day forecast horizon`
          : valueId === 'history'
            ? 'Complete dated demand records needed'
            : 'Click to review these products',
    }));
  return (
    <div className="space-y-5">
      <NotificationSummaryCards
        cards={cards}
        active={status}
        onSelect={changeStatus}
      />
      <NotificationProductControls
        query={query}
        setQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        status={status}
        setStatus={changeStatus}
        statuses={statuses}
        sort={sort}
        setSort={(value) => {
          setSort(value as ForecastSort);
          setPage(1);
        }}
        sorts={
          [
            ['demand', `Highest demand · ${days} days`],
            ...(filters.warehouseId && plan.canSeeStock
              ? [['shortfall', 'Largest forecast shortfall']]
              : []),
            ['quality', 'Best recent fit'],
            [
              'sales',
              plan.period
                ? 'Most sold · selected period'
                : 'Most sold · 30 days',
            ],
            ['name', 'Product name'],
          ] as Array<[string, string]>
        }
        count={rows.length}
        reset={() => {
          setQuery('');
          setStatus('all');
          setSort('demand');
          setDays(30);
          setPage(1);
        }}
      >
        <InsightControls
          plan={plan}
          filters={filters}
          refresh={refresh}
          loading={loading}
          embedded
        />
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Forecast horizon
          <select
            aria-label="Forecast horizon"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm font-normal"
          >
            {[7, 14, 30, 90].map((day) => (
              <option key={day} value={day}>
                Next {day} days
              </option>
            ))}
          </select>
        </label>
      </NotificationProductControls>
      {!filters.warehouseId && (
        <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          Tenant totals forecast customer sales across locations. Choose a
          warehouse to include its transfer outflow and plan replenishment.
        </p>
      )}
      {!rows.length ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          No forecasts match these filters. Review another warehouse or reset
          the filters.
        </div>
      ) : (
        <ForecastProductGrid
          key={JSON.stringify([query, status, sort, days, active])}
          lines={rows.slice((active - 1) * 24, active * 24)}
          asOf={plan.generatedAt}
          days={days}
          stock={!!plan.canSeeStock}
          purchase={!!plan.canReviewRestock}
        />
      )}
      {pages > 1 && (
        <nav
          aria-label="Forecast pages"
          className="flex items-center justify-end gap-4 text-sm"
        >
          <button
            disabled={active === 1}
            onClick={() => setPage(active - 1)}
            className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            {active} / {pages}
          </span>
          <button
            disabled={active === pages}
            onClick={() => setPage(active + 1)}
            className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
