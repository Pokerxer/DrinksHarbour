'use client';

// app/shared/warehouses/warehouse-analysis/analysis-header.tsx
// Title card with the brand rule and the Refresh action.

import { PiArrowsClockwise } from 'react-icons/pi';
import { fraunces } from '../../purchases/purchases-fonts';

export default function AnalysisHeader({
  loading,
  onRefresh,
}: {
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202]" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
            Reporting
          </p>
          <h1
            className={`${fraunces.className} mt-1 text-[28px] font-semibold leading-tight text-[#2a2420] sm:text-[32px]`}
          >
            Warehouse Analysis
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Stock value, on-hand levels, and expiry risk across warehouses
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
          className="group flex items-center gap-1.5 rounded-lg border border-[#ece4d6] bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202] disabled:opacity-50"
        >
          <PiArrowsClockwise
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : 'transition-transform duration-500 group-active:-rotate-180'}`}
          />
          Refresh
        </button>
      </div>
    </div>
  );
}
