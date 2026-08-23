// Pure logic for the /sales/[id] detail pages.
//
// The server never sets quoteStatus 'expired' on its own — the enum value
// exists but nothing writes it — so expiry is derived here where it is shown,
// and an operator sees a stale deadline before acting on stale prices.
//
// Vitest runs `environment: 'node'` — nothing renderable may live here.

import type { SalesLineItem } from '@/services/salesOrder.service';

export interface QuoteExpiry {
  state: 'ok' | 'soon' | 'expired';
  /** Whole days remaining; null when there is nothing to count down. */
  daysLeft: number | null;
}

const EXPIRY_RELEVANT_STATUSES = new Set(['draft', 'sent', 'accepted']);
const SOON_WINDOW_DAYS = 7;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function quoteExpiry(
  validUntil: string | undefined | null,
  status?: string,
  now: Date = new Date()
): QuoteExpiry {
  if (!validUntil || !EXPIRY_RELEVANT_STATUSES.has(status ?? '')) {
    return { state: 'ok', daysLeft: null };
  }
  const until = new Date(validUntil);
  if (Number.isNaN(until.getTime())) return { state: 'ok', daysLeft: null };
  // Compare calendar days, not raw ms — a deadline "today" has the whole day.
  const dayDiff = Math.round(
    (startOfDay(until) - startOfDay(now)) / 86_400_000
  );
  if (dayDiff < 0) return { state: 'expired', daysLeft: null };
  if (dayDiff <= SOON_WINDOW_DAYS) return { state: 'soon', daysLeft: dayDiff };
  return { state: 'ok', daysLeft: null };
}

export interface FulfilmentProgress {
  ordered: number;
  delivered: number;
  pct: number;
}

/** Ordered vs delivered units across product lines; sections/notes carry none. */
export function fulfilmentProgress(
  items: SalesLineItem[]
): FulfilmentProgress {
  let ordered = 0;
  let delivered = 0;
  for (const it of items ?? []) {
    if (it.lineType !== 'product') continue;
    ordered += it.quantity || 0;
    delivered += it.fulfilledQty || 0;
  }
  const pct =
    ordered > 0 ? Math.min(100, Math.round((delivered / ordered) * 100)) : 0;
  return { ordered, delivered, pct };
}

/** Server rule (salesOrder.service.js canCancel): live orders only. */
export function canCancelOrder(status?: string): boolean {
  // A missing orderStatus means never confirmed — cancellable, like 'draft'.
  return !(status === 'fulfilled' || status === 'cancelled');
}
