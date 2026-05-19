// @ts-nocheck
'use client';

import MetricCard from '@core/components/cards/metric-card';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { useWebAnalytics } from '@/context/WebAnalyticsContext';

function fmt(n: number, isPercent = false): string {
  if (isPercent) return `${n.toFixed(2)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}.${String(m).padStart(2, '0')} hrs`;
  return `${m} min`;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-muted bg-white p-5 dark:bg-gray-100/20">
      <div className="mb-2 h-5 w-24 rounded bg-gray-200" />
      <div className="h-8 w-16 rounded bg-gray-200" />
    </div>
  );
}

const STABLE_SPARKLINE = [35, 52, 41, 67, 58, 73, 49].map((v, i) => ({ day: `D${i+1}`, sale: v }));

export default function StatCards({ className }: { className?: string }) {
  const { data } = useWebAnalytics();

  if (!data) {
    return (
      <div className={cn('grid grid-cols-1 gap-5 3xl:gap-8 4xl:gap-9', className)}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const overview = data.overview;

  const stats = [
    {
      id: '1',
      title: 'Website Traffic',
      metric: fmt(overview.traffic.current),
      info: 'Number of the visitors on the website.',
      pct: overview.traffic.pctChange,
      fill: '#015DE1',
    },
    {
      id: '2',
      title: 'Conversion Rate',
      metric: fmt(overview.conversionRate.current, true),
      info: 'Number of the visitors turned into user.',
      pct: overview.conversionRate.pctChange,
      fill: '#048848',
    },
    {
      id: '3',
      title: 'Bounce Rate',
      metric: fmt(overview.bounceRate.current, true),
      info: 'Number of the visitors went without visiting.',
      pct: overview.bounceRate.pctChange,
      fill: '#B92E5D',
    },
    {
      id: '4',
      title: 'Session Duration',
      metric: fmtDuration(overview.avgSessionDuration.current),
      info: 'Amount of time users used the website.',
      pct: overview.avgSessionDuration.pctChange,
      fill: '#8200E9',
    },
  ];

  return (
    <div className={cn('grid grid-cols-1 gap-5 3xl:gap-8 4xl:gap-9', className)}>
      {stats.map((stat) => {
        const increased = stat.pct >= 0;
        const pctColor = increased ? '#048848' : '#B92E5D';
        const pctLabel = `${increased ? '+' : ''}${stat.pct.toFixed(2)}%`;

        return (
          <MetricCard
            key={stat.title + stat.id}
            title={stat.title}
            metric={stat.metric}
            rounded="lg"
            metricClassName="text-2xl mt-1"
            info={
              <Text className="mt-4 max-w-[150px] text-sm text-gray-500">
                {stat.info}
              </Text>
            }
            chart={
              <>
                <div
                  style={{ color: pctColor }}
                  className="mb-3 text-sm font-medium"
                >
                  {pctLabel}
                </div>
                <div className="h-12 w-20 @[16.25rem]:h-16 @[16.25rem]:w-24 @xs:h-20 @xs:w-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart barSize={6} barGap={5} data={STABLE_SPARKLINE}>
                      <Bar
                        dataKey="sale"
                        fill={stat.fill}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            }
            chartClassName="flex flex-col w-auto h-auto text-center"
            className="@container @7xl:text-[15px] [&>div]:items-end"
          />
        );
      })}
    </div>
  );
}
