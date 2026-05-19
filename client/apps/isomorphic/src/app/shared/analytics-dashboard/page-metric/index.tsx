// @ts-nocheck
'use client';

import React, { useState, useMemo } from 'react';
import ButtonGroupAction from '@core/components/charts/button-group-action';
import { DatePicker } from '@core/ui/datepicker';
import { Flex, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { pageMetricData } from '@/data/page-metrics-data';
import { pageMetricsColumns } from '@/app/shared/analytics-dashboard/page-metric/columns';
import Table from '@core/components/table';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import TablePagination from '@core/components/table/pagination';
import { useWebAnalytics } from '@/context/WebAnalyticsContext';

export type PageMetricDataType = (typeof pageMetricData)[number];

const filterOptions = ['Top Pages', 'Top Folders', 'Top Subfolders'];

export default function PageMetrics({ className }: { className?: string }) {
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const { data } = useWebAnalytics();

  const tableData = data?.pages ?? pageMetricData;

  const filteredData = useMemo(() => {
    if (!startDate || !tableData.length) return tableData;
    const y = startDate.getFullYear();
    const m = startDate.getMonth();
    return tableData.filter(row => {
      const d = new Date(row.updatedAt);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [tableData, startDate]);

  const { table } = useTanStackTable<PageMetricDataType>({
    tableData: filteredData,
    columnConfig: pageMetricsColumns,
    options: {
      initialState: {
        pagination: {
          pageIndex: 0,
          pageSize: 5,
        },
      },
      enableColumnResizing: false,
    },
  });

  return (
    <div
      className={cn(
        'rounded-xl border border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      <Flex align="center" justify="between" className="gap-0 p-5 lg:p-7">
        <ButtonGroupAction
          options={filterOptions}
          defaultActive={filterOptions[0]}
          onChange={(data) => console.log('Page metric filter', data)}
          activeClassName="bg-gray-900 text-gray-0 dark:bg-gray-100"
          className="hidden @lg:flex"
        />
        <Title as="h5" className="text-base @lg:hidden sm:text-lg">
          Page Metric
        </Title>

        <DatePicker
          selected={startDate}
          onChange={(date: Date | null) => setStartDate(date)}
          dateFormat="MMM, yyyy"
          placeholderText="Select Month"
          showMonthYearPicker
          popperPlacement="bottom-end"
          inputProps={{
            variant: 'text',
            inputClassName: 'p-0 px-1 h-auto [&_input]:text-ellipsis',
          }}
          className="w-36"
        />
      </Flex>
      <Table
        table={table}
        variant="elegant"
        classNames={{
          rowClassName: 'last:border-0',
        }}
      />
      <TablePagination table={table} className="p-4" />
    </div>
  );
}
