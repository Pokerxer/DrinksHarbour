'use strict';
// Regression for the DRI-5 sitemap leak (2026-11-10): GET /api/subcategories
// and /api/categories feed navigation chips AND the public platform sitemap's
// productCount gate. Their counts came from navigationCounts.js, which counted
// every approved product — so retail-kind-only subcategories (beauty-grooming,
// home-living, glassware) were advertised in the sitemap while their
// marketplace grids render empty (DRI-5 gates the marketplace itself). The
// service must now keep two flavors of count: marketplace-only (beverage-kind,
// the marketplaceWhereClause clause) for main-marketplace and sitemap callers,
// and the legacy all-product tally for tenant-storefront callers.
const test = require('node:test');
const assert = require('node:assert/strict');

const Product = require('../models/Product');
const c = require('../constants/catalogKind');
const { navigationCounts } = require('../services/navigationCounts');
const { createNavigationCountsCache } = require('../services/navigationCountsCache');

/** Stub Product.aggregate, capture every pipeline, return an array pass-through. */
function captureAggregates() {
  const pipelines = [];
  const original = Product.aggregate;
  Product.aggregate = (pipeline) => {
    pipelines.push(pipeline);
    return Promise.resolve([{ _id: 'sub1', count: 7 }]);
  };
  return {
    pipelines,
    restore() { Product.aggregate = original; },
  };
}

/** The fixture() store from navigationCountsCache.test.js. */
function fixture() {
  const entries = new Map();
  return createNavigationCountsCache({
    run: async fn => fn({
      get: async key => entries.get(key),
      set: async (key, value) => { entries.set(key, value); },
    }),
    isEnabled: () => true,
  });
}

test('marketplaceOnly flavor counts carry the DRI-5 beverage-only clause', async () => {
  const stub = captureAggregates();
  try {
    const counts = await navigationCounts('subCategory', { marketplaceOnly: true });
    assert.deepEqual(counts, { sub1: 7 });
    assert.equal(stub.pipelines.length, 1);
    assert.deepEqual(stub.pipelines[0][0].$match, {
      status: 'approved',
      subCategory: { $ne: null },
      ...c.marketplaceWhereClause(),
    });
  } finally { stub.restore(); }
});

test('default flavor keeps the legacy all-product tally (no kind clause)', async () => {
  const stub = captureAggregates();
  try {
    await navigationCounts('category');
    assert.equal(stub.pipelines.length, 1);
    assert.equal(JSON.stringify(stub.pipelines[0]).includes('catalogKind'), false);
  } finally { stub.restore(); }
});

test('flavors never share a memoized read — marketplace and legacy counts stay independent', async () => {
  const store = new Map();
  let loads = 0;
  const load = async () => ({ a: (loads += 1) });
  const cache = createNavigationCountsCache({
    run: async fn => fn({
      get: async key => store.get(key),
      set: async (key, value) => { store.set(key, value); },
    }),
    isEnabled: () => true,
  });
  const [marketplace, legacy] = await Promise.all([
    cache.read('category', load, '-marketplace'),
    cache.read('category', load),
  ]);
  assert.equal(marketplace.a, 1);
  assert.equal(legacy.a, 2);
});

test('cache round-trips a flavor separately from the unflavored key', async () => {
  const store = new Map();
  let loads = 0;
  const load = async () => ({ a: (loads += 1) });
  const cache = createNavigationCountsCache({
    run: async fn => fn({
      get: async key => store.get(key),
      set: async (key, value) => { store.set(key, value); },
    }),
    isEnabled: () => true,
  });
  const first = await cache.read('subCategory', load, '-marketplace');
  const second = await cache.read('subCategory', load, '-marketplace');
  assert.equal(first.a, 1);
  assert.equal(second.a, 1); // served from the '-marketplace' flavor, no re-load
});
