// @ts-nocheck
'use client';

/**
 * Shared list-control primitives used across POS orders, product history,
 * and sub-product table views.
 *
 * - FilterItem  — checkbox-style toggle for filter keys
 * - GroupItem   — radio-style toggle for group-by keys
 * - SortIcon    — up/down/neutral sort direction indicator
 */

import React from 'react';
import { PiArrowUp, PiArrowDown, PiArrowsDownUp } from 'react-icons/pi';

// ── FilterItem ────────────────────────────────────────────────────────────────

interface FilterItemProps<T extends string> {
  fkey: T;
  label: string;
  active: boolean;
  onToggle: (key: T) => void;
  /** Override accent colour — defaults to DrinksHarbour red */
  color?: string;
}

export function FilterItem<T extends string>({
  fkey, label, active, onToggle, color = '#b20202',
}: FilterItemProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onToggle(fkey)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
      style={active ? { backgroundColor: `${color}14`, color, fontWeight: 600 } : { color: '#374151' }}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
        style={active ? { borderColor: color, backgroundColor: color } : { borderColor: '#d1d5db' }}
      >
        {active && <span className="h-2 w-2 rounded-sm bg-white" />}
      </span>
      {label}
    </button>
  );
}

// ── GroupItem ─────────────────────────────────────────────────────────────────

interface GroupItemProps<T extends string> {
  gkey: T;
  label: string;
  active: boolean;
  onToggle: (key: T | null) => void;
  color?: string;
}

export function GroupItem<T extends string>({
  gkey, label, active, onToggle, color = '#b20202',
}: GroupItemProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onToggle(active ? null : gkey)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50"
      style={active ? { backgroundColor: `${color}14`, color, fontWeight: 600 } : { color: '#374151' }}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        style={active ? { borderColor: color } : { borderColor: '#d1d5db' }}
      >
        {active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      </span>
      {label}
    </button>
  );
}

// ── SortIcon ──────────────────────────────────────────────────────────────────

interface SortIconProps {
  col: string;
  sortCol: string;
  sortDir: 'asc' | 'desc';
  /** Override accent colour — defaults to DrinksHarbour red */
  color?: string;
}

export function SortIcon({ col, sortCol, sortDir, color = '#b20202' }: SortIconProps) {
  if (sortCol !== col) return <PiArrowsDownUp className="h-3 w-3 opacity-30" />;
  return sortDir === 'asc'
    ? <PiArrowUp   className="h-3 w-3" style={{ color }} />
    : <PiArrowDown className="h-3 w-3" style={{ color }} />;
}
