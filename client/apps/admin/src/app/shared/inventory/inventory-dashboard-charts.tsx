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
          formatter={(v: string) =>
            v === 'in' ? 'Units in' : v === 'out' ? 'Units out' : 'Net'
          }
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="in" fill={CHART_COLORS.in} radius={[3, 3, 0, 0]} />
        <Bar dataKey="out" fill={CHART_COLORS.out} radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="net"
          stroke={CHART_COLORS.net}
          strokeWidth={2}
          dot={false}
        />
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

export function DonutChart({
  data,
  currency = false,
}: {
  data: SlicePoint[];
  currency?: boolean;
}) {
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
          formatter={(value: number) =>
            currency ? ngn.format(value) : value.toLocaleString()
          }
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
  name: string;
  value: number;
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  if (data.length === 0) return <EmptyChart label="No valued stock yet" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `₦${compact.format(v)}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 11, fill: '#4b5563' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number) => [ngn.format(value), 'Stock value']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
