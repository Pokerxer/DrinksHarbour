'use client';

// app/shared/warehouses/warehouse-detail/batch-panel.tsx
// The expandable batch (lot) list for one stock line, rendered inside both the
// grid card and the table's expanded row.

import type { WarehouseBatch } from '@/services/warehouse.service';
import { ExpiryBadge } from './badges';

export default function BatchPanel({
  loading,
  batches,
}: {
  loading: boolean;
  batches: WarehouseBatch[] | undefined;
}) {
  if (loading) {
    return (
      <div className="space-y-2 px-5 py-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }
  if (!batches || batches.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-gray-400">
        No batches tracked for this line.
      </p>
    );
  }
  return (
    <div className="space-y-1.5 px-5 py-4">
      {batches.map((b) => (
        <div
          key={b._id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-100"
        >
          <span className="font-mono font-semibold text-gray-700">
            {b.batchNumber}
          </span>
          <span className="tabular-nums text-gray-500">{b.quantity} units</span>
          <span className="ml-auto">
            <ExpiryBadge expiryDate={b.expiryDate} />
          </span>
        </div>
      ))}
    </div>
  );
}
