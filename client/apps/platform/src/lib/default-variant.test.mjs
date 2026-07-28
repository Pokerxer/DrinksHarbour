// Run with:  node --experimental-strip-types --test src/lib/default-variant.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  pickDefaultSizeFrom,
  pickDefaultVariant,
  isDefaultVariantInStock,
} from './default-variant.ts';

/** Shapes a product the way /api/products/slug/:slug returns it. */
const product = (sizes) => ({
  name: 'Test Whisky',
  status: 'approved',
  // The API returns availability as an OBJECT, never a bare string.
  availability: { status: 'in_stock', stockLevel: 'high', availableFrom: 1 },
  priceRange: { min: 5000, max: 9000 },
  availableAt: sizes ? [{ sizes }] : [],
});

test('picks the first in-stock size, not the first size', () => {
  const sizes = [
    { size: '20cl', stock: 0, pricing: { websitePrice: 5000 } },
    { size: '70cl', stock: 12, pricing: { websitePrice: 9000 } },
  ];
  assert.equal(pickDefaultSizeFrom(sizes).size, '70cl');
  assert.equal(pickDefaultVariant(product(sizes)).price, 9000);
});

test('falls back to the first size when every size is sold out', () => {
  const sizes = [
    { size: '20cl', stock: 0, pricing: { websitePrice: 5000 } },
    { size: '70cl', stock: 0, pricing: { websitePrice: 9000 } },
  ];
  assert.equal(pickDefaultSizeFrom(sizes).size, '20cl');
});

test('an in-stock default variant reports in stock', () => {
  assert.equal(
    isDefaultVariantInStock(product([{ size: '70cl', stock: 12 }])),
    true,
  );
});

test('a fully sold-out product reports out of stock', () => {
  assert.equal(
    isDefaultVariantInStock(product([{ size: '70cl', stock: 0 }])),
    false,
  );
});

// The bug this module now guards against: `product:availability` and the
// JSON-LD Offer advertised "in stock" for every variant-less product, because
// the old rule compared the availability OBJECT to the string "out_of_stock"
// (always true) and read `status`, which holds "approved", not stock state.
// The Detail component renders "✗ Out of Stock" here — there is no size to
// select — so the markup has to agree.
test('regression: a product with no vendor sizes reports out of stock', () => {
  const p = product(null);
  assert.equal(pickDefaultVariant(p), null);
  assert.notEqual(p.availability, 'out_of_stock', 'availability is an object, not a string');
  assert.equal(isDefaultVariantInStock(p), false);
});

test('regression: a vendor entry with an empty size list reports out of stock', () => {
  assert.equal(isDefaultVariantInStock(product([])), false);
});
