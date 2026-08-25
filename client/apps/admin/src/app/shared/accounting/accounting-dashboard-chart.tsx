'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import type { MonthlyPoint } from '@/services/accounting.service';
import { fmtMoney } from './accounting-helpers';

function fmtYAxis(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `₦${Math.round(v / 1_000)}K`;
  return `₦${v}`;
}

/** Revenue vs expenses — ComposedChart in the POS sales-chart style. */
export default function AccountingDashboardChart({
  data,
}: {
  data: MonthlyPoint[];
}) {
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const avgProfit = data.length
    ? (totalRevenue - totalExpenses) / data.length
    : 0;
  const bestIdx = data.reduce((bi, d, i) => (d.revenue > data[bi].revenue ? i : bi), 0);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '6-mo revenue', value: fmtMoney(totalRevenue) },
          { label: '6-mo expenses', value: fmtMoney(totalExpenses) },
          { label: 'Monthly avg profit', value: fmtMoney(avgProfit) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{s.label}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            barSize={28}
            margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
            className="[&_.recharts-cartesian-grid-vertical]:opacity-0"
          >
            <defs>
              <linearGradient id="acctRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b20202" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#d42b2b" stopOpacity={0.65} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtYAxis}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              width={56}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar
              dataKey="revenue"
              name="Revenue"
              fill="url(#acctRevenueGradient)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              dataKey="expenses"
              name="Expenses"
              type="monotone"
              stroke="#64748b"
              strokeWidth={2}
              dot={{ r: 3, fill: '#fff', stroke: '#64748b', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#64748b' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote */}
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-gray-400">Bars = revenue · line = expenses</span>
        {data[bestIdx]?.revenue > 0 && (
          <span className="ml-auto text-gray-400">
            Best month:{' '}
            <span className="font-semibold text-gray-600">{data[bestIdx].label}</span>{' '}
            {fmtMoney(data[bestIdx].revenue)}
          </span>
        )}
      </div>
    </div>
  );
}
