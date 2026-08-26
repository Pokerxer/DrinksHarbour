// @ts-nocheck
'use client';

/**
 * Shared visual primitives for the Banners module.
 * Single source of truth for status/priority/type badges and the
 * content-position / CTA-style class maps used by the list columns,
 * details page, create form preview and AI suggestion cards.
 */

import { BANNER_PLACEMENT_OPTIONS } from '@/types/banner.types';

export const PLATFORM_URL =
  process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://drinksharbour.com';

/** Resolve an internal CTA link to an absolute storefront URL. */
export function platformLink(link?: string): string {
  if (!link) return '#';
  return /^https?:\/\//i.test(link) ? link : `${PLATFORM_URL}${link}`;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  draft: {
    label: 'Draft',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  active: {
    label: 'Active',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  paused: {
    label: 'Paused',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  expired: {
    label: 'Expired',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
  },
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status?: string;
  size?: 'sm' | 'md';
}) {
  const cfg = STATUS_CONFIG[status ?? ''] ?? {
    label: status || '—',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  };
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${cfg.bg} ${cfg.text} ring-current/10 ring-1 ${pad}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Priority ────────────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; ring: string }
> = {
  low: {
    label: 'Low',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    ring: 'ring-gray-200',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
  },
  high: {
    label: 'High',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    ring: 'ring-orange-200',
  },
  urgent: {
    label: 'Urgent',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    ring: 'ring-red-200',
  },
};

export function PriorityBadge({
  priority,
  size = 'md',
}: {
  priority?: string;
  size?: 'sm' | 'md';
}) {
  if (!priority) return <span className="text-sm text-gray-400">—</span>;
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.low;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring} ${pad}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Type ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> =
  {
    hero: { label: 'Hero', bg: 'bg-blue-100', text: 'text-blue-700' },
    promotional: {
      label: 'Promotional',
      bg: 'bg-purple-100',
      text: 'text-purple-700',
    },
    category: { label: 'Category', bg: 'bg-green-100', text: 'text-green-700' },
    product: { label: 'Product', bg: 'bg-orange-100', text: 'text-orange-700' },
    seasonal: { label: 'Seasonal', bg: 'bg-amber-100', text: 'text-amber-700' },
    announcement: {
      label: 'Announcement',
      bg: 'bg-pink-100',
      text: 'text-pink-700',
    },
    custom: { label: 'Custom', bg: 'bg-gray-100', text: 'text-gray-600' },
  };

export function TypeBadge({ type }: { type?: string }) {
  const cfg = TYPE_CONFIG[type ?? ''] ?? {
    label: type || '—',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

export function PlacementLabel({ placement }: { placement?: string }) {
  if (!placement) return <span className="text-sm text-gray-400">—</span>;
  const label =
    BANNER_PLACEMENT_OPTIONS.find((p) => p.value === placement)?.label ||
    String(placement).replace(/_/g, ' ');
  return <span className="text-sm capitalize text-gray-700">{label}</span>;
}

// ─── Class maps (content position / CTA style) ───────────────────────────────

export const POSITION_GRID_CLS: Record<string, string> = {
  'top-left': 'items-start justify-start text-left',
  'top-center': 'items-start justify-center text-center',
  'top-right': 'items-start justify-end text-right',
  'center-left': 'items-center justify-start text-left',
  center: 'items-center justify-center text-center',
  'center-right': 'items-center justify-end text-right',
  'bottom-left': 'items-end justify-start text-left',
  'bottom-center': 'items-end justify-center text-center',
  'bottom-right': 'items-end justify-end text-right',
};

export const CTA_STYLE_CLS: Record<string, string> = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600',
  secondary: 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300',
  outline: 'bg-transparent text-white border-2 border-white hover:bg-white/10',
  text: 'text-white underline underline-offset-4 hover:decoration-2',
  custom: 'bg-gray-900 text-white hover:bg-gray-800',
};

/** CTA classes without hover states (static contexts: previews, cards). */
export const CTA_STYLE_STATIC_CLS: Record<string, string> = {
  primary: 'bg-orange-500 text-white',
  secondary: 'bg-white text-gray-900 border border-gray-300',
  outline: 'bg-transparent text-white border-2 border-white',
  text: 'text-white underline underline-offset-4',
  custom: 'bg-gray-900 text-white',
};
