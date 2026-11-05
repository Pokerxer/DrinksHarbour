import { describe, expect, it } from 'vitest';
import type { KioskProduct } from './types';
import { MAX_COMPARE_ITEMS, addCompareItem, compareKey, removeCompareItem } from './use-compare';

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
