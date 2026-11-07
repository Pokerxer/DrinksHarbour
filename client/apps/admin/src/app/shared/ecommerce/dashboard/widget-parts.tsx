'use client';

// Colocated UI primitives shared by the dashboard widgets only. Extracted so
// profit/tenant-revenue (and the stat cards) render one identical card
// language: small-caps eyebrow → tabular value → delta pill, and no widget
// re-implements its own progress/delta/empty styling.
// RSC note: subpath rizzui imports only — never `from 'rizzui'`.

import { useEffect, useState } from 'react';
import cn from '@core/utils/class-names';
import {
  PiCaretDoubleDownDuotone,
  PiCaretDoubleUpDuotone,
} from 'react-icons/pi';

/**
 * True when the user asked the OS to reduce motion. SSR/hydration render
 * `false` (animations on), then opt out after mount — data is never hidden
 * behind an animation in either state.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * Delta pill that is never colour-only: caret icon + signed percentage +
 * an explicit aria-name ("up/down …"). Percent is always rendered as an
 * absolute value (the caret carries the direction), tabular-nums so rows
 * of cards don't jitter while live data updates.
 */
export function DeltaBadge({
  up,
  percent,
  ariaLabel,
  className,
}: {
  up: boolean;
  /** Absolute change to display (pass Math.abs(x) — direction comes from `up`). */
  percent: number | string;
  /** Full accessible name, e.g. "up vs last month". */
  ariaLabel: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
        up
          ? 'bg-green-lighter text-green-dark dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-lighter text-red-dark dark:bg-red-900/30 dark:text-red-400',
        className
      )}
    >
      {up ? (
        <PiCaretDoubleUpDuotone className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <PiCaretDoubleDownDuotone className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {percent}
      {typeof percent === 'number' ? '%' : ''}
    </span>
  );
}

/**
 * Small metric tile used on the profit / store-revenue widgets. One visual
 * pattern in both widgets; `accentColor` (tenant brand) or `highlight`
 * (violet) picks the emphasized tile. Colours come from tokens so the tile
 * reads in both themes.
 */
export function MetricBox({
  label,
  value,
  sub,
  color = 'text-gray-900 dark:text-gray-100',
  highlight = false,
  accentColor,
  children,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  color?: string;
  highlight?: boolean;
  accentColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5',
        highlight
          ? accentColor
            ? 'border-transparent'
            : 'border-violet-200 bg-violet-50 dark:border-violet-800/40 dark:bg-violet-900/20'
          : 'border-muted bg-gray-50 dark:bg-gray-100/10'
      )}
      style={
        highlight && accentColor
          ? { borderColor: `${accentColor}40`, background: `${accentColor}0e` }
          : undefined
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-600">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-base font-bold font-lexend tabular-nums',
          color
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-600">
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * Chart legend row: dot + label, positioned with the chart (not detached),
 * works for both themes because colours are explicit series hexes with a
 * token-based text colour.
 */
export function LegendRow({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <ul
      aria-label="Chart legend"
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500',
        className
      )}
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Shared empty state for list/chart widgets: soft icon + one line of plain
 * guidance (never a blank axis or an unexplained empty grid).
 */
export function EmptyState({
  icon,
  message,
  className,
}: {
  icon: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-gray-500',
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-100/10 dark:text-gray-400">
        {icon}
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
