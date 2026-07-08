// @ts-nocheck
'use client';

import { motion } from 'framer-motion';
import { Flex } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiPackageBold,
  PiCheckCircleBold,
  PiWarningBold,
  PiXCircleBold,
  PiEyeSlashBold,
  PiArchiveBold,
} from 'react-icons/pi';

interface StatusPillsProps {
  activeFilters: string[];
  onFilterToggle: (filter: string) => void;
  stats: {
    total: number;
    published: number;
    draft: number;
    discontinued: number;
    lowStock?: number;
    outOfStock?: number;
  };
  variant?: 'default' | 'compact';
}

interface PillConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  color: 'brand' | 'green' | 'amber' | 'red' | 'gray';
  statKey: keyof StatusPillsProps['stats'];
}

const PILL_CONFIGS: PillConfig[] = [
  {
    id: '',
    label: 'All',
    icon: PiPackageBold,
    color: 'brand',
    statKey: 'total',
  },
  {
    id: 'published',
    label: 'Published',
    icon: PiCheckCircleBold,
    color: 'green',
    statKey: 'published',
  },
  {
    id: 'low_stock',
    label: 'Low Stock',
    icon: PiWarningBold,
    color: 'amber',
    statKey: 'lowStock',
  },
  {
    id: 'out_of_stock',
    label: 'Out of Stock',
    icon: PiXCircleBold,
    color: 'red',
    statKey: 'outOfStock',
  },
];

const VISIBILITY_PILLS: PillConfig[] = [
  {
    id: 'draft',
    label: 'Draft',
    icon: PiEyeSlashBold,
    color: 'gray',
    statKey: 'draft',
  },
  {
    id: 'discontinued',
    label: 'Discontinued',
    icon: PiArchiveBold,
    color: 'gray',
    statKey: 'discontinued',
  },
];

const COLOR_MAP = {
  brand: {
    active: 'bg-[#b20202] text-white border-[#b20202] shadow-[#b20202]/30',
    inactive:
      'bg-white text-[#b20202] border-[#b20202]/30 hover:border-[#b20202] hover:bg-red-50',
    badge: 'bg-red-100 text-[#b20202]',
  },
  green: {
    active: 'bg-green-500 text-white border-green-500 shadow-green-500/30',
    inactive:
      'bg-white text-green-600 border-green-200 hover:border-green-400 hover:bg-green-50',
    badge: 'bg-green-100 text-green-700',
  },
  amber: {
    active: 'bg-amber-500 text-white border-amber-500 shadow-amber-500/30',
    inactive:
      'bg-white text-amber-600 border-amber-200 hover:border-amber-400 hover:bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
  red: {
    active: 'bg-red-500 text-white border-red-500 shadow-red-500/30',
    inactive:
      'bg-white text-red-600 border-red-200 hover:border-red-400 hover:bg-red-50',
    badge: 'bg-red-100 text-red-700',
  },
  gray: {
    active: 'bg-gray-500 text-white border-gray-500 shadow-gray-500/30',
    inactive:
      'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50',
    badge: 'bg-gray-100 text-gray-700',
  },
};

function StatusPill({
  config,
  isActive,
  count,
  onClick,
  variant = 'default',
}: {
  config: PillConfig;
  isActive: boolean;
  count: number;
  onClick: () => void;
  variant?: 'default' | 'compact';
}) {
  const colors = COLOR_MAP[config.color];
  const Icon = config.icon;

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl border-2 font-semibold transition-all',
        variant === 'compact' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        isActive ? colors.active + ' shadow-lg' : colors.inactive
      )}
    >
      <Icon className={cn(variant === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      <span>{config.label}</span>
      <motion.span
        key={count}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'flex items-center justify-center rounded-full font-bold',
          variant === 'compact'
            ? 'h-[18px] min-w-[18px] text-[10px]'
            : 'h-[22px] min-w-[22px] text-xs',
          isActive ? 'bg-white/30' : colors.badge
        )}
      >
        {count}
      </motion.span>
    </motion.button>
  );
}

export default function StatusPills({
  activeFilters,
  onFilterToggle,
  stats,
  variant = 'default',
}: StatusPillsProps) {
  return (
    <div className="space-y-3">
      {/* Main Status Pills */}
      <Flex wrap="wrap" gap="2">
        {PILL_CONFIGS.map((config) => {
          const isActive =
            activeFilters.includes(config.id) ||
            (config.id === '' && activeFilters.length === 0);
          const count = stats[config.statKey] || 0;

          return (
            <StatusPill
              key={config.id}
              config={config}
              isActive={isActive}
              count={count}
              onClick={() => onFilterToggle(config.id)}
              variant={variant}
            />
          );
        })}

        {/* Separator */}
        <div
          className={cn(
            'mx-1 w-px bg-gray-200',
            variant === 'compact' ? 'h-6' : 'h-8'
          )}
        />

        {/* Visibility Pills */}
        {VISIBILITY_PILLS.map((config) => {
          const isActive = activeFilters.includes(config.id);
          const count = stats[config.statKey] || 0;

          return (
            <StatusPill
              key={config.id}
              config={config}
              isActive={isActive}
              count={count}
              onClick={() => onFilterToggle(config.id)}
              variant={variant}
            />
          );
        })}
      </Flex>
    </div>
  );
}

// Compact version for inline use
export function StatusPillsInline({
  activeFilter,
  onFilterChange,
  stats,
}: {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stats: StatusPillsProps['stats'];
}) {
  const quickFilters = [
    { id: '', label: 'All', count: stats.total, color: 'brand' as const },
    {
      id: 'published',
      label: 'Published',
      count: stats.published,
      color: 'green' as const,
    },
    {
      id: 'low_stock',
      label: 'Low',
      count: stats.lowStock || 0,
      color: 'amber' as const,
    },
    {
      id: 'out_of_stock',
      label: 'Out',
      count: stats.outOfStock || 0,
      color: 'red' as const,
    },
  ];

  return (
    <Flex gap="1" className="rounded-xl bg-gray-100 p-1">
      {quickFilters.map((filter) => {
        const isActive = activeFilter === filter.id;

        return (
          <motion.button
            key={filter.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              isActive
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <span>{filter.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px]',
                isActive
                  ? COLOR_MAP[filter.color].badge
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              {filter.count}
            </span>
          </motion.button>
        );
      })}
    </Flex>
  );
}
