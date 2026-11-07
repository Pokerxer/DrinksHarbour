'use client';

import Link from 'next/link';
import MetricCard from '@core/components/cards/metric-card';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { Text } from 'rizzui/typography';
import {
  PiGiftDuotone,
  PiBankDuotone,
  PiChartPieSliceDuotone,
  PiWarningDiamondDuotone,
} from 'react-icons/pi';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { useDashboard, useDashboardMeta } from './use-dashboard';
import {
  formatCompactNaira as fmt,
  percentChange as pct,
} from './dashboard-format';
import { DeltaBadge, usePrefersReducedMotion } from './widget-parts';

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50 lg:p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-100/20" />
        <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-100/20" />
      </div>
      <div className="mb-2 h-7 w-24 rounded bg-gray-200 dark:bg-gray-100/20" />
      <div className="mt-5 border-t border-dashed border-muted pt-4">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-100/20" />
      </div>
    </div>
  );
}

export default function StatCards({ className }: { className?: string }) {
  const data = useDashboard();
  const meta = useDashboardMeta();
  const reducedMotion = usePrefersReducedMotion();
  const periodLabel = meta?.label ?? 'This month';
  const comparisonLabel = meta?.comparisonLabel ?? 'vs last month';

  if (!data) {
    return (
      <div
        className={cn('grid grid-cols-1 gap-5 3xl:gap-8 4xl:gap-9', className)}
      >
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const {
    period,
    previous,
    today,
    yesterday,
    pendingOrders,
    lowStockCount,
    avgOrderValue,
    sparkline,
  } = data.statCards;

  const ordersPct = pct(period.orders, previous.orders);
  const revenuePct = pct(period.revenue, previous.revenue);
  const avgPrevious =
    previous.orders > 0 ? Math.round(previous.revenue / previous.orders) : 0;
  const avgPct = pct(avgOrderValue, avgPrevious);

  const stats: {
    id: string;
    href?: string;
    icon: React.ReactNode;
    title: string;
    metric: string;
    sub: string;
    increased: boolean;
    pct: number | null;
    style: string;
    fill: string;
    chart: { day: string; sale: number }[];
  }[] = [
    {
      id: '1',
      href: routes.eCommerce.orders,
      icon: <PiGiftDuotone className="h-6 w-6" />,
      title: `Orders · ${periodLabel}`,
      metric: period.orders.toLocaleString(),
      sub: `${today.orders} today`,
      increased: ordersPct >= 0,
      pct: Math.abs(ordersPct),
      style: 'text-[#3872FA]',
      fill: '#3872FA',
      chart: sparkline.map((d) => ({ day: d.day, sale: d.orders })),
    },
    {
      id: '2',
      icon: <PiChartPieSliceDuotone className="h-6 w-6" />,
      title: `Revenue · ${periodLabel}`,
      metric: fmt(period.revenue),
      sub: `${fmt(today.revenue)} today`,
      increased: revenuePct >= 0,
      pct: Math.abs(revenuePct),
      style: 'text-[#10b981]',
      fill: '#10b981',
      chart: sparkline.map((d) => ({ day: d.day, sale: d.revenue })),
    },
    {
      id: '3',
      icon: <PiBankDuotone className="h-6 w-6" />,
      title: `Avg Order Value · ${periodLabel}`,
      metric: fmt(avgOrderValue),
      sub: 'across active orders',
      increased: avgPct >= 0,
      pct: Math.abs(avgPct),
      style: 'text-[#7928ca]',
      fill: '#7928ca',
      chart: sparkline.map((d) => ({ day: d.day, sale: d.revenue })),
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
      chart: sparkline.map((d) => ({ day: d.day, sale: d.orders })),
    },
  ];

  return (
    <div
      className={cn('grid grid-cols-1 gap-5 3xl:gap-8 4xl:gap-9', className)}
    >
      {stats.map((stat) => {
        const card = (
          <MetricCard
            title={stat.title}
            metric={stat.metric}
            metricClassName="lg:text-[22px] tabular-nums"
            titleClassName="text-xs font-medium uppercase tracking-wider text-gray-500"
            icon={stat.icon}
            iconClassName={cn(
              '[&>svg]:w-10 [&>svg]:h-8 lg:[&>svg]:w-11 lg:[&>svg]:h-9 w-auto h-auto p-0 bg-transparent -mx-1.5',
              stat.style
            )}
            chart={
              <ResponsiveContainer width="100%" height="100%" aria-hidden="true">
                <BarChart barSize={5} barGap={2} data={stat.chart}>
                  <Bar
                    dataKey="sale"
                    fill={stat.fill}
                    radius={2}
                    isAnimationActive={!reducedMotion}
                  />
                </BarChart>
              </ResponsiveContainer>
            }
            chartClassName="hidden @[200px]:flex @[200px]:items-center h-14 w-24"
            className="@container [&>div]:items-center"
          >
            <Text className="mt-5 flex items-center border-t border-dashed border-muted pt-4 leading-none">
              {stat.pct !== null ? (
                <>
                  <DeltaBadge
                    up={stat.increased}
                    percent={stat.pct}
                    ariaLabel={`${stat.increased ? 'Up' : 'Down'} ${stat.pct}% ${comparisonLabel}`}
                    className="me-2"
                  />
                  <Text
                    as="span"
                    className="hidden text-xs text-gray-500 @[240px]:inline-flex"
                  >
                    {stat.increased ? 'up' : 'down'} {comparisonLabel}
                  </Text>
                </>
              ) : (
                <Text
                  as="span"
                  className="text-xs text-orange-dark dark:text-orange-400"
                >
                  {stat.sub}
                </Text>
              )}
            </Text>
          </MetricCard>
        );

        // Only the Orders card carries an approved deep link (verified route):
        // Revenue/AOV have no dashboard-internal target and stay value-only.
        return (
          <StatWrapped href={stat.href} key={stat.id}>
            {card}
          </StatWrapped>
        );
      })}
    </div>
  );
}

/**
 * Wraps a stat card in a deep link when one is approved for it. The wrapper
 * is the grid child so card spacing is untouched; focus shows the same
 * primary ring the dashboard controls use.
 */
function StatWrapped({
  href,
  children,
}: {
  href: string | undefined;
  children: React.ReactNode;
}) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      className="block rounded-lg transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </Link>
  );
}
