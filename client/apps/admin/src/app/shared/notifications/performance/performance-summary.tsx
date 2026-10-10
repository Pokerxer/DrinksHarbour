import type { InsightLine } from '@/services/notificationInsights.service';
import {
  PiChartBar,
  PiTrendUp,
  PiTrendDown,
  PiWine,
  PiWarningCircle,
  PiArrowRight,
} from 'react-icons/pi';
import { units } from '../insights/presentation';
import { performanceTotals, type Segment } from './performance-rules';
export default function PerformanceSummary({
  lines,
  segment,
  onSelect,
  customPeriod = false,
}: {
  customPeriod?: boolean;
  lines: InsightLine[];
  segment: Segment;
  onSelect: (segment: Segment) => void;
}) {
  const totals = performanceTotals(lines),
    coverage = totals.total
      ? Math.round((totals.known / totals.total) * 100)
      : 0;
  const cards = [
    {
      label: customPeriod
        ? 'Recorded units · selected period'
        : 'Recorded units · 30 days',
      value:
        totals.known || !totals.total ? units(totals.units) : 'Needs history',
      detail: `${totals.known} of ${totals.total} product sizes · ${coverage}% coverage`,
      filter: 'all' as const,
      icon: PiChartBar,
      color: 'text-[#b20202]',
      background: 'bg-red-50',
    },
    {
      label: 'Picking up',
      value: totals.rising,
      detail: customPeriod
        ? 'More units than the preceding equal period'
        : 'More units sold than the previous week',
      filter: 'rising' as const,
      icon: PiTrendUp,
      color: 'text-emerald-700',
      background: 'bg-emerald-50',
    },
    {
      label: 'Slowing down',
      value: totals.falling,
      detail: customPeriod
        ? 'Fewer units than the preceding equal period'
        : 'Fewer units sold than the previous week',
      filter: 'falling' as const,
      icon: PiTrendDown,
      color: 'text-amber-700',
      background: 'bg-amber-50',
    },
    {
      label: 'No recorded sales',
      value: totals.noSales,
      detail: customPeriod
        ? 'No net sales in the selected period'
        : 'No net sales in the 30-day window',
      filter: 'no_sales' as const,
      icon: PiWine,
      color: 'text-gray-600',
      background: 'bg-gray-100',
    },
    {
      label: 'Needs history',
      value: totals.incomplete,
      detail: 'Review sales dates or location evidence',
      filter: 'incomplete' as const,
      icon: PiWarningCircle,
      color: 'text-blue-700',
      background: 'bg-blue-50',
    },
  ];
  return (
    <div
      aria-label="Performance overview"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <button
          type="button"
          key={card.label}
          aria-label={`Filter performance: ${card.label}`}
          aria-pressed={segment === card.filter}
          onClick={() => onSelect(card.filter)}
          className={`group relative overflow-hidden rounded-xl border bg-white p-4 text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b20202] ${segment === card.filter ? 'border-[#b20202]/40 ring-1 ring-[#b20202]/10' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.background} ${card.color}`}
            >
              <card.icon aria-hidden className="h-5 w-5" />
            </span>
            <PiArrowRight
              aria-hidden
              className={`h-4 w-4 ${segment === card.filter ? 'text-[#b20202]' : 'text-gray-300 group-hover:text-gray-500'}`}
            />
          </div>
          <p className="mt-3 text-xs font-semibold text-gray-500">
            {card.label}
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${card.color}`}>
            {card.value}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            {card.detail}
          </p>
        </button>
      ))}
    </div>
  );
}
