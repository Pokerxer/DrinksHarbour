import type { Order } from '@/services/order.service';

/** Order-level gift block captured at checkout. Contract per
 *  docs/superpowers/specs/2026-10-27-gift-checkout-design.md — the subdoc is
 *  persisted on the order only when `isGift` is true. Typed here (not in
 *  order.service) so the admin order surfaces own the contract until the
 *  shared type is widened. */
export interface OrderGift {
  isGift: true;
  from: string; // trim, 1..80 — validated server-side
  to: string; // trim, 1..80
  message?: string; // gift note, 0..500; customer content — never interpreted as HTML
  /** 'YYYY-MM-DD', >= tomorrow (Africa/Lagos), <= +180 days */
  requestedDeliveryDate: string;
  packagingRequested?: boolean;
}

/** Reads the gift subdoc from an order, or null when the order is not a gift
 *  (or the subdoc is malformed). */
export function getGift(order: Order): OrderGift | null {
  const gift = (order as Order & { gift?: OrderGift }).gift;
  return gift?.isGift ? gift : null;
}

/**
 * Formats the customer's *requested* delivery date for staff display.
 *
 * Parsed from its 'YYYY-MM-DD' parts — never via `new Date(ymd)`, which reads
 * the string as UTC midnight and can shift the day when rendered in a local
 * timezone. Staff copy must always reinforce that this is a request to
 * confirm, never a guaranteed date.
 */
export function formatRequestedDeliveryDate(
  ymd: string,
  opts?: { short?: boolean }
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: opts?.short ? 'short' : 'long',
    year: 'numeric',
  });
}
