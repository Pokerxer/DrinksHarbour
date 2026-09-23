import { expect, test } from 'vitest';
import { eligiblePricelists, kioskInput, kioskUrl } from './form-utils';
import type { Kiosk } from './types';
test('pricelist selection excludes other branches and incompatible currency', () => {
  const lists = [
    {
      _id: 'one',
      name: 'Here',
      currency: 'NGN',
      shops: ['retail'],
      warehouses: [],
      isDefault: false,
      isSelectable: false,
    },
    {
      _id: 'two',
      name: 'Other',
      currency: 'NGN',
      shops: ['other'],
      warehouses: [],
      isDefault: true,
      isSelectable: true,
    },
    {
      _id: 'three',
      name: 'Foreign',
      currency: 'USD',
      shops: [],
      warehouses: [],
      isDefault: true,
      isSelectable: true,
    },
  ];
  expect(eligiblePricelists(lists, 'retail', 'loc', 'NGN').map((p) => p._id)).toEqual(['one']);
});
test('edit payload never resubmits tenant or administrative metadata', () => {
  const input = kioskInput({
    _id: 'id',
    tenant: 'secret',
    version: 5,
    name: 'Kiosk',
    slug: 'counter',
    settings: {},
  } as unknown as Kiosk);
  expect(input).not.toHaveProperty('tenant');
  expect(input).not.toHaveProperty('_id');
  expect(input).not.toHaveProperty('version');
});
test('public links use admin origin and a separate kiosk namespace', () => {
  expect(kioskUrl('store-counter', 'https://admin.drinksharbour.com/')).toBe(
    'https://admin.drinksharbour.com/kiosk/price-checker/store-counter'
  );
});

test('older unscoped pricelists without binding arrays remain selectable', () => {
  const lists = [
    { _id: 'legacy', name: 'Retail', currency: 'NGN', isDefault: true },
  ] as import('./types').PricelistOption[];
  expect(eligiblePricelists(lists, 'retail', 'loc', 'NGN')).toHaveLength(1);
});

test('default kiosk links use the current admin browser origin', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost:3000' } },
  });
  try {
    expect(kioskUrl('store-counter')).toBe(
      'http://localhost:3000/kiosk/price-checker/store-counter'
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
