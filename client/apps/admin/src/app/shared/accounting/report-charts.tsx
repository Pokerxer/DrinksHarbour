'use client';

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BalanceSheet, GeneralLedger, ProfitLoss, TrialBalance } from '@/services/accounting.service';
import { ACCOUNT_TYPE_LABELS, fmtAxisMoney, fmtDate, fmtMoney } from './accounting-helpers';

const BRAND = '#b20202';
const SLATE = '#64748b';
const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' };
const TYPE_COLORS: Record<string, string> = {
  asset: '#2563eb',
  liability: '#d97706',
  equity: '#7c3aed',
  income: '#059669',
  expense: '#b20202',
};

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-0.5 font-medium text-gray-700">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="tabular-nums text-gray-600">
          {p.name && `${p.name}: `}
          <span className="font-semibold text-gray-900">{fmtMoney(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

function ChartFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="h-56">{children}</div>
    </div>
  );
}

/** P&L breakdown: Revenue → COGS → Gross → OpEx → Net as coloured bars. */
export function PLBreakdownChart({ data }: { data: ProfitLoss }) {
  const rows = [
    { label: 'Revenue', value: data.revenueTotal },
    { label: 'COGS', value: data.cogs.total },
    { label: 'Gross Profit', value: data.grossProfit },
    { label: 'OpEx', value: data.expenseTotal },
    { label: 'Net Profit', value: data.netProfit },
  ];
  return (
    <ChartFrame label="P&L breakdown (NGN)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={6} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            width={62}
            tickFormatter={fmtAxisMoney}
          />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f8fafc' }} />
          <ReferenceLine y={0} stroke="#e2e8f0" />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {rows.map((r) => (
              <Cell key={r.label} fill={r.value < 0 ? '#ef4444' : r.label === 'Net Profit' ? BRAND : '#cbd5e1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Balance-sheet position: Assets vs Liabilities vs Equity horizontal bars. */
export function BSPositionChart({ data }: { data: BalanceSheet }) {
  const rows = [
    { label: 'Assets', value: data.assets.total },
    { label: 'Liabilities', value: data.liabilities.total },
    { label: 'Equity', value: data.equity.total },
  ];
  return (
    <ChartFrame label="Position (NGN)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={fmtAxisMoney} />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={80}
          />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
            <Cell fill="#2563eb" />
            <Cell fill="#d97706" />
            <Cell fill="#7c3aed" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** GL running balance across the window, avg-referenced like order-analysis. */
export function GLBalanceChart({ data }: { data: GeneralLedger }) {
  const opening = data.openingBalance ?? 0;
  const rows = [
    ...(opening !== 0 ? [{ label: 'Opening', balance: opening }] : []),
    ...data.lines.map((l) => ({ label: fmtDate(l.date), balance: l.balance })),
  ];
  const avg =
    rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.balance, 0) / rows.length) * 100) / 100
      : 0;
  return (
    <ChartFrame label="Running balance (NGN)">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="glAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BRAND} stopOpacity={0.18} />
              <stop offset="95%" stopColor={BRAND} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={6} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} width={62} tickFormatter={fmtAxisMoney} />
          <Tooltip content={<MoneyTooltip />} cursor={{ stroke: BRAND, strokeWidth: 1, strokeDasharray: '4 4' }} />
          <ReferenceLine y={0} stroke="#e2e8f0" />
          {rows.length > 1 && (
            <ReferenceLine
              y={avg}
              stroke="#cbd5e1"
              strokeDasharray="5 4"
              label={{ value: `Avg ${fmtAxisMoney(avg)}`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8', dy: -6 }}
            />
          )}
          <Area dataKey="balance" type="monotone" fill="url(#glAreaFill)" stroke="none" />
          <Line dataKey="balance" name="Balance" type="monotone" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3, fill: '#fff', stroke: BRAND, strokeWidth: 2 }} activeDot={{ r: 6, fill: BRAND, stroke: '#fff', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Trial-balance mix: closing balance share per account type. */
export function TBTypeMixChart({ data }: { data: TrialBalance }) {
  const byType = new Map<string, number>();
  for (const r of data.rows) {
    byType.set(r.type, Math.round(((byType.get(r.type) ?? 0) + Math.abs(r.closing)) * 100) / 100);
  }
  const rows = Array.from(byType.entries())
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({
      label: ACCOUNT_TYPE_LABELS[type] ?? type,
      value,
      color: TYPE_COLORS[type] ?? SLATE,
    }));
  if (rows.length === 0) return null;
  return (
    <ChartFrame label="Closing balance mix by account type">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
            {rows.map((r) => (
              <Cell key={r.label} fill={r.color} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<MoneyTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
