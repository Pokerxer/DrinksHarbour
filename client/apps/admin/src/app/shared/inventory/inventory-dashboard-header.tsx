'use client';

import { PiArrowClockwise, PiWarningOctagonDuotone } from 'react-icons/pi';

function relativeTime(iso: string): string {
  const secs = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return new Date(iso).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface InventoryHeaderProps {
  loading: boolean;
  refreshing: boolean;
  lastUpdated: string | null;
  onRefresh: () => void;
}

export default function InventoryHeader({
  loading,
  refreshing,
  lastUpdated,
  onRefresh,
}: InventoryHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Inventory Overview</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Stock health, valuation and the last 14 days of operations across your
          warehouses.
          {lastUpdated && !loading && (
            <span className="ms-1 text-gray-400">
              Updated {relativeTime(lastUpdated)}.
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading || refreshing}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PiArrowClockwise
          className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`}
        />
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <PiWarningOctagonDuotone className="h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-[#b20202] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202]"
      >
        Retry
      </button>
    </div>
  );
}
