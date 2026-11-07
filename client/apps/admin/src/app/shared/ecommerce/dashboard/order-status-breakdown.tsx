// @ts-nocheck
'use client';

import WidgetCard from '@core/components/cards/widget-card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  LabelList,
} from 'recharts';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import { EmptyState, usePrefersReducedMotion } from './widget-parts';
import { PiBagDuotone } from 'react-icons/pi';
import { useDashboard, useDashboardMeta } from './use-dashboard';
import cn from '@core/utils/class-names';

const STATUS_META: Record<string, { label: string; fill: string }> = {
  pending: { label: 'Pending', fill: '#f59e0b' },
  confirmed: { label: 'Confirmed', fill: '#3872FA' },
  processing: { label: 'Processing', fill: '#8b5cf6' },
  shipped: { label: 'Shipped', fill: '#06b6d4' },
  delivered: { label: 'Delivered', fill: '#10b981' },
  cancelled: { label: 'Cancelled', fill: '#ef4444' },
  refunded: { label: 'Refunded', fill: '#6b7280' },
};

function SkeletonChart() {
  return (
    <div className="pt-4">
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-3"
            aria-hidden="true"
          >
            <div className="h-3 w-16 shrink-0 rounded bg-gray-200 dark:bg-gray-100/20" />
            <div
              className="h-4 flex-1 rounded-e-lg bg-gray-200 dark:bg-gray-100/20"
              style={{ maxWidth: `${20 + i * 15}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderStatusBreakdown({
  className,
}: {
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const data = useDashboard();
  const meta = useDashboardMeta();
  const periodLabel = meta?.label ?? 'This month';
  const statusMap = data?.statusBreakdown ?? {};

  const chartData = Object.entries(STATUS_META)
    .map(([key, meta]) => ({
      name: meta.label,
      sales: statusMap[key] ?? 0,
      fill: meta.fill,
    }))
    .filter((d) => d.sales > 0);

  const total = chartData.reduce((s, d) => s + d.sales, 0);

  return (
    <WidgetCard
      title="Order Status"
      description={
        data ? `${total} orders · ${periodLabel}` : `Breakdown · ${periodLabel}`
      }
      descriptionClassName="text-gray-500 dark:text-gray-600 mt-0.5"
      className={cn('@container', className)}
    >
      {!data ? (
        <SkeletonChart />
      ) : chartData.length === 0 ? (
        <EmptyState
          icon={<PiBagDuotone className="h-6 w-6" aria-hidden="true" />}
          message={`No orders ${periodLabel.toLowerCase()} yet`}
        />
      ) : (
        <div
          className="h-64 w-full pb-2 pt-4"
          role="img"
          aria-label={`Order status breakdown: ${chartData
            .map((d) => `${d.sales.toLocaleString()} ${d.name.toLowerCase()}`)
            .join(', ')} — ${total} orders ${periodLabel.toLowerCase()}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {/* Comparison across statuses → horizontal bars. Categories are
                directly labelled on the axis (the axis is the legend), exact
                counts on hover/focus tooltip and as end labels. */}
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 32, bottom: 0, left: 0 }}
              className="[&_.recharts-cartesian-axis-tick-value]:fill-gray-500"
            >
              <CartesianGrid
                strokeDasharray="6 8"
                strokeOpacity={0.4}
                horizontal={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={76}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                cursor={false}
                content={<CustomTooltip />}
                formatter={(value: number) => value.toLocaleString('en-NG')}
              />
              <Bar
                dataKey="sales"
                name="Orders"
                barSize={14}
                radius={[0, 4, 4, 0]}
                isAnimationActive={!reducedMotion}
              >
                {chartData.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
                <LabelList
                  dataKey="sales"
                  position="right"
                  formatter={(v: number) => v.toLocaleString()}
                  className="fill-gray-500"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}
