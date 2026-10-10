import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProductInStock, isSizeInStock } from './productStock.ts';

test('available quantity zero overrides physical stock', () => {
  assert.equal(isProductInStock({ stockInfo: { totalStock: 12, availableStock: 0 } }), false);
  assert.equal(isSizeInStock({ stock: 12, availableStock: 0 }), false);
});
test('sold-out status overrides stale positive stock', () => {
  assert.equal(isProductInStock({ availability: { status: 'out_of_stock', totalStock: 12 } }), false);
  assert.equal(isSizeInStock({ stock: 12, availability: 'out_of_stock' }), false);
});
test('stock can come from tenant sizes or legacy product quantities', () => {
  assert.equal(isProductInStock({ availableAt: [{ sizes: [{ stock: 0 }, { stock: 3 }] }] }), true);
  assert.equal(isProductInStock({ quantity: 0 }), false);
  assert.equal(isProductInStock({ quantity: 3 }), true);
  assert.equal(isProductInStock({}), false);
});
