// @ts-nocheck
'use client';

import WidgetCard from '@core/components/cards/widget-card';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useMedia } from '@core/hooks/use-media';
import { useDashboard } from './use-dashboard';
import cn from '@core/utils/class-names';

const STATUS_META: Record<string, { label: string; fill: string }> = {
  pending:    { label: 'Pending',    fill: '#f59e0b' },
  confirmed:  { label: 'Confirmed',  fill: '#3872FA' },
  processing: { label: 'Processing', fill: '#8b5cf6' },
  shipped:    { label: 'Shipped',    fill: '#06b6d4' },
  delivered:  { label: 'Delivered',  fill: '#10b981' },
  cancelled:  { label: 'Cancelled',  fill: '#ef4444' },
  refunded:   { label: 'Refunded',   fill: '#6b7280' },
};

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="mx-auto h-64 w-64 rounded-full bg-gray-100" />
      <div className="mt-4 space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="mx-auto h-3 w-32 rounded bg-gray-100" />)}
      </div>
    </div>
  );
}

export default function OrderStatusBreakdown({ className }: { className?: string }) {
  const isMobile = useMedia('(max-width: 480px)', false);
  const data = useDashboard();
  const statusMap = data?.statusBreakdown ?? {};

  const chartData = Object.entries(STATUS_META)
    .map(([key, meta]) => ({ name: meta.label, sales: statusMap[key] ?? 0, fill: meta.fill }))
    .filter(d => d.sales > 0);

  const total = chartData.reduce((s, d) => s + d.sales, 0);

  return (
    <WidgetCard
      title="Order Status"
      description={data ? `${total} orders this month` : 'This month\'s breakdown'}
      descriptionClassName="text-gray-500 mt-0.5"
      className={cn('@container', className)}
    >
      {!data ? (
        <div className="pt-4"><SkeletonCard /></div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <p className="text-sm">No orders this month yet</p>
        </div>
      ) : (
        <div className="h-80 w-full pb-4 pt-4 @sm:h-96 @xl:pb-0">
          <ResponsiveContainer
            width="100%"
            height="100%"
            className="[&_.recharts-default-legend]:flex [&_.recharts-default-legend]:flex-wrap [&_.recharts-default-legend]:justify-center @xl:[&_.recharts-default-legend]:flex-col [&_.recharts-legend-wrapper]:!static [&_.recharts-legend-wrapper]:!-mt-[22px] [&_.recharts-legend-wrapper]:!leading-[22px] @xs:[&_.recharts-legend-wrapper]:!mt-0 @xl:[&_.recharts-legend-wrapper]:!absolute @xl:[&_.recharts-legend-wrapper]:!end-0 @xl:[&_.recharts-legend-wrapper]:!start-auto @xl:[&_.recharts-legend-wrapper]:!top-1/2 @xl:[&_.recharts-legend-wrapper]:!-translate-y-1/2 @xl:[&_.recharts-legend-wrapper]:!leading-9"
          >
            <RadialBarChart
              innerRadius="20%"
              outerRadius="110%"
              barSize={isMobile ? 16 : 22}
              data={chartData}
              className="rtl:[&_.recharts-legend-item>svg]:ml-1"
            >
              <RadialBar
                label={{ fill: '#ffffff', position: 'insideStart', fontSize: 11 }}
                background
                dataKey="sales"
                className="[&_.recharts-radial-bar-background-sector]:fill-gray-100"
              />
              <Legend iconSize={10} layout="vertical" verticalAlign="middle" />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetCard>
  );
}
