// server/__tests__/productSlugs.sellable.test.js
//
// Regression: GET /api/products/slugs feeds the platform sitemap. It used to
// match on `{ status: 'approved' }` alone while the product detail page
// (getProductBySlug) additionally requires isPublished, an approved+subscribed
// tenant, and at least one available size. Eleven live URLs were advertised to
// Google and served 404s. These tests pin the bulk query to the same gates.
const test = require('node:test');
const assert = require('node:assert');

const Product = require('../models/Product');
const productService = require('../services/product.service');

/** Run getSellableProductSlugs with aggregate stubbed; return the pipeline. */
async function capturePipeline() {
  const original = Product.aggregate;
  let captured;
  Product.aggregate = (pipeline) => {
    captured = pipeline;
    return Promise.resolve([]);
  };
  try {
    await productService.getSellableProductSlugs();
  } finally {
    Product.aggregate = original;
  }
  return captured;
}

/** Depth-first search for the first object carrying `key`. */
function findStage(node, key) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findStage(item, key);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    if (Object.prototype.hasOwnProperty.call(node, key)) return node;
    for (const value of Object.values(node)) {
      const hit = findStage(value, key);
      if (hit) return hit;
    }
  }
  return null;
}

/** Depth-first search for the `$lookup` stage whose results land in `alias`. */
function findLookupAs(node, alias) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findLookupAs(item, alias);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    if (node.$lookup && node.$lookup.as === alias) return node.$lookup;
    for (const value of Object.values(node)) {
      const hit = findLookupAs(value, alias);
      if (hit) return hit;
    }
  }
  return null;
}

test('gates on product status AND isPublished, not status alone', async () => {
  const pipeline = await capturePipeline();
  const match = pipeline[0].$match;
  assert.equal(match.status, 'approved');
  assert.equal(
    match.isPublished,
    true,
    'unpublished products render 404 — they must not reach the sitemap',
  );
});

test('requires a tenant that is approved and actively subscribed', async () => {
  const pipeline = await capturePipeline();
  const tenantLookup = findLookupAs(pipeline, 'sellingTenant');
  assert.ok(tenantLookup, 'expected a tenant lookup aliased sellingTenant');
  assert.equal(tenantLookup.from, 'tenants');

  const tenantMatch = findStage(tenantLookup.pipeline, 'subscriptionStatus');
  assert.equal(tenantMatch.status, 'approved');
  assert.deepStrictEqual(tenantMatch.subscriptionStatus, {
    $in: ['active', 'trialing'],
  });
});

test('requires at least one active, available size', async () => {
  const pipeline = await capturePipeline();
  const sizeLookup = findLookupAs(pipeline, 'sellableSizes');
  assert.ok(sizeLookup, 'expected a size lookup aliased sellableSizes');
  assert.equal(sizeLookup.from, 'sizes');

  const sizeMatch = findStage(sizeLookup.pipeline, 'availability');
  assert.equal(sizeMatch.status, 'active');
  assert.deepStrictEqual(sizeMatch.availability, {
    $in: ['available', 'in_stock', 'low_stock', 'pre_order', 'limited_stock'],
  });
});

test('drops products with no qualifying listing', async () => {
  const pipeline = await capturePipeline();
  const final = pipeline.filter((s) => s.$match && s.$match.sellable);
  assert.equal(final.length, 1, 'expected exactly one sellable gate');
  assert.deepStrictEqual(final[0].$match.sellable, { $ne: [] });
});

test('returns only the fields the sitemap needs', async () => {
  const pipeline = await capturePipeline();
  const projections = pipeline.filter((s) => s.$project);
  const last = projections[projections.length - 1].$project;
  assert.deepStrictEqual(last, { _id: 0, slug: 1, updatedAt: 1 });
});
