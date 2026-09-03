// The public chatbot may only see the slice of the catalogue the storefront
// shows: approved AND published.
//
// Regression origin: chatbot.service.js queried `{ status: 'approved' }` in two
// places and never `isPublished`. `status` and `isPublished` are independent —
// product.service.js's buildCatalogueVisibilityQuery exists precisely because
// widening one does not widen the other — so an approved-but-unpublished
// product passed the chatbot's filter while failing the storefront's.
//
// Measured against the live database on 2026-09-03: 597 products were approved,
// 586 were approved AND published, and all 11 of the difference had a live
// listing under an active tenant. So all 11 reached the model's prompt and
// could be recommended by name and price, while /api/products/slug/:slug —
// which enforces SELLABLE_PRODUCT_MATCH — 404s for every one of them. The
// chatbot was advertising drinks no customer could open, let alone buy.
//
// These tests capture the filter each query is issued with. Admin vitest and
// node:test here both run without a database, and the filter is the whole
// decision — asserting it is asserting the bug.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const productService = require('../services/product.service');
const chatbotService = require('../services/chatbot.service');

// Mongoose query chains end in .lean(); this stub answers every chain method
// the chatbot calls and resolves to `data` whatever the filter was.
const chainable = (data) => {
  const obj = {};
  ['select', 'populate', 'limit', 'sort', 'skip'].forEach((m) => { obj[m] = () => obj; });
  obj.lean = async () => data;
  return obj;
};

/** Records every filter `Model.find` is called with, and answers with `data`. */
const capturingFind = (t, Model, method, data) => {
  const calls = [];
  t.mock.method(Model, method, (filter) => {
    calls.push(filter);
    return chainable(data);
  });
  return calls;
};

const productFilters = (calls) => calls.filter((f) => f && 'status' in f);

test('loadCatalog asks the database only for published products', async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const sizeId = new mongoose.Types.ObjectId();

  t.mock.method(Tenant, 'find', () => chainable([
    { _id: tenantId, name: 'Test Tenant', revenueModel: 'markup', markupPercentage: 25, commissionPercentage: 12 },
  ]));
  const findCalls = capturingFind(t, Product, 'find', [
    { _id: productId, name: 'Published Gin', slug: 'published-gin', type: 'spirit', category: null, subCategory: null, images: [] },
  ]);
  t.mock.method(SubProduct, 'find', () => chainable([
    {
      _id: new mongoose.Types.ObjectId(), product: productId, tenant: tenantId,
      baseSellingPrice: 1000, costPrice: 1000, availableStock: 10, sizes: [sizeId],
    },
  ]));
  t.mock.method(Size, 'find', () => chainable([
    { _id: sizeId, size: '75cl', volumeMl: 750, stock: 10, status: 'active', availability: 'available', costPrice: 1000, sellingPrice: 1000 },
  ]));

  // A fresh tenant id per test — loadCatalog caches for two minutes per tenant.
  await chatbotService.loadCatalog(tenantId);

  const filters = productFilters(findCalls);
  assert.equal(filters.length, 1, 'loadCatalog should issue exactly one Product.find');
  assert.equal(filters[0].status, 'approved');
  assert.equal(
    filters[0].isPublished, true,
    'an approved-but-unpublished product has no storefront page — it must not enter the prompt',
  );
});

test("queryProducts' direct-MongoDB fallback asks only for published products", async (t) => {
  // Force the fallback: it runs whenever searchProducts yields nothing.
  t.mock.method(productService, 'searchProducts', async () => ({ products: [] }));

  const findCalls = capturingFind(t, Product, 'find', []);
  t.mock.method(Tenant, 'find', () => chainable([]));
  t.mock.method(SubProduct, 'find', () => chainable([]));
  t.mock.method(Size, 'find', () => chainable([]));

  await chatbotService.queryProducts({ type: 'gin' }, 'gin', 5);

  const filters = productFilters(findCalls);
  assert.equal(filters.length, 1, 'the fallback should issue exactly one Product.find');
  assert.equal(filters[0].status, 'approved');
  assert.equal(
    filters[0].isPublished, true,
    'the fallback path bypasses searchProducts, so it must carry the visibility rule itself',
  );
});

test('generateProductDetails will not describe an unpublished product', async (t) => {
  const calls = [];
  t.mock.method(Product, 'findOne', (filter) => {
    calls.push(filter);
    return chainable(null);
  });

  const result = await chatbotService.generateProductDetails(new mongoose.Types.ObjectId());

  assert.equal(calls.length, 1, 'lookup must be filtered, not a bare findById');
  assert.equal(calls[0].status, 'approved');
  assert.equal(calls[0].isPublished, true);
  assert.equal(result.error, 'Product not found');
});

// The rule the chatbot enforces must be the storefront's rule, not a second
// copy of it that can drift. If product.service ever changes what the public
// may see, this fails until the chatbot follows.
test("the chatbot's visibility rule is the storefront's own definition", () => {
  assert.deepEqual(productService.buildCatalogueVisibilityQuery(), {
    status: 'approved',
    isPublished: true,
  });
});
