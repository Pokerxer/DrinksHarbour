'use client';

import { motion } from 'framer-motion';
import cn from '@core/utils/class-names';
import {
  PiShoppingCartBold,
  PiClockBold,
  PiArrowRightBold,
  PiTruckBold,
  PiCheckCircleBold,
  PiXCircleBold,
} from 'react-icons/pi';

const STAT_CARDS = [
  { id: '', label: 'All Orders', icon: PiShoppingCartBold, color: 'blue' },
  { id: 'pending', label: 'Pending', icon: PiClockBold, color: 'orange' },
  {
    id: 'processing',
    label: 'Processing',
    icon: PiArrowRightBold,
    color: 'indigo',
  },
  { id: 'shipped', label: 'Shipped', icon: PiTruckBold, color: 'purple' },
  {
    id: 'delivered',
    label: 'Delivered',
    icon: PiCheckCircleBold,
    color: 'green',
  },
  { id: 'cancelled', label: 'Cancelled', icon: PiXCircleBold, color: 'red' },
] as const;

const CARD_COLORS: Record<
  string,
  { grad: string; icon: string; ring: string; text: string }
> = {
  blue: {
    grad: 'from-blue-500/10 to-blue-500/5',
    icon: 'bg-blue-500',
    ring: 'ring-blue-400/50',
    text: 'text-blue-600 dark:text-blue-400',
  },
  orange: {
    grad: 'from-orange-500/10 to-orange-500/5',
    icon: 'bg-orange-500',
    ring: 'ring-orange-400/50',
    text: 'text-orange-600 dark:text-orange-400',
  },
  indigo: {
    grad: 'from-indigo-500/10 to-indigo-500/5',
    icon: 'bg-indigo-500',
    ring: 'ring-indigo-400/50',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  purple: {
    grad: 'from-purple-500/10 to-purple-500/5',
    icon: 'bg-purple-500',
    ring: 'ring-purple-400/50',
    text: 'text-purple-600 dark:text-purple-400',
  },
  green: {
    grad: 'from-green-500/10 to-green-500/5',
    icon: 'bg-green-500',
    ring: 'ring-green-400/50',
    text: 'text-green-600 dark:text-green-400',
  },
  red: {
    grad: 'from-red-500/10 to-red-500/5',
    icon: 'bg-red-500',
    ring: 'ring-red-400/50',
    text: 'text-red-600 dark:text-red-400',
  },
};

export default function StatsCards({
  counts,
  active,
  loading,
  onFilter,
}: {
  counts: Record<string, number>;
  active: string;
  loading: boolean;
  onFilter: (s: string) => void;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STAT_CARDS.map((c, i) => {
        const col = CARD_COLORS[c.color];
        const Icon = c.icon;
        const isActive = active === c.id;
        return (
          <motion.button
            key={c.id || 'all'}
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFilter(c.id)}
            aria-pressed={isActive}
            className={cn(
              'relative rounded-2xl bg-gradient-to-br p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              col.grad,
              isActive && `ring-4 ${col.ring}`
            )}
          >
            <div
              className={cn(
                'mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white',
                col.icon
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            {loading ? (
              <div className="h-8 w-10 animate-pulse rounded bg-gray-200" />
            ) : (
              <p className="text-2xl font-black text-gray-900">
                {counts[c.id || 'all'] ?? 0}
              </p>
            )}
            <p
              className={cn(
                'mt-0.5 text-xs font-semibold opacity-80',
                col.text
              )}
            >
              {c.label}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}
