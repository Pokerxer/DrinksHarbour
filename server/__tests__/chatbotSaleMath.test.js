// The chatbot must quote the price the shop is charging.
//
// chatbot.service.js's loadCatalog carried its own hand-written copy of the
// sub-product sale arithmetic — the fourth in the codebase — and it disagreed
// with product.service.js (which is what `websitePrice`, and therefore the
// product page and the cart, actually are) in two ways:
//
//   1. it rounded with `parseFloat(x.toFixed(2))` where every other surface
//      uses `roundUpTo100`, so a sale price came out a few naira BELOW the real
//      one — the bot quoting ₦55,890 for a bottle the shop sells at ₦55,900;
//   2. it matched `saleType === 'percentage' || 'flash_sale'` with no default,
//      so a sale saved with no explicit type discounted nothing in the chatbot
//      while product.service.js's `saleType || 'percentage'` discounted it.
//
// Both are quoted-price errors on an unauthenticated public surface. The fix is
// to stop having a fourth copy: loadCatalog now calls applySubProductSale.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const chatbotService = require('../services/chatbot.service');
const { roundUpTo100 } = require('../utils/pricing');

const chainable = (data) => {
  const obj = {};
  ['select', 'populate', 'limit', 'sort', 'skip'].forEach((m) => { obj[m] = () => obj; });
  obj.lean = async () => data;
  return obj;
};

/**
 * Build a catalogue of exactly one product/size with every markup at zero, so
 * the only arithmetic the assertions exercise is the sale.
 *
 * The size costs ₦62,100 but the platform price lands on ₦62,000: with no
 * markup the platform price would equal the tenant's own store price, and
 * calcPlatformSellingPrice (utils/pricing.js:194) undercuts it to the next
 * hundred below. That clamp is upstream of everything tested here — it just has
 * to be accounted for, not worked around.
 *
 * The discount values are chosen so `roundUpTo100` and the old
 * `parseFloat(toFixed(2))` give DIFFERENT answers; at a round percentage they
 * agree and the test would prove nothing.
 */
const SIZE_COST = 62100;
const PRE_SALE = 62000;

const buildCatalog = (t, sale) => {
  const tenantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const sizeId = new mongoose.Types.ObjectId();

  t.mock.method(Tenant, 'find', () => chainable([
    { _id: tenantId, name: 'Test Tenant', revenueModel: 'markup', markupPercentage: 0, commissionPercentage: 0 },
  ]));
  t.mock.method(Product, 'find', () => chainable([
    { _id: productId, name: 'Sale Whisky', slug: 'sale-whisky', type: 'spirit',
      category: null, subCategory: null, images: [], platformMarkup: 0, platformDiscount: null },
  ]));
  t.mock.method(SubProduct, 'find', () => chainable([
    { _id: new mongoose.Types.ObjectId(), product: productId, tenant: tenantId,
      baseSellingPrice: SIZE_COST, costPrice: SIZE_COST, availableStock: 10,
      sizes: [sizeId], ...sale },
  ]));
  t.mock.method(Size, 'find', () => chainable([
    { _id: sizeId, size: '70cl', volumeMl: 700, stock: 10, status: 'active',
      availability: 'available', costPrice: SIZE_COST, sellingPrice: SIZE_COST, unitsPerPack: 1 },
  ]));

  // A fresh tenant id per call — loadCatalog caches two minutes per tenant.
  return chatbotService.loadCatalog(tenantId);
};

const onlySize = (catalog) => {
  assert.ok(catalog, 'expected a catalogue');
  assert.equal(catalog.entries.length, 1);
  assert.equal(catalog.entries[0].sizes.length, 1);
  return catalog.entries[0].sizes[0];
};

test('no sale: the catalogue quotes the plain platform price', async (t) => {
  const size = onlySize(await buildCatalog(t, { isOnSale: false }));
  assert.equal(size.price, PRE_SALE);
  assert.equal(size.onSale, false);
});

test('a percentage sale is rounded UP to the nearest 100, like the shop', async (t) => {
  const size = onlySize(await buildCatalog(t, {
    isOnSale: true, saleType: 'percentage', saleDiscountValue: 7,
  }));

  assert.equal(size.price, roundUpTo100(PRE_SALE * 0.93));
  assert.equal(size.price, 57700);
  assert.notEqual(size.price, 57660, 'toFixed(2) rounding quotes BELOW the shop price');
  assert.equal(size.onSale, true);
  assert.equal(size.originalPrice, PRE_SALE);
});

test('a sale with no explicit saleType is a percentage, as on the product page', async (t) => {
  const size = onlySize(await buildCatalog(t, { isOnSale: true, saleDiscountValue: 7 }));
  assert.equal(size.price, roundUpTo100(PRE_SALE * 0.93));
  assert.equal(size.onSale, true);
});

test('flash_sale is priced as a percentage', async (t) => {
  const size = onlySize(await buildCatalog(t, {
    isOnSale: true, saleType: 'flash_sale', saleDiscountValue: 7,
  }));
  assert.equal(size.price, roundUpTo100(PRE_SALE * 0.93));
});

test('a fixed sale subtracts and rounds up to the nearest 100', async (t) => {
  const size = onlySize(await buildCatalog(t, {
    isOnSale: true, saleType: 'fixed', saleDiscountValue: 2150,
  }));
  assert.equal(size.price, roundUpTo100(PRE_SALE - 2150));
  assert.equal(size.price, 59900);
  assert.notEqual(size.price, 59850, 'toFixed(2) rounding quotes BELOW the shop price');
});

test('an expired sale is not quoted as a sale', async (t) => {
  const size = onlySize(await buildCatalog(t, {
    isOnSale: true, saleType: 'percentage', saleDiscountValue: 7, saleEndDate: '2020-01-01',
  }));
  assert.equal(size.price, PRE_SALE);
  assert.equal(size.onSale, false);
});

// The prompt text is what the model reads, so the numbers in it are the ones
// the customer gets told.
test('the prompt text carries the same numbers as the entries', async (t) => {
  const catalog = await buildCatalog(t, {
    isOnSale: true, saleType: 'percentage', saleDiscountValue: 7,
  });
  assert.match(catalog.text, /₦57,700/);
  assert.match(catalog.text, /\[was ₦62,000\]/);
  assert.match(catalog.text, /\[ON SALE\]/);
  assert.ok(!catalog.text.includes('57,660'), 'the old toFixed price must not appear');
});
