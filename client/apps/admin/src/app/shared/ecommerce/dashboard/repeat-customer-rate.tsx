// @ts-nocheck
'use client';

import WidgetCard from '@core/components/cards/widget-card';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import { useMedia } from '@core/hooks/use-media';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Badge } from 'rizzui';
import { useDashboard } from './use-dashboard';

const FALLBACK = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
  newCustomer: 0, returningCustomer: 0,
}));

function SkeletonChart() {
  return (
    <div className="h-[480px] w-full animate-pulse space-y-2 pt-9">
      <div className="h-full rounded-xl bg-gray-100" />
    </div>
  );
}

export default function RepeatCustomerRate({ className }: { className?: string }) {
  const isTablet = useMedia('(max-width: 820px)', false);
  const data = useDashboard();
  const chartData = data?.customerChart ?? FALLBACK;

  // Totals for annotation
  const totalNew = chartData.reduce((s, m) => s + m.newCustomer, 0);
  const totalReturning = chartData.reduce((s, m) => s + m.returningCustomer, 0);

  return (
    <WidgetCard
      title="Customer Activity"
      description={
        <>
          <Badge renderAsDot className="ms-1 bg-[#10b981]" /> Guest orders
          <Badge renderAsDot className="me-1 ms-4 bg-[#0470f2]" /> Registered
          {data && (
            <span className="ms-4 text-xs text-gray-500">
              {totalNew} guest · {totalReturning} registered this year
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
          <div className="h-[480px] w-full pt-9">
            <ResponsiveContainer width="100%" height="100%" {...(isTablet && { minWidth: '700px' })}>
              <AreaChart
                data={chartData}
                margin={{ left: -16 }}
                className="[&_.recharts-cartesian-axis-tick-value]:fill-gray-500 rtl:[&_.recharts-cartesian-axis.yAxis]:-translate-x-12 [&_.recharts-cartesian-grid-vertical]:opacity-0"
              >
                <defs>
                  <linearGradient id="newCustomer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="oldCustomer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3872FA" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3872FA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 10" strokeOpacity={0.435} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="natural" dataKey="newCustomer"       name="Guest orders"  stroke="#10b981" strokeWidth={2.3} fillOpacity={1} fill="url(#newCustomer)" />
                <Area type="natural" dataKey="returningCustomer" name="Registered"    stroke="#3872FA" strokeWidth={2.3} fillOpacity={1} fill="url(#oldCustomer)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
