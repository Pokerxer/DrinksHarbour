// The shop list (`GET /api/products` → getAllProducts) must quote the same
// price as the product page it links to.
//
// getAllProducts runs its own copy of the platform pricing pipeline, and its
// Size $project asked for a NARROWER set of fields than the arithmetic a few
// lines below it reads: `platformMarkupOverridePct`, the per-size platform
// markup, was never requested. Missing, it falls back to the product-level
// markup AND re-enables the undercut clamp in calcPlatformSellingPrice (which
// is deliberately skipped when an override is set). 463 of 1023 live sizes
// carry one, and 36 of 59 products on the first page disagreed with their own
// product page because of it.
//
// A projection that omits a field is silent: `size?.platformMarkupOverridePct
// ?? null` looks deliberate and reads as "no override" for every product.
//
// Observed on production before the fix, laphroaig-four-oak: the list said
// ₦194,900 and the product page said ₦194,100.
//
// Same bug, same shape as relatedProductsPricing.test.js — these tests drive
// the REAL aggregation pipeline the service builds: the aggregate mock applies
// the pipeline's own $project to the fixture size, so a field the pipeline
// never asks for never reaches the pricing math, exactly as Mongo does.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Flavor = require('../models/Flavor');
const productService = require('../services/product.service');

// The live numbers from laphroaig-four-oak: cost 150,000 × the tenant's 15%
// markup = a platform cost of 172,500, and an override of 12.4638% puts the
// shelf price on ₦194,100.
const COST_PRICE = 150000;
const SELLING_PRICE = 195000;
const OVERRIDE_PCT = 12.4638;
const PRICE_WITH_OVERRIDE = 194100;
const PRICE_WITHOUT_OVERRIDE = 194900; // 198,400 clamped to just under the store price

/** Find the `sizes` $lookup's $project inside the pipeline the service built. */
const sizeProjection = (pipeline) => {
  const subLookup = pipeline.find(s => s.$lookup?.as === 'subProducts');
  assert.ok(subLookup, 'expected a subProducts $lookup');
  const sizeLookup = subLookup.$lookup.pipeline.find(s => s.$lookup?.as === 'sizes');
  assert.ok(sizeLookup, 'expected a sizes $lookup');
  const project = sizeLookup.$lookup.pipeline.find(s => s.$project);
  assert.ok(project, 'expected a $project on the sizes lookup');
  return project.$project;
};

/**
 * Stub the collections getAvailableFilters reads (it runs after the price
 * mapping and would otherwise sit on mongoose's buffering timeout).
 */
const stubFilterSources = (t) => {
  t.mock.method(Product, 'distinct', async () => []);
  for (const Model of [Category, Brand, Flavor]) {
    t.mock.method(Model, 'find', () => ({ lean: async () => [] }));
  }
};

/**
 * Run getAllProducts against a single size, with Mongo's projection semantics
 * honoured: only the fields the pipeline asks for come back.
 */
const listPricingFor = async (t, size, { tenant = {}, subProduct = {}, product = {}, queryParams = {} } = {}) => {
  let projection = null;
  let call = 0;

  stubFilterSources(t);
  t.mock.method(Product, 'countDocuments', async () => 1);
  t.mock.method(Product, 'aggregate', async (pipeline) => {
    // getAvailableFilters aggregates again after the price mapping.
    if (call++ > 0) return [];

    projection = sizeProjection(pipeline);
    const projected = { _id: size._id };
    for (const key of Object.keys(projection)) {
      if (key !== '_id' && key in size) projected[key] = size[key];
    }
    return [{
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Whisky',
      slug: 'test-whisky',
      images: [],
      platformMarkup: 15,
      platformDiscount: null,
      createdAt: new Date(),
      ...product,
      // The pipeline renames the subProducts $lookup to activeSubProducts via
      // $addFields; the price mapping reads that name and nothing else.
      activeSubProducts: [{
        _id: new mongoose.Types.ObjectId(),
        sku: 'SP-1',
        costPrice: COST_PRICE,
        sizes: [projected],
        tenant: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Wyn City',
          slug: 'wyn-city',
          revenueModel: 'markup',
          markupPercentage: 15,
          commissionPercentage: 0,
          defaultCurrency: 'NGN',
          ...tenant,
        },
        ...subProduct,
      }],
    }];
  });

  const result = await productService.getAllProducts({ page: 1, limit: 20, ...queryParams });
  const listed = result.products[0];
  assert.ok(listed, 'expected one listed product');
  return { listed, projection, pricing: listed.availableAt[0].sizes[0].pricing };
};

const baseSize = (extra = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  size: '70cl',
  volumeMl: 700,
  sellingPrice: SELLING_PRICE,
  costPrice: COST_PRICE,
  currency: 'NGN',
  stock: 10,
  availableStock: 10,
  availability: 'available',
  sku: 'SZ-1',
  isDefault: true,
  ...extra,
});

test("a size's platform markup override reaches the shop list's price", async (t) => {
  const { pricing } = await listPricingFor(t, baseSize({ platformMarkupOverridePct: OVERRIDE_PCT }));

  assert.equal(pricing.websitePrice, PRICE_WITH_OVERRIDE);
  assert.notEqual(
    pricing.websitePrice,
    PRICE_WITHOUT_OVERRIDE,
    'the override was dropped, so the undercut clamp fired and undercut the product page',
  );
});

test('the shop list asks for every size field its own pricing math reads', async (t) => {
  const { projection } = await listPricingFor(t, baseSize());

  // Consumed by getAllProducts' size mapping. A field missing here is silent —
  // it just reads as "not set" for the whole catalogue.
  for (const field of [
    'size', 'displayName', 'volumeMl', 'sellingPrice', 'costPrice',
    'wholesalePrice', 'platformMarkupOverridePct', 'compareAtPrice',
    'currency', 'stock', 'availableStock', 'availability',
    'sku', 'isDefault',
  ]) {
    assert.equal(projection[field], 1, `sizes $project must request ${field}`);
  }
});

test('a size with no override still gets the product-level markup and clamp', async (t) => {
  const { pricing } = await listPricingFor(t, baseSize());

  assert.equal(pricing.websitePrice, PRICE_WITHOUT_OVERRIDE);
  assert.equal(pricing.platformCostPrice, 172500);
});

test("a size's wholesale price is still the platform cost basis in the list", async (t) => {
  // Wholesale 20,000 → platform cost 23,000 → ₦26,500. Without it the basis is
  // costPrice 30,000 → ₦39,700. Neither trips the undercut clamp at 40,000.
  const { pricing } = await listPricingFor(t, baseSize({
    costPrice: 30000,
    sellingPrice: 40000,
    wholesalePrice: 20000,
  }));

  assert.equal(pricing.websitePrice, 26500);
  assert.notEqual(pricing.websitePrice, 39700, 'the wholesale rate was dropped');
});
