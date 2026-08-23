// KPI header for /sales/analytics. Four numbers that frame every chart below:
// how much was booked, across how many documents, at what average size, and
// how much is still owed. Presentational — the orchestrator computes.

'use client';

import { useMemo } from 'react';

export interface SalesAnalyticsKpis {
  revenue: number;
  docCount: number;
  orderCount: number;
  avgOrder: number;
  outstanding: number;
}

const naira = (v: number) =>
  `₦${v.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? 'border-[#b20202]/20 bg-[#b20202]/[0.04]'
          : 'border-[#ece4d6] bg-white'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-gray-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function SalesAnalyticsHeader({
  kpis,
}: {
  kpis: SalesAnalyticsKpis;
}) {
  const quoteShare = useMemo(() => {
    const q = kpis.docCount - kpis.orderCount;
    return q > 0 ? `${q} quotation${q === 1 ? '' : 's'} included` : undefined;
  }, [kpis]);

  return (
    <div className="mb-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Sales Analysis</h1>
          <p className="text-xs text-gray-400">
            Quotations and orders in one ledger · click any bar or row to drill
            into its documents
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          accent
          label="Booked revenue"
          value={naira(kpis.revenue)}
          sub={quoteShare ?? 'orders only'}
        />
        <KpiCard
          label="Documents"
          value={kpis.docCount.toLocaleString()}
          sub={`${kpis.orderCount} confirmed order(s)`}
        />
        <KpiCard label="Average value" value={naira(kpis.avgOrder)} />
        <KpiCard
          label="Outstanding"
          value={naira(kpis.outstanding)}
          sub="unpaid + partial balance"
        />
      </div>
    </div>
  );
}
