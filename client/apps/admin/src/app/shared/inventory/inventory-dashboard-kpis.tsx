'use client';

import {
  PiChartLineUpDuotone,
  PiCoinsDuotone,
  PiCubeDuotone,
  PiEmptyDuotone,
  PiTrendUpDuotone,
  PiWarningCircleDuotone,
} from 'react-icons/pi';

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warn' | 'danger';
}

function KpiCard({ label, value, icon, tone = 'default' }: KpiCardProps) {
  const toneCls =
    tone === 'danger'
      ? 'bg-red-50 text-red-600'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-600'
        : 'bg-[#fef2f2] text-[#b20202]';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5 ${toneCls}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-400">
            {label}
          </p>
          <p className="truncate text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="h-5 w-28 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

interface KpiData {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warn' | 'danger';
}

export function KpiCards({ data }: { data: KpiData[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {data.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
  );
}
