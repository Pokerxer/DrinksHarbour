'use client';

import {
  PiCurrencyNgn,
  PiShoppingCart,
  PiTag,
  PiRows,
  PiTrendUp,
  PiPercent,
} from 'react-icons/pi';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type { SalesSummary, VoidSummary, StatusFilter } from '../types';

interface SummaryStripProps {
  summary: SalesSummary;
  voidSummary: VoidSummary;
  hasCostData: boolean;
  filteredCount: number;
  statusFilter: StatusFilter;
}

export function SummaryStrip({
  summary,
  voidSummary,
  hasCostData,
  filteredCount,
  statusFilter,
}: SummaryStripProps) {
  const showVoidCard = statusFilter === 'all' && voidSummary.count > 0;
  const colCount = (hasCostData ? 6 : 5) + (showVoidCard ? 1 : 0);

  const cards = [
    {
      icon: PiCurrencyNgn,
      label: 'Gross Revenue',
      value: formatCurrency(summary.gross),
      sub: `−${formatCurrency(summary.discount)} disc.`,
      color: 'text-gray-400',
      bg: 'bg-gray-50',
    },
    {
      icon: PiTrendUp,
      label: 'Net Revenue',
      value: formatCurrency(summary.revenue),
      sub: 'after discounts',
      color: 'text-green-500',
      bg: 'bg-green-50',
    },
    {
      icon: PiTag,
      label: 'Total Discount',
      value: formatCurrency(summary.discount),
      sub:
        summary.gross > 0
          ? `${((summary.discount / summary.gross) * 100).toFixed(1)}% of gross`
          : '',
      color: 'text-orange-400',
      bg: 'bg-orange-50',
    },
    {
      icon: PiShoppingCart,
      label: 'Items Sold',
      value: summary.items.toLocaleString(),
      sub: `across ${filteredCount.toLocaleString()} lines`,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      icon: PiRows,
      label: 'Distinct Orders',
      value: summary.orders.toLocaleString(),
      sub: `avg ${formatCurrency(summary.avgOrder)} / order`,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
    },
    ...(hasCostData
      ? [
          {
            icon: PiPercent,
            label: 'Est. Profit',
            value: formatCurrency(summary.profit),
            sub:
              summary.revenue > 0
                ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}% margin`
                : '',
            color: 'text-teal-500',
            bg: 'bg-teal-50',
          },
        ]
      : []),
    ...(showVoidCard
      ? [
          {
            icon: PiRows,
            label: 'Voided',
            value: `${voidSummary.count} items`,
            sub: formatCurrency(voidSummary.revenue) + ' revenue',
            color: 'text-red-400',
            bg: 'bg-red-50',
          },
        ]
      : []),
  ];

  return (
    <div className="shrink-0 border-b border-gray-200 bg-white">
      <div
        className="grid divide-x divide-gray-100"
        style={{
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        }}
      >
        {cards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}
            >
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400">{label}</p>
              <p className="text-sm font-semibold tabular-nums leading-tight text-gray-900">
                {value}
              </p>
              {sub && (
                <p className="text-[10px] tabular-nums text-gray-400">{sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}