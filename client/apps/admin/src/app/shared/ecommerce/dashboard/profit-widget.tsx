// @ts-nocheck
'use client';

import cn from '@core/utils/class-names';
import WidgetCard from '@core/components/cards/widget-card';
import {
  PiInfoFill,
  PiArrowUpBold,
  PiArrowDownBold,
} from 'react-icons/pi';
import { useDashboard, useDashboardMeta } from './use-dashboard';
import { formatCompactNaira as fmt } from './dashboard-format';
import { DeltaBadge, MetricBox } from './widget-parts';
import ProfitTrendChart from './profit-trend-chart';

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
  vendorCost: 0,
  profit: 0,
}));

function pct(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export default function ProfitWidget({ className }: { className?: string }) {
  const data = useDashboard();
  const meta = useDashboardMeta();

  const trend = data?.profit?.trend ?? FALLBACK;
  const profit = data?.profit;

  const profitPct = profit ? pct(profit.thisMonth, profit.lastMonth) : 0;
  const todayRevenue = data?.statCards?.today?.revenue ?? 0;
  const yestRevenue = data?.statCards?.yesterday?.revenue ?? 0;
  const todayUp = todayRevenue >= yestRevenue;

  // Profit margin % = platformProfit / grossRevenue
  const margin =
    (profit?.grossRevenue ?? 0) > 0
      ? Math.round((profit!.thisMonth / profit!.grossRevenue) * 1000) / 10
      : 0;
  const comparisonLabel = meta?.comparisonLabel ?? 'vs last month';

  return (
    <WidgetCard
      title="Platform Profit"
      description={
        !data ? (
          <div className="mt-1 h-7 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-100/20" />
        ) : (
          <span className="tabular-nums">
            {fmt(profit?.thisMonth ?? 0)}
            {profit?.grossRevenue ? (
              <span className="ms-2 text-sm font-normal text-gray-500 dark:text-gray-600">
                {margin}% margin
              </span>
            ) : null}
          </span>
        )
      }
      titleClassName="!text-xs font-medium uppercase tracking-wider text-gray-500"
      descriptionClassName="font-lexend mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl 3xl:text-2xl"
      headerClassName="mb-4"
      className={cn('flex flex-col', className)}
    >
      <div className="flex flex-grow flex-col gap-3">
        {/* Period comparison pill (period-aware label, icon + % so it is
            never colour-only) */}
        {data && (
          <div className="flex items-center gap-2">
            <DeltaBadge
              up={profitPct >= 0}
              percent={Math.abs(profitPct)}
              ariaLabel={`${profitPct >= 0 ? 'Up' : 'Down'} ${Math.abs(profitPct)}% ${comparisonLabel}`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-600">
              {comparisonLabel} ({fmt(profit?.lastMonth ?? 0)})
            </span>
          </div>
        )}

        {/* Profit formula breakdown */}
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
          <>
            {/* Equation row: Revenue − Cost = Profit */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-dashed border-muted px-3 py-2 text-xs">
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {fmt(profit?.grossRevenue ?? 0)}
              </span>
              <span className="text-gray-500 dark:text-gray-600">Revenue</span>
              <span className="mx-1 text-gray-300 dark:text-gray-500">−</span>
              <span className="font-semibold tabular-nums text-blue-dark dark:text-blue-400">
                {fmt(profit?.vendorCost ?? 0)}
              </span>
              <span className="text-gray-500 dark:text-gray-600">
                Vendor Cost
              </span>
              <span className="mx-1 text-gray-300 dark:text-gray-500">=</span>
              <span className="font-bold tabular-nums text-violet-700 dark:text-violet-400">
                {fmt(profit?.thisMonth ?? 0)}
              </span>
              <span className="text-gray-500 dark:text-gray-600">Profit</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MetricBox
                label="Gross Revenue"
                value={fmt(profit?.grossRevenue ?? 0)}
                sub="across active orders"
              />
              <MetricBox
                label="Platform Profit"
                value={fmt(profit?.thisMonth ?? 0)}
                sub={`${margin}% margin`}
                color="text-violet-700 dark:text-violet-300"
                highlight
              />
              <MetricBox
                label="Vendor Cost"
                value={fmt(profit?.vendorCost ?? 0)}
                sub="platform pays vendors"
                color="text-blue-dark dark:text-blue-400"
              />
              <MetricBox
                label="Today vs Yesterday"
                value={fmt(todayRevenue)}
                sub={
                  <>
                    {todayUp ? (
                      <PiArrowUpBold
                        className="h-3 w-3 shrink-0 text-green-dark dark:text-green-400"
                        aria-label="up"
                      />
                    ) : (
                      <PiArrowDownBold
                        className="h-3 w-3 shrink-0 text-red-dark"
                        aria-label="down"
                      />
                    )}
                    {fmt(yestRevenue)} yest.
                  </>
                }
                color={
                  todayUp
                    ? 'text-green-dark dark:text-green-400'
                    : 'text-red-dark dark:text-red-400'
                }
              />
            </div>
          </>
        )}

        {/* Trend chart */}
        <div className="mt-auto h-44 w-full">
          {!data ? (
            <div className="h-full animate-pulse rounded-xl bg-gray-200 dark:bg-gray-100/20" />
          ) : (
            <ProfitTrendChart
              trend={trend}
              ariaLabel={`12-month trend of revenue, vendor cost and platform profit. ${
                profitPct >= 0 ? 'Up' : 'Down'
              } ${Math.abs(profitPct)}% ${comparisonLabel}.`}
            />
          )}
        </div>

        <p className="flex items-start gap-1 text-[11px] leading-tight text-gray-500 dark:text-gray-600">
          <PiInfoFill
            className="inline-flex h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          Profit = Revenue − Vendor Cost across all active orders. Vendor cost =
          customerPrice ÷ (1 + platformMarkup%).
        </p>
      </div>
    </WidgetCard>
  );
}
