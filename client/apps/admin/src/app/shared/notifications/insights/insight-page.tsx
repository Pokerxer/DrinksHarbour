'use client';
import NotificationTimeframe from '../notification-timeframe';
import { useState } from 'react';
import NotificationProductControls from '../notification-product-controls';
import NotificationSummaryCards from '../notification-summary-cards';
import {
  selectInsightLines,
  matchesStatus,
  type InsightStatus,
  type InsightSort,
} from './list-rules';
import { useInsightPlan } from './use-insight-plan';
import InsightControls, { usePlanningFilters } from './insight-controls';
import InsightShell from './insight-shell';
import InsightProductCard from './insight-product-card';
const content = {
  stock: {
    title: 'Low-stock alerts',
    description:
      'Products that need attention, ranked by shortage risk and sales speed when demand evidence is available.',
  },
  warehouses: {
    title: 'Warehouse alerts',
    description:
      'Track each location separately. Stock arriving elsewhere cannot hide a shortage here.',
  },
  forecasts: {
    title: 'Demand forecasts',
    description:
      'Forecast future product needs from recorded sales. Trained AI is validated against a historical baseline.',
  },
};
export default function InsightPage({ mode }: { mode: keyof typeof content }) {
  const filters = usePlanningFilters(),
    inbox = useInsightPlan(
      mode === 'forecasts' ? 'demand' : 'warehouse-risk',
      filters.query
    );
  return (
    <InsightResults
      key={`${inbox.scope}:${filters.query}`}
      mode={mode}
      filters={filters}
      inbox={inbox}
    />
  );
}
function InsightResults({
  mode,
  filters,
  inbox,
}: {
  mode: keyof typeof content;
  filters: ReturnType<typeof usePlanningFilters>;
  inbox: ReturnType<typeof useInsightPlan>;
}) {
  const [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState<InsightStatus>('all'),
    [sort, setSort] = useState<InsightSort>(
      mode === 'forecasts' ? 'forecast' : 'priority'
    );
  const reportSummary = mode === 'forecasts' && !filters.warehouseId;
  const source = (
    reportSummary
      ? inbox.data?.summaries || inbox.data?.lines || []
      : inbox.data?.lines || []
  ).filter(
    (l) =>
      mode !== 'stock' ||
      (typeof l.available === 'number' && l.available <= (l.threshold ?? 0)) ||
      ['urgent', 'high'].includes(l.urgency || '')
  );
  const lines = selectInsightLines(source, query, status, sort);
  const statuses: Array<[InsightStatus, string]> =
    mode === 'stock'
      ? [
          ['all', 'Low-stock entries'],
          ['out', 'Out of stock'],
          ['minimum', 'Below minimum'],
          ['urgent', 'Stock at risk'],
          ...(inbox.data?.canSeeDemand
            ? [['history', 'Needs history'] as [InsightStatus, string]]
            : []),
        ]
      : [
          ['all', 'All products'],
          ['urgent', 'Needs attention'],
          ['history', 'Needs history'],
          ['trained', 'AI forecasts'],
          ['baseline', 'Baseline forecasts'],
        ];
  const updateStatus = (value: string) => {
    setStatus(value as InsightStatus);
    setPage(1);
  };
  const pages = Math.max(1, Math.ceil(lines.length / 50)),
    activePage = Math.min(page, pages),
    rows = lines.slice((activePage - 1) * 50, activePage * 50);
  return (
    <InsightShell
      {...content[mode]}
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
        <NotificationSummaryCards
          active={status}
          onSelect={updateStatus}
          cards={statuses.map(([valueId, label]) => ({
            valueId,
            label,
            value: source.filter((l) => matchesStatus(l, valueId)).length,
            detail:
              valueId === 'all'
                ? 'Product sizes in this location scope'
                : valueId === 'history'
                  ? 'Reliable history still needed'
                  : 'Click to review these products',
          }))}
        />
      )}
      <NotificationProductControls
        query={query}
        setQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        status={status}
        setStatus={updateStatus}
        statuses={statuses}
        sort={sort}
        setSort={(value) => {
          setSort(value as InsightSort);
          setPage(1);
        }}
        sorts={
          [
            ['priority', 'Most urgent first'],
            [
              'sales',
              filters.startDate
                ? 'Most sold · selected period'
                : 'Most sold · 30 days',
            ],
            ['least', 'Least sold · 30 days'],
            ['forecast', 'Highest forecast demand'],
            ['stock', 'Lowest available stock'],
            ['name', 'Product name'],
          ].filter(
            ([value]) =>
              (inbox.data?.canSeeDemand ||
                !['sales', 'least', 'forecast'].includes(value)) &&
              (inbox.data?.canSeeStock || value !== 'stock')
          ) as Array<[string, string]>
        }
        count={lines.length}
        reset={() => {
          setQuery('');
          setStatus('all');
          setSort(mode === 'forecasts' ? 'forecast' : 'priority');
          setPage(1);
        }}
      >
        <InsightControls
          plan={inbox.data}
          filters={filters}
          refresh={inbox.refresh}
          loading={inbox.loading}
          embedded
        />
      </NotificationProductControls>
      {!inbox.loading && !inbox.error && !rows.length && (
        <p className="rounded-xl border bg-white p-8 text-center text-gray-500">
          No matching products. Add stock and record sales to build this view.
        </p>
      )}
      <div className="space-y-3">
        {rows.map((line) => (
          <InsightProductCard
            key={line.key}
            line={line}
            mode={mode}
            stock={!!inbox.data?.canSeeStock}
            demand={!!inbox.data?.canSeeDemand}
            purchase={!!inbox.data?.canPurchase}
          />
        ))}
      </div>
      {pages > 1 && (
        <div className="flex justify-end gap-4 text-sm">
          <button
            disabled={activePage === 1}
            onClick={() => setPage(activePage - 1)}
          >
            Previous
          </button>
          <span>
            {activePage} / {pages}
          </span>
          <button
            disabled={activePage === pages}
            onClick={() => setPage(activePage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </InsightShell>
  );
}
