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

// Live regression: /shop?category=scotch rendered
// "Buy Scotch Whisky Online | DrinksHarbour | DrinksHarbour" because the shop
// route appended ` | ${SITE}` to the category's stored metaTitle, which already
// ended in it. The listing routes now route that value through buildPageTitle.
test('regression: a category metaTitle carrying the site name yields one suffix', () => {
  const storedMetaTitle = 'Buy Scotch Whisky Online | DrinksHarbour';
  const title = buildPageTitle(storedMetaTitle, SITE);
  assert.equal(title, 'Buy Scotch Whisky Online | DrinksHarbour');
  assert.equal(title.match(/DrinksHarbour/g).length, 1, 'site name must appear exactly once');
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

// Live regression: /brands/dalmore rendered
// "Dalmore — Buy Dalmore Drinks Online in | DrinksHarbour". The word-boundary
// trim landed just past "in", and stripping trailing separators left the
// preposition dangling. A truncated title must end on a word that can end a
// phrase.
test('regression: truncating never leaves a dangling preposition', () => {
  const cases = [
    ['Dalmore — Buy Dalmore Drinks Online in Nigeria', 'Dalmore — Buy Dalmore Drinks Online'],
    ['Coca-Cola — Buy Coca-Cola Drinks Online in Nigeria', 'Coca-Cola — Buy Coca-Cola Drinks Online'],
    ['Absolut Vodka | Premium Swedish Vodka in Nigeria', 'Absolut Vodka | Premium Swedish Vodka'],
  ];
  for (const [stored, expected] of cases) {
    assert.equal(capSeoTitle(stored, SITE), expected);
  }
});

test('a stop word is kept when the title fits the budget', () => {
  // No truncation happened, so the author's phrasing is left exactly as-is.
  assert.equal(capSeoTitle('Best Gin to Buy in', SITE), 'Best Gin to Buy in');
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
