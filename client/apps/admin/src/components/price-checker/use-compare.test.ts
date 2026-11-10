import { describe, expect, it } from 'vitest';
import type { KioskProduct } from './types';
import {
  MAX_COMPARE_ITEMS,
  addCompareItem,
  compareKey,
  removeCompareItem,
  replaceByKey,
  replaceOldest,
} from './use-compare';

const bottle = (barcode: string, price = 10): KioskProduct => ({
  name: `Bottle ${barcode}`,
  price,
  currency: 'NGN',
  alcoholic: false,
  taxLabel: '',
  barcode,
});
const item = bottle('416000123456', 5);
const full = [bottle('1'), bottle('2'), bottle('3'), bottle('4')];

describe('compare tray helpers', () => {
  it('limits the tray to four bottles', () => {
    expect(MAX_COMPARE_ITEMS).toBe(4);
  });
  it('adds unique bottles and ignores duplicates', () => {
    expect(compareKey(item)).toBe('416000123456');
    expect(addCompareItem([], item)).toEqual([item]);
    expect(addCompareItem([item], { ...item, price: 12 })).toEqual([item]);
    expect(addCompareItem(full, bottle('5'))).toHaveLength(4);
    expect(addCompareItem([bottle('1'), bottle('2')], bottle('5'))).toHaveLength(3);
  });
  it('borrows a name/size key when the product has no barcode', () => {
    const noBarcode = { ...item, barcode: undefined };
    expect(compareKey(noBarcode)).toBe('Bottle 416000123456|');
  });
  it('removes by compare key', () => {
    expect(removeCompareItem([item], '416000123456')).toEqual([]);
    expect(removeCompareItem([item], 'other')).toEqual([item]);
  });
});

import { replaceByKey, replaceOldest } from './use-compare';

describe('swap helpers', () => {
  it('replaceOldest drops the first-held bottle and keeps the rest in order', () => {
    const held = [bottle('1'), bottle('2'), bottle('3')];
    const out = replaceOldest(held, bottle('5', 15));
    expect(out.map((row) => row.barcode)).toEqual(['2', '3', '5']);
  });
  it('replaceByKey swaps in place, preserving order', () => {
    const held = [bottle('1'), bottle('2'), bottle('3')];
    const out = replaceByKey(held, bottle('9', 19), '2');
    expect(out.map((row) => row.barcode)).toEqual(['1', '9', '3']);
  });
  it('replaceByKey leaves the tray untouched when the key is unknown', () => {
    const held = [bottle('1'), bottle('2')];
    expect(replaceByKey(held, bottle('2', 12), 'nope')).toEqual(held);
  });
});
