// The price STORED on a cart line must be the price the customer was SHOWN.
//
// Sibling of cartSaleDiscount.test.js, which covered the READ half
// (validateCartItems). This is the WRITE half plus getCart's served price.
//
// Regression origin — same family, third and fourth copies of the same
// omission. `calculateSizePricing` applies the PRODUCT-level discount
// (`product.platformDiscount`) but knows nothing about the SUB-PRODUCT sale
// (`isOnSale` / `saleType` / `saleDiscountValue`). Every caller applies that
// sale itself via `applySubProductSale`. Two in cart.service.js did not:
//
//   addToCart:135  → priceAtAddition snapshotted the PRE-sale price
//   getCart:431    → served the PRE-sale price to the drawer, and its
//                    subproduct projection (:410) did not even SELECT the
//                    sale fields, so the sale was invisible to it
//
// Consequences, measured live on 2026-09-03:
//   - 7 of 7 on-sale sub-products stored/served the wrong price
//   - 3 of 5 items sitting in real carts had a wrong priceAtAddition
//     (one sale item off by ₦38,000; two pack lines never re-priced)
//   - Cart.subtotal (:369 multiplies priceAtAddition) inherited it, and so did
//     the admin live-carts view reading the raw document
//   - /cart/validate returned the correct post-sale price, so the drawer
//     called the CORRECT price a "price change", showed a red banner and
//     disabled checkout behind "Resolve 1 issue first"
//
// Checkout (order.controller.js:177-194) already wrapped applySubProductSale
// and is server-authoritative, so nobody was CHARGED wrongly — this was a
// correctness-and-trust defect, not a money-loss one.
//
// Fixture note: prices here avoid the ₦62,100 → ₦62,000 undercut trap in
// calcPlatformSellingPrice (utils/pricing.js:194) by leaving sellingPrice at 0
// so tenantStorePrice never triggers the undercut, and use a non-round
// discount (7% / ₦2,150) so roundUpTo100 and toFixed(2) cannot agree by luck.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  calculateSizePricing,
  applySubProductSale,
  roundUpTo100,
  resolveEffectiveUnitPrice,
} = require('../utils/pricing');

// ── Shared fixtures ─────────────────────────────────────────────────────────

// Markup model, every markup at 0, sellingPrice 0 → pre-sale finalPrice is
// exactly the size costPrice, so the only arithmetic under test is the sale.
// sellingPrice 0 also keeps tenantStorePrice at 0, which disables the undercut
// rule in calcPlatformSellingPrice.
const FLAT_TENANT = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Tenant',
  status: 'approved',
  subscriptionStatus: 'active',
  revenueModel: 'markup',
  markupPercentage: 0,
};

const FLAT_PRODUCT = { platformMarkup: 0, platformDiscount: null };

const SALE_7PCT = {
  isOnSale: true,
  saleType: 'percentage',
  saleDiscountValue: 7,
  saleStartDate: null,
  saleEndDate: null,
};

const SALE_FIXED = {
  isOnSale: true,
  saleType: 'fixed',
  saleDiscountValue: 2150,
  saleStartDate: null,
  saleEndDate: null,
};

// ── The arithmetic the write path must now perform ──────────────────────────

test('write path: a sale item must snapshot the POST-sale price', () => {
  const size = { _id: new mongoose.Types.ObjectId(), costPrice: 40000, sellingPrice: 0, unitsPerPack: 1 };

  // What addToCart used to store — calculateSizePricing alone.
  const oldWay = calculateSizePricing(size, FLAT_PRODUCT, FLAT_TENANT, 0, 0);

  // What it must store now.
  const newWay = applySubProductSale(
    calculateSizePricing(size, FLAT_PRODUCT, FLAT_TENANT, 0, 0),
    SALE_7PCT,
  );

  assert.equal(oldWay.finalPrice, 40000, 'pre-sale platform price');
  assert.equal(newWay.finalPrice, roundUpTo100(40000 * 0.93), 'post-sale platform price');
  assert.notEqual(
    newWay.finalPrice, oldWay.finalPrice,
    'the fixture must actually exercise a divergence, or this file proves nothing',
  );
});

test('write path: a fixed sale subtracts and rounds like the product page', () => {
  const size = { _id: new mongoose.Types.ObjectId(), costPrice: 40000, sellingPrice: 0, unitsPerPack: 1 };
  const priced = applySubProductSale(
    calculateSizePricing(size, FLAT_PRODUCT, FLAT_TENANT, 0, 0),
    SALE_FIXED,
  );
  assert.equal(priced.finalPrice, roundUpTo100(40000 - 2150));
  assert.equal(priced.saleActive, true);
  assert.equal(priced.priceBeforeSale, 40000);
});

test('write path: the sale delta is recorded, so a sale ending is not a price rise', () => {
  const size = { _id: new mongoose.Types.ObjectId(), costPrice: 40000, sellingPrice: 0, unitsPerPack: 1 };
  const priced = applySubProductSale(
    calculateSizePricing(size, FLAT_PRODUCT, FLAT_TENANT, 0, 0),
    SALE_7PCT,
  );

  // This is the discountApplied addToCart now writes.
  const saleDiscount = priced.saleActive
    ? Math.max(0, (priced.priceBeforeSale ?? priced.finalPrice) - priced.finalPrice)
    : 0;

  assert.ok(saleDiscount > 0, 'a live sale must record a nonzero discount');
  assert.equal(saleDiscount + priced.finalPrice, priced.priceBeforeSale,
    'discountApplied + priceAtAddition must reconstruct the pre-sale price');
});

test('write path: no sale records a zero discount and the plain price', () => {
  const size = { _id: new mongoose.Types.ObjectId(), costPrice: 40000, sellingPrice: 0, unitsPerPack: 1 };
  const priced = applySubProductSale(
    calculateSizePricing(size, FLAT_PRODUCT, FLAT_TENANT, 0, 0),
    { isOnSale: false },
  );
  const saleDiscount = priced.saleActive
    ? Math.max(0, priced.priceBeforeSale - priced.finalPrice) : 0;

  assert.equal(priced.finalPrice, 40000);
  assert.equal(saleDiscount, 0);
});

// The snapshot is a per-unit, non-pack price on purpose: the pack rate is
// quantity-dependent and quantity is mutated after the line is written
// (cart.service.js:129 / updateCartItemQuantity) with no re-pricing. getCart's
// subtotal, validate and checkout all apply the pack rate live.
test('write path: the snapshot is the single-unit price, not the pack rate', () => {
  const packTenant = {
    ...FLAT_TENANT, markupPercentage: 40, packMarkupPercentage: 10, packRateMinUnits: 2,
  };
  const size = { _id: new mongoose.Types.ObjectId(), costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 };

  const priced = applySubProductSale(
    calculateSizePricing(size, FLAT_PRODUCT, packTenant, 0, 0),
    { isOnSale: false },
  );

  assert.ok(priced.packUnitPrice != null, 'fixture must publish a pack rate');
  assert.ok(priced.packUnitPrice < priced.finalPrice, 'pack rate must be cheaper');
  assert.equal(
    priced.finalPrice, resolveEffectiveUnitPrice(priced, 1),
    'the stored snapshot equals the quantity-1 price',
  );
  assert.notEqual(
    priced.finalPrice, resolveEffectiveUnitPrice(priced, 6),
    'and is deliberately NOT the pack price',
  );
});

// ── addToCart, end to end ───────────────────────────────────────────────────

test('addToCart stores the post-sale price and the sale delta', async (t) => {
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const Cart = require('../models/Cart');
  const User = require('../models/User');
  const cartService = require('../services/cart.service');

  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const subProductId = new mongoose.Types.ObjectId();
  const sizeId = new mongoose.Types.ObjectId();

  const product = { _id: productId, ...FLAT_PRODUCT, status: 'approved' };
  const subProduct = {
    _id: subProductId,
    product: productId,
    costPrice: 0,
    baseSellingPrice: 0,
    tenant: FLAT_TENANT,
    ...SALE_7PCT,
  };
  const size = {
    _id: sizeId,
    subproduct: subProductId,
    costPrice: 40000,
    sellingPrice: 0,
    stock: 50,
    availability: 'available',
    unitsPerPack: 1,
    maxOrderQuantity: null,
    minOrderQuantity: null,
  };

  const thenable = (value) => {
    const obj = { populate: () => obj, lean: () => obj };
    obj.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
    return obj;
  };

  t.mock.method(Product, 'findOne', () => thenable(product));
  t.mock.method(SubProduct, 'findOne', () => thenable(subProduct));
  t.mock.method(Size, 'findOne', () => thenable(size));

  // A minimal in-memory stand-in for the mongoose document addToCart mutates.
  const savedCart = {
    _id: new mongoose.Types.ObjectId(),
    user: userId,
    items: [],
    subtotal: 0,
    estimatedTotal: 0,
    save: async () => savedCart,
  };
  t.mock.method(Cart, 'findOne', () => thenable(savedCart));
  // findById is the populate-and-return at the end of addToCart; the assertions
  // below read the in-memory document instead, so an empty shape is fine.
  t.mock.method(Cart, 'findById', () => thenable({ items: [] }));
  t.mock.method(User, 'findByIdAndUpdate', () => thenable({}));

  await cartService.addToCart({
    userId, productId, subProductId, sizeId,
    tenantId: FLAT_TENANT._id, quantity: 1,
  });

  assert.equal(savedCart.items.length, 1, 'the line was written');
  const line = savedCart.items[0];

  const expected = roundUpTo100(40000 * 0.93);
  assert.equal(line.priceAtAddition, expected,
    'priceAtAddition must be the price the shop advertised, not the pre-sale one');
  assert.notEqual(line.priceAtAddition, 40000,
    'the pre-sale price is exactly the bug');
  assert.equal(line.discountApplied, 40000 - expected,
    'the sale delta is recorded so a sale ending is not read as a price rise');

  // Cart.subtotal (:369) multiplies priceAtAddition — it must now agree.
  assert.equal(savedCart.subtotal, expected,
    'Cart.subtotal, and every raw-document consumer, inherits the snapshot');
});

// ── The two sides must agree — the actual customer-visible failure ──────────

test('the price addToCart stores validates as ok, not price_changed', async (t) => {
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const cartService = require('../services/cart.service');

  const subProductId = new mongoose.Types.ObjectId();
  const sizeId = new mongoose.Types.ObjectId();

  const subProduct = {
    _id: subProductId,
    costPrice: 0,
    baseSellingPrice: 0,
    tenant: FLAT_TENANT,
    product: FLAT_PRODUCT,
    ...SALE_7PCT,
  };
  const size = {
    _id: sizeId, costPrice: 40000, sellingPrice: 0,
    availableStock: 50, stock: 50, availability: 'available',
    isLowStock: false, maxOrderQuantity: null, unitsPerPack: 1,
  };

  const thenable = (value) => {
    const obj = { populate: () => obj, lean: () => obj };
    obj.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
    return obj;
  };
  t.mock.method(SubProduct, 'findOne', () => thenable(subProduct));
  t.mock.method(Size, 'findOne', () => thenable(size));

  // Exactly what the fixed addToCart writes.
  const stored = applySubProductSale(
    calculateSizePricing(size, FLAT_PRODUCT, FLAT_TENANT, 0, 0),
    subProduct,
  ).finalPrice;

  const [result] = await cartService.validateCartItems([
    { subProductId: String(subProductId), sizeId: String(sizeId), quantity: 1, price: stored },
  ]);

  assert.equal(result.status, 'ok',
    'the drawer must not flag a phantom price change on the price it just stored');
  assert.equal(result.priceDiff, 0);
  assert.equal(result.currentPrice, stored);
});

// ── getCart's served price — the fourth copy ─────────────────────────────────

test('getCart serves the post-sale price, matching validate and checkout', () => {
  const size = { _id: new mongoose.Types.ObjectId(), size: '70cl', costPrice: 40000, sellingPrice: 0, unitsPerPack: 1 };
  const { buildCartLine } = require('../helpers/cart.helpers');

  const item = {
    product: { _id: new mongoose.Types.ObjectId(), name: 'X', slug: 'x', images: [] },
    subproduct: { _id: new mongoose.Types.ObjectId(), sku: 'S', tenant: FLAT_TENANT, ...SALE_7PCT },
    size,
    quantity: 1,
  };

  // getCart's pipeline, as fixed.
  const pricing = applySubProductSale(
    calculateSizePricing(size, FLAT_PRODUCT, FLAT_TENANT, 0, 0),
    item.subproduct,
  );
  const line = buildCartLine(item, pricing);

  assert.equal(line.price, roundUpTo100(40000 * 0.93),
    'the drawer must show the advertised sale price');
  assert.notEqual(line.price, 40000, 'serving the pre-sale price is the bug');
  assert.equal(line.saleActive, true,
    'the drawer needs sale provenance or it shows a sale price with no sale badge');
  assert.equal(line.priceBeforeSale, 40000, 'and the struck-through original');
});

test('getCart withdraws the pack rate during a sale — no stacking', () => {
  const packTenant = {
    ...FLAT_TENANT, markupPercentage: 40, packMarkupPercentage: 10, packRateMinUnits: 2,
  };
  const size = { _id: new mongoose.Types.ObjectId(), size: '70cl', costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 };
  const { buildCartLine } = require('../helpers/cart.helpers');

  const noSale = buildCartLine(
    {
      product: { _id: new mongoose.Types.ObjectId(), name: 'X', slug: 'x', images: [] },
      subproduct: { _id: new mongoose.Types.ObjectId(), sku: 'S', tenant: packTenant, isOnSale: false },
      size, quantity: 6,
    },
    applySubProductSale(calculateSizePricing(size, FLAT_PRODUCT, packTenant, 0, 0), { isOnSale: false }),
  );
  assert.ok(noSale.packUnitPrice != null, 'no sale → the pack offer stands');

  const onSale = buildCartLine(
    {
      product: { _id: new mongoose.Types.ObjectId(), name: 'X', slug: 'x', images: [] },
      subproduct: { _id: new mongoose.Types.ObjectId(), sku: 'S', tenant: packTenant, ...SALE_7PCT },
      size, quantity: 6,
    },
    applySubProductSale(calculateSizePricing(size, FLAT_PRODUCT, packTenant, 0, 0), SALE_7PCT),
  );
  assert.equal(onSale.packUnitPrice, null,
    'a sale withdraws the pack rate — the drawer must not advertise an offer the product page hides');
  assert.equal(onSale.packThreshold, null);
});

// getCart's lean() projection must carry the sale fields. If a future edit
// trims them, applySubProductSale sees isOnSale undefined, treats the line as
// not-on-sale, and every sale item silently reverts to its pre-sale price with
// no test failing anywhere else.
test('getCart projection must select the sub-product sale fields', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../services/cart.service.js'), 'utf8');

  // Find the getCart function body, then the items.subproduct populate select.
  const getCartStart = src.indexOf('const getCart = async');
  assert.ok(getCartStart >= 0, 'getCart function must be findable');
  const body = src.slice(getCartStart, getCartStart + 4000);

  const match = body.match(/path:\s*'items\.subproduct'[\s\S]*?select:\s*'([^']+)'/);
  assert.ok(match, "getCart's items.subproduct populate select must be findable");

  for (const field of ['isOnSale', 'saleType', 'saleDiscountValue', 'saleStartDate', 'saleEndDate']) {
    assert.ok(
      match[1].includes(field),
      `getCart must project ${field} — without it applySubProductSale silently no-ops`,
    );
  }
});
