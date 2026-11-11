import { expect, it } from 'vitest';
import { suggestBottles } from './suggestions';
import type { OfflineProduct } from './offline';

const bottle = (barcode: string, data: Partial<OfflineProduct> = {}): OfflineProduct => ({
  name: `Wine ${barcode}`, barcode, price: 1000, currency: 'NGN',
  alcoholic: true, taxLabel: '', suggestible: true, ...data,
});

it('uses branch availability, taxonomy, grape, brand and retail-price proximity', () => {
  const scan = bottle('0', {
    category: 'Red wine', subCategory: 'Dry reds', grapeVarieties: ['Merlot'], brand: 'Estate',
  });
  const catalogue = [
    bottle('1', { category: 'White wine', price: 1001 }),
    bottle('2', { category: 'Red wine', subCategory: 'Dry reds', price: 1050, grapeVarieties: ['Merlot'] }),
    bottle('3', { category: 'Red wine', subCategory: 'Dry reds', price: 1100, brand: 'Estate', grapeVarieties: ['Merlot'] }),
    bottle('4', { category: 'Red wine', subCategory: 'Dry reds', price: 1000, suggestible: false }),
    bottle('5', { category: 'Red wine', subCategory: 'Dry reds', price: 1020, grapeVarieties: ['Merlot'] }),
    scan,
  ];
  expect(suggestBottles(scan, catalogue).map((item) => item.barcode)).toEqual(['3', '5', '2']);
});

it('falls back to the same beverage type and nearby prices when taxonomy is missing', () => {
  const scan = bottle('0', { beverageType: 'spirit' });
  expect(suggestBottles(scan, [
    bottle('1', { beverageType: 'beer', price: 1001 }),
    bottle('2', { beverageType: 'spirit', price: 1100 }),
    bottle('3', { beverageType: 'spirit', price: 1020 }),
  ]).map((item) => item.barcode)).toEqual(['3', '2']);
});
