// The Overview KPI row.
//
// Each card is a portal, not a poster: the number is the headline, the sub
// line is the pipeline behind it, and the whole card navigates into the exact
// filtered list that produced it. Presentational only — the orchestrator owns
// fetching and the money/status definitions live in sales-overview-helpers.

'use client';

import Link from 'next/link';
import { PiCaretRight } from 'react-icons/pi';
import type { ReactNode } from 'react';

export interface SalesOverviewKpi {
  key: string;
  label: string;
  value: string;
  /** Pipeline breakdown under the number; omitted when there is nothing behind it. */
  sub?: string;
  /** Where the number comes from — the card links here. */
  href: string;
  icon: ReactNode;
  accentClass: string;
}

export default function SalesOverviewKpis({
  kpis,
}: {
  kpis: SalesOverviewKpi[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Link
          key={kpi.key}
          href={kpi.href}
          className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5 ${kpi.accentClass}`}
            >
              {kpi.icon}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
            {kpi.value}
          </p>
          {kpi.sub && (
            <p className="mt-1 truncate text-xs text-gray-500">{kpi.sub}</p>
          )}
          <PiCaretRight className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-200 transition-all group-hover:right-3 group-hover:text-brand" />
        </Link>
      ))}
    </div>
  );
}
