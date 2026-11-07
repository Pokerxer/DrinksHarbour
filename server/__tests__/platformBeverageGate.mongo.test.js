// DRI-5 (board 2026-11-05): the /platform marketplace surface — public
// /api/products search, every public strip, /api/products/slugs faceting and
// the chatbot shop surfaces — must return beverage-kind Products ONLY.
//
// Non-beverage KINDS.retail products (Fashion/Electronics/Beauty/Home +
// hospitality_ lounge stock) stay sellable through tenant store surfaces
// (channel 'store') and through POS/tenant stock paths (DRI-4 scope, untouched
// here), but must be absent from every platform marketplace surface even when
// approved + isPublished.
//
// Behavioral, not static: drives the real routers/services against the
// disposable venuePhase0 replica-set Mongo, same convention as
// posTillAcceptance.mongo.test.js.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/platformBeverageGate.mongo.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { connectVenueMongo } = require('./helpers/venueMongo');
const { startRouter } = require('./helpers/routeAuthHarness');
const productRouter = require('../routes/product.routes');
const storeRouter = require('../routes/store.routes');

const productService = require('../services/product.service');

let seed; // populated once below

async function setup() {
  // The shared owned DB is dropped between tests (connectVenueMongo's
  // t.after), so memoize on the DATA, not on a resolved promise: if the marker
  // product is gone, re-seed into the fresh DB. node:test runs tests in a file
  // sequentially, so the count check is race-free.
  const MarkerProduct = require('../models/Product');
  const seeded = await MarkerProduct.collection.countDocuments({ slug: 'gate-lager' });
  if (seeded) return seed;

  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const Tenant = require('../models/Tenant');
  const Sales = require('../models/Sales');
  const Brand = require('../models/Brand');

  const oid = () => new mongoose.Types.ObjectId();

  const tenant = oid();
  await Tenant.collection.insertOne({
    _id: tenant,
    name: 'Gate Tenant',
    slug: 'gate-tenant',
    status: 'approved',
    isActive: true,
    plan: 'starter',
    subscriptionStatus: 'active',
    revenueModel: 'commission',
    commissionPercentage: 13,
  });

  const beverageBrand = oid();
  const retailBrand = oid();
  await Brand.collection.insertOne({ _id: beverageBrand, name: 'Gate Brewing', slug: 'gate-brewing' });
  await Brand.collection.insertOne({ _id: retailBrand, name: 'Gate Retail Threads', slug: 'gate-retail-threads' });

  const makeProduct = async ({ name, slug, type, catalogKind, brand, abv = null }) => {
    const _id = oid();
    const doc = {
      _id,
      name,
      slug,
      type,
      brand,
      status: 'approved',
      isPublished: true,
      description: `${name} description`,
      isAlcoholic: abv != null,
      // New-arrivals window: getNewArrivals matches publishedAt within the
      // last `days` (30 default), so absence = dropped from that strip too.
      publishedAt: new Date('2026-11-04'),
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-11-01'),
    };
    if (catalogKind) doc.catalogKind = catalogKind; // omitted = legacy beverage
    await Product.collection.insertOne(doc);
    // Keep the RAW ObjectId — makeListing joins SubProduct.product to it via
    // $eq against Products.$_id, so a string here silently unlinks every
    // listing (string ≠ ObjectId in $expr comparisons).
    return { _id, name, slug };
  };

  // Approved + published listings in all three shapes the clause must reason
  // about: legacy absence, explicit beverage, and non-beverage retail.
  const legacyLager = await makeProduct({ name: 'Gate Lager', slug: 'gate-lager', type: 'beer', brand: beverageBrand, abv: 5 });
  const explicitWine = await makeProduct({ name: 'Gate Merlot', slug: 'gate-merlot', type: 'wine', catalogKind: 'beverage', brand: beverageBrand, abv: 13 });
  const retailTop = await makeProduct({ name: 'Gate Tee', slug: 'gate-tee', type: 'fashion_top', catalogKind: 'retail', brand: retailBrand });

  // Every product gets a real published listing from the tenant, so a
  // "visible because nobody stocked it" false pass is impossible.
  const makeListing = async (product) => {
    const sub = oid();
    const size = oid();
    await SubProduct.collection.insertOne({
      _id: sub,
      tenant,
      product: product._id,
      status: 'active',
      isPublished: true,
      visibleInOnlineStore: true,
      baseSellingPrice: 1000,
      sellingPrice: 1000,
      costPrice: 500,
      defaultSize: size,
      sizes: [size],
    });
    await Size.collection.insertOne({
      _id: size,
      tenant,
      subproduct: sub,
      size: '500ml',
      status: 'active',
      availability: 'available',
      sellingPrice: 1000,
      costPrice: 500,
      volumeMl: 500,
      // Persisted stock: the public listing defaults to `inStock` filtering
      // (`stock - reservedStock > 0`), so no stock fields = everything empty.
      stock: 10,
      reservedStock: 0,
      isVisibleInPOS: true,
    });
    return sub.toString();
  };

  // Sales rows link each product to its OWN listing (sub id) so the
  // trending/bestsellers aggregates match genuinely-linked purchases. ALL
  // products get current (7-day-window) sales so the sales-driven strips have
  // data; the retail product deliberately has the MOST units (50 vs 3) — if
  // the gate is real, it is dropped while the weaker beverage sellers still
  // surface. An empty strip would be false-pass territory, so beverage
  // presence is asserted alongside retail absence.
  const beverageSub1 = await makeListing(legacyLager);
  const beverageSub2 = await makeListing(explicitWine);
  const retailSub = await makeListing(retailTop);

  const makeSaleRow = async (product, sub, quantity) => {
    await Sales.collection.insertOne({
      tenant,
      product: product._id,
      subproduct: sub,
      size: oid(),
      channel: 'tenant_pos',
      quantity,
      priceAtSale: 1000,
      itemSubtotal: quantity * 1000,
      finalItemPrice: quantity * 1000,
      revenueModelUsed: 'commission',
      platformAmount: 0,
      tenantAmount: quantity * 1000,
      fulfillmentStatus: 'fulfilled',
      soldAt: new Date(),
    });
  };
  await makeSaleRow(legacyLager, beverageSub1, 3);
  await makeSaleRow(explicitWine, beverageSub2, 3);
  await makeSaleRow(retailTop, retailSub, 50); // the popular item the gate must still drop

  // The search-suggestions $text leg needs the compound text index — the
  // fixture connects with autoIndex: false, so build it explicitly.
  await Product.collection.createIndex({ name: 'text', description: 'text', tastingNotes: 'text' });
  await Product.collection.createIndex({ slug: 1, status: 1 });

  seed = { tenantId: tenant.toString(), products: { legacyLager, explicitWine, retailTop } };
  return seed;
}

const beverageSlugs = () => ['gate-lager', 'gate-merlot'];
const retailSlug = 'gate-tee';

/** All public product surfaces must return the beverages and nothing else. */
async function assertBeverageOnly(slugList, label) {
  assert.ok(beverageSlugs().every((s) => slugList.includes(s)), `${label}: beverage products present (got ${JSON.stringify(slugList)})`);
  assert.ok(!slugList.includes(retailSlug), `${label}: retail product absent (got ${JSON.stringify(slugList)})`);
}

// ── Platform marketplace: HTTP level ────────────────────────────────────────

test('GET /api/products excludes approved+published retail-kind products', async (t) => {
  await connectVenueMongo(t, 'platgate');
  await setup();
  const app = await startRouter(productRouter, '/api/products');
  try {
    const res = await fetch(app.url('/api/products?limit=50'));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    await assertBeverageOnly((data.products || []).map((p) => p.slug), 'getAllProducts');
  } finally { await app.close(); }
});

test('GET /api/products/search excludes retail-kind products', async (t) => {
  await connectVenueMongo(t, 'platgate');
  await setup();
  const app = await startRouter(productRouter, '/api/products');
  try {
    const res = await fetch(app.url('/api/products/search?q=Gate&limit=50'));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    await assertBeverageOnly((data.products || []).map((p) => p.slug), 'publicSearch');
  } finally { await app.close(); }
});

for (const strip of ['featured', 'new-arrivals', 'trending', 'bestsellers']) {
  test(`GET /api/products/${strip} excludes retail-kind products`, async (t) => {
    await connectVenueMongo(t, 'platgate');
    await setup();
    const app = await startRouter(productRouter, '/api/products');
    try {
      const res = await fetch(app.url(`/api/products/${strip}?limit=50`));
      assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
      const { data } = await res.json();
      const rows = Array.isArray(data) ? data : (data.products || []);
      await assertBeverageOnly(rows.map((p) => String(p.slug)), strip);
    } finally { await app.close(); }
  });
}

test('GET /api/products/suggestions drops retail-kind matches', async (t) => {
  await connectVenueMongo(t, 'platgate');
  await setup();
  const app = await startRouter(productRouter, '/api/products');
  try {
    // "Tee" only matches the retail product — the gate must blank it, not the
    // whole suggestion list.
    const retailRes = await fetch(app.url('/api/products/suggestions?q=Tee&limit=8'));
    assert.equal(retailRes.status, 200);
    const retailJson = await retailRes.json();
    assert.deepEqual(retailJson.data || [], [], 'retail-only term must not surface');

    const bevRes = await fetch(app.url('/api/products/suggestions?q=Lager&limit=8'));
    assert.equal(bevRes.status, 200);
    const bevJson = await bevRes.json();
    assert.ok((bevJson.data || []).includes('Gate Lager'), 'beverage term still suggests');
  } finally { await app.close(); }
});

test('GET /api/products/:id/related never returns retail-kind products', async (t) => {
  await connectVenueMongo(t, 'platgate');
  await setup();
  const { legacyLager } = (await setup()).products;
  const app = await startRouter(productRouter, '/api/products');
  try {
    const res = await fetch(app.url(`/api/products/${legacyLager._id}/related?limit=20`));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    // Controller wraps the service result: data.products = { products, pagination, meta }
    const rows = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : (data.products?.products || []));
    await assertBeverageOnly(rows.map((p) => String(p.slug)), 'related');
  } finally { await app.close(); }
});

test('GET /api/products/slugs and facet counts exclude retail-kind products', async (t) => {
  await connectVenueMongo(t, 'platgate');
  await setup();
  const app = await startRouter(productRouter, '/api/products');
  try {
    const res = await fetch(app.url('/api/products/slugs'));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    await assertBeverageOnly(data.slugs || [], 'slugs');
    assert.ok(!(data.brandCounts || {})['gate-retail-threads'], 'retail-only brand facet absent');
    assert.ok((data.brandCounts || {})['gate-brewing'] > 0, 'beverage brand facet present');
  } finally { await app.close(); }
});

test('GET /api/products/filter-options does not advertise retail-only brands', async (t) => {
  await connectVenueMongo(t, 'platgate');
  await setup();
  const app = await startRouter(productRouter, '/api/products');
  try {
    const res = await fetch(app.url('/api/products/filter-options'));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    const brandNames = (data.brands || []).map((b) => b.name);
    assert.ok(!brandNames.includes('Gate Retail Threads'), `retail brand must not advertise (got ${JSON.stringify(brandNames)})`);
    assert.ok(brandNames.includes('Gate Brewing'), 'beverage brand still advertised');
  } finally { await app.close(); }
});

// ── Tenant store surface: retail kinds stay sellable ───────────────────────

test("searchProducts with the 'store' channel still lists retail-kind products for the tenant storefront", async (t) => {
  const s = await connectVenueMongo(t, 'platgate').then(setup);
  const result = await productService.searchProducts({
    tenantId: s.tenantId,
    page: 1,
    limit: 50,
    inStock: false,
    catalogChannel: 'store',
  });
  const slugs = (result.products || []).map((p) => p.slug);
  assert.ok(slugs.includes(retailSlug), `tenant storefront keeps its retail listing (got ${JSON.stringify(slugs)})`);
  assert.ok(beverageSlugs().every((x) => slugs.includes(x)), 'beverages still present');
});

test("GET /api/stores/:slug (tenant storefront) still lists retail-kind products", async (t) => {
  const s = await connectVenueMongo(t, 'platgate').then(setup);
  const app = await startRouter(storeRouter, '/api/stores');
  try {
    const res = await fetch(app.url('/api/stores/gate-tenant'));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    const slugs = (data.products || []).map((p) => p.slug);
    assert.ok(slugs.includes(retailSlug), `storefront keeps retail listing (got ${JSON.stringify(slugs)})`);
  } finally { await app.close(); }
});

// ── Name resolution is centralized: retail product slugs by id ──────────────

test('retail product keeps its sellable shape outside the marketplace clause (regression guard)', async (t) => {
  const s = await connectVenueMongo(t, 'platgate').then(setup);
  const Product = require('../models/Product');
  const doc = await Product.findOne({ slug: retailSlug }).lean();
  assert.equal(doc.status, 'approved');
  assert.equal(doc.isPublished, true);
  assert.equal(doc.catalogKind, 'retail');
  assert.ok(s.tenantId, 'tenant fixture present');
});

// ── DRI-9 (2026-11-05): the product-DETAIL surface follows the DRI-5 split ──
// Public /api/products/slug/:slug serves two surfaces inside the platform
// app: the beverage-only main marketplace (default, no x-is-tenant-site) and
// tenant storefront subdomains (flag forwarded by the platform middleware).
// Retail-kind Products must not assemble buy offers on the marketplace
// surface; beverage detail is untouched; product-ID (admin) endpoints never
// see the gate.

test('GET /api/products/slug/:slug gates retail-kind offers on the main-marketplace surface', async (t) => {
  await connectVenueMongo(t, 'platgate');
  const { retailTop } = (await setup()).products;
  const app = await startRouter(productRouter, '/api/products');
  try {
    // No x-is-tenant-site header ⇒ main-marketplace surface ⇒ 404 with the
    // "no active seller" wording, never a sellable payload.
    const res = await fetch(app.url(`/api/products/slug/${retailTop.slug}`));
    assert.equal(res.status, 404, JSON.stringify(await res.clone().json()));
    const body = await res.json();
    assert.equal(body.message, 'Product is not currently available from any seller');
  } finally { await app.close(); }
});

test('GET /api/products/slug/:slug with x-is-tenant-site keeps retail-kind detail sellable', async (t) => {
  await connectVenueMongo(t, 'platgate');
  const { retailTop } = (await setup()).products;
  const app = await startRouter(productRouter, '/api/products');
  try {
    // Tenant-storefront surface (platform middleware injects the flag) — the
    // retail product keeps its seller offer and variants.
    const res = await fetch(app.url(`/api/products/slug/${retailTop.slug}`), {
      headers: { 'x-is-tenant-site': 'true' },
    });
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    const product = data?.product ?? data;
    assert.equal(product.slug, retailTop.slug);
    assert.ok(Array.isArray(product.availableAt) && product.availableAt.length > 0, 'seller offer assembled on tenant-site surface');
  } finally { await app.close(); }
});

test('GET /api/products/slug/:slug still sells beverage detail on the main-marketplace surface', async (t) => {
  await connectVenueMongo(t, 'platgate');
  const { legacyLager, explicitWine } = (await setup()).products;
  const app = await startRouter(productRouter, '/api/products');
  try {
    for (const legacy of [legacyLager, explicitWine]) {
      const res = await fetch(app.url(`/api/products/slug/${legacy.slug}`));
      assert.equal(res.status, 200, `beverage detail ${legacy.slug} must stay sellable: ${JSON.stringify(await res.clone().json())}`);
      const { data } = await res.json();
      const product = data?.product ?? data;
      assert.ok(Array.isArray(product.availableAt) && product.availableAt.length > 0, `${legacy.slug} has a seller offer`);
    }
  } finally { await app.close(); }
});

test('productService.getProductBySlug gates retail-kind offers unless surface=tenant-site', async (t) => {
  const s = await connectVenueMongo(t, 'platgate').then(setup);
  // Marketplace surface (default / unknown surface value): rejects.
  await assert.rejects(
    productService.getProductBySlug(retailSlug),
    (e) => e.statusCode === 404 && e.message === 'Product is not currently available from any seller',
  );
  for (const surface of [null, undefined, '']) {
    await assert.rejects(productService.getProductBySlug(retailSlug, { surface }), 'unset surface must gate');
  }
  // Tenant-site surface: resolves with offers.
  const product = await productService.getProductBySlug(retailSlug, { surface: 'tenant-site', tenantId: s.tenantId });
  assert.ok(Array.isArray(product.availableAt) && product.availableAt.length > 0, 'tenant-site surface assembles offers');
  // Beverage sanity on the same code path.
  const lager = await productService.getProductBySlug('gate-lager');
  assert.ok(Array.isArray(lager.availableAt) && lager.availableAt.length > 0);
});

test('legacy retail TYPE mapping gates detail too (catalogKindForType path)', async (t) => {
  await connectVenueMongo(t, 'platgate');
  const s = await setup();
  // Legacy-shaped doc: no catalogKind field, retail vertical type. The type→kind
  // helper must still classify it retail, mirroring the DRI-5 convention
  // (absent catalogKind = classify by type taxonomy).
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const oid = () => new mongoose.Types.ObjectId();
  const _id = oid();
  await Product.collection.insertOne({
    _id, name: 'Gate Legacy Top', slug: 'gate-legacy-top', type: 'fashion_top',
    description: 'legacy doc', status: 'approved', isPublished: true,
    createdAt: new Date('2026-01-01'), publishedAt: new Date('2026-11-04'),
  });
  const sub = oid(); const size = oid();
  await SubProduct.collection.insertOne({
    _id: sub, tenant: new mongoose.Types.ObjectId(s.tenantId), product: _id,
    status: 'active', isPublished: true, visibleInOnlineStore: true,
    baseSellingPrice: 900, sellingPrice: 900, costPrice: 400, sizes: [size],
  });
  await Size.collection.insertOne({
    _id: size, tenant: s.tenantId, subproduct: sub, size: 'M', status: 'active',
    availability: 'available', sellingPrice: 900, costPrice: 400, stock: 5,
  });
  // Positive control first: on the tenant-site surface the legacy doc resolves
  // with a real offer — so any rejection below is the gate, not bad data.
  const tenantSiteProduct = await productService.getProductBySlug('gate-legacy-top', { surface: 'tenant-site', tenantId: s.tenantId });
  assert.ok(tenantSiteProduct.availableAt?.length > 0, 'legacy retail doc assembles offers on tenant-site surface');
  await assert.rejects(
    productService.getProductBySlug('gate-legacy-top'),
    (e) => e.statusCode === 404 && e.message === 'Product is not currently available from any seller',
    'legacy retail-typed doc must gate on the marketplace surface',
  );
});

test('getProductById (admin/product-id surface) still returns the retail product untouched', async (t) => {
  await connectVenueMongo(t, 'platgate');
  const { retailTop } = (await setup()).products;
  const app = await startRouter(productRouter, '/api/products');
  try {
    const res = await fetch(app.url(`/api/products/${retailTop._id}`));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const { data } = await res.json();
    assert.equal((data?.product ?? data)?.slug, retailTop.slug, 'product-id surface sees all kinds');
  } finally { await app.close(); }
});
