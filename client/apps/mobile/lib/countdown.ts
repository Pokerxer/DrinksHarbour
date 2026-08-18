import type { RawProduct } from './catalog-api.ts';

/**
 * Flash-sale time math.
 *
 * `now` is a parameter rather than a call to Date.now() so the arithmetic is
 * testable without faking timers — the component owns the ticking, this module
 * owns the maths.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * When the data carries no sale end date the section still shows a clock, so it
 * reads as a live promotion rather than a broken one. Matches the web block's
 * 8-hour default (Home1/FlashSale.tsx:463).
 */
export const FALLBACK_SALE_WINDOW_MS = 8 * HOUR;

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

const EXPIRED: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

export function timeLeftUntil(endsAtMs: number, nowMs: number): TimeLeft {
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(nowMs)) return EXPIRED;

  const remaining = endsAtMs - nowMs;
  if (remaining <= 0) return EXPIRED;

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    expired: false,
  };
}

/**
 * The soonest still-future sale end across the rail, falling back to a fixed
 * window. Never returns Infinity — the caller renders this directly.
 */
export function earliestSaleEnd(products: RawProduct[] | undefined | null, nowMs: number): number {
  const ends: number[] = [];

  for (const product of Array.isArray(products) ? products : []) {
    const entries = Array.isArray(product?.availableAt) ? product.availableAt : [];
    for (const raw of entries) {
      const entry = raw as { isOnSale?: unknown; saleEndDate?: unknown } | null;
      if (!entry?.isOnSale || typeof entry.saleEndDate !== 'string') continue;

      const parsed = Date.parse(entry.saleEndDate);
      if (Number.isFinite(parsed) && parsed > nowMs) ends.push(parsed);
    }
  }

  return ends.length ? Math.min(...ends) : nowMs + FALLBACK_SALE_WINDOW_MS;
}
