'use client';

import {
  PiArrowsClockwise,
  PiCurrencyNgn,
  PiShoppingCart,
  PiReceipt,
  PiPackage,
  PiTrendUp,
} from 'react-icons/pi';
import type { PurchaseAnalyticsSummary } from '@/services/purchaseAnalytics.service';
import { fmtNaira, fmtCompact } from './purchases-analytics-helpers';
import { fraunces } from './purchases-fonts';

export interface AnalyticsKpis {
  totalSpend: number;
  orderCount: number;
  avgOrder: number;
  receiptPct: number;
}

/**
 * Page banner + headline KPI cards for the purchase analysis screen.
 * Extracted from purchases-analytics.tsx so the orchestrator stays focused on
 * data flow; this file is presentational only.
 */
export function AnalyticsHeader({
  kpis,
  summary,
  onRefresh,
}: {
  kpis: AnalyticsKpis;
  summary: PurchaseAnalyticsSummary | null;
  onRefresh: () => void;
}) {
  return (
    <>
      {/* ── Header ── */}
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
              Purchase Analysis
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Spend, volumes, and vendor performance across purchase orders
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh"
            className="group flex items-center gap-1.5 rounded-lg border border-[#ece4d6] bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202]"
          >
            <PiArrowsClockwise className="h-3.5 w-3.5 transition-transform duration-500 group-active:-rotate-180" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {/* Hero: Total Spend */}
        <div
          title={fmtNaira(kpis.totalSpend)}
          className="relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-[#8a0202] via-[#b20202] to-[#6b0101] p-5 text-white shadow-md lg:col-span-2"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-14 -right-6 h-28 w-28 rounded-full border border-white/10" />
          <div className="relative flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">
              Total Spend
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <PiCurrencyNgn className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`${fraunces.className} relative mt-3 text-[34px] font-semibold tabular-nums leading-none`}
          >
            {fmtCompact(kpis.totalSpend)}
          </p>
          <p className="relative mt-1.5 text-[11px] text-white/55">
            {fmtNaira(kpis.totalSpend)}
          </p>
        </div>

        {[
          {
            label: 'Purchase Orders',
            value: String(kpis.orderCount),
            icon: <PiShoppingCart className="h-4 w-4" />,
            color: 'text-blue-600 bg-blue-50',
          },
          {
            label: 'Avg Order Value',
            value: fmtCompact(kpis.avgOrder),
            full: fmtNaira(kpis.avgOrder),
            icon: <PiTrendUp className="h-4 w-4" />,
            color: 'text-emerald-600 bg-emerald-50',
          },
          {
            label: 'Receipt Rate',
            value: `${kpis.receiptPct.toFixed(0)}%`,
            icon: <PiPackage className="h-4 w-4" />,
            color: 'text-violet-600 bg-violet-50',
          },
          {
            label: 'Pending Approvals',
            value: String(summary?.pendingApprovals ?? 0),
            icon: <PiReceipt className="h-4 w-4" />,
            color:
              (summary?.pendingApprovals ?? 0) > 0
                ? 'text-amber-600 bg-amber-50'
                : 'text-gray-500 bg-gray-100',
          },
        ].map(({ label, value, full, icon, color }) => (
          <div
            key={label}
            title={full}
            className="rounded-2xl border border-[#ece4d6] bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}
              >
                {icon}
              </span>
            </div>
            <p
              className={`${fraunces.className} mt-2 text-2xl font-semibold tabular-nums text-[#2a2420]`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
