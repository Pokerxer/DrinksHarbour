// @ts-nocheck
'use client';

import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import WidgetCard from '@core/components/cards/widget-card';
import {
  AreaChart, Area, Tooltip, ResponsiveContainer, CartesianGrid, XAxis,
} from 'recharts';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import {
  PiCaretDoubleUpDuotone,
  PiCaretDoubleDownDuotone,
  PiInfoFill,
} from 'react-icons/pi';
import { useDashboard } from './use-dashboard';
import { useTenant } from '@/context/TenantContext';

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

function pct(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

interface MetricBoxProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  highlight?: boolean;
  accentColor?: string;
}

function MetricBox({ label, value, sub, color, highlight, accentColor }: MetricBoxProps) {
  return (
    <div
      className={cn('rounded-xl border px-3 py-2.5', !highlight && 'border-muted bg-gray-50 dark:bg-gray-100/10')}
      style={highlight && accentColor ? { borderColor: `${accentColor}40`, background: `${accentColor}0e` } : undefined}
    >
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('mt-0.5 text-base font-bold', color ?? 'text-gray-900')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const FALLBACK = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
  totalSales: 0,
}));

export default function TenantRevenueWidget({ className }: { className?: string }) {
  const data = useDashboard();
  const { tenant } = useTenant();
  const accentColor = tenant?.primaryColor || '#dc2626';

  const trend = data?.profit?.trend ?? FALLBACK;
  const thisMonth = data?.statCards?.thisMonth?.revenue ?? 0;
  const lastMonth = data?.statCards?.lastMonth?.revenue ?? 0;
  const thisMonthOrders = data?.statCards?.thisMonth?.orders ?? 0;
  const todayRevenue = data?.statCards?.today?.revenue ?? 0;
  const yestRevenue = data?.statCards?.yesterday?.revenue ?? 0;
  const avgOrderValue = data?.statCards?.avgOrderValue ?? 0;

  const revPct = pct(thisMonth, lastMonth);
  const todayUp = todayRevenue >= yestRevenue;

  // Simple revenue margin-like display: how much of orders this month is today
  const todayShare = thisMonth > 0 ? Math.round((todayRevenue / thisMonth) * 100) : 0;

  return (
    <WidgetCard
      title="Store Revenue"
      description={
        !data ? (
          <div className="mt-1 h-7 w-32 animate-pulse rounded bg-gray-200" />
        ) : (
          <span>{fmt(thisMonth)}</span>
        )
      }
      titleClassName="text-gray-500 font-normal font-inter !text-sm"
      descriptionClassName="text-lg font-semibold sm:text-xl 3xl:text-2xl text-gray-900 font-lexend mt-1"
      headerClassName="mb-4"
      className={cn('flex flex-col', className)}
    >
      <div className="flex flex-col flex-grow gap-3">

        {/* vs last month */}
        {data && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn('flex items-center gap-0.5 font-medium', revPct >= 0 ? 'text-green-600' : 'text-red-500')}>
              {revPct >= 0
                ? <PiCaretDoubleUpDuotone className="h-3.5 w-3.5" />
                : <PiCaretDoubleDownDuotone className="h-3.5 w-3.5" />}
              {Math.abs(revPct)}%
            </span>
            <span className="text-gray-400">vs last month ({fmt(lastMonth)})</span>
          </div>
        )}

        {/* Metric boxes */}
        {!data ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              label="This Month"
              value={fmt(thisMonth)}
              sub={`${thisMonthOrders} orders`}
              color="text-gray-900"
              highlight
              accentColor={accentColor}
            />
            <MetricBox
              label="Avg Order Value"
              value={fmt(avgOrderValue)}
              sub="per order"
              color="text-gray-900"
            />
            <MetricBox
              label="Today"
              value={fmt(todayRevenue)}
              sub={`${todayShare}% of month`}
              color={todayUp ? 'text-green-600' : 'text-orange-500'}
            />
            <MetricBox
              label="Yesterday"
              value={fmt(yestRevenue)}
              sub={todayUp ? '↑ better today' : '↓ was better'}
              color="text-gray-600"
            />
          </div>
        )}

        {/* Revenue trend chart */}
        <div className="mt-auto h-44 w-full">
          {!data ? (
            <div className="h-full animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id="gradTenantRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 8" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="bump"
                  dataKey="totalSales"
                  name="Revenue"
                  stroke={accentColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradTenantRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <Text className="text-[11px] text-gray-400 leading-tight">
          <PiInfoFill className="inline-flex h-3.5 w-3.5 text-gray-400" />{' '}
          Revenue from all active orders placed this month. Compared against last month's total.
        </Text>
      </div>
    </WidgetCard>
  );
}
