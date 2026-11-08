import { describe, expect, it } from 'vitest';
import type { KioskProduct } from './types';
import { compareSummary } from './session-summary';

const bottle = (name: string, price: number): KioskProduct => ({
  name,
  price,
  currency: 'NGN',
  alcoholic: false,
  taxLabel: '',
});

describe('compareSummary', () => {
  it('summarises the compared set with the best value and price band', () => {
    const summary = compareSummary([bottle('Glen Grant', 57000), bottle('Talisker', 38000), bottle('Highland Park', 71000)]);
    expect(summary).toEqual({
      count: 3,
      bestName: 'Talisker',
      bestPrice: 38000,
      from: 38000,
      to: 71000,
      saved: 33000,
    });
  });
  it('returns null for fewer than two bottles or empty input', () => {
    expect(compareSummary([])).toBeNull();
    expect(compareSummary([bottle('Solo', 1000)])).toBeNull();
  });
});
