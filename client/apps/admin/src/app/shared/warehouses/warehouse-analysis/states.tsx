'use client';

// app/shared/warehouses/warehouse-analysis/states.tsx
// Load failure (with retry) and genuinely-empty dataset states — previously a
// failed load just toasted and left an empty report shell on screen.

import { PiArrowsClockwise, PiChartBar, PiWarningCircleBold } from 'react-icons/pi';

export function AnalysisErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#ece4d6] bg-white px-6 py-20 text-center shadow-sm">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <PiWarningCircleBold className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">
        Couldn&apos;t load warehouse stock
      </h3>
      <p className="mt-1 max-w-md text-sm text-gray-400">
        {message || 'Something went wrong while fetching the analysis feed.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#b20202] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f0101]"
      >
        <PiArrowsClockwise className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}

export function AnalysisEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <PiChartBar className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">
        No stock to analyse yet
      </h3>
      <p className="mt-1 max-w-md text-sm text-gray-400">
        Receive purchase orders or adjust stock into your warehouses — analysis
        will populate automatically.
      </p>
    </div>
  );
}
