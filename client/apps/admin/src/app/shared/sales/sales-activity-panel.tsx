// client/apps/admin/src/app/shared/sales/sales-activity-panel.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { PiClockCounterClockwise, PiSpinner } from 'react-icons/pi';
import { salesOrderService } from '@/services/salesOrder.service';
import { type SalesActivity, groupByDay } from './sales-activity-helpers';
import SalesActivityItem from './sales-activity-item';
import SalesActivityComposer from './sales-activity-composer';

export default function SalesActivityPanel({
  token,
  orderId,
  refreshKey,
}: {
  token: string;
  orderId?: string;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<SalesActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !token) return;
    setLoading(true);
    setError(false);
    try {
      const res = await salesOrderService.getActivities(orderId, token);
      setItems((res.data as SalesActivity[]) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps — also re-run when refreshKey bumps
  }, [orderId, refreshKey, token]);

  const groups = groupByDay(items);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
      <div className="mb-3 flex items-center gap-2">
        <PiClockCounterClockwise className="h-4 w-4 text-brand" />
        <h3 className="text-xs font-semibold text-gray-800">History</h3>
      </div>

      {!orderId ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
          History appears after the first save.
        </p>
      ) : (
        <>
          <SalesActivityComposer
            token={token}
            orderId={orderId}
            onPosted={load}
          />

          <div className="mt-3">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
                <PiSpinner className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-xs text-gray-500">
                  Couldn&apos;t load history
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">
                No activity yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {groups.map((group) => (
                  <div key={group.label} className="py-1">
                    <p className="py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {group.label}
                    </p>
                    <div className="divide-y divide-gray-50">
                      {group.items.map((activity) => (
                        <SalesActivityItem
                          key={activity._id}
                          activity={activity}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
