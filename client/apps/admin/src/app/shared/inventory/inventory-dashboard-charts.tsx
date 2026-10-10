'use client';

import {
  Bar,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Brand palette (matches warehouse-analysis-helpers PALETTE)
export const CHART_COLORS = {
  in: '#3d6b5c', // deep teal-green
  out: '#b20202', // maroon (brand)
  net: '#c8932c', // brass / gold
  slate: '#5b7da0',
  terracotta: '#a8512e',
  violet: '#7d6b9e',
  olive: '#8a9b4f',
  rose: '#c46a6a',
  steel: '#4a5d6e',
  amber: '#d9a05b',
};

export const PIE_PALETTE = [
  CHART_COLORS.out,
  CHART_COLORS.net,
  CHART_COLORS.in,
  CHART_COLORS.slate,
  CHART_COLORS.terracotta,
  CHART_COLORS.violet,
  CHART_COLORS.olive,
  CHART_COLORS.rose,
  CHART_COLORS.steel,
  CHART_COLORS.amber,
];

const compact = new Intl.NumberFormat('en-NG', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      <div className="mt-3" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg bg-gray-50/60">
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

// ── Stock flow (bar + net line) ──────────────────────────────────────────────

export interface FlowPoint {
  day: string; // short label, e.g. "24 Jun"
  in: number;
  out: number;
  net: number;
}

export function StockFlowChart({ data }: { data: FlowPoint[] }) {
  if (!data.some((d) => d.in || d.out))
    return <EmptyChart label="No stock movement in this period" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 8, left: -18 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => compact.format(v)}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            value.toLocaleString(),
            name === 'in' ? 'Units in' : name === 'out' ? 'Units out' : 'Net',
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend
          formatter={(v: string) => (v === 'in' ? 'Units in' : v === 'out' ? 'Units out' : 'Net')}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="in" fill={CHART_COLORS.in} radius={[3, 3, 0, 0]} />
        <Bar dataKey="out" fill={CHART_COLORS.out} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="net" stroke={CHART_COLORS.net} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Donut / pie ──────────────────────────────────────────────────────────────

export interface SlicePoint {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({ data, currency = false }: { data: SlicePoint[]; currency?: boolean }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <EmptyChart label="Nothing to chart yet" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={1}
        >
          {filtered.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => (currency ? ngn.format(value) : value.toLocaleString())}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Top products by stock value (horizontal bars) ────────────────────────────

export interface TopProductPoint {
  id?: string;
  name: string;
  value: number;
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  if (data.length === 0) return <EmptyChart label="No stock matches these filters" />;
  const number = (value: number) => (Number.isFinite(value) ? value : 0);
  const maximum = data.reduce((max, row) => Math.max(max, Math.abs(number(row.value))), 1);
  const currency = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <div className="h-full overflow-y-auto pr-2" aria-label="All matching stock values">
      {data.map((row, index) => {
        const value = number(row.value);
        return (
          <div
            key={`${row.id || row.name}-${index}`}
            data-stock-value
            className="mb-3 grid grid-cols-[minmax(80px,2fr)_minmax(70px,3fr)] items-center gap-2 sm:grid-cols-[minmax(90px,2fr)_minmax(70px,3fr)_minmax(80px,2fr)]"
          >
            <span className="break-words text-xs text-gray-600">{row.name}</span>
            <span className="h-5 overflow-hidden rounded bg-gray-100" aria-hidden="true">
              <span
                className={`block h-full rounded ${value < 0 ? 'bg-amber-600' : 'bg-[#b20202]'}`}
                style={{ width: `${(Math.abs(value) / maximum) * 100}%` }}
              />
            </span>
            <span className="col-span-2 text-right text-xs font-semibold tabular-nums text-gray-700 sm:col-span-1">
              {currency.format(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
