import { describe, expect, it } from 'vitest';
import type { KioskProduct } from './types';
import { bestValueRank, drinks, pricePerDrink, pricePerMl, valueRatios, typeLabel } from './metrics';

const bottle = (overrides: Partial<KioskProduct>): KioskProduct => ({
  name: 'X',
  price: 0,
  currency: 'NGN',
  alcoholic: false,
  taxLabel: '',
  ...overrides,
});

describe('metrics', () => {
  it('price per ml rounds to cents and is null for missing volume', () => {
    expect(pricePerMl(5000, 700)).toBe(7.14);
    expect(pricePerMl(5000, 0)).toBeNull();
    expect(pricePerMl(5000)).toBeNull();
  });
  it('drink count uses 25ml units of pure alcohol', () => {
    expect(drinks(700, 40)).toBe(11);
    expect(drinks(700, 0)).toBeNull();
    expect(drinks(undefined, 40)).toBeNull();
  });
  it('price per drink divides price by drink count', () => {
    expect(pricePerDrink(4400, 700, 40)).toBe(400);
    expect(pricePerDrink(1000)).toBeNull();
  });
  it('best value ranks per ml only when every item has volume, else by price', () => {
    const volumed = [
      bottle({ price: 1000, volumeMl: 700 }),
      bottle({ price: 1500, volumeMl: 1000 }),
    ];
    // 1000/700 ≈ 1.43 per ml beats 1500/1000 = 1.5 per ml.
    expect(bestValueRank(volumed)).toEqual([0, 1]);
    const mixed = [bottle({ price: 1000, volumeMl: 700 }), bottle({ price: 900 })];
    expect(bestValueRank(mixed)).toEqual([1, 0]);
  });
  it('type labels humanize slugs', () => {
    expect(typeLabel('soft-drink')).toBe('Soft drink');
    expect(typeLabel(undefined)).toBeUndefined();
    expect(typeLabel('spirit')).toBe('Spirit');
  });
  it('valueRatios normalizes the tray value metric; OOS bottles excluded', () => {
    expect(valueRatios([bottle({ price: 1000, volumeMl: 700 }), bottle({ price: 500, volumeMl: 700 })]))
      .toEqual([1, 0.5]);
    // no volumes on every bottle → metric falls back to price
    expect(valueRatios([bottle({ price: 2000 }), bottle({ price: 1000 })])).toEqual([1, 0.5]);
    const oos = [
      bottle({ price: 1000, volumeMl: 700, availability: 'IN_STOCK' }),
      bottle({ price: 500, volumeMl: 700, availability: 'OUT_OF_STOCK' }),
    ];
    expect(valueRatios(oos)).toEqual([1, null]);
  });
  it('bestValueRank never crowns an out-of-stock bottle', () => {
    const tray = [
      bottle({ price: 500, availability: 'OUT_OF_STOCK' }),
      bottle({ price: 900, availability: 'IN_STOCK' }),
      bottle({ price: 400, availability: 'OUT_OF_STOCK' }),
    ];
    const ranks = bestValueRank(tray);
    expect(ranks[1]).toBe(0);
    expect(ranks[0]).toBe(Number.POSITIVE_INFINITY);
    expect(ranks[2]).toBe(Number.POSITIVE_INFINITY);
  });
});
