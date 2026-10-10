'use client';
import { useState } from 'react';
import type { InsightPlan } from '@/services/notificationInsights.service';
import NotificationProductControls from '../notification-product-controls';
import NotificationSummaryCards from '../notification-summary-cards';
import InsightControls, {
  usePlanningFilters,
} from '../insights/insight-controls';
import RestockProductGrid from './restock-product-grid';
import VendorOrderGroups from '../vendor-orders/vendor-order-groups';
import {
  selectedGroups,
  validQuantity,
  type Selections,
} from '../vendor-orders/order-draft';
import {
  restockRows,
  selectRestockLines,
  matchesRestockStatus,
  type RestockStatus,
  type RestockSort,
} from './restock-rules';
export default function RestockResults({
  plan,
  vendorOrders,
  loading,
  filters,
  refresh,
}: {
  plan: InsightPlan;
  vendorOrders: boolean;
  loading: boolean;
  filters: ReturnType<typeof usePlanningFilters>;
  refresh: () => void;
}) {
  const [selections, setSelections] = useState<Selections>({}),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState<RestockStatus>('all'),
    [sort, setSort] = useState<RestockSort>('priority');
  const source = filters.warehouseId
    ? plan.lines.filter((l) => l.warehouseId === filters.warehouseId)
    : plan.lines;
  const rows = restockRows(source, selections);
  const groups = selectedGroups(source, selections);
  const invalid = source.some((l) => {
    const s = selections[l.key],
      o = s ? l.alternatives?.find((a) => a.offerId === s.offerId) : l.selected;
    return !!o && !validQuantity(s?.quantity ?? o.quantity, o);
  });
  const lines = selectRestockLines(rows, query, status, sort);
  const statuses: Array<[RestockStatus, string]> = [
    ['all', 'All products'],
    ['urgent', 'Needs attention'],
    ['ready', 'Order quantities ready'],
    ['manual', 'Review quantity'],
    ['transfer', 'Review transfers'],
    ['covered', 'Covered by supply'],
    ['excluded', 'Excluded from order'],
    ['supplier', 'Supplier matched'],
    ['missingSupplier', 'Needs supplier'],
    ['history', 'Needs history'],
  ];
  const updateStatus = (value: string) => {
    setStatus(value as RestockStatus);
    setPage(1);
  };
  const pages = Math.max(1, Math.ceil(lines.length / 50)),
    active = Math.min(page, pages);
  return (
    <div className="space-y-5">
      <NotificationSummaryCards
        active={status}
        onSelect={updateStatus}
        cards={statuses
          .filter(([key]) =>
            [
              'all',
              'urgent',
              'ready',
              'manual',
              'transfer',
              'missingSupplier',
            ].includes(key)
          )
          .map(([valueId, label]) => ({
            valueId,
            label,
            value: rows.filter((l) => matchesRestockStatus(l, valueId)).length,
            detail:
              valueId === 'all'
                ? `${groups.length} supplier / destination orders`
                : 'Click to review matching products',
          }))}
      />
      <NotificationProductControls
        label="Search restock products"
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
          setSort(value as RestockSort);
          setPage(1);
        }}
        sorts={[
          ['priority', 'Most urgent first'],
          [
            'sales',
            filters.startDate
              ? 'Most sold · selected period'
              : 'Most sold · 30 days',
          ],
          [
            'movement',
            filters.startDate
              ? 'Fastest movement · selected period'
              : 'Fastest sales + transfers · 30 days',
          ],
          ['quantity', 'Largest selected order'],
          ['stock', 'Lowest available stock'],
          ['name', 'Product name'],
        ]}
        count={lines.length}
        reset={() => {
          setQuery('');
          setStatus('all');
          setSort('priority');
          setPage(1);
        }}
      >
        <InsightControls
          plan={plan}
          filters={filters}
          refresh={refresh}
          loading={loading}
          cover
          embedded
        />
      </NotificationProductControls>
      <p className="text-xs text-gray-500">
        Order quantities include all selected products, including those hidden
        by filters. Currency totals remain separate.
      </p>
      {invalid && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          A selected quantity does not meet supplier pack or tier terms. Review
          quantities, including products hidden by filters, before preparing
          purchases.
        </p>
      )}
      {vendorOrders && (
        <VendorOrderGroups
          groups={groups}
          coverDays={plan.coverDays}
          disabled={invalid || loading}
        />
      )}
      {!groups.length && (
        <p className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No supported positive order quantities yet. Review missing history,
          supplier prices or destination details below.
        </p>
      )}
      <RestockProductGrid
        key={JSON.stringify([query, status, sort, page])}
        lines={lines.slice((active - 1) * 50, active * 50)}
        allLines={source}
        selections={selections}
        stock={!!plan.canSeeStock}
        demand={!!plan.canSeeDemand}
        onChange={(key, choice) =>
          setSelections((s) => ({ ...s, [key]: choice }))
        }
      />
      {!lines.length && (
        <p className="rounded-xl border bg-white p-8 text-center text-gray-500">
          No matching products.
        </p>
      )}
      {pages > 1 && (
        <div className="flex justify-end gap-4 text-sm">
          <button disabled={active === 1} onClick={() => setPage(active - 1)}>
            Previous
          </button>
          <span>
            {active} / {pages}
          </span>
          <button
            disabled={active === pages}
            onClick={() => setPage(active + 1)}
          >
            Next
          </button>
        </div>
      )}
      {!vendorOrders && (
        <VendorOrderGroups
          groups={groups}
          coverDays={plan.coverDays}
          disabled={invalid || loading}
        />
      )}
    </div>
  );
}
