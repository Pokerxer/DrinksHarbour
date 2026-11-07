'use client';

// Colocated sibling of profit-widget.tsx (imported only there): the 12-month
// composed trend (revenue area / vendor-cost area / dashed profit line).
// Monotone curves instead of the decorative `bump` so the shape reflects the
// monthly figures, ₦-formatted axis ticks, exact-value tooltip, and a visible
// legend pinned to the chart.

import {
  Area,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
} from 'recharts';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import { CustomYAxisTick } from '@core/components/charts/custom-yaxis-tick';
import { LegendRow, usePrefersReducedMotion } from './widget-parts';

export const PROFIT_SERIES = [
  { label: 'Revenue', color: '#10b981' },
  { label: 'Vendor Cost', color: '#3b82f6' },
  { label: 'Platform Profit', color: '#7c3aed' },
];

export default function ProfitTrendChart({
  trend,
  ariaLabel,
}: {
  trend: {
    month: string;
    totalSales: number;
    vendorCost: number;
    profit: number;
  }[];
  /** Screen-reader summary of the chart's key insight (no image alt on SVG). */
  ariaLabel: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="flex h-full flex-col" role="img" aria-label={ariaLabel}>
      <LegendRow items={PROFIT_SERIES} className="mb-1 shrink-0" />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={trend}
            margin={{ top: 4, bottom: 0, left: 0, right: 0 }}
          >
            <defs>
              <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
              stroke="#10b981"
              strokeWidth={1.8}
              fillOpacity={1}
              fill="url(#gradRev)"
              isAnimationActive={!reducedMotion}
            />
            <Area
              type="monotone"
              dataKey="vendorCost"
              name="Vendor Cost"
              stroke="#3b82f6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#gradCost)"
              isAnimationActive={!reducedMotion}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Platform Profit"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
              isAnimationActive={!reducedMotion}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
