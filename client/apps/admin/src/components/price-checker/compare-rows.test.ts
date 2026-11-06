import { describe, expect, it } from 'vitest';
import type { KioskProduct } from './types';
import { decisionHeadline, rowsFor } from './compare-rows';

const bottle = (overrides: Partial<KioskProduct>): KioskProduct => ({
  name: 'X',
  price: 0,
  currency: 'NGN',
  alcoholic: false,
  taxLabel: '',
  ...overrides,
});

describe('comparison rows and decision headline', () => {
  it('marks rows shared only when every bottle defines the same value', () => {
    const rows = rowsFor([
      bottle({ name: 'A', price: 100, size: '70cl', abv: 40, beverageType: 'spirit' }),
      bottle({
        name: 'B',
        price: 150,
        size: '70cl',
        abv: 40,
        beverageType: 'spirit',
        origin: 'Scotland',
      }),
    ]);
    const shared = rows.filter((row) => row.shared).map((row) => row.label);
    expect(shared).toContain('Size');
    expect(shared).toContain('Type');
    expect(shared).toContain('ABV');
    expect(shared).not.toContain('Origin');
  });
  it('headline leads with shared attributes and closes with the price spread', () => {
    const headline = decisionHeadline(
      [
        bottle({ name: 'A', price: 42000, size: '70cl', beverageType: 'spirit' }),
        bottle({ name: 'B', price: 57000, size: '70cl', beverageType: 'spirit' }),
      ],
      'NGN'
    );
    expect(headline).toBe(
      'Both bottles share 70cl · Spirit · Non-alcoholic. Main difference: price (₦15,000).'
    );
  });
  it('falls back to size/brand differences and returns null when everything is shared', () => {
    const brandSplit = decisionHeadline(
      [
        bottle({ name: 'A', price: 5000, size: '70cl', brand: 'Guinness' }),
        bottle({ name: 'B', price: 5000, size: '70cl', brand: 'Heineken' }),
      ],
      'NGN'
    );
    expect(brandSplit).toBe(
      'Both bottles share 70cl · Non-alcoholic. Main difference: brand (Guinness vs Heineken).'
    );
    const identical = decisionHeadline(
      [bottle({ name: 'A', price: 1000 }), bottle({ name: 'B', price: 1000 })],
      'NGN'
    );
    expect(identical).toBeNull();
    expect(decisionHeadline([bottle({ name: 'A', price: 1000 })], 'NGN')).toBeNull();
  });
});
