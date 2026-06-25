// server/__tests__/pricelistPricing.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
} = require('../services/pricelistPricing.service');

test('findMatchingPriceRules excludes bundle rules and rules below minQuantity, sorts by sequence then minQuantity desc', () => {
  const subProductId = 'sp1';
  const rules = [
    { _id: 'r1', priceType: 'bundle', minQuantity: 0, sequence: 0 },
    { _id: 'r2', priceType: 'discount', minQuantity: 6, sequence: 1, discountPercentage: 5 },
    { _id: 'r3', priceType: 'discount', minQuantity: 0, sequence: 0, discountPercentage: 10 },
  ];
  const result = findMatchingPriceRules(rules, subProductId, 6);
  assert.deepStrictEqual(result.map((r) => r._id), ['r3', 'r2']);
});

test('findMatchingPriceRules excludes a rule whose minQuantity exceeds the given quantity', () => {
  const rules = [{ _id: 'r1', priceType: 'discount', minQuantity: 10, sequence: 0, discountPercentage: 10 }];
  assert.deepStrictEqual(findMatchingPriceRules(rules, 'sp1', 5), []);
});

test('findMatchingPriceRules prefers product-specific rules over all-products rules', () => {
  const rules = [
    { _id: 'global', priceType: 'discount', minQuantity: 0, sequence: 0, discountPercentage: 5 },
    { _id: 'specific', priceType: 'discount', minQuantity: 0, sequence: 0, discountPercentage: 20, subProduct: 'sp1' },
  ];
  const result = findMatchingPriceRules(rules, 'sp1', 1);
  assert.deepStrictEqual(result.map((r) => r._id), ['specific']);
});

test('applyPriceRules applies fixed, formula, discount(pct), discount(fixed), flash_sale in sequence', () => {
  assert.strictEqual(applyPriceRules(5000, 3000, [{ priceType: 'fixed', fixedPrice: 4000 }]), 4000);
  assert.strictEqual(applyPriceRules(5000, 3000, [{ priceType: 'formula', markupPercentage: 50 }]), 4500);
  assert.strictEqual(applyPriceRules(5000, 3000, [{ priceType: 'discount', discountType: 'percentage', discountPercentage: 10 }]), 4500);
  assert.strictEqual(applyPriceRules(5000, 3000, [{ priceType: 'discount', discountType: 'fixed', discountAmount: 500 }]), 4500);
  assert.strictEqual(applyPriceRules(5000, 3000, [{ priceType: 'flash_sale', flashSalePercentage: 20 }]), 4000);
});

test('applyPriceRules chains multiple rules sequentially', () => {
  const rules = [
    { priceType: 'fixed', fixedPrice: 4000 },
    { priceType: 'discount', discountType: 'percentage', discountPercentage: 10 },
  ];
  assert.strictEqual(applyPriceRules(5000, 3000, rules), 3600);
});

test('pickBestBundle returns null when no bundle qualifies for the given quantity', () => {
  const dbBundles = [{ name: 'Buy 6', quantity: 6, discount: 10, discountType: 'percentage', active: true }];
  assert.strictEqual(pickBestBundle(dbBundles, [], 3, 'sp1', { price: 1000, costPrice: 600 }), null);
});

test('pickBestBundle picks the DB bundle once quantity qualifies', () => {
  const dbBundles = [{ name: 'Buy 6', quantity: 6, discount: 10, discountType: 'percentage', active: true }];
  const result = pickBestBundle(dbBundles, [], 6, 'sp1', { price: 1000, costPrice: 600 });
  assert.strictEqual(result.name, 'Buy 6');
});

test('pickBestBundle merges in a pricelist bundle rule scoped to the matching subProduct', () => {
  const rules = [{
    priceType: 'bundle', bundleName: 'PL Bundle', bundleQuantity: 4,
    bundleDiscount: 15, bundleDiscountType: 'percentage', subProduct: 'sp1', minQuantity: 0,
  }];
  const result = pickBestBundle([], rules, 4, 'sp1', { price: 1000, costPrice: 600 });
  assert.strictEqual(result.name, 'PL Bundle');
});

test('pickBestBundle picks the higher-savings candidate when multiple qualify', () => {
  const dbBundles = [
    { name: 'Small', quantity: 2, discount: 5, discountType: 'percentage', active: true },
    { name: 'Big', quantity: 2, discount: 20, discountType: 'percentage', active: true },
  ];
  const result = pickBestBundle(dbBundles, [], 2, 'sp1', { price: 1000, costPrice: 600 });
  assert.strictEqual(result.name, 'Big');
});

test('applyBundleOverride applies markup_on_cost as costPrice * (1 + markup%)', () => {
  const bundle = { discountType: 'markup_on_cost', discount: 50 };
  const result = applyBundleOverride(1000, bundle, 600, 1200);
  assert.strictEqual(result.price, 900);
  assert.strictEqual(result.overridden, true);
});

test('applyBundleOverride applies no_discount by restoring the pre-sale originalPrice', () => {
  const bundle = { discountType: 'no_discount' };
  const result = applyBundleOverride(800, bundle, 600, 1000);
  assert.strictEqual(result.price, 1000);
  assert.strictEqual(result.overridden, true);
});

test('applyBundleOverride leaves price untouched for percentage/fixed types (caller handles those)', () => {
  const bundle = { discountType: 'percentage', discount: 10 };
  const result = applyBundleOverride(1000, bundle, 600, 1200);
  assert.strictEqual(result.price, 1000);
  assert.strictEqual(result.overridden, false);
});

test('applyBundleOverride returns the price unchanged when there is no bundle', () => {
  const result = applyBundleOverride(1000, null, 600, 1200);
  assert.strictEqual(result.price, 1000);
  assert.strictEqual(result.overridden, false);
});

test('computeBundleLineDiscount computes a percentage bundle discount over the line gross', () => {
  const bundle = { discountType: 'percentage', discount: 10 };
  // lineGross = 1000 * 4 = 4000; 10% = 400
  assert.strictEqual(computeBundleLineDiscount(bundle, 4000, 4, 0, false), 400);
});

test('computeBundleLineDiscount computes a fixed bundle discount capped at the post-cashier-discount line gross', () => {
  const bundle = { discountType: 'fixed', discount: 200 };
  // 200 * 4 = 800, capped at lineGross(4000) - itemDiscAmt(3500) = 500
  assert.strictEqual(computeBundleLineDiscount(bundle, 4000, 4, 3500, false), 500);
});

test('computeBundleLineDiscount returns 0 when the bundle already overrode the price', () => {
  const bundle = { discountType: 'percentage', discount: 10 };
  assert.strictEqual(computeBundleLineDiscount(bundle, 4000, 4, 0, true), 0);
});

test('computeBundleLineDiscount returns 0 when there is no bundle', () => {
  assert.strictEqual(computeBundleLineDiscount(null, 4000, 4, 0, false), 0);
});
