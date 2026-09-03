// The "You May Also Like" carousel must quote the same price as the product
// page it links to.
//
// enrichRelatedProducts runs its own copy of the platform pricing pipeline, and
// its Size $project asked for a NARROWER set of fields than the arithmetic a
// few lines below it reads:
//
//   - `platformMarkupOverridePct` — the per-size platform markup. Missing, it
//     falls back to the product-level markup AND re-enables the undercut clamp
//     in calcPlatformSellingPrice (which is deliberately skipped when an
//     override is set). 463 of 1023 live sizes carry one.
//   - `wholesalePrice` — the B2B rate that REPLACES costPrice as the platform
//     cost basis when it is set. 19 live sizes carry one.
//
// A projection that omits a field is silent: `size.wholesalePrice || 0` and
// `size.platformMarkupOverridePct ?? null` both look deliberate and both
// evaluate to the "not set" branch for every product.
//
// Observed on production before the fix, glenfiddich-12-years-old:
// the carousel said ₦56,200 and the product page said ₦59,100.
//
// These tests drive the REAL aggregation pipeline the service builds: the
// aggregate mock applies the pipeline's own $project to the fixture size, so a
// field the pipeline never asks for never reaches the pricing math — exactly
// what Mongo does.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const productService = require('../services/product.service');

// The live numbers from the product above: platform cost 48,394.58 × 1.15 =
// 55,653.77, and an override of 11.4031% puts the shelf price on ₦62,100.
const COST_PRICE = 48394.58;
const SELLING_PRICE = 59300;
const OVERRIDE_PCT = 11.4031;
const PRICE_WITH_OVERRIDE = 62100;
const PRICE_WITHOUT_OVERRIDE = 59200; // 64,100 clamped to just under the store price

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
 * Run enrichRelatedProducts against a size, with Mongo's projection semantics
 * honoured: only the fields the pipeline asks for come back.
 */
const cardPricingFor = async (t, size, { tenant = {}, subProduct = {}, product = {} } = {}) => {
  const productId = new mongoose.Types.ObjectId();
  let projection = null;

  t.mock.method(Product, 'aggregate', async (pipeline) => {
    projection = sizeProjection(pipeline);
    const projected = { _id: size._id };
    for (const key of Object.keys(projection)) {
      if (key !== '_id' && key in size) projected[key] = size[key];
    }
    return [{
      _id: productId,
      name: 'Test Whisky',
      slug: 'test-whisky',
      images: [],
      platformMarkup: 15,
      platformDiscount: null,
      ...product,
      subProducts: [{
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

  const [card] = await productService.enrichRelatedProducts([{ _id: productId }], false);
  assert.ok(card, 'expected one enriched card');
  return { card, projection, pricing: card.availableAt[0].sizes[0].pricing };
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

test("a size's platform markup override reaches the carousel's price", async (t) => {
  const { pricing } = await cardPricingFor(t, baseSize({ platformMarkupOverridePct: OVERRIDE_PCT }));

  assert.equal(pricing.websitePrice, PRICE_WITH_OVERRIDE);
  assert.notEqual(
    pricing.websitePrice,
    PRICE_WITHOUT_OVERRIDE,
    'the override was dropped, so the undercut clamp fired and undercut the shop',
  );
});

test("a size's wholesale price is the platform cost basis in the carousel too", async (t) => {
  // Wholesale 20,000 → platform cost 23,000 → ₦26,500. Without it the basis is
  // costPrice 30,000 → ₦39,700. Neither trips the undercut clamp at 40,000.
  const { pricing } = await cardPricingFor(t, baseSize({
    costPrice: 30000,
    sellingPrice: 40000,
    wholesalePrice: 20000,
  }));

  assert.equal(pricing.websitePrice, 26500);
  assert.notEqual(pricing.websitePrice, 39700, 'the wholesale rate was dropped');
});

test('the carousel asks for every size field its own pricing math reads', async (t) => {
  const { projection } = await cardPricingFor(t, baseSize());

  // Consumed by enrichRelatedProducts' size mapping. A field missing here is
  // silent — it just reads as "not set" for the whole catalogue.
  for (const field of [
    'size', 'displayName', 'volumeMl', 'sellingPrice', 'costPrice',
    'wholesalePrice', 'platformMarkupOverridePct', 'compareAtPrice',
    'currency', 'stock', 'availableStock', 'availability', 'discount',
    'sku', 'isDefault',
  ]) {
    assert.equal(projection[field], 1, `sizes $project must request ${field}`);
  }
});

test('a size with no override still gets the product-level markup and clamp', async (t) => {
  const { pricing } = await cardPricingFor(t, baseSize());

  assert.equal(pricing.websitePrice, PRICE_WITHOUT_OVERRIDE);
  assert.equal(pricing.platformCostPrice, 55653.77);
});
