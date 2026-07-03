// server/__tests__/pricelistPricing.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
  applyCartBundles,
  findCartThresholdRules,
  computeCartThresholdDiscount,
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

// ── flashSaleQty qty cap (was dead data — engine never enforced it) ──────────

test('findMatchingPriceRules excludes a flash_sale rule when flashSaleQty > 0 and quantity exceeds it', () => {
  const rules = [
    { _id: 'fs', priceType: 'flash_sale', flashSalePercentage: 20, flashSaleQty: 3, minQuantity: 0, sequence: 0 },
  ];
  // qty 3 qualifies (== flashSaleQty)
  assert.deepStrictEqual(findMatchingPriceRules(rules, 'sp1', 3).map((r) => r._id), ['fs']);
  // qty 4 excluded (> flashSaleQty)
  assert.deepStrictEqual(findMatchingPriceRules(rules, 'sp1', 4), []);
});

test('findMatchingPriceRules treats flashSaleQty=0 as unlimited (existing behavior)', () => {
  const rules = [
    { _id: 'fs', priceType: 'flash_sale', flashSalePercentage: 20, flashSaleQty: 0, minQuantity: 0, sequence: 0 },
  ];
  assert.deepStrictEqual(findMatchingPriceRules(rules, 'sp1', 100).map((r) => r._id), ['fs']);
});

test('flashSaleQty cap does not affect non-flash_sale rules', () => {
  const rules = [
    { _id: 'd', priceType: 'discount', discountPercentage: 10, flashSaleQty: 3, minQuantity: 0, sequence: 0 },
  ];
  // discount rule with a stray flashSaleQty should still qualify at qty 5
  assert.deepStrictEqual(findMatchingPriceRules(rules, 'sp1', 5).map((r) => r._id), ['d']);
});

// ── Rule-scope guards (cart-scoped types never leak into per-line paths) ─────

test('findMatchingPriceRules excludes cart_threshold rules from per-line matching', () => {
  const rules = [
    { _id: 't', priceType: 'cart_threshold', thresholdAmount: 100, discountType: 'percentage', discountPercentage: 5, minQuantity: 0, sequence: 0 },
    { _id: 'd', priceType: 'discount', discountPercentage: 10, minQuantity: 0, sequence: 1 },
  ];
  assert.deepStrictEqual(findMatchingPriceRules(rules, 'sp1', 1).map((r) => r._id), ['d']);
});

test('pickBestBundle ignores cross-product rules (bundleTargetSubProduct set) — they must not discount the trigger', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 2, bundleDiscount: 50, bundleDiscountType: 'percentage', minQuantity: 0,
  }];
  // Scanning product A (the trigger) at qty 6 must NOT pick this bundle.
  assert.strictEqual(pickBestBundle([], rules, 6, 'A', { price: 1000, costPrice: 600 }), null);
});

// ── Cross-product bundles (Buy X Get Y) — applyCartBundles ───────────────────

function cartLine(subProductId, quantity, price, costPrice = 0) {
  return { subProductId, quantity, price, costPrice };
}

test('applyCartBundles: trigger qty met → target line gets percentage discount', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 10, bundleDiscountType: 'percentage',
    minQuantity: 0,
  }];
  const lines = [cartLine('A', 6, 1000), cartLine('B', 2, 500, 300)];
  const adj = applyCartBundles(lines, rules);
  // Target B line: 2 units × 500 = 1000 gross; 10% = 100 discount
  assert.strictEqual(adj.length, 1);
  assert.strictEqual(String(adj[0].subProductId), 'B');
  assert.strictEqual(adj[0].discountAmount, 100);
});

test('applyCartBundles: trigger qty not met → no discount', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 10, bundleDiscountType: 'percentage',
  }];
  const lines = [cartLine('A', 3, 1000), cartLine('B', 2, 500)];
  const adj = applyCartBundles(lines, rules);
  assert.strictEqual(adj.length, 0);
});

test('applyCartBundles: target not in cart → no adjustment', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 10, bundleDiscountType: 'percentage',
  }];
  const lines = [cartLine('A', 6, 1000)]; // B not in cart
  const adj = applyCartBundles(lines, rules);
  assert.strictEqual(adj.length, 0);
});

test('applyCartBundles: fixed discount type applies flat amount off target line', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 50, bundleDiscountType: 'fixed',
  }];
  const lines = [cartLine('A', 6, 1000), cartLine('B', 2, 500)];
  const adj = applyCartBundles(lines, rules);
  // fixed 50 per unit × 2 = 100
  assert.strictEqual(adj[0].discountAmount, 100);
});

test('applyCartBundles: markup_on_cost overrides target per-unit price', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 20, bundleDiscountType: 'markup_on_cost',
  }];
  const lines = [cartLine('A', 6, 1000), cartLine('B', 2, 500, 300)];
  const adj = applyCartBundles(lines, rules);
  // cost 300 × (1 + 20%) = 360 override price
  assert.strictEqual(adj[0].overridePrice, 360);
});

test('applyCartBundles: no_discount restores original price on target', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 0, bundleDiscountType: 'no_discount',
  }];
  const lines = [cartLine('A', 6, 1000), cartLine('B', 2, 400)];
  const adj = applyCartBundles(lines, rules);
  // no_discount: target keeps its own price (no override needed when not on sale)
  // but the adjustment marks it; overridePrice = the line's own price (no change)
  assert.strictEqual(adj.length, 1);
  assert.strictEqual(adj[0].overridePrice, 400);
});

test('applyCartBundles: same-product bundles (no bundleTargetSubProduct) are ignored', () => {
  // Same-product bundles are handled by the existing per-line pickBestBundle path.
  // applyCartBundles only processes cross-product rules (bundleTargetSubProduct set).
  const rules = [{
    priceType: 'bundle', subProduct: 'A', // no bundleTargetSubProduct
    bundleQuantity: 6, bundleDiscount: 10, bundleDiscountType: 'percentage',
  }];
  const lines = [cartLine('A', 6, 1000)];
  const adj = applyCartBundles(lines, rules);
  assert.strictEqual(adj.length, 0);
});

test('applyCartBundles: minQuantity above trigger qty blocks the rule', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 10, bundleDiscountType: 'percentage',
    minQuantity: 12,
  }];
  const lines = [cartLine('A', 6, 1000), cartLine('B', 2, 500)];
  assert.strictEqual(applyCartBundles(lines, rules).length, 0);
});

test('applyCartBundles: lineIndex addresses the exact target line (size variants share a subProductId)', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 10, bundleDiscountType: 'percentage',
  }];
  const lines = [cartLine('A', 6, 1000), cartLine('B', 1, 500), cartLine('B', 2, 800)];
  const adj = applyCartBundles(lines, rules);
  assert.strictEqual(adj.length, 2);
  assert.deepStrictEqual(adj.map((a) => a.lineIndex), [1, 2]);
  assert.strictEqual(adj[0].discountAmount, 50);  // 500 × 1 × 10%
  assert.strictEqual(adj[1].discountAmount, 160); // 800 × 2 × 10%
});

test('applyCartBundles: no_discount restores originalPrice when the target line is on sale', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 0, bundleDiscountType: 'no_discount',
  }];
  const lines = [cartLine('A', 6, 1000), { ...cartLine('B', 2, 400), originalPrice: 600 }];
  const adj = applyCartBundles(lines, rules);
  assert.strictEqual(adj[0].overridePrice, 600);
});

test('applyCartBundles: expired rule is skipped', () => {
  const rules = [{
    priceType: 'bundle', subProduct: 'A', bundleTargetSubProduct: 'B',
    bundleQuantity: 6, bundleDiscount: 10, bundleDiscountType: 'percentage',
    endDate: new Date('2020-01-01'),
  }];
  const lines = [cartLine('A', 6, 1000), cartLine('B', 2, 500)];
  const adj = applyCartBundles(lines, rules);
  assert.strictEqual(adj.length, 0);
});

// ── Cart spend-threshold discount ────────────────────────────────────────────

test('findCartThresholdRules: subtotal below threshold → no rules', () => {
  const rules = [{ priceType: 'cart_threshold', thresholdAmount: 50000, discountType: 'percentage', discountPercentage: 5, sequence: 0 }];
  assert.deepStrictEqual(findCartThresholdRules(rules, 49999), []);
});

test('findCartThresholdRules: subtotal above threshold → rule qualifies', () => {
  const rules = [{ _id: 't1', priceType: 'cart_threshold', thresholdAmount: 50000, discountType: 'percentage', discountPercentage: 5, sequence: 0 }];
  const result = findCartThresholdRules(rules, 50000);
  assert.deepStrictEqual(result.map((r) => r._id), ['t1']);
});

test('findCartThresholdRules: expired rule is excluded', () => {
  const rules = [{ priceType: 'cart_threshold', thresholdAmount: 50000, discountType: 'percentage', discountPercentage: 5, endDate: new Date('2020-01-01') }];
  assert.deepStrictEqual(findCartThresholdRules(rules, 60000), []);
});

test('findCartThresholdRules: non-cart_threshold rules are ignored', () => {
  const rules = [
    { _id: 'd', priceType: 'discount', discountPercentage: 10, thresholdAmount: 50000 },
    { _id: 't', priceType: 'cart_threshold', thresholdAmount: 50000, discountType: 'percentage', discountPercentage: 5, sequence: 0 },
  ];
  const result = findCartThresholdRules(rules, 60000);
  assert.deepStrictEqual(result.map((r) => r._id), ['t']);
});

test('computeCartThresholdDiscount: single percentage rule', () => {
  const rules = [{ priceType: 'cart_threshold', thresholdAmount: 50000, discountType: 'percentage', discountPercentage: 5, sequence: 0 }];
  // 100000 × 5% = 5000
  assert.strictEqual(computeCartThresholdDiscount(rules, 100000), 5000);
});

test('computeCartThresholdDiscount: single fixed rule', () => {
  const rules = [{ priceType: 'cart_threshold', thresholdAmount: 50000, discountType: 'fixed', discountAmount: 2000, sequence: 0 }];
  assert.strictEqual(computeCartThresholdDiscount(rules, 100000), 2000);
});

test('computeCartThresholdDiscount: multiple rules stack sequentially', () => {
  const rules = [
    { priceType: 'cart_threshold', thresholdAmount: 50000, discountType: 'percentage', discountPercentage: 5, sequence: 0 },
    { priceType: 'cart_threshold', thresholdAmount: 100000, discountType: 'percentage', discountPercentage: 10, sequence: 1 },
  ];
  // 100000 → -5% = 95000 → -10% = 85500; total discount = 14500
  assert.strictEqual(computeCartThresholdDiscount(rules, 100000), 14500);
});
