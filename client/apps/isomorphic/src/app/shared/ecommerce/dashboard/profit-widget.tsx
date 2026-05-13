// @ts-nocheck
'use client';

import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import WidgetCard from '@core/components/cards/widget-card';
import { AreaChart, Area, Tooltip, ResponsiveContainer, CartesianGrid, XAxis, Line, ComposedChart } from 'recharts';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import {
  PiInfoFill,
  PiCaretDoubleUpDuotone,
  PiCaretDoubleDownDuotone,
  PiArrowRightBold,
} from 'react-icons/pi';
import { useDashboard } from './use-dashboard';

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
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
}

function MetricBox({ label, value, sub, color, highlight }: MetricBoxProps) {
  return (
    <div className={cn(
      'rounded-xl border px-3 py-2.5',
      highlight
        ? 'border-violet-200 bg-violet-50 dark:border-violet-800/40 dark:bg-violet-900/20'
        : 'border-muted bg-gray-50 dark:bg-gray-100/10'
    )}>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('mt-0.5 text-base font-bold', color ?? 'text-gray-900')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const FALLBACK = Array.from({ length: 12 }, (_, i) => ({
  month:      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
  totalSales: 0,
  vendorCost: 0,
  profit:     0,
}));

export default function ProfitWidget({ className }: { className?: string }) {
  const data = useDashboard();

  const trend  = data?.profit?.trend ?? FALLBACK;
  const profit = data?.profit;

  const profitPct    = profit ? pct(profit.thisMonth, profit.lastMonth) : 0;
  const todayRevenue = data?.statCards?.today?.revenue    ?? 0;
  const yestRevenue  = data?.statCards?.yesterday?.revenue ?? 0;
  const todayUp      = todayRevenue >= yestRevenue;

  // Profit margin % = platformProfit / paidRevenue
  const margin = (profit?.paidRevenue ?? 0) > 0
    ? Math.round((profit!.thisMonth / profit!.paidRevenue) * 1000) / 10
    : 0;

  return (
    <WidgetCard
      title="Platform Profit"
      description={
        !data
          ? <div className="mt-1 h-7 w-32 animate-pulse rounded bg-gray-200" />
          : (
            <span>
              {fmt(profit?.thisMonth ?? 0)}
              {profit?.paidRevenue ? (
                <span className="ms-2 text-sm font-normal text-gray-400">
                  {margin}% margin
                </span>
              ) : null}
            </span>
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
            <span className={cn('flex items-center gap-0.5 font-medium', profitPct >= 0 ? 'text-green-600' : 'text-red-500')}>
              {profitPct >= 0
                ? <PiCaretDoubleUpDuotone className="h-3.5 w-3.5" />
                : <PiCaretDoubleDownDuotone className="h-3.5 w-3.5" />
              }
              {Math.abs(profitPct)}%
            </span>
            <span className="text-gray-400">vs last month ({fmt(profit?.lastMonth ?? 0)})</span>
          </div>
        )}

        {/* Profit formula breakdown */}
        {!data ? (
          <div className="grid grid-cols-2 gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : (
          <>
            {/* Equation row: Revenue - Cost = Profit */}
            <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-muted px-3 py-2 text-xs">
              <span className="font-semibold text-gray-900">{fmt(profit?.paidRevenue ?? 0)}</span>
              <span className="text-gray-400">Revenue</span>
              <span className="mx-1 text-gray-300">−</span>
              <span className="font-semibold text-blue-600">{fmt(profit?.vendorCost ?? 0)}</span>
              <span className="text-gray-400">Vendor Cost</span>
              <span className="mx-1 text-gray-300">=</span>
              <span className="font-bold text-violet-600">{fmt(profit?.thisMonth ?? 0)}</span>
              <span className="text-gray-400">Profit</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MetricBox
                label="Gross Revenue"
                value={fmt(profit?.paidRevenue ?? 0)}
                sub="paid orders only"
                color="text-gray-900"
              />
              <MetricBox
                label="Platform Profit"
                value={fmt(profit?.thisMonth ?? 0)}
                sub={`${margin}% margin`}
                color="text-violet-600"
                highlight
              />
              <MetricBox
                label="Vendor Cost"
                value={fmt(profit?.vendorCost ?? 0)}
                sub="platform pays vendors"
                color="text-blue-600"
              />
              <MetricBox
                label="Today vs Yesterday"
                value={fmt(todayRevenue)}
                sub={`${todayUp ? '↑' : '↓'} ${fmt(yestRevenue)} yest.`}
                color={todayUp ? 'text-green-600' : 'text-red-500'}
              />
            </div>
          </>
        )}

        {/* Trend chart */}
        <div className="mt-auto h-44 w-full">
          {!data ? (
            <div className="h-full animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 8" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="bump"
                  dataKey="totalSales"
                  name="Revenue"
                  stroke="#10b981"
                  strokeWidth={1.8}
                  fillOpacity={1}
                  fill="url(#gradRev)"
                />
                <Area
                  type="bump"
                  dataKey="vendorCost"
                  name="Vendor Cost"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#gradCost)"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Platform Profit"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <Text className="text-[11px] text-gray-400 leading-tight">
          <PiInfoFill className="inline-flex h-3.5 w-3.5 text-gray-400" />{' '}
          Profit = Revenue − Vendor Cost. Vendor cost = platform price ÷ 1.15.
        </Text>
      </div>
    </WidgetCard>
  );
}
