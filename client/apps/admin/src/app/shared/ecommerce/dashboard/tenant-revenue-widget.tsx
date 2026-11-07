// @ts-nocheck
'use client';

import cn from '@core/utils/class-names';
import WidgetCard from '@core/components/cards/widget-card';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import { CustomYAxisTick } from '@core/components/charts/custom-yaxis-tick';
import {
  Area,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  AreaChart,
} from 'recharts';
import { PiInfoFill } from 'react-icons/pi';
import { useDashboard, useDashboardMeta } from './use-dashboard';
import { formatCompactNaira as fmt } from './dashboard-format';
import { useTenant } from '@/context/TenantContext';
import {
  DeltaBadge,
  MetricBox,
  usePrefersReducedMotion,
} from './widget-parts';

const FALLBACK = Array.from({ length: 12 }, (_, i) => ({
  month: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][i],
  totalSales: 0,
}));

function pct(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export default function TenantRevenueWidget({
  className,
}: {
  className?: string;
}) {
  const data = useDashboard();
  const meta = useDashboardMeta();
  const reducedMotion = usePrefersReducedMotion();
  const periodLabel = meta?.label ?? 'This month';
  const comparisonLabel = meta?.comparisonLabel ?? 'vs last month';
  const { tenant } = useTenant();
  const accentColor = tenant?.primaryColor || '#dc2626';

  const trend = data?.profit?.trend ?? FALLBACK;
  const periodRevenue = data?.statCards?.period?.revenue ?? 0;
  const prevRevenue = data?.statCards?.previous?.revenue ?? 0;
  const periodOrders = data?.statCards?.period?.orders ?? 0;
  const todayRevenue = data?.statCards?.today?.revenue ?? 0;
  const yestRevenue = data?.statCards?.yesterday?.revenue ?? 0;
  const avgOrderValue = data?.statCards?.avgOrderValue ?? 0;

  const revPct = pct(periodRevenue, prevRevenue);
  const todayUp = todayRevenue >= yestRevenue;

  // Simple revenue margin-like display: how much of orders this period is today
  const todayShare =
    periodRevenue > 0 ? Math.round((todayRevenue / periodRevenue) * 100) : 0;

  return (
    <WidgetCard
      title="Store Revenue"
      description={
        !data ? (
          <div className="mt-1 h-7 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-100/20" />
        ) : (
          <span className="tabular-nums">{fmt(periodRevenue)}</span>
        )
      }
      titleClassName="!text-xs font-medium uppercase tracking-wider text-gray-500"
      descriptionClassName="font-lexend mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl 3xl:text-2xl"
      headerClassName="mb-4"
      className={cn('flex flex-col', className)}
    >
      <div className="flex flex-grow flex-col gap-3">
        {/* comparison vs the previous window — icon + % pill, never colour-only */}
        {data && (
          <div className="flex items-center gap-2">
            <DeltaBadge
              up={revPct >= 0}
              percent={Math.abs(revPct)}
              ariaLabel={`${revPct >= 0 ? 'Up' : 'Down'} ${Math.abs(revPct)}% ${comparisonLabel}`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-600">
              {comparisonLabel} ({fmt(prevRevenue)})
            </span>
          </div>
        )}

        {/* Metric boxes */}
        {!data ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-100/20"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              label={periodLabel}
              value={fmt(periodRevenue)}
              sub={`${periodOrders} orders`}
              highlight
              accentColor={accentColor}
            />
            <MetricBox
              label="Avg Order Value"
              value={fmt(avgOrderValue)}
              sub="per order"
            />
            <MetricBox
              label="Today"
              value={fmt(todayRevenue)}
              sub={`${todayShare}% of period`}
              color={
                todayUp
                  ? 'text-green-dark dark:text-green-400'
                  : 'text-orange-dark dark:text-orange-400'
              }
            />
            <MetricBox
              label="Yesterday"
              value={fmt(yestRevenue)}
              sub={
                todayUp
                  ? 'today did better'
                  : `yesterday led by ${fmt(Math.max(yestRevenue - todayRevenue, 0))}`
              }
              color="text-gray-900 dark:text-gray-100"
            />
          </div>
        )}

        {/* Revenue trend chart */}
        <div className="mt-auto h-44 w-full">
          {!data ? (
            <div className="h-full animate-pulse rounded-xl bg-gray-200 dark:bg-gray-100/20" />
          ) : (
            <div
              className="flex h-full flex-col"
              role="img"
              aria-label={`12-month revenue trend. ${revPct >= 0 ? 'Up' : 'Down'} ${Math.abs(revPct)}% ${comparisonLabel}.`}
            >
              <p className="mb-1 shrink-0 text-xs text-gray-500 dark:text-gray-600">
                12-month trend
              </p>
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trend}
                    margin={{ top: 4, bottom: 0, left: 0, right: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="gradTenantRev"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={accentColor}
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor={accentColor}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="6 8"
                      strokeOpacity={0.4}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={46}
                      tick={<CustomYAxisTick prefix="₦" />}
                    />
                    <Tooltip content={<CustomTooltip prefix="₦" />} />
                    <Area
                      type="monotone"
                      dataKey="totalSales"
                      name="Revenue"
                      stroke={accentColor}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#gradTenantRev)"
                      isAnimationActive={!reducedMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <p className="flex items-start gap-1 text-[11px] leading-tight text-gray-500 dark:text-gray-600">
          <PiInfoFill
            className="inline-flex h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          {`Revenue from all active orders placed in the selected period (${periodLabel}). Compared ${comparisonLabel}.`}
        </p>
      </div>
    </WidgetCard>
  );
}
