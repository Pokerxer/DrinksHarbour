'use client';

// app/shared/warehouses/warehouse-analysis/kpi-cards.tsx
// Headline strip: gradient hero (total stock value) + four stat cards.

import {
  PiClock,
  PiCube,
  PiCurrencyNgn,
  PiPackage,
  PiWarning,
} from 'react-icons/pi';
import {
  fmtCompact,
  fmtCount,
  fmtNaira,
  type AnalysisKpis,
} from '../warehouse-analysis-helpers';
import { fraunces } from '../../purchases/purchases-fonts';

export default function KpiCards({ kpis }: { kpis: AnalysisKpis }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
      {/* Hero: Total Stock Value */}
      <div
        title={fmtNaira(kpis.value)}
        className="relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-[#8a0202] via-[#b20202] to-[#6b0101] p-5 text-white shadow-md lg:col-span-2"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-14 -right-6 h-28 w-28 rounded-full border border-white/10" />
        <div className="relative flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">
            Total Stock Value
          </p>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <PiCurrencyNgn className="h-4 w-4" />
          </span>
        </div>
        <p
          className={`${fraunces.className} relative mt-3 text-[34px] font-semibold tabular-nums leading-none`}
        >
          {fmtCompact(kpis.value)}
        </p>
        <p className="relative mt-1.5 text-[11px] text-white/55">
          {fmtNaira(kpis.value)}
        </p>
      </div>

      {[
        {
          label: 'Units On Hand',
          value: fmtCount(kpis.onHand),
          full: `${kpis.onHand.toLocaleString()} units`,
          icon: <PiCube className="h-4 w-4" />,
          color: 'text-blue-600 bg-blue-50',
        },
        {
          label: 'SKUs In Stock',
          value: kpis.skuCount.toLocaleString(),
          full: `${kpis.skuCount.toLocaleString()} SKUs with stock`,
          icon: <PiPackage className="h-4 w-4" />,
          color: 'text-emerald-600 bg-emerald-50',
        },
        {
          label: 'Low / Out',
          value: `${kpis.lowOutPct.toFixed(0)}%`,
          full: `${kpis.lowLines} low · ${kpis.outLines} out`,
          icon: <PiWarning className="h-4 w-4" />,
          color:
            kpis.lowLines + kpis.outLines > 0
              ? 'text-amber-600 bg-amber-50'
              : 'text-gray-500 bg-gray-100',
        },
        {
          label: 'At Expiry Risk',
          value: fmtCompact(kpis.riskValue),
          full: fmtNaira(kpis.riskValue),
          icon: <PiClock className="h-4 w-4" />,
          color:
            kpis.riskValue > 0
              ? 'text-rose-600 bg-rose-50'
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
  );
}
