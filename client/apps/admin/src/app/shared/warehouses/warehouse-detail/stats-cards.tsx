'use client';

// app/shared/warehouses/warehouse-detail/stats-cards.tsx
// Brand-themed stat cards. Only the Low / Out card toggles the status filter —
// the earlier build also treated "Stock Lines" as a filter toggle, which read
// as a bug (clicking it appeared to do nothing to the data).

import { motion } from 'framer-motion';
import {
  PiPackageBold,
  PiCubeBold,
  PiLockKeyBold,
  PiWarningBold,
} from 'react-icons/pi';
import { fraunces } from '../../purchases/purchases-fonts';

export type DetailStats = {
  total: number;
  units: number;
  reserved: number;
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  active,
  interactive,
  index,
  onClick,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  active: boolean;
  interactive: boolean;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      onClick={interactive ? onClick : undefined}
      aria-pressed={interactive ? active : undefined}
      tabIndex={interactive ? undefined : -1}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition-all ${
        active
          ? 'border-[#b20202]/40 ring-2 ring-[#b20202]/15'
          : interactive
            ? 'border-[#ece4d6] hover:shadow-md'
            : 'cursor-default border-[#ece4d6]'
      }`}
    >
      {/* accent rule */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b20202]/70">
            {label}
          </p>
          <p
            className={`${fraunces.className} mt-1.5 text-3xl font-semibold tabular-nums text-[#2a2420]`}
          >
            {value.toLocaleString()}
          </p>
        </div>
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 border-t border-[#f1ece2] pt-3 text-xs text-gray-400">
        {active ? 'Active — click to clear' : sub}
      </p>
    </motion.button>
  );
}

const ACCENTS = {
  slate: '#5b7da0',
  green: '#3d6b5c',
  gold: '#c8932c',
  brand: '#b20202',
} as const;

export default function StatsCards({
  stats,
  activeFilter,
  onFilterChange,
}: {
  stats: DetailStats & { lowOut: number };
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  const cards = [
    {
      id: '',
      label: 'Stock Lines',
      value: stats.total,
      icon: PiPackageBold,
      accent: ACCENTS.slate,
      sub: 'SKU · size combos',
    },
    {
      id: 'units',
      label: 'Units On Hand',
      value: stats.units,
      icon: PiCubeBold,
      accent: ACCENTS.green,
      sub: 'Total quantity',
    },
    {
      id: 'reserved',
      label: 'Reserved',
      value: stats.reserved,
      icon: PiLockKeyBold,
      accent: ACCENTS.gold,
      sub: 'Allocated to orders',
    },
    {
      id: 'low_out',
      label: 'Low / Out',
      value: stats.lowOut,
      icon: PiWarningBold,
      accent: ACCENTS.brand,
      sub: 'Click to filter',
    },
  ];

  const isFilterActive = (id: string) =>
    id === 'low_out' && activeFilter === 'low_out';

  const handleClick = (id: string) => () => {
    if (id !== 'low_out') return;
    onFilterChange(activeFilter === 'low_out' ? '' : 'low_out');
  };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((stat, index) => (
        <StatCard
          key={stat.id || 'lines'}
          label={stat.label}
          value={stat.value}
          sub={stat.sub}
          icon={stat.icon}
          accent={stat.accent}
          active={isFilterActive(stat.id)}
          interactive={stat.id === 'low_out'}
          index={index}
          onClick={handleClick(stat.id)}
        />
      ))}
    </div>
  );
}
