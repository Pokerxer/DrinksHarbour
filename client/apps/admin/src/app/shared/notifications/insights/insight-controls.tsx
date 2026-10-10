'use client';
import { validTimeframe } from '../notification-timeframe';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { InsightPlan } from '@/services/notificationInsights.service';
export function usePlanningFilters() {
  const params = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  const query = new URLSearchParams();
  for (const k of ['warehouseId', 'subProductId', 'sizeId']) {
    const v = params.get(k);
    if (
      v &&
      (/^[a-f\d]{24}$/i.test(v) ||
        (path === '/notifications/warehouses' &&
          k === 'warehouseId' &&
          v === 'unassigned'))
    )
      query.set(k, v);
  }
  const startDate = params.get('startDate') || '',
    endDate = params.get('endDate') || '';
  if (validTimeframe(startDate, endDate, true)) {
    query.set('startDate', startDate);
    query.set('endDate', endDate);
  }
  const cover = params.get('coverDays');
  query.set(
    'coverDays',
    cover && ['7', '14', '30'].includes(cover) ? cover : '14'
  );
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(query);
    value ? next.set(key, value) : next.delete(key);
    router.replace(`${path}?${next}`);
  };
  return {
    query: query.toString(),
    startDate: query.get('startDate') || '',
    endDate: query.get('endDate') || '',
    setRange: (start: string, end: string) => {
      const next = new URLSearchParams(query);
      next.delete('startDate');
      next.delete('endDate');
      if (validTimeframe(start, end, true)) {
        next.set('startDate', start);
        next.set('endDate', end);
      }
      router.replace(`${path}?${next}`);
    },
    warehouseId: query.get('warehouseId') || '',
    coverDays: query.get('coverDays') || '14',
    set,
    hasProductFilter: query.has('subProductId') || query.has('sizeId'),
    clearProduct: () => {
      const next = new URLSearchParams(query);
      next.delete('subProductId');
      next.delete('sizeId');
      router.replace(`${path}?${next}`);
    },
  };
}
export default function InsightControls({
  plan,
  filters,
  refresh,
  loading,
  cover = false,
  embedded = false,
}: {
  plan: InsightPlan | null;
  filters: ReturnType<typeof usePlanningFilters>;
  refresh: () => void;
  loading: boolean;
  cover?: boolean;
  embedded?: boolean;
}) {
  return (
    <div
      className={
        embedded
          ? 'flex flex-wrap items-end gap-3'
          : 'flex flex-wrap items-end gap-4 rounded-xl border bg-white p-4'
      }
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
        Warehouse
        <select
          aria-label="Warehouse"
          className="h-11 rounded-xl border border-gray-200 px-3 py-2 text-sm"
          value={filters.warehouseId}
          onChange={(e) => filters.set('warehouseId', e.target.value)}
        >
          <option value="">All warehouses</option>
          {plan?.warehouses.map((w) => (
            <option key={w._id} value={w._id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      {cover && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Stock cover after delivery
          <select
            className="h-11 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={filters.coverDays}
            onChange={(e) => filters.set('coverDays', e.target.value)}
          >
            {[7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      )}
      {filters.hasProductFilter && (
        <button
          onClick={filters.clearProduct}
          className="text-sm font-semibold underline"
        >
          Show all products
        </button>
      )}
      {!embedded && (
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? 'Refreshing…' : 'Refresh insights'}
        </button>
      )}
    </div>
  );
}
