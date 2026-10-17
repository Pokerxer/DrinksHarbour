import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPrice } from './search-price.ts';
test('search shows the selected seller price and never treats a price range as a sale', () => {
  assert.deepEqual(searchPrice({ shoppingOffer: { price: 2500 }, priceRange: { min: 1000, max: 3000 } }), { price: 2500, original: undefined });
  assert.deepEqual(searchPrice({ priceRange: { min: 1000, max: 3000 } }), { price: 1000, original: undefined });
});
