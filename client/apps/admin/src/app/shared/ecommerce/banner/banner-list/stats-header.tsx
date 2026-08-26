// @ts-nocheck
'use client';

/**
 * Status stat cards for the banners list — POS dashboard StatCard styling
 * (bordered card, icon chip, uppercase label, black tabular value) while
 * doubling as status filter tabs (server-side ?status=). Selected card gets
 * the brand-red treatment.
 */

import { motion } from 'framer-motion';
import {
  PiArrowsClockwiseBold,
  PiCheckCircleBold,
  PiArrowsClockwise,
  PiPauseBold,
  PiXCircleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

export interface BannerStats {
  total: number;
  active: number;
  scheduled: number;
  paused: number;
  archived: number;
}

const CARDS = [
  { id: '', label: 'Total', icon: <PiArrowsClockwiseBold className="h-5 w-5" />, accent: true },
  { id: 'active', label: 'Active', icon: <PiCheckCircleBold className="h-5 w-5" />, accent: false },
  { id: 'scheduled', label: 'Scheduled', icon: <PiArrowsClockwise className="h-5 w-5" />, accent: false },
  { id: 'paused', label: 'Paused', icon: <PiPauseBold className="h-5 w-5" />, accent: false },
  { id: 'archived', label: 'Archived', icon: <PiXCircleBold className="h-5 w-5" />, accent: false },
];

export default function StatsHeader({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: BannerStats;
  activeFilter: string;
  onFilterChange: (f: string) => void;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
      {CARDS.map((card, idx) => {
        const value =
          card.id === '' ? stats.total : (stats as any)[card.id] ?? 0;
        const selected = activeFilter === card.id;
        return (
          <motion.button
            key={card.id || 'total'}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onFilterChange(card.id)}
            aria-pressed={selected}
            className={cn(
              'flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors',
              selected
                ? 'border-[#b20202]/30 bg-[#b20202]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                selected
                  ? 'bg-[#b20202] text-white'
                  : 'bg-gray-100 text-gray-500'
              )}
            >
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {card.label}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-xl font-black leading-none tabular-nums',
                  selected ? 'text-[#b20202]' : 'text-gray-900'
                )}
              >
                {value}
              </p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
