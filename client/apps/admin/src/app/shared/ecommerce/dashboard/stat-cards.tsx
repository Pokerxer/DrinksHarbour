// @ts-nocheck
'use client';

import MetricCard from '@core/components/cards/metric-card';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiCaretDoubleUpDuotone,
  PiCaretDoubleDownDuotone,
  PiGiftDuotone,
  PiBankDuotone,
  PiChartPieSliceDuotone,
  PiWarningDiamondDuotone,
} from 'react-icons/pi';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { useDashboard } from './use-dashboard';

function pct(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-muted bg-white p-5 dark:bg-gray-100/20">
      <div className="mb-4 flex items-start justify-between">
        <div className="h-8 w-8 rounded bg-gray-200" />
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
      <div className="mb-2 h-7 w-24 rounded bg-gray-200" />
      <div className="mt-5 border-t border-dashed border-muted pt-4">
        <div className="h-4 w-32 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function StatCards({ className }: { className?: string }) {
  const data = useDashboard();

  if (!data) {
    return (
      <div className={cn('grid grid-cols-1 gap-5 3xl:gap-8 4xl:gap-9', className)}>
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const { thisMonth, lastMonth, today, yesterday, pendingOrders, lowStockCount, avgOrderValue, sparkline } = data.statCards;

  const ordersPct   = pct(thisMonth.orders,  lastMonth.orders);
  const revenuePct  = pct(thisMonth.revenue, lastMonth.revenue);
  const avgLastMonth = lastMonth.orders > 0 ? Math.round(lastMonth.revenue / lastMonth.orders) : 0;
  const avgPct       = pct(avgOrderValue, avgLastMonth);

  const stats = [
    {
      id: '1',
      icon: <PiGiftDuotone className="h-6 w-6" />,
      title: 'Orders This Month',
      metric: thisMonth.orders.toLocaleString(),
      sub: `${today.orders} today`,
      increased: ordersPct >= 0,
      pct: Math.abs(ordersPct),
      style: 'text-[#3872FA]',
      fill: '#3872FA',
      chart: sparkline.map(d => ({ day: d.day, sale: d.orders })),
    },
    {
      id: '2',
      icon: <PiChartPieSliceDuotone className="h-6 w-6" />,
      title: 'Revenue This Month',
      metric: fmt(thisMonth.revenue),
      sub: `${fmt(today.revenue)} today`,
      increased: revenuePct >= 0,
      pct: Math.abs(revenuePct),
      style: 'text-[#10b981]',
      fill: '#10b981',
      chart: sparkline.map(d => ({ day: d.day, sale: d.revenue })),
    },
    {
      id: '3',
      icon: <PiBankDuotone className="h-6 w-6" />,
      title: 'Avg Order Value',
      metric: fmt(avgOrderValue),
      sub: 'from paid orders',
      increased: avgPct >= 0,
      pct: Math.abs(avgPct),
      style: 'text-[#7928ca]',
      fill: '#7928ca',
      chart: sparkline.map(d => ({ day: d.day, sale: d.revenue })),
    },
    {
      id: '4',
      icon: <PiWarningDiamondDuotone className="h-6 w-6" />,
      title: 'Pending Orders',
      metric: pendingOrders.toLocaleString(),
      sub: `${lowStockCount} low/out-of-stock`,
      increased: false,
      pct: null,
      style: 'text-[#f59e0b]',
      fill: '#f59e0b',
      chart: sparkline.map(d => ({ day: d.day, sale: d.orders })),
    },
  ];

  return (
    <div className={cn('grid grid-cols-1 gap-5 3xl:gap-8 4xl:gap-9', className)}>
      {stats.map((stat) => (
        <MetricCard
          key={stat.id}
          title={stat.title}
          metric={stat.metric}
          metricClassName="lg:text-[22px]"
          icon={stat.icon}
          iconClassName={cn(
            '[&>svg]:w-10 [&>svg]:h-8 lg:[&>svg]:w-11 lg:[&>svg]:h-9 w-auto h-auto p-0 bg-transparent -mx-1.5',
            stat.style
          )}
          chart={
            <ResponsiveContainer width="100%" height="100%">
              <BarChart barSize={5} barGap={2} data={stat.chart}>
                <Bar dataKey="sale" fill={stat.fill} radius={5} />
              </BarChart>
            </ResponsiveContainer>
          }
          chartClassName="hidden @[200px]:flex @[200px]:items-center h-14 w-24"
          className="@container [&>div]:items-center"
        >
          <Text className="mt-5 flex items-center border-t border-dashed border-muted pt-4 leading-none text-gray-500">
            {stat.pct !== null ? (
              <>
                <Text
                  as="span"
                  className={cn(
                    'me-2 inline-flex items-center font-medium',
                    stat.increased ? 'text-green' : 'text-red'
                  )}
                >
                  {stat.increased
                    ? <PiCaretDoubleUpDuotone className="me-1 h-4 w-4" />
                    : <PiCaretDoubleDownDuotone className="me-1 h-4 w-4" />
                  }
                  {stat.pct}%
                </Text>
                <Text as="span" className="hidden @[240px]:inline-flex">
                  {stat.increased ? 'up' : 'down'} vs last month
                </Text>
              </>
            ) : (
              <Text as="span" className="text-sm text-orange-500">{stat.sub}</Text>
            )}
          </Text>
        </MetricCard>
      ))}
    </div>
  );
}
