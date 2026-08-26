// @ts-nocheck
'use client';

/**
 * Small presentational primitives used across the banner details view.
 */

import { motion } from 'framer-motion';

export function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent || 'bg-gray-50 text-gray-500'}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {label}
          </p>
          <p className="text-xl font-black tabular-nums text-gray-900">
            {value}
          </p>
        </div>
      </div>
      {sub && <p className="mt-1.5 text-xs text-gray-400">{sub}</p>}
    </motion.div>
  );
}

export function Card({
  icon,
  title,
  children,
  className = '',
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200/70 bg-white shadow-sm ${className}`}
    >
      <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function InfoRow({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="flex items-center gap-2 truncate text-sm font-medium text-gray-900">
        {badge || value || '—'}
      </dd>
    </div>
  );
}

// 3×3 grid positions for the visual content-position indicator.
const POSITION_CELLS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export function PositionGridIndicator({ position }: { position?: string }) {
  const active = position || 'center';
  return (
    <div className="grid w-20 grid-cols-3 gap-1" aria-hidden="true">
      {POSITION_CELLS.map((pos) => (
        <div
          key={pos}
          className={`h-5 rounded-sm transition ${
            pos === active
              ? 'bg-orange-500 ring-2 ring-orange-300 ring-offset-1'
              : 'bg-gray-100'
          }`}
        />
      ))}
    </div>
  );
}

/** Section card header icon in a neutral wrapper. */
export function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center text-gray-500">
      {children}
    </span>
  );
}
