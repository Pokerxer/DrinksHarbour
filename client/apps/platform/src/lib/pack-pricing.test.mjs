// Run with:  node --experimental-strip-types --test src/lib/pack-pricing.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolvePackPricing } from './pack-pricing.ts';

/** A 6-pack offer at ₦9,000/unit against a ₦10,000 shelf price, 24 in stock. */
const offer = (overrides = {}) => ({
  packUnitPrice: 9000,
  packThreshold: 6,
  packSavingsPct: 10,
  unitPrice: 10000,
  quantity: 1,
  stock: 24,
  ...overrides,
});

test('offers the pack when stock covers a full pack', () => {
  const p = resolvePackPricing(offer());
  assert.equal(p.hasPackPricing, true);
  assert.equal(p.packRateActive, false);
  assert.equal(p.effectiveUnitPrice, 10000);
  assert.equal(p.effectiveTotal, 10000);
  assert.equal(p.thresholdRemaining, 5);
  assert.equal(p.totalSavings, 0);
});

test('applies the pack rate once quantity reaches the threshold', () => {
  const p = resolvePackPricing(offer({ quantity: 6 }));
  assert.equal(p.packRateActive, true);
  assert.equal(p.effectiveUnitPrice, 9000);
  assert.equal(p.effectiveTotal, 54000);
  assert.equal(p.thresholdRemaining, 0);
  assert.equal(p.totalSavings, 6000);
});

test('keeps the pack rate above the threshold', () => {
  const p = resolvePackPricing(offer({ quantity: 8 }));
  assert.equal(p.packRateActive, true);
  assert.equal(p.effectiveTotal, 72000);
  assert.equal(p.totalSavings, 8000);
});

test('hides the pack when stock is short of one full pack', () => {
  const p = resolvePackPricing(offer({ stock: 5, quantity: 5 }));
  assert.equal(p.hasPackPricing, false);
  assert.equal(p.packRateActive, false);
  assert.equal(p.effectiveUnitPrice, 10000);
  assert.equal(p.effectiveTotal, 50000);
  assert.equal(p.thresholdRemaining, 0);
});

test('hides the pack when the per-order cap is short of one full pack', () => {
  const p = resolvePackPricing(offer({ maxOrderQuantity: 4 }));
  assert.equal(p.hasPackPricing, false);
});

test('a cap at or above the threshold still offers the pack', () => {
  assert.equal(resolvePackPricing(offer({ maxOrderQuantity: 6 })).hasPackPricing, true);
});

test('stock exactly one pack still offers the pack', () => {
  assert.equal(resolvePackPricing(offer({ stock: 6 })).hasPackPricing, true);
});

test('never stacks a pack discount on top of a sale', () => {
  assert.equal(resolvePackPricing(offer({ onSale: true, quantity: 6 })).hasPackPricing, false);
  assert.equal(resolvePackPricing(offer({ onSale: true, quantity: 6 })).effectiveUnitPrice, 10000);
});

test('ignores a pack price that is not cheaper than the unit price', () => {
  assert.equal(resolvePackPricing(offer({ packUnitPrice: 10000 })).hasPackPricing, false);
  assert.equal(resolvePackPricing(offer({ packUnitPrice: 12000 })).hasPackPricing, false);
});

test('ignores missing or zero pack fields', () => {
  assert.equal(resolvePackPricing(offer({ packUnitPrice: null })).hasPackPricing, false);
  assert.equal(resolvePackPricing(offer({ packThreshold: null })).hasPackPricing, false);
  assert.equal(resolvePackPricing(offer({ packThreshold: 0 })).hasPackPricing, false);
});

test('unknown stock is not treated as zero stock', () => {
  const p = resolvePackPricing(offer({ stock: null, maxOrderQuantity: null }));
  assert.equal(p.hasPackPricing, true);
});

test('quantity below one is clamped to a single unit', () => {
  const p = resolvePackPricing(offer({ quantity: 0 }));
  assert.equal(p.effectiveTotal, 10000);
  assert.equal(p.thresholdRemaining, 5);
});

test('exposes the offer fields only when the offer stands', () => {
  assert.equal(resolvePackPricing(offer()).packThreshold, 6);
  assert.equal(resolvePackPricing(offer({ stock: 2 })).packThreshold, null);
  assert.equal(resolvePackPricing(offer({ stock: 2 })).packUnitPrice, null);
  assert.equal(resolvePackPricing(offer({ stock: 2 })).packSavingsPct, null);
});
