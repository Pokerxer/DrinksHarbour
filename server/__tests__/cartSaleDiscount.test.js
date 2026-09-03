// The cart must price a sale item the same way the product page priced it.
//
// Regression origin: `calculateSizePricing` applies the PRODUCT-level discount
// (`product.platformDiscount`) but knows nothing about the SUB-PRODUCT sale
// (`isOnSale` / `saleType` / `saleDiscountValue`). Every other surface applied
// that sale itself on top — product.service.js (which is what `websitePrice`,
// and therefore the cart's stored price, actually is), order.controller.js, and
// chatbot.service.js all have their own copy of the arithmetic.
// cart.service.js's validateCartItems did not. So:
//
//   cart holds     websitePrice          = sale price   (e.g. ₦59,100)
//   /cart/validate returns finalPrice    = pre-sale     (e.g. ₦62,100)
//   → Math.round(currentPrice) !== Math.round(oldPrice)
//   → status 'price_changed', the drawer shows a RED price rise, the checkout
//     button is disabled behind "Resolve 1 issue first", and "Accept prices"
//     writes the HIGHER pre-sale price into the customer's cart.
//
// Measured live on 2026-09-03: 7 sub-products had an open sale window, and all
// 7 diverged — Glenfiddich 12 by ₦3,000, Caperdonich 25 by ₦40,000. Every sale
// item on the site was unbuyable through the cart drawer.
//
// Second defect, same root: calculateSizePricing suppresses pack pricing during
// a PRODUCT discount but not during a SUB-PRODUCT sale, so the cart advertised
// a pack rate the product page hides and checkout would have stacked the two —
// which product.service.js:10036 and utils/pricing.js:368 both state must
// never happen.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applySubProductSale, isSubProductSaleActive, roundUpTo100, resolveEffectiveUnitPrice,
} = require('../utils/pricing');

const PRICED = () => ({
  finalPrice: 62100,
  packUnitPrice: 58000,
  packThreshold: 6,
  packSavingsPct: 7,
});

const NOW = new Date('2026-09-03T12:00:00Z');

// ── isSubProductSaleActive ───────────────────────────────────────────────────

test('a sale with no dates set is active', () => {
  assert.equal(isSubProductSaleActive({ isOnSale: true, saleDiscountValue: 10 }, NOW), true);
});

test('a sale that has not started yet is not active', () => {
  assert.equal(isSubProductSaleActive(
    { isOnSale: true, saleDiscountValue: 10, saleStartDate: '2026-10-01' }, NOW), false);
});

test('an expired sale is not active', () => {
  assert.equal(isSubProductSaleActive(
    { isOnSale: true, saleDiscountValue: 10, saleEndDate: '2026-08-01' }, NOW), false);
});

test('isOnSale without a discount value is not a sale', () => {
  assert.equal(isSubProductSaleActive({ isOnSale: true, saleDiscountValue: 0 }, NOW), false);
});

test('a missing sub-product is not a sale', () => {
  assert.equal(isSubProductSaleActive(null, NOW), false);
  assert.equal(isSubProductSaleActive(undefined, NOW), false);
});

// ── applySubProductSale — must reproduce product.service.js exactly ──────────

test('percentage sale: rounded up to the nearest 100, like the product page', () => {
  const out = applySubProductSale(PRICED(), { isOnSale: true, saleType: 'percentage', saleDiscountValue: 5 }, NOW);
  assert.equal(out.finalPrice, roundUpTo100(62100 * 0.95));
  assert.equal(out.saleActive, true);
  assert.equal(out.priceBeforeSale, 62100);
});

test('flash_sale is priced as a percentage', () => {
  const pct = applySubProductSale(PRICED(), { isOnSale: true, saleType: 'percentage', saleDiscountValue: 5 }, NOW);
  const flash = applySubProductSale(PRICED(), { isOnSale: true, saleType: 'flash_sale', saleDiscountValue: 5 }, NOW);
  assert.equal(flash.finalPrice, pct.finalPrice);
});

test('a missing saleType defaults to percentage', () => {
  const out = applySubProductSale(PRICED(), { isOnSale: true, saleDiscountValue: 5 }, NOW);
  assert.equal(out.finalPrice, roundUpTo100(62100 * 0.95));
});

test('fixed sale subtracts, and never goes below zero', () => {
  const out = applySubProductSale(PRICED(), { isOnSale: true, saleType: 'fixed', saleDiscountValue: 2000 }, NOW);
  assert.equal(out.finalPrice, roundUpTo100(62100 - 2000));

  const huge = applySubProductSale(PRICED(), { isOnSale: true, saleType: 'fixed', saleDiscountValue: 999999 }, NOW);
  assert.equal(huge.finalPrice, 0);
});

// product.service.js applies the sale in an `if/else if` over percentage |
// flash_sale | fixed — anything else falls through and the price is unchanged.
// The cart must fall through identically or it charges a discount the product
// page never showed.
test('an unrecognised saleType leaves the price alone, as the product page does', () => {
  const out = applySubProductSale(PRICED(), { isOnSale: true, saleType: 'clearance', saleDiscountValue: 50 }, NOW);
  assert.equal(out.finalPrice, 62100);
});

test('no sale leaves every field untouched', () => {
  const priced = PRICED();
  const out = applySubProductSale(priced, { isOnSale: false, saleDiscountValue: 20 }, NOW);
  assert.equal(out.finalPrice, priced.finalPrice);
  assert.equal(out.packUnitPrice, priced.packUnitPrice);
  assert.equal(out.packThreshold, priced.packThreshold);
  assert.equal(out.saleActive, false);
});

// ── No stacking ─────────────────────────────────────────────────────────────

test('an active sale withdraws the pack rate — a sale and a pack must not stack', () => {
  const out = applySubProductSale(PRICED(), { isOnSale: true, saleType: 'percentage', saleDiscountValue: 5 }, NOW);
  assert.equal(out.packUnitPrice, null);
  assert.equal(out.packThreshold, null);
  assert.equal(out.packSavingsPct, null);
});

test('an inactive sale leaves the pack rate published', () => {
  const out = applySubProductSale(PRICED(), { isOnSale: true, saleDiscountValue: 5, saleEndDate: '2026-08-01' }, NOW);
  assert.equal(out.packUnitPrice, 58000);
  assert.equal(out.packThreshold, 6);
});

test('the input pricing object is not mutated', () => {
  const priced = PRICED();
  applySubProductSale(priced, { isOnSale: true, saleType: 'percentage', saleDiscountValue: 5 }, NOW);
  assert.equal(priced.finalPrice, 62100, 'callers reuse the calculateSizePricing output');
  assert.equal(priced.packUnitPrice, 58000);
});

// The cart quotes a price and checkout charges one; if they disagree the
// customer is billed something they never agreed to. Both now go through
// applySubProductSale, so a sale line at pack quantity must resolve to the sale
// price — NOT pack × sale, which is the stacking both pricing.js:368 and
// product.service.js:10036 exist to prevent.
test('checkout and the cart agree on a sale line at pack quantity', () => {
  const priced = applySubProductSale(
    PRICED(),
    { isOnSale: true, saleType: 'percentage', saleDiscountValue: 5 },
    NOW,
  );
  const qtyAtPackThreshold = 6;
  const charged = resolveEffectiveUnitPrice(priced, qtyAtPackThreshold);

  assert.equal(charged, roundUpTo100(62100 * 0.95));
  assert.notEqual(charged, roundUpTo100(58000 * 0.95), 'sale must not stack on the pack rate');
});

// ── The bug itself, end to end through validateCartItems ────────────────────

test('a cart holding the sale price validates as ok, not price_changed', async (t) => {
  const mongoose = require('mongoose');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const cartService = require('../services/cart.service');

  const subProductId = new mongoose.Types.ObjectId();
  const sizeId = new mongoose.Types.ObjectId();

  // A tenant and product with no markup/discount of their own, so
  // calculateSizePricing's finalPrice is exactly the size selling price and the
  // arithmetic under test is only the sale.
  const subProduct = {
    _id: subProductId,
    costPrice: 0,
    baseSellingPrice: 0,
    isOnSale: true,
    saleType: 'percentage',
    saleDiscountValue: 10,
    saleStartDate: null,
    saleEndDate: null,
    tenant: { status: 'approved', subscriptionStatus: 'active', revenueModel: 'markup', markupPercentage: 0 },
    product: { platformMarkup: 0, platformDiscount: null },
  };
  // The markup revenue model prices off costPrice; with every markup at 0 the
  // pre-sale finalPrice is exactly ₦10,000, so the only arithmetic the
  // assertions below exercise is the sale itself.
  const size = {
    _id: sizeId, costPrice: 10000, sellingPrice: 10000,
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

  // What the storefront published, and therefore what the cart is holding.
  const salePrice = roundUpTo100(10000 * 0.9);

  const [result] = await cartService.validateCartItems([
    { subProductId: String(subProductId), sizeId: String(sizeId), quantity: 1, price: salePrice },
  ]);

  assert.equal(result.currentPrice, salePrice,
    'validate must price through the same sale the product page applied');
  assert.equal(result.status, 'ok',
    'a cart holding the advertised sale price is not a price change');
  assert.equal(result.priceDiff, 0);
  assert.equal(result.baseUnitPrice, salePrice,
    '"Accept prices" writes baseUnitPrice — it must not restore the pre-sale price');
});
