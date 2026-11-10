import type { KioskProduct } from './types';

const round2 = (value: number) => Math.round(value * 100) / 100;

export function pricePerMl(price: number, volumeMl?: number): number | null {
  if (!volumeMl || volumeMl <= 0) return null;
  return round2(price / volumeMl);
}

/** 25ml units of pure alcohol (a standard spirits drink). */
export function drinks(volumeMl?: number, abv?: number, unitMl = 25): number | null {
  if (!volumeMl || volumeMl <= 0 || abv === undefined || abv <= 0) return null;
  return Math.floor((volumeMl * (abv / 100)) / unitMl);
}

export function pricePerDrink(price: number, volumeMl?: number, abv?: number): number | null {
  const count = drinks(volumeMl, abv);
  return count ? round2(price / count) : null;
}

/**
 * Ordinal ranks (0 = best): by price per ml when the whole tray of
 * IN-STOCK bottles has volumes, otherwise by raw price. Out-of-stock
 * bottles are never ranked (Infinity) so no badge or decoration lands on
 * them. ranks[i] is the rank of products[i].
 */
export function bestValueRank(products: KioskProduct[]): number[] {
  const inStock = products.filter(
    (product) => product.availability !== 'OUT_OF_STOCK'
  );
  const byPerMl =
    inStock.length > 0 &&
    inStock.every((p) => typeof p.volumeMl === 'number' && p.volumeMl > 0);
  const key = (product: KioskProduct) =>
    byPerMl ? (product.price as number) / (product.volumeMl as number) : product.price;
  const rankOf = new Map<number, number>();
  inStock
    .map((product) => ({ product, key: key(product) }))
    .sort((a, b) => a.key - b.key)
    .forEach((entry, rank) => {
      rankOf.set(products.indexOf(entry.product), rank);
    });
  return products.map((_, index) => rankOf.get(index) ?? Number.POSITIVE_INFINITY);
}

/**
 * Relative value per bottle for the compare cards' bars: 0 → 1 normalized
 * against the most expensive in-stock bottle (shortest bar = cheapest).
 * Metric is per-ml when every in-stock bottle has a volume; else raw price.
 * Out-of-stock bottles get null (no bar).
 */
export function valueRatios(products: KioskProduct[]): (number | null)[] {
  const inStock = products.filter(
    (product) => product.availability !== 'OUT_OF_STOCK' && typeof product.price === 'number'
  );
  if (!inStock.length) return products.map(() => null);
  const byPerMl = inStock.every(
    (p) => typeof p.volumeMl === 'number' && p.volumeMl > 0
  );
  const metric = (product: KioskProduct) =>
    byPerMl ? (product.price as number) / (product.volumeMl as number) : product.price;
  const max = Math.max(...inStock.map(metric));
  return products.map((product) => {
    if (product.availability === 'OUT_OF_STOCK') return null;
    return round2(Math.min(1, round2(metric(product)) / max));
  });
}

export function typeLabel(type?: string): string | undefined {
  if (!type) return undefined;
  return type
    .split('-')
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        : part.toLowerCase()
    )
    .join(' ');
}
