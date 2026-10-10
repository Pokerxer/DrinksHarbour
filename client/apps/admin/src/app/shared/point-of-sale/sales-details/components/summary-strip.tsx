'use client';

import {
  PiCurrencyNgn,
  PiShoppingCart,
  PiTag,
  PiRows,
  PiTrendUp,
  PiPercent,
  PiArrowCounterClockwise,
} from 'react-icons/pi';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type { LinesSummary, VoidSummary, StatusFilter } from '../types';

interface SummaryStripProps {
  summary: LinesSummary;
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
  // A return on the same line is broken out so the gross → net gap is visible
  // rather than being labelled "discount" and quietly absorbing it.
  const showReturnsCard = summary.returns > 0;

  const cards = [
    {
      icon: PiCurrencyNgn,
      label: 'Gross Revenue',
      value: formatCurrency(summary.gross),
      sub: 'before returns',
      color: 'text-gray-400',
      bg: 'bg-gray-50',
    },
    ...(showReturnsCard
      ? [
          {
            icon: PiArrowCounterClockwise,
            label: 'Returns',
            value: formatCurrency(summary.returns),
            sub:
              summary.gross > 0
                ? `${((summary.returns / summary.gross) * 100).toFixed(1)}% of gross`
                : '',
            color: 'text-amber-500',
            bg: 'bg-amber-50',
          },
        ]
      : []),
    {
      icon: PiTrendUp,
      label: 'Net Revenue',
      value: formatCurrency(summary.revenue),
      sub: 'after returns',
      color: 'text-green-500',
      bg: 'bg-green-50',
    },
    {
      icon: PiTag,
      label: 'Total Discount',
      value: formatCurrency(summary.discount),
      // Stated as already-deducted, so it is not read as a further step
      // between gross and net — the net figure has it taken out.
      sub: `already deducted · ${summary.gross > 0 ? `${((summary.discount / summary.gross) * 100).toFixed(1)}% of gross` : '0%'}`,
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
            // The margin is measured on the revenue that actually has a cost
            // basis. Uncosted revenue is disclosed rather than folded in as a
            // 0% margin, which would understate the margin on real stock.
            sub:
              summary.uncostedRevenue > 0
                ? `${summary.margin.toFixed(1)}% on ${formatCurrency(summary.costedRevenue)} costed · ${formatCurrency(summary.uncostedRevenue)} uncosted`
                : `${summary.margin.toFixed(1)}% margin`,
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
      {/* A fixed inline column count could never wrap, so on a narrow screen
          each card collapsed into an unreadable sliver. A responsive grid lets
          the strip reflow into rows as the viewport shrinks; the card count is
          dynamic (returns/void cards) so the columns are viewport-driven, not
          count-driven. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {cards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="flex items-center gap-3 border-b border-r border-gray-100 px-4 py-3 last:border-r-0">
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