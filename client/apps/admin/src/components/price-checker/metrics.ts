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
export function bestValueRank(products: KioskProduct[]): number[] {
  const byPerMl =
    products.length > 1 &&
    products.every((p) => typeof p.volumeMl === 'number' && p.volumeMl > 0);
  const key = (product: KioskProduct) =>
    byPerMl ? (product.price as number) / (product.volumeMl as number) : product.price;
  const order: Record<number, number> = {};
  products
    .map((product, index) => ({ index, key: key(product) }))
    .sort((a, b) => a.key - b.key)
    .forEach((entry, rank) => {
      order[entry.index] = rank;
    });
  return products.map((_, index) => order[index]);
}
