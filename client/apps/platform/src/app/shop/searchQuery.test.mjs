// Run with:  node --experimental-strip-types --test src/app/shop/searchQuery.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildShopSearchParams,
  parseProductsResponse,
  parseShopPage,
  shopPageHref,
  SHOP_PAGE_SIZE,
  SHOP_WORKING_SET,
} from './searchQuery.ts';

const sp = (qs) => new URLSearchParams(qs);

// ── buildShopSearchParams ────────────────────────────────────────────────────

test('defaults to the full working set, as the client background fetch needs', () => {
  assert.equal(buildShopSearchParams(sp('')).get('limit'), String(SHOP_WORKING_SET));
});

test('an explicit limit wins — the server seeds one grid page only', () => {
  const p = buildShopSearchParams(sp(''), { limit: SHOP_PAGE_SIZE });
  assert.equal(p.get('limit'), '24');
});

test('page 1 is left implicit so page-1 and no-page URLs share a cache entry', () => {
  assert.equal(buildShopSearchParams(sp(''), { page: 1 }).get('page'), null);
});

test('page > 1 is passed through to the API', () => {
  const p = buildShopSearchParams(sp(''), { limit: SHOP_PAGE_SIZE, page: 3 });
  assert.equal(p.get('page'), '3');
  assert.equal(p.get('limit'), '24');
});

test('filters still translate to the API param names', () => {
  const p = buildShopSearchParams(sp('search=ardbeg&category=whisky&subcategory=scotch&brand=Ardbeg&sort=newest'));
  assert.equal(p.get('q'), 'ardbeg');
  assert.equal(p.get('category'), 'whisky');
  assert.equal(p.get('subCategory'), 'scotch');
  assert.equal(p.get('brand'), 'Ardbeg');
  assert.equal(p.get('sort'), 'newest');
});

test('every shop request opts into the grid-card projection', () => {
  assert.equal(buildShopSearchParams(sp('')).get('fields'), 'card');
  assert.equal(buildShopSearchParams(sp('category=whisky'), { limit: 24, page: 2 }).get('fields'), 'card');
});

test('the paging options do not disturb the filter translation', () => {
  const bare = buildShopSearchParams(sp('category=whisky&origin=Scotland'));
  const paged = buildShopSearchParams(sp('category=whisky&origin=Scotland'), { limit: 24, page: 2 });
  bare.delete('limit');
  paged.delete('limit');
  paged.delete('page');
  assert.equal(bare.toString(), paged.toString());
});

// ── parseProductsResponse ────────────────────────────────────────────────────

test('reads the grand total from pagination.totalResults', () => {
  const r = parseProductsResponse({
    success: true,
    data: {
      products: [{ _id: '1' }, { _id: '2' }],
      pagination: { totalResults: 425, totalPages: 18 },
    },
  });
  assert.equal(r.total, 425);
  assert.equal(r.totalPages, 18);
  assert.equal(r.products.length, 2);
});

test('regression: the old code read pagination.total, which the API never sends', () => {
  // Guards the bug this replaced — the shop reported its page size as the
  // catalogue size, so "N products available" was whatever limit it had used.
  const r = parseProductsResponse({
    success: true,
    data: { products: [{ _id: '1' }], pagination: { total: 9999, totalResults: 425 } },
  });
  assert.equal(r.total, 425);
});

test('falls back to the received count when the API sends no pagination block', () => {
  const r = parseProductsResponse({ success: true, data: { products: [{ _id: '1' }, { _id: '2' }] } });
  assert.equal(r.total, 2);
  assert.equal(r.totalPages, 1);
});

test('handles the legacy data.data and bare-array shapes', () => {
  assert.equal(parseProductsResponse({ success: true, data: { data: [{}, {}] } }).total, 2);
  assert.equal(parseProductsResponse({ products: [{}, {}, {}] }).total, 3);
  assert.equal(parseProductsResponse([{}]).total, 1);
});

test('an unrecognised payload yields an empty, safe result', () => {
  const r = parseProductsResponse({ oops: true });
  assert.deepEqual(r, {
    products: [],
    total: 0,
    totalPages: 1,
    facetCounts: { brands: {}, origins: {}, categories: {}, subcategories: {}, flavors: {} },
  });
});

test('facet counts are lifted out of the API filters block', () => {
  const r = parseProductsResponse({
    success: true,
    data: {
      products: [],
      pagination: { totalResults: 425, totalPages: 18 },
      filters: { counts: { brands: { Ardbeg: 12 }, origins: { Scotland: 40 } } },
    },
  });
  assert.equal(r.facetCounts.brands.Ardbeg, 12);
  assert.equal(r.facetCounts.origins.Scotland, 40);
  // Missing facets default to empty rather than undefined, so the sidebar's
  // Object.entries() never throws.
  assert.deepEqual(r.facetCounts.flavors, {});
});

test('an API with no counts yet degrades to empty facet counts, not a crash', () => {
  const r = parseProductsResponse({ success: true, data: { products: [{}], filters: {} } });
  assert.deepEqual(r.facetCounts.brands, {});
});

// ── parseShopPage ────────────────────────────────────────────────────────────

test('?page= parses to a 1-based page', () => {
  assert.equal(parseShopPage('3'), 3);
  assert.equal(parseShopPage('1'), 1);
});

test('junk, missing, zero and negative pages all mean page 1', () => {
  for (const v of [null, undefined, '', 'abc', '0', '-4', '1.5e9999']) {
    assert.equal(parseShopPage(v), 1, `expected page 1 for ${JSON.stringify(v)}`);
  }
});

// ── shopPageHref ─────────────────────────────────────────────────────────────

test('page 1 drops ?page= so it cannot compete with the bare /shop URL', () => {
  assert.equal(shopPageHref(sp('category=whisky'), 1), '/shop?category=whisky');
  assert.equal(shopPageHref(sp(''), 1), '/shop');
});

test('page 2+ carries every other filter along', () => {
  assert.equal(
    shopPageHref(sp('category=whisky&brand=Ardbeg'), 2),
    '/shop?category=whisky&brand=Ardbeg&page=2',
  );
});

test('an existing page param is replaced, not duplicated', () => {
  assert.equal(shopPageHref(sp('page=7&brand=Ardbeg'), 3), '/shop?page=3&brand=Ardbeg');
  assert.equal(shopPageHref(sp('page=7&brand=Ardbeg'), 1), '/shop?brand=Ardbeg');
});
