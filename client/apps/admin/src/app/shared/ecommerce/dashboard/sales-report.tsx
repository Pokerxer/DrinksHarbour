// @ts-nocheck
'use client';

import WidgetCard from '@core/components/cards/widget-card';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import { CustomYAxisTick } from '@core/components/charts/custom-yaxis-tick';
import { useMedia } from '@core/hooks/use-media';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  Line,
} from 'recharts';
import { Badge } from 'rizzui';
import { useDashboard } from './use-dashboard';

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
  revenue: 0,
  orders: 0,
  profit: 0,
}));

function SkeletonChart() {
  return (
    <div className="flex h-96 w-full animate-pulse items-end gap-2 pt-9">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-gray-200"
            style={{ height: `${20 + ((i * 17 + 11) % 60)}%` }}
          />
          <div className="h-3 w-5 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n}`;
}

export default function SalesReport({
  className,
  isTenant,
}: {
  className?: string;
  isTenant?: boolean;
}) {
  const isTablet = useMedia('(max-width: 820px)', false);
  const data = useDashboard();

  const salesMap = new Map((data?.salesReport ?? []).map((m) => [m.month, m]));
  const profitMap = new Map(
    (data?.profit?.trend ?? []).map((m) => [m.month, m])
  );
  const chartData = FALLBACK.map((f) => {
    const s = salesMap.get(f.month);
    const p = profitMap.get(f.month);
    const rev = s?.revenue ?? 0;
    const vc = p?.vendorCost ?? 0;
    const pft = p?.profit ?? rev - vc;
    return {
      month: f.month,
      revenue: rev,
      orders: s?.orders ?? 0,
      vendorCost: vc,
      profit: pft,
    };
  });

  const totalRevenue = chartData.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = chartData.reduce((s, m) => s + m.orders, 0);
  const totalProfit = chartData.reduce((s, m) => s + m.profit, 0);

  return (
    <WidgetCard
      title={isTenant ? 'Revenue Trend' : 'Sales Report'}
      description={
        <>
          <Badge renderAsDot className="me-0.5 bg-[#282ECA]" /> Revenue
          <Badge
            renderAsDot
            className="me-0.5 ms-4 bg-[#B8C3E9] dark:bg-[#7c88b2]"
          />{' '}
          Orders
          {!isTenant && (
            <>
              <Badge renderAsDot className="me-0.5 ms-4 bg-[#3b82f6]" /> Vendor
              Cost
              <Badge renderAsDot className="me-0.5 ms-4 bg-[#7c3aed]" />{' '}
              Platform Profit
            </>
          )}
          {data && (
            <span className="ms-4 font-semibold text-gray-900">
              {fmt(totalRevenue)} revenue
              {isTenant
                ? ` · ${totalOrders.toLocaleString()} orders`
                : ` · ${fmt(totalProfit)} profit`}
            </span>
          )}
        </>
      }
      descriptionClassName="text-gray-500 mt-1.5 flex flex-wrap items-center gap-1"
      className={className}
    >
      {!data ? (
        <SkeletonChart />
      ) : (
        <div className="custom-scrollbar overflow-x-auto scroll-smooth">
          <div className="h-96 w-full pt-9">
            <ResponsiveContainer
              width="100%"
              height="100%"
              {...(isTablet && { minWidth: '700px' })}
            >
              <ComposedChart
                data={chartData}
                barSize={isTablet ? 18 : 22}
                className="[&_.recharts-tooltip-cursor]:fill-opacity-20 dark:[&_.recharts-tooltip-cursor]:fill-opacity-10 [&_.recharts-cartesian-axis-tick-value]:fill-gray-500 [&_.recharts-cartesian-axis.yAxis]:-translate-y-3 rtl:[&_.recharts-cartesian-axis.yAxis]:-translate-x-12 [&_.recharts-cartesian-grid-vertical]:opacity-0"
              >
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F0F1FF" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#8200E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 10" strokeOpacity={0.435} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={<CustomYAxisTick prefix="₦" />}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="#282ECA"
                  stackId="a"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="orders"
                  name="Orders"
                  fill="#B8C3E9"
                  fillOpacity={0.9}
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                />
                <Area
                  type="bump"
                  dataKey="revenue"
                  name="Revenue trend"
                  stroke="#8200E9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#salesGrad)"
                />
                {!isTenant && (
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Platform Profit"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
