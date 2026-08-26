// @ts-nocheck
'use client';

/**
 * Status stat cards for the banners list — double as status filter tabs
 * (server-side filtering via ?status=).
 */

import { Text } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiCheckCircleBold,
  PiArrowsClockwise,
  PiPauseBold,
  PiXCircleBold,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import cn from '@core/utils/class-names';

export interface BannerStats {
  total: number;
  active: number;
  scheduled: number;
  paused: number;
  archived: number;
}

const COLOR_MAP: Record<
  string,
  { bg: string; text: string; iconBg: string; ring: string }
> = {
  blue: {
    bg: 'from-blue-500/10 to-blue-500/5',
    text: 'text-blue-600',
    iconBg: 'bg-blue-500',
    ring: 'ring-blue-500/30',
  },
  green: {
    bg: 'from-green-500/10 to-green-500/5',
    text: 'text-green-600',
    iconBg: 'bg-green-500',
    ring: 'ring-green-500/30',
  },
  amber: {
    bg: 'from-amber-500/10 to-amber-500/5',
    text: 'text-amber-600',
    iconBg: 'bg-amber-500',
    ring: 'ring-amber-500/30',
  },
  orange: {
    bg: 'from-orange-500/10 to-orange-500/5',
    text: 'text-orange-600',
    iconBg: 'bg-orange-500',
    ring: 'ring-orange-500/30',
  },
  gray: {
    bg: 'from-gray-500/10 to-gray-500/5',
    text: 'text-gray-600',
    iconBg: 'bg-gray-500',
    ring: 'ring-gray-500/30',
  },
};

export default function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: BannerStats;
  activeFilter: string;
  onFilterChange: (f: string) => void;
}) {
  const cards = [
    { id: '', label: 'Total', value: stats.total, icon: PiArrowsClockwiseBold, color: 'blue' },
    { id: 'active', label: 'Active', value: stats.active, icon: PiCheckCircleBold, color: 'green' },
    { id: 'scheduled', label: 'Scheduled', value: stats.scheduled, icon: PiArrowsClockwise, color: 'amber' },
    { id: 'paused', label: 'Paused', value: stats.paused, icon: PiPauseBold, color: 'orange' },
    { id: 'archived', label: 'Archived', value: stats.archived, icon: PiXCircleBold, color: 'gray' },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((card, idx) => {
        const colors = COLOR_MAP[card.color];
        const isActive = activeFilter === card.id;
        const Icon = card.icon;
        return (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilterChange(card.id)}
            className={cn(
              'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left transition-all',
              colors.bg,
              isActive && `ring-4 ${colors.ring}`
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <Text
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider opacity-70',
                    colors.text
                  )}
                >
                  {card.label}
                </Text>
                <motion.div
                  key={card.value}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-1"
                >
                  <Text className="text-3xl font-black">{card.value}</Text>
                </motion.div>
              </div>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg',
                  colors.iconBg
                )}
              >
                <Icon className="h-6 w-6" />
              </motion.div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
