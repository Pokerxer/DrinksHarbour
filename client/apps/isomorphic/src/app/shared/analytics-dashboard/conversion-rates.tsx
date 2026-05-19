// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import WidgetCard from '@core/components/cards/widget-card';
import ButtonGroupAction from '@core/components/charts/button-group-action';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { CustomTooltip } from '@core/components/charts/custom-tooltip';
import { useWebAnalytics } from '@/context/WebAnalyticsContext';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const staticData = [
  { country: 'Italy',  amount: 590  },
  { country: 'Japan',  amount: 868  },
  { country: 'China',  amount: 1397 },
  { country: 'Canada', amount: 1480 },
  { country: 'USA',    amount: 1520 },
  { country: 'UK',     amount: 1400 },
];

const filterOptions = ['Week', 'Month', 'Year'];

const periodMap: Record<string, 'week' | 'month' | 'year'> = {
  Week: 'week',
  Month: 'month',
  Year: 'year',
};

export default function ConversionRates({ className }: { className?: string }) {
  const { data } = useWebAnalytics();
  const { data: session } = useSession();
  const token = (session?.user as any)?.token;

  const initialData = data?.conversions ?? staticData;
  const [chartData, setChartData] = useState(initialData);
  const [activeFilter, setActiveFilter] = useState<string>('Year');
  const [isLoading, setIsLoading] = useState(false);

  // Sync with context data when it first loads
  useEffect(() => {
    if (data?.conversions) {
      setChartData(data.conversions);
    }
  }, [data?.conversions]);

  const overallRate = data?.overview?.conversionRate?.current;
  const description = overallRate != null
    ? `${overallRate.toFixed(2)}% overall conversion rate`
    : '+43.4% last year';

  async function handleFilterBy(filter: string) {
    setActiveFilter(filter);
    const period = periodMap[filter] ?? 'year';

    setIsLoading(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/analytics/conversions?period=${period}`, { headers });
      const json = await res.json();
      if (json?.data) {
        setChartData(json.data);
      }
    } catch {
      // Silently fall back to existing data on error
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <WidgetCard
      title={'Conversion Rates'}
      description={description}
      rounded="lg"
      action={
        <ButtonGroupAction
          options={filterOptions}
          onChange={(val) => handleFilterBy(val)}
          className="-ms-2 mb-3 @lg:mb-0 @lg:ms-0"
        />
      }
      descriptionClassName="text-gray-500 mt-1.5 mb-3 @md:mb-0"
      headerClassName="flex-col @md:flex-row"
      className={className}
    >
      <div
        className="h-96 w-full @sm:py-3"
        style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            layout="vertical"
            margin={{ left: -2 }}
            data={chartData}
            className="[&_.recharts-cartesian-axis-tick-value]:fill-gray-500 rtl:[&_.recharts-cartesian-axis.yAxis]:-translate-x-12"
          >
            <XAxis type="number" axisLine={false} tickLine={false} />
            <YAxis
              dataKey="country"
              type="category"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="amount" barSize={16} radius={4} fill="#3872FA" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
