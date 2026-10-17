'use client';

import { Text, Flex } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiPackageBold,
  PiCheckCircleBold,
  PiWarningBold,
  PiXCircleBold,
  PiTrendUpBold,
} from 'react-icons/pi';
import type { Stats } from '../filtering';

export function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
  trends,
  resultCount,
  refreshing = false,
  unavailable = false,
  onRetry,
}: {
  stats: Stats;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  trends?: number[];
  resultCount?: number;
  refreshing?: boolean;
  unavailable?: boolean;
  onRetry?: () => void;
}) {
  const statCards = [
    {
      id: '',
      label: 'Total',
      value: stats.total,
      icon: PiPackageBold,
      color: 'blue',
    },
    {
      id: 'active',
      label: 'Active',
      value: stats.active,
      icon: PiCheckCircleBold,
      color: 'green',
    },
    {
      id: 'low_stock',
      label: 'Low Stock',
      value: stats.lowStock,
      icon: PiWarningBold,
      color: 'amber',
    },
    {
      id: 'out_of_stock',
      label: 'Out of Stock',
      value: stats.outOfStock,
      icon: PiXCircleBold,
      color: 'red',
    },
  ];

  const colorMap: Record<
    string,
    { bg: string; text: string; iconBg: string; ring: string }
  > = {
    blue: {
      bg: 'bg-blue-50/40',
      text: 'text-blue-600',
      iconBg: 'bg-blue-50 text-blue-700',
      ring: 'ring-blue-500/30',
    },
    green: {
      bg: 'bg-green-50/40',
      text: 'text-green-600',
      iconBg: 'bg-green-50 text-green-700',
      ring: 'ring-green-500/30',
    },
    amber: {
      bg: 'bg-amber-50/40',
      text: 'text-amber-600',
      iconBg: 'bg-amber-50 text-amber-700',
      ring: 'ring-amber-500/30',
    },
    red: {
      bg: 'bg-red-50/40',
      text: 'text-red-600',
      iconBg: 'bg-red-50 text-red-700',
      ring: 'ring-red-500/30',
    },
  };

  return (
    <section aria-label="Sub-product summary" aria-busy={refreshing}>
      <p role="status" className="mb-3 text-xs text-gray-500">
        {unavailable
          ? 'Summary unavailable. Retry loading products.'
          : refreshing
            ? 'Updating product summary…'
            : `Counts reflect your current search and filters${resultCount != null ? ` · ${resultCount} shown` : ''}.`}
      </p>
      {unavailable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mb-3 min-h-11 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Retry summary
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const colors = colorMap[stat.color];
          const isActive = activeFilter === stat.id;
          const Icon = stat.icon;

          return (
            <button
              key={stat.id}
              type="button"
              aria-label={`Filter ${stat.label}: ${unavailable ? 'unavailable' : stat.value} products`}
              aria-pressed={isActive}
              disabled={unavailable}
              title={
                isActive && stat.id
                  ? 'Click again to show all matching products'
                  : `Show ${stat.label.toLowerCase()} products`
              }
              onClick={() => onFilterChange(stat.id)}
              className={cn(
                'group relative rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50',
                isActive && colors.bg,
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60',
                isActive && 'ring-2 ' + colors.ring
              )}
            >
              <Flex justify="between" align="start">
                <div>
                  <Text className={cn('text-xs font-semibold', colors.text)}>
                    {stat.label}
                  </Text>
                  <div key={stat.value} className="mt-1">
                    <Text className="text-2xl font-semibold tabular-nums text-gray-900">
                      {unavailable ? '—' : stat.value}
                    </Text>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    colors.iconBg
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </Flex>

              <Flex
                justify="between"
                align="center"
                className="mt-3 border-t border-black/5 pt-3"
              >
                <Text className="text-[11px] font-medium text-gray-500">
                  Added in last 30 days
                </Text>
                {!unavailable &&
                  trends !== undefined &&
                  (trends[index] > 0 ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-600">
                      <PiTrendUpBold className="h-3 w-3" />+{trends[index]}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-400">
                      0
                    </span>
                  ))}
              </Flex>
            </button>
          );
        })}
      </div>
    </section>
  );
}
