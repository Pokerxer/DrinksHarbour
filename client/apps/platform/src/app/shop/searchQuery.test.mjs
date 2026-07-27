// Run with:  node --experimental-strip-types --test src/app/shop/searchQuery.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildShopSearchParams,
  parseProductsResponse,
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
  assert.deepEqual(r, { products: [], total: 0, totalPages: 1 });
});
