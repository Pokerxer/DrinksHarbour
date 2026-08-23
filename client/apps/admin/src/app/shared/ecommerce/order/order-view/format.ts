import type { Order } from '@/services/order.service';

export function formatCurrency(amount?: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount as number) ? (amount as number) : 0);
}

/** Orders coming from older imports or POS holds can be missing timestamps —
 *  `new Date(undefined)` renders as "Invalid Date" if passed through blindly. */
export function parseDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function shortDate(iso?: string | null) {
  const d = parseDate(iso);
  if (!d) return null;
  return `${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`;
}

export function longDate(iso?: string | null) {
  const d = parseDate(iso);
  if (!d) return null;
  return d.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function humanize(v?: string) {
  return (v ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Timestamp keys on Order that the lifecycle UI reads. Exists so components
 *  never need `(order as any)[key]`. */
export type OrderTimestampKey = NonNullable<
  {
    [K in keyof Order]: Order[K] extends string | undefined ? K : never;
  }[keyof Order]
>;
