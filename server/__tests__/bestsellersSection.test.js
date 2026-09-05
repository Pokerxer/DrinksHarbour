// The "Best Sellers" tab of the storefront's RecommendedForYou section
// (`GET /api/products/bestsellers` → getBestsellers) was dead on arrival.
//
// Three defects, each silent in a different way:
//
//  1. `sales` was never declared. The card builder reads
//     `totalSold: sales[product._id.toString()]`, but unlike getNewArrivals and
//     getFeaturedProducts — which both do
//     `const [ratings, sales] = await Promise.all([...])` — getBestsellers only
//     ever awaited getProductsRatings. Every request threw a bare
//     `ReferenceError: sales is not defined` from inside the .map(), so the tab
//     returned a 500 and the section fell back to its "Nothing here yet" empty
//     state. Nothing in the section distinguished "endpoint is broken" from
//     "no bestsellers yet", which is why it stayed unnoticed.
//
//  2. The aggregation never looked up `category`, `subCategory`, `tags` or
//     `flavors`, yet the card builder projects all four. A $lookup that isn't
//     there is indistinguishable from an empty relation: every bestseller card
//     shipped `category: null` and `tags: []`, so category chips and flavour
//     filters were blank on this tab only.
//
//  3. `totalSold` was sourced from the (missing) bulk sales map rather than
//     from the `topSellers` aggregation that had ALREADY computed the exact
//     per-product figure used to rank them. The ranking number and the
//     displayed number came from two different queries — and assignProductBadge
//     keys the BEST SELLER badge off `product.totalSold`, which the card
//     builder passes as the pre-projection Mongo doc that never carries it. So
//     even once it returned rows, the Best Sellers tab could not award a Best
//     Seller badge.
//
// These tests drive the REAL aggregation pipeline the service builds, in the
// same style as productListPricing.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Tenant = require('../models/Tenant');
const Sales = require('../models/Sales');
const Review = require('../models/Review');
const productService = require('../services/product.service');

const COST_PRICE = 150000;
const SELLING_PRICE = 195000;

const productId = () => new mongoose.Types.ObjectId();

const baseSize = (extra = {}) => ({
  _id: productId(),
  size: '70cl',
  displayName: '70cl',
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

/** Find a $lookup by its `as` name in the top-level pipeline. */
const lookupFor = (pipeline, as) =>
  pipeline.find((stage) => stage.$lookup?.as === as);

/**
 * Run getBestsellers with Mongo stubbed out, returning the built pipeline and
 * the resulting cards.
 *
 * `topSellers` drives the Sales ranking aggregation; `products` are the docs
 * the Product aggregation returns.
 */
const runBestsellers = async (t, { topSellers, products, reviews = [] }) => {
  let pipeline = null;
  let rankPipeline = null;
  let salesCall = 0;

  t.mock.method(Sales, 'aggregate', async (p) => {
    // 1st call ranks the top sellers, 2nd counts the total for pagination.
    if (salesCall++ === 0) {
      rankPipeline = p;
      return topSellers;
    }
    return [{ total: topSellers.length }];
  });

  t.mock.method(Review, 'aggregate', async () => reviews);

  t.mock.method(Product, 'aggregate', async (builtPipeline) => {
    pipeline = builtPipeline;
    return products;
  });

  t.mock.method(Tenant, 'find', () => ({
    select: () => ({ lean: async () => [{
      _id: products[0]?.subProducts?.[0]?.tenant?._id ?? productId(),
      name: 'Wyn City',
      slug: 'wyn-city',
      revenueModel: 'markup',
      markupPercentage: 15,
      commissionPercentage: 0,
      defaultCurrency: 'NGN',
    }] }),
  }));

  const result = await productService.getBestsellers(1, 12);
  return { result, pipeline, rankPipeline };
};

/** A Product aggregation doc with one tenant, one size. */
const productDoc = (id, extra = {}) => {
  const tenantId = productId();
  return {
    _id: id,
    name: 'Test Whisky',
    slug: 'test-whisky',
    images: [],
    platformMarkup: 15,
    platformDiscount: null,
    createdAt: new Date('2020-01-01'),
    status: 'approved',
    ...extra,
    subProducts: [{
      _id: productId(),
      sku: 'SP-1',
      costPrice: COST_PRICE,
      sizes: [baseSize()],
      tenant: {
        _id: tenantId,
        name: 'Wyn City',
        slug: 'wyn-city',
        revenueModel: 'markup',
        markupPercentage: 15,
        commissionPercentage: 0,
        defaultCurrency: 'NGN',
      },
    }],
  };
};

test('the bestsellers endpoint returns cards instead of throwing', async (t) => {
  const id = productId();

  const { result } = await runBestsellers(t, {
    topSellers: [{ _id: id, totalSold: 42 }],
    products: [productDoc(id)],
  });

  // Before the fix this rejected with "ReferenceError: sales is not defined",
  // the controller's asyncHandler turned it into a 500, and the storefront
  // section rendered its empty state.
  assert.equal(result.products.length, 1, 'expected one bestseller card');
});

test('a card reports the same units sold that ranked it', async (t) => {
  const id = productId();

  const { result } = await runBestsellers(t, {
    topSellers: [{ _id: id, totalSold: 42 }],
    products: [productDoc(id)],
  });

  assert.equal(
    result.products[0].totalSold,
    42,
    'totalSold must come from the ranking aggregation, not a second query',
  );
});

test('a product that sold enough earns the BEST SELLER badge', async (t) => {
  const id = productId();

  // Stock must clear LIMITED_STOCK_MAX: that badge legitimately outranks
  // best_seller, and the default fixture's 10 units would win the tie.
  const doc = productDoc(id);
  doc.subProducts[0].sizes = [baseSize({ stock: 400, availableStock: 400 })];

  const { result } = await runBestsellers(t, {
    // Comfortably over BEST_SELLER_MIN_SOLD.
    topSellers: [{ _id: id, totalSold: 500 }],
    products: [doc],
  });

  assert.equal(
    result.products[0].badge?.type,
    'best_seller',
    'assignProductBadge reads product.totalSold — it must be set before the call',
  );
});

test('cards are ordered by units sold, descending', async (t) => {
  const [a, b, c] = [productId(), productId(), productId()];

  const { result } = await runBestsellers(t, {
    topSellers: [
      { _id: a, totalSold: 300 },
      { _id: b, totalSold: 200 },
      { _id: c, totalSold: 100 },
    ],
    // Mongo returns $in matches in arbitrary order — deliberately not sorted.
    products: [productDoc(c), productDoc(a), productDoc(b)],
  });

  assert.deepEqual(
    result.products.map((p) => p.totalSold),
    [300, 200, 100],
  );
});

test('the pipeline looks up every relation the card projects', async (t) => {
  const id = productId();

  const { pipeline } = await runBestsellers(t, {
    topSellers: [{ _id: id, totalSold: 42 }],
    products: [productDoc(id)],
  });

  // The card builder emits product.category / subCategory / tags / flavors. A
  // relation with no $lookup is silently null or [] on every card.
  for (const relation of ['brand', 'category', 'subCategory', 'tags', 'flavors']) {
    assert.ok(
      lookupFor(pipeline, relation),
      `bestsellers pipeline must $lookup ${relation}`,
    );
  }
});

test('each relation is looked up from the collection its ref actually lives in', async (t) => {
  const id = productId();

  const { pipeline } = await runBestsellers(t, {
    topSellers: [{ _id: id, totalSold: 42 }],
    products: [productDoc(id)],
  });

  // A $lookup naming the wrong collection is as silent as a missing one — it
  // just matches nothing. subCategory in particular refs the SubCategory model
  // (`subcategories`), NOT `categories`, which is easy to get wrong given the
  // adjacent category lookup.
  const expected = {
    brand: 'brands',
    category: 'categories',
    subCategory: 'subcategories',
    tags: 'tags',
    flavors: 'flavors',
  };

  for (const [relation, collection] of Object.entries(expected)) {
    assert.equal(
      lookupFor(pipeline, relation).$lookup.from,
      collection,
      `${relation} must be looked up from ${collection}`,
    );
  }
});

test('a looked-up category survives onto the card', async (t) => {
  const id = productId();
  const categoryId = productId();

  const { result } = await runBestsellers(t, {
    topSellers: [{ _id: id, totalSold: 42 }],
    products: [productDoc(id, {
      category: { _id: categoryId, name: 'Whisky', slug: 'whisky', type: 'spirit' },
      tags: [{ _id: productId(), name: 'peated', slug: 'peated' }],
    })],
  });

  assert.equal(result.products[0].category?.slug, 'whisky');
  assert.equal(result.products[0].tags.length, 1);
});

test('no sales at all yields an empty page, not an error', async (t) => {
  const { result } = await runBestsellers(t, {
    topSellers: [],
    products: [],
  });

  assert.deepEqual(result.products, []);
  assert.equal(result.pagination.total, 0);
});

// ── Ranking source ──────────────────────────────────────────────────────────
//
// The `sales` collection is written ONLY by tenant sales-order fulfillment
// (services/salesFulfill.service.js). Marketplace checkout on drinksharbour.com
// writes an Order and nothing else — Sales.channel even defines a
// 'main_website' value that no code path in the repo ever writes.
//
// On the live dataset that means: sales = 0 documents, orders = 453 (444
// delivered). So ranking off `sales` alone returned an empty Best Sellers tab
// on a catalogue with 154 distinct products actually sold. Trending papers over
// this with a random-sample fallback; bestsellers had none, so it showed empty.
//
// Marketplace orders must therefore count toward "most purchased".

test('marketplace orders count toward the ranking', async (t) => {
  const { rankPipeline } = await runBestsellers(t, {
    topSellers: [],
    products: [],
  });

  const union = rankPipeline.find((s) => s.$unionWith);
  assert.ok(
    union,
    'ranking must union the orders collection — sales alone is POS-only and is empty in production',
  );
  assert.equal(union.$unionWith.coll, 'orders');
});

test('only paid, actually-delivered orders count toward the ranking', async (t) => {
  const { rankPipeline } = await runBestsellers(t, {
    topSellers: [],
    products: [],
  });

  const orderStages = rankPipeline.find((s) => s.$unionWith).$unionWith.pipeline;
  const match = orderStages.find((s) => s.$match);
  assert.ok(match, 'the orders branch must filter before counting');

  // A pending or cancelled order is not a purchase; counting it would let an
  // abandoned cart rank a product onto the storefront's Best Sellers tab.
  assert.deepEqual(match.$match.status, { $in: ['delivered', 'shipped'] });
  assert.equal(match.$match.paymentStatus, 'paid');

  // Order lines live in items[], so the branch has to unwind before grouping.
  assert.ok(
    orderStages.some((s) => s.$unwind),
    'the orders branch must $unwind items before summing quantities',
  );
});

test('units from both channels are summed per product, not counted twice', async (t) => {
  const id = productId();

  // The union emits one row per source; the outer $group must combine them so a
  // product sold 30 in-store and 70 online ranks as 100, not as two rows.
  const { rankPipeline } = await runBestsellers(t, {
    topSellers: [{ _id: id, totalSold: 100 }],
    products: [productDoc(id)],
  });

  const group = rankPipeline.find((s) => s.$group);
  assert.ok(group, 'expected a $group to aggregate the unioned rows');
  assert.equal(group.$group._id, '$product');
  assert.deepEqual(group.$group.totalSold, { $sum: '$quantity' });

  const groupIdx = rankPipeline.findIndex((s) => s.$group);
  const unionIdx = rankPipeline.findIndex((s) => s.$unionWith);
  assert.ok(unionIdx < groupIdx, 'the union must happen before the grouping');
});
