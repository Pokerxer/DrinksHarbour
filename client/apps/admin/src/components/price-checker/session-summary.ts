import type { KioskProduct } from './types';

export interface CompareSummary {
  count: number;
  bestName: string;
  bestPrice: number;
  /** Price band across the compared set. */
  from: number;
  to: number;
  /** Spread between the priciest and the best-value bottle. */
  saved: number;
}

/** Pure summary of a just-compared set, shown as a one-line recap when the
 *  comparison closes. Null for anything shorter than two bottles. */
export function compareSummary(items: KioskProduct[]): CompareSummary | null {
  if (items.length < 2) return null;
  const best = items.reduce((low, next) => (next.price < low.price ? next : low));
  const to = items.reduce((high, next) => (next.price > high.price ? next : high));
  return {
    count: items.length,
    bestName: best.name,
    bestPrice: best.price,
    from: best.price,
    to: to.price,
    saved: to.price - best.price,
  };
}
