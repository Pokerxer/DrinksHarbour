// Run with:  node --experimental-strip-types --test src/lib/seoTitle.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildPageTitle, capSeoTitle, stripSiteSuffix } from './seoTitle.ts';

const SITE = 'DrinksHarbour';

test('leaves a short title untouched', () => {
  assert.equal(capSeoTitle('Champagne', SITE), 'Champagne');
});

test('regression: a stored metaTitle ending in the site name no longer doubles the separator', () => {
  // Live value on /categories/champagne — 50 chars, over the 45-char budget.
  const stored = 'Premium French Champagne in Nigeria | DrinksHarbour';
  assert.equal(
    buildPageTitle(stored, SITE),
    'Premium French Champagne in Nigeria | DrinksHarbour',
  );
});

test('regression: truncating mid-suffix never leaves a dangling pipe', () => {
  // Live value on /product/glenfiddich-18-years-old — 46 chars.
  const stored = 'Glenfiddich 18 Years Old Single Malt | Premium';
  const title = buildPageTitle(stored, SITE);
  assert.equal(title, 'Glenfiddich 18 Years Old Single Malt | DrinksHarbour');
  assert.ok(!/\|\s*\|/.test(title), 'title must not contain a doubled pipe');
});

test('trims to a word boundary within the SERP budget', () => {
  const stored = 'Buy Authentic Single Malt Scotch Whisky Online in Nigeria Today';
  const capped = capSeoTitle(stored, SITE);
  assert.ok(capped.length <= 45, `expected <= 45 chars, got ${capped.length}`);
  assert.ok(stored.startsWith(capped), 'capped title must be a prefix of the original');
  assert.ok(!/\s$/.test(capped), 'capped title must not end in whitespace');
});

test('strips the site suffix regardless of separator or casing', () => {
  assert.equal(stripSiteSuffix('Red Wine | DrinksHarbour', SITE), 'Red Wine');
  assert.equal(stripSiteSuffix('Red Wine — drinksharbour', SITE), 'Red Wine');
  assert.equal(stripSiteSuffix('Red Wine - DrinksHarbour', SITE), 'Red Wine');
});

test('keeps a site name that is part of the title itself', () => {
  assert.equal(
    stripSiteSuffix('DrinksHarbour Gift Cards', SITE),
    'DrinksHarbour Gift Cards',
  );
});

test('never ends on a separator after trimming', () => {
  for (const stored of [
    'Buy Premium Irish Whiskey Online in Nigeria | Fast Delivery',
    'Shop Rosé Wine in Abuja — Chilled and Delivered Same Day',
    'Tequila, Mezcal and Agave Spirits, Delivered Across Nigeria',
  ]) {
    const capped = capSeoTitle(stored, SITE);
    assert.ok(!/[|·•/,:–—\s-]$/.test(capped), `"${capped}" ends on a separator`);
  }
});
