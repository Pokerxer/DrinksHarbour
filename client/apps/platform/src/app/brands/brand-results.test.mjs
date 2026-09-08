import test from 'node:test';
import assert from 'node:assert/strict';
import { displayableBrands } from './brand-results.ts';
test('Glenfiddich and Laphroaig remain visible with zero or missing cached counts', () => {
  const brands = [
    { name: 'Glenfiddich', slug: 'glenfiddich', productCount: 0 },
    { name: 'Laphroaig', slug: 'laphroaig' },
    { name: 'Other', slug: 'other', productCount: 2 },
  ];
  assert.deepEqual(displayableBrands(brands), brands);
});
test('records without a usable brand destination stay out of the grid', () => {
  assert.deepEqual(displayableBrands([{ name: 'Incomplete' }, { slug: 'incomplete' }]), []);
});
