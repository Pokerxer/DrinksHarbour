'use client';

// app/shared/warehouses/warehouse-detail/badges.tsx
// Status / expiry / reorder chips shared by the grid and table views.

import {
  PiCheckCircleBold,
  PiWarningBold,
  PiXCircleBold,
  PiArrowUUpLeftBold,
} from 'react-icons/pi';
import type { StockStatus } from './row-utils';
import { STATUS_LABEL } from './row-utils';

export function StatusBadge({ status }: { status: StockStatus }) {
  const map = {
    in_stock: {
      cls: 'bg-green-50 text-green-700',
      icon: <PiCheckCircleBold className="h-3.5 w-3.5" />,
    },
    low_stock: {
      cls: 'bg-amber-50 text-amber-700',
      icon: <PiWarningBold className="h-3.5 w-3.5" />,
    },
    out_of_stock: {
      cls: 'bg-red-50 text-red-600',
      icon: <PiXCircleBold className="h-3.5 w-3.5" />,
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map.cls}`}
    >
      {map.icon}
      {STATUS_LABEL[status]}
    </span>
  );
}

const MS_PER_DAY = 86_400_000;

export function ExpiryBadge({ expiryDate }: { expiryDate?: string | null }) {
  if (!expiryDate) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        No expiry
      </span>
    );
  }
  const days = Math.floor(
    (new Date(expiryDate).getTime() - Date.now()) / MS_PER_DAY
  );
  const dateStr = new Date(expiryDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const cls =
    days < 30
      ? 'bg-red-50 text-red-600'
      : days < 60
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-600';
  const note = days < 0 ? 'expired' : days < 60 ? `${days}d left` : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {dateStr}
      {note && <span className="opacity-70">· {note}</span>}
    </span>
  );
}

/** Amber chip shown when the server flags the line at/below its reorder point. */
export function ReorderBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      title="At or below the reorder point"
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"
    >
      <PiArrowUUpLeftBold className="h-3 w-3" />
      Reorder
    </span>
  );
}
