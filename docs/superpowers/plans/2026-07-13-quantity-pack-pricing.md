# Quantity-Triggered Pack Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a platform-storefront cart line reaches a size's stored pack quantity (`Size.unitsPerPack`), the whole line is priced at the tenant's reduced pack markup instead of the normal markup; POS drops the old static pack keying and relies on pricelist `minQuantity` rules.

**Architecture:** `calculateSizePricing` always prices the headline at normal rates and additionally publishes `packUnitPrice`/`packThreshold`/`packSavingsPct` for pack-eligible sizes. A new `resolveLineRates(tenant, size, quantity)` is the single quantity trigger, used by cart validation and checkout. Order creation becomes server-authoritative on price. Client cart computes the effective unit price locally from pack fields carried on the cart item.

**Tech Stack:** Node/Express + Mongoose (server), Next.js/TS (client platform app), node:test (server tests — NOT jest).

**Spec:** `docs/superpowers/specs/2026-07-13-quantity-pack-pricing-design.md`

## Global Constraints

- Tests are **node:test**: run one file with `node --test server/__tests__/packPricing.test.js` (from repo root), full suite with `npm test --prefix server`. Suite baseline: 443 pass / 3 pre-existing failures (2 SO-number, 1 pricelist-scope). Do not fix or worry about the 3 pre-existing failures.
- Platform prices are always rounded UP to the nearest ₦100 by `calcPlatformSellingPrice` — tests must expect round numbers.
- Tenant pack fields already exist and must NOT change: `packMarkupPercentage` (null → pack pricing off), `packCommissionPercentage` (null → normal commission), `packRateMinUnits` (default 2).
- `Size.unitsPerPack` default 1 = feature inert for that size.
- Spec deviation (approved rationale): server-side `Cart.recalculateCartTotals` is NOT made quantity-aware — the server Cart stores raw tenant `sellingPrice` (not platform price) and is not the storefront pricing authority; `validateCartItems` is.
- Spec deviation (YAGNI): pack fields are published only in the `getProductBySlug` size payload (the storefront consumer), not in `subproduct.service.js` admin payloads — the admin pack UI was reverted and has no consumer for them.
- Commit after every task. Never commit with `--no-verify`.

---

### Task 1: Pricing engine — `resolveLineRates`, pack fields in `calculateSizePricing`

**Files:**
- Modify: `server/utils/pricing.js`
- Test: `server/__tests__/packPricing.test.js`

**Interfaces:**
- Produces: `resolveLineRates(tenant, size, quantity)` → `{ markupPct, commissionPct, isPackRate }` (pack rates only when `size.unitsPerPack >= tenant.packRateMinUnits` AND `quantity >= size.unitsPerPack`).
- Produces: `calculateSizePricing(...)` return gains `packUnitPrice: number|null`, `packThreshold: number|null`, `packSavingsPct: number|null`; `finalPrice` is ALWAYS the normal-rate price now. The `isPackRate` output field is removed.
- Produces: `resolveEffectiveUnitPrice(pricing, quantity)` → number (packUnitPrice when quantity ≥ packThreshold, else finalPrice).
- Consumes: existing `resolveRevenueRates`, `calcPlatformCostPrice`, `calcPlatformSellingPrice`.

- [ ] **Step 1: Rewrite the stale pack tests + add new failing tests**

In `server/__tests__/packPricing.test.js`, the `resolveRevenueRates` tests (top of file) stay unchanged. DELETE every existing test in the `calculateSizePricing` and `calculateSubProductPricing` sections that asserts pack-rate pricing based on `unitsPerPack` (e.g. `'markup model: 12-pack is priced with the pack markup'`) — read the whole file first and remove any test asserting that `unitsPerPack >= 2` changes `finalPrice` or sets `isPackRate` in the output. Then APPEND:

```js
// ─────────────────────────────────────────────────────────────────
// Quantity-triggered pack pricing (Phase 2)
// ─────────────────────────────────────────────────────────────────
const { resolveLineRates, resolveEffectiveUnitPrice } = require('../utils/pricing');

const packTenant = {
  revenueModel: 'markup',
  markupPercentage: 15,
  commissionPercentage: 12,
  packMarkupPercentage: 10,
  packRateMinUnits: 2,
};

test('resolveLineRates: below threshold quantity uses normal rates', () => {
  const size = { unitsPerPack: 6 };
  const rates = resolveLineRates(packTenant, size, 5);
  assert.strictEqual(rates.markupPct, 15);
  assert.strictEqual(rates.isPackRate, false);
});

test('resolveLineRates: at threshold quantity uses pack rates for the whole line', () => {
  const size = { unitsPerPack: 6 };
  assert.strictEqual(resolveLineRates(packTenant, size, 6).markupPct, 10);
  assert.strictEqual(resolveLineRates(packTenant, size, 6).isPackRate, true);
  // 8 units: still whole-line pack rate
  assert.strictEqual(resolveLineRates(packTenant, size, 8).markupPct, 10);
});

test('resolveLineRates: ineligible size (unitsPerPack 1) never gets pack rates', () => {
  const rates = resolveLineRates(packTenant, { unitsPerPack: 1 }, 50);
  assert.strictEqual(rates.markupPct, 15);
  assert.strictEqual(rates.isPackRate, false);
});

test('resolveLineRates: tenant without pack rates stays at normal rates', () => {
  const tenant = { markupPercentage: 15, commissionPercentage: 12 };
  const rates = resolveLineRates(tenant, { unitsPerPack: 6 }, 6);
  assert.strictEqual(rates.markupPct, 15);
  assert.strictEqual(rates.isPackRate, true); // pack window reached, but rates fall back
});

test('calculateSizePricing: headline finalPrice uses NORMAL rates regardless of unitsPerPack', () => {
  const product = { platformMarkup: 15 };
  const size = { costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 };
  const single = calculateSizePricing({ ...size, unitsPerPack: 1 }, product, packTenant, 0, 0);
  const packEligible = calculateSizePricing(size, product, packTenant, 0, 0);
  assert.strictEqual(packEligible.finalPrice, single.finalPrice);
  assert.strictEqual(packEligible.markupPct, 15);
});

test('calculateSizePricing: pack-eligible size publishes packUnitPrice/packThreshold/packSavingsPct', () => {
  const product = { platformMarkup: 15 };
  const size = { costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 };
  const pricing = calculateSizePricing(size, product, packTenant, 0, 0);
  // normal: 10000×1.15×1.15 = 13225 → 13300; pack: 10000×1.10×1.15 = 12650 → 12700
  assert.strictEqual(pricing.packThreshold, 6);
  assert.ok(pricing.packUnitPrice > 0);
  assert.ok(pricing.packUnitPrice < pricing.finalPrice);
  assert.ok(pricing.packSavingsPct >= 1);
});

test('calculateSizePricing: pack fields are null when the size is not eligible', () => {
  const product = { platformMarkup: 15 };
  const pricing = calculateSizePricing({ costPrice: 10000, sellingPrice: 0, unitsPerPack: 1 }, product, packTenant, 0, 0);
  assert.strictEqual(pricing.packUnitPrice, null);
  assert.strictEqual(pricing.packThreshold, null);
  assert.strictEqual(pricing.packSavingsPct, null);
});

test('calculateSizePricing: pack fields suppressed when tenant has no pack rates (no real saving)', () => {
  const tenant = { revenueModel: 'markup', markupPercentage: 15 };
  const product = { platformMarkup: 15 };
  const pricing = calculateSizePricing({ costPrice: 10000, sellingPrice: 0, unitsPerPack: 6 }, product, tenant, 0, 0);
  assert.strictEqual(pricing.packUnitPrice, null);
});

test('calculateSizePricing: pack fields suppressed when maxOrderQuantity < unitsPerPack', () => {
  const product = { platformMarkup: 15 };
  const size = { costPrice: 10000, sellingPrice: 0, unitsPerPack: 6, maxOrderQuantity: 4 };
  const pricing = calculateSizePricing(size, product, packTenant, 0, 0);
  assert.strictEqual(pricing.packUnitPrice, null);
});

test('resolveEffectiveUnitPrice: switches to packUnitPrice at the threshold', () => {
  const pricing = { finalPrice: 13300, packUnitPrice: 12700, packThreshold: 6 };
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 5), 13300);
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 6), 12700);
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 8), 12700);
});

test('resolveEffectiveUnitPrice: no pack fields → always finalPrice', () => {
  const pricing = { finalPrice: 13300, packUnitPrice: null, packThreshold: null };
  assert.strictEqual(resolveEffectiveUnitPrice(pricing, 50), 13300);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test server/__tests__/packPricing.test.js`
Expected: FAIL — `resolveLineRates is not a function` / pack-field assertions fail.

- [ ] **Step 3: Implement in `server/utils/pricing.js`**

3a. After the `resolveRevenueRates` function, add:

```js
/**
 * Quantity-triggered rate resolution for a transaction line (cart/checkout).
 * Pack rates apply only when the size is pack-eligible
 * (unitsPerPack >= tenant.packRateMinUnits) AND the line quantity has reached
 * the pack size (quantity >= unitsPerPack). The whole line then gets pack rates.
 *
 * @param {object} tenant
 * @param {object} size - needs unitsPerPack
 * @param {number} quantity - line quantity
 * @returns {{ markupPct: number, commissionPct: number, isPackRate: boolean }}
 */
const resolveLineRates = (tenant, size, quantity = 1) => {
  const unitsPerPack = size?.unitsPerPack ?? 1;
  const minUnits = tenant?.packRateMinUnits ?? DEFAULT_PACK_RATE_MIN_UNITS;
  if (unitsPerPack < minUnits || (quantity ?? 1) < unitsPerPack) {
    return {
      markupPct: tenant?.markupPercentage ?? 25,
      commissionPct: tenant?.commissionPercentage ?? 12,
      isPackRate: false,
    };
  }
  return resolveRevenueRates(tenant, unitsPerPack);
};

/**
 * Pick the per-unit price a line actually pays given its quantity.
 * @param {object} pricing - output of calculateSizePricing
 * @param {number} quantity
 */
const resolveEffectiveUnitPrice = (pricing, quantity = 1) =>
  pricing?.packUnitPrice != null && pricing?.packThreshold != null &&
  (quantity ?? 1) >= pricing.packThreshold
    ? pricing.packUnitPrice
    : (pricing?.finalPrice ?? 0);
```

3b. In `calculateSizePricing` change the rate line (currently `const { markupPct, commissionPct, isPackRate } = resolveRevenueRates(tenant, size?.unitsPerPack ?? 1);`) to:

```js
  // Headline price is ALWAYS at the normal rates; the pack rate is published
  // separately as packUnitPrice and only earned by quantity (resolveLineRates).
  const { markupPct, commissionPct } = resolveRevenueRates(tenant, 1);
```

3c. After the `const platformMargin = calcPlatformMargin(...)` line, add:

```js
  // Quantity-triggered pack pricing: a pack-eligible size advertises a second
  // per-unit price that a line earns at quantity >= unitsPerPack.
  const unitsPerPack = size?.unitsPerPack ?? 1;
  const minUnits = tenant?.packRateMinUnits ?? DEFAULT_PACK_RATE_MIN_UNITS;
  const thresholdReachable = !size?.maxOrderQuantity || size.maxOrderQuantity >= unitsPerPack;
  let packUnitPrice = null;
  let packThreshold = null;
  let packSavingsPct = null;
  if (unitsPerPack >= minUnits && thresholdReachable && platformSellingPrice > 0) {
    const packRates = resolveRevenueRates(tenant, unitsPerPack);
    const packCost = calcPlatformCostPrice(costPrice, tenantSellingPrice, revenueModel, packRates.markupPct, packRates.commissionPct);
    const packSelling = calcPlatformSellingPrice(packCost, platformMarkupPct, productDiscount, {
      tenantStorePrice: tenantSellingPrice,
      platformMarkupOverridePct: overridePct,
    });
    if (packSelling > 0 && packSelling < platformSellingPrice) {
      packUnitPrice = packSelling;
      packThreshold = unitsPerPack;
      packSavingsPct = Math.round(((platformSellingPrice - packSelling) / platformSellingPrice) * 100);
    }
  }
```

3d. In the return object: remove the `isPackRate,` line, and after `finalPrice: platformSellingPrice` add:

```js
    // Quantity-triggered pack pricing (null when not eligible / no saving)
    packUnitPrice,
    packThreshold,
    packSavingsPct
```

3e. Add `resolveLineRates,` and `resolveEffectiveUnitPrice,` to `module.exports`.

3f. Check for other consumers of the removed output field: `grep -rn "isPackRate" server client --include="*.js" --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v __tests__ | grep -v "utils/pricing.js"`. If any hit reads `.isPackRate` from a `calculateSizePricing` result, remove that usage (expected: none after the reverts; `resolveRevenueRates`/`resolveLineRates` callers still get `isPackRate` from those functions, which is fine).

- [ ] **Step 4: Run the test file, then the full suite**

Run: `node --test server/__tests__/packPricing.test.js` → Expected: PASS (all).
Run: `npm test --prefix server` → Expected: 3 pre-existing failures only.

- [ ] **Step 5: Commit**

```bash
git add server/utils/pricing.js server/__tests__/packPricing.test.js
git commit -m "feat(pricing): quantity-triggered pack rates — resolveLineRates + dual published price"
```

---

### Task 2: Strip static pack keying from display/search paths

**Files:**
- Modify: `server/services/product.service.js` (7 inline blocks + 2 aggregations)
- Modify: `server/helpers/buildProductQuery.helper.js`
- (No change needed: `server/services/chatbot.service.js` — it calls `calculateSizePricing`, already fixed by Task 1.)

**Interfaces:**
- Consumes: `resolveRevenueRates` (unchanged signature).
- Produces: all headline/list/search prices computed at normal rates; no behavioral pack pricing anywhere in static paths.

- [ ] **Step 1: Replace the 6 identical inline blocks**

In `server/services/product.service.js` the exact line below appears 6 times (near lines 4447, 5486, 7733, 8701, 9130, 11079):

```js
        // Multi-pack sizes use the tenant's reduced pack rates
        const { markupPct: effMarkupPct, commissionPct: effCommissionPct } = resolveRevenueRates(tenant, (typeof size !== 'undefined' ? size : sizeItem)?.unitsPerPack ?? 1);
```

Replace ALL occurrences (use replace_all on the two-line string) with:

```js
        // Headline price is always at the normal rates; pack rates are quantity-earned (resolveLineRates)
        const { markupPct: effMarkupPct, commissionPct: effCommissionPct } = resolveRevenueRates(tenant, 1);
```

Then the 7th variant near line 9537 (inside `getProductBySlug`, indented 6 spaces, arg is `size?.unitsPerPack ?? 1`):

```js
      // Multi-pack sizes use the tenant's reduced pack rates
      const { markupPct: effMarkupPct, commissionPct: effCommissionPct } = resolveRevenueRates(tenant, size?.unitsPerPack ?? 1);
```

→ same replacement (keep the 6-space indent).

- [ ] **Step 2: Simplify the 2 price-stats aggregations**

Near lines 5120 and 5154 (both `minPrice` and `maxPrice` projections), replace each occurrence of this `$cond` expression:

```js
                              // Multi-pack sizes use the tenant's reduced pack markup when configured
                              { $cond: [
                                { $and: [
                                  { $gte: [{ $ifNull: ['$$size.unitsPerPack', 1] }, { $ifNull: ['$$sub.tenant.packRateMinUnits', 2] }] },
                                  { $ne: [{ $ifNull: ['$$sub.tenant.packMarkupPercentage', null] }, null] },
                                ] },
                                '$$sub.tenant.packMarkupPercentage',
                                '$$sub.tenant.markupPercentage',
                              ] },
```

with simply:

```js
                              '$$sub.tenant.markupPercentage',
```

(2 occurrences — use replace_all.)

- [ ] **Step 3: Remove pack keying from `buildProductQuery.helper.js`**

In `calculateEffectivePrice` (line ~319) change:

```js
    if (tenant.revenueModel === 'markup' && tenant.markupPercentage) {
        const { markupPct } = resolveRevenueRates(tenant, unitsPerPack);
        price = costPrice * (1 + markupPct / 100);
    }
```

to:

```js
    if (tenant.revenueModel === 'markup' && tenant.markupPercentage) {
        price = costPrice * (1 + tenant.markupPercentage / 100);
    }
```

Then remove the now-unused `unitsPerPack = 1` 8th parameter from the function signature, remove the `resolveRevenueRates` require if now unused in the file, and find/trim every caller: `grep -n "calculateEffectivePrice(" server/helpers/buildProductQuery.helper.js server -r | grep -v node_modules` — drop the 8th argument at each call site.

- [ ] **Step 4: Run the suite**

Run: `npm test --prefix server` → Expected: 3 pre-existing failures only.

- [ ] **Step 5: Commit**

```bash
git add server/services/product.service.js server/helpers/buildProductQuery.helper.js
git commit -m "refactor(pricing): headline prices always at normal rates — pack rates are quantity-earned"
```

---

### Task 3: Publish pack fields in the product-detail size payload

**Files:**
- Modify: `server/services/product.service.js` (`getProductBySlug`, block starting ~line 9530)

**Interfaces:**
- Consumes: `resolveRevenueRates`, `calcPlatformCostPrice`, `calcPlatformSellingPrice`, `roundUpTo100` (all already imported), `DEFAULT_PACK_RATE_MIN_UNITS` (add to the require from `../utils/pricing`).
- Produces: each size in `availableAt[].sizes[]` gains `pricing.packUnitPrice`, `pricing.packThreshold`, `pricing.packSavingsPct` (null when not eligible). The client (Task 7/8) reads exactly these paths.

- [ ] **Step 1: Compute pack fields in the getProductBySlug size block**

In the block inside `getProductBySlug` (the one modified in Task 2 Step 1, ~line 9537), after the line `const websitePrice = platformSellingPrice;` insert:

```js
      // Quantity-triggered pack pricing: second per-unit price earned at qty >= unitsPerPack.
      // Runs the same pipeline (incl. sale discount below) at the tenant's pack rates.
      const _unitsPerPack = size?.unitsPerPack ?? 1;
      const _packMinUnits = tenant?.packRateMinUnits ?? DEFAULT_PACK_RATE_MIN_UNITS;
      const _packReachable = !size?.maxOrderQuantity || size.maxOrderQuantity >= _unitsPerPack;
      let packUnitPrice = null;
      let packThreshold = null;
      let packSavingsPct = null;
      if (_unitsPerPack >= _packMinUnits && _packReachable && websitePrice > 0) {
        const packRates = resolveRevenueRates(tenant, _unitsPerPack);
        const packCost = calcPlatformCostPrice(costPrice, sellingPrice, revenueModel, packRates.markupPct, packRates.commissionPct);
        let packSelling = calcPlatformSellingPrice(packCost, platformMarkupPct, productDiscount, { tenantStorePrice: sellingPrice, platformMarkupOverridePct: size?.platformMarkupOverridePct ?? null });
        if (saleActive && subProduct.saleDiscountValue > 0) {
          const discountType = subProduct.saleType || 'percentage';
          packSelling = discountType === 'fixed'
            ? roundUpTo100(Math.max(0, packSelling - subProduct.saleDiscountValue))
            : roundUpTo100(packSelling * (1 - subProduct.saleDiscountValue / 100));
        }
        if (packSelling > 0 && packSelling < websitePrice) {
          packUnitPrice = packSelling;
          packThreshold = _unitsPerPack;
          packSavingsPct = Math.round(((websitePrice - packSelling) / websitePrice) * 100);
        }
      }
```

NOTE: this insert must go AFTER the sale-discount `if (saleActive ...)` block (so `websitePrice` is final), i.e. immediately after `const websitePrice = platformSellingPrice;`. `saleActive` is already defined above it.

- [ ] **Step 2: Add the fields to the returned size's `pricing` object**

In the same block's `return { ... }` (starts `_id: size._id,` ~line 9610), find the nested `pricing:` object (it contains `websitePrice`) and add:

```js
          packUnitPrice,
          packThreshold,
          packSavingsPct,
```

If the `require('../utils/pricing')` destructure at the top of `product.service.js` doesn't already include `DEFAULT_PACK_RATE_MIN_UNITS`, add it.

- [ ] **Step 3: Run suite + syntax check**

Run: `node --check server/services/product.service.js` → Expected: no output.
Run: `npm test --prefix server` → Expected: 3 pre-existing failures only.

- [ ] **Step 4: Commit**

```bash
git add server/services/product.service.js
git commit -m "feat(platform): publish packUnitPrice/packThreshold on product-detail size payload"
```

---

### Task 4: Quantity-aware cart validation

**Files:**
- Modify: `server/services/cart.service.js` (`validateCartItems`, ~line 532)

**Interfaces:**
- Consumes: `calculateSizePricing` (Task 1 shape: `finalPrice`, `packUnitPrice`, `packThreshold`, `packSavingsPct`).
- Produces: each validation result gains `baseUnitPrice` (single-unit price), `packUnitPrice`, `packThreshold`, `packSavingsPct`, `packApplied`; `currentPrice` is the quantity-aware effective price. Client (Task 8) relies on exactly these names.

- [ ] **Step 1: Make `validateCartItems` quantity-aware**

Replace this block:

```js
    // Platform selling price (markup/commission + product discount) — same pipeline
    // the storefront product page uses, NOT the raw tenant-facing Size.sellingPrice.
    const currentPrice = calculateSizePricing(
      size, subProduct.product, subProduct.tenant,
      subProduct.costPrice, subProduct.baseSellingPrice
    ).finalPrice;
```

with:

```js
    // Platform selling price (markup/commission + product discount) — same pipeline
    // the storefront product page uses, NOT the raw tenant-facing Size.sellingPrice.
    // Quantity-aware: at quantity >= packThreshold the whole line pays packUnitPrice.
    const sizePricing = calculateSizePricing(
      size, subProduct.product, subProduct.tenant,
      subProduct.costPrice, subProduct.baseSellingPrice
    );
    const packApplied = sizePricing.packUnitPrice != null &&
      sizePricing.packThreshold != null && quantity >= sizePricing.packThreshold;
    const currentPrice = packApplied ? sizePricing.packUnitPrice : sizePricing.finalPrice;
    const packInfo = {
      baseUnitPrice: sizePricing.finalPrice,
      packUnitPrice: sizePricing.packUnitPrice,
      packThreshold: sizePricing.packThreshold,
      packSavingsPct: sizePricing.packSavingsPct,
      packApplied,
    };
```

Then spread `...packInfo` into each of the four non-`unavailable` return objects in the function (`out_of_stock`, `quantity_reduced`, `price_changed`, `ok`), e.g.:

```js
    return { ...base, ...packInfo, status: 'ok', available: true, currentPrice, priceDiff: 0,
      stockStatus: size.availability, maxQuantity, isLowStock };
```

Also update the `tenant` populate select in this function to keep the pack fields it already selects (no change expected — verify `packMarkupPercentage packCommissionPercentage packRateMinUnits` are present, they are as of line ~543).

- [ ] **Step 2: Run suite**

Run: `node --check server/services/cart.service.js` then `npm test --prefix server` → Expected: 3 pre-existing failures only.

- [ ] **Step 3: Commit**

```bash
git add server/services/cart.service.js
git commit -m "feat(cart): quantity-aware pack pricing in cart validation"
```

---

### Task 5: Server-authoritative checkout pricing + pack payout

**Files:**
- Modify: `server/models/Order.js` (~line 96, after `revenueRateAtPurchase`)
- Modify: `server/controllers/order.controller.js` (~lines 84–180)

**Interfaces:**
- Consumes: `resolveLineRates(tenant, size, quantity)`, `calculateSizePricing`, `resolveEffectiveUnitPrice`, `roundUpTo100` from `../utils/pricing` (Task 1).
- Produces: order items priced server-side; `packRateApplied: Boolean` on order items.

- [ ] **Step 1: Add `packRateApplied` to the order item schema**

In `server/models/Order.js`, directly after the `revenueRateAtPurchase` field definition, add:

```js
  // True when the quantity-triggered pack rate was applied to this line
  packRateApplied: {
    type: Boolean,
    default: false,
  },
```

- [ ] **Step 2: Expand the bulk fetches in `order.controller.js`**

Change the SubProduct select (~line 89) from `'_id costPrice baseSellingPrice tenant'` to:

```js
          .select('_id costPrice baseSellingPrice tenant product isOnSale saleDiscountValue saleType saleStartDate saleEndDate')
```

Change the Size select (~line 94) from `'_id costPrice sellingPrice tenant unitsPerPack'` to:

```js
          .select('_id costPrice sellingPrice tenant unitsPerPack maxOrderQuantity platformMarkupOverridePct discountValue discountType discountStart discountEnd')
```

After the `tenantMap` is built (~line 121), add a Product bulk fetch (check the top of the file — `Product` should already be required; if not, add `const Product = require('../models/Product');`):

```js
  // Product docs are needed to recompute the authoritative platform price
  const orderProductIds = [...new Set(subProducts.map(sp => sp.product?.toString()).filter(Boolean))];
  const orderProducts = orderProductIds.length
    ? await Product.find({ _id: { $in: orderProductIds } }).select('_id platformMarkup platformDiscount').lean()
    : [];
  const productMap = new Map(orderProducts.map(p => [p._id.toString(), p]));
```

Update the pricing import at the top to:

```js
const { calcPlatformCostPrice, resolveRevenueRates, resolveLineRates, resolveEffectiveUnitPrice, calculateSizePricing, roundUpTo100, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');
```

- [ ] **Step 3: Recompute the unit price server-side and pay out at line rates**

Inside the `orderItems = items.map(...)` callback, replace:

```js
    // Multi-pack sizes are paid out at the tenant's reduced pack rates
    const { markupPct, commissionPct } = resolveRevenueRates(tenant, sz?.unitsPerPack ?? 1);

    const customerPrice = item.price;  // platform selling price per unit
    const qty           = item.quantity;
```

with:

```js
    const qty = item.quantity;
    // Quantity-triggered pack rates: whole line at pack rates when qty >= unitsPerPack
    const { markupPct, commissionPct, isPackRate } = resolveLineRates(tenant, sz, qty);

    // Server-authoritative unit price — same authority as cart validateCartItems
    // (calculateSizePricing), plus the SubProduct sale discount the product page applies.
    const productDoc = productMap.get(sp?.product?.toString());
    let serverUnitPrice = 0;
    if (sz && tenant) {
      const sizePricing = calculateSizePricing(sz, productDoc, tenant, sp?.costPrice ?? 0, sp?.baseSellingPrice ?? 0);
      serverUnitPrice = resolveEffectiveUnitPrice(sizePricing, qty);
      if (serverUnitPrice > 0 && sp) {
        const now = new Date();
        const saleStart = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
        const saleEnd   = sp.saleEndDate   ? new Date(sp.saleEndDate)   : null;
        const saleActive = sp.isOnSale && (sp.saleDiscountValue ?? 0) > 0 &&
          (!saleStart || now >= saleStart) && (!saleEnd || now <= saleEnd);
        if (saleActive) {
          serverUnitPrice = (sp.saleType || 'percentage') === 'fixed'
            ? roundUpTo100(Math.max(0, serverUnitPrice - sp.saleDiscountValue))
            : roundUpTo100(serverUnitPrice * (1 - sp.saleDiscountValue / 100));
        }
      }
    }
    // Fall back to the client price only when the line can't be priced (no size data)
    const customerPrice = serverUnitPrice > 0 ? serverUnitPrice : item.price;
```

And in the returned order-item object, after `revenueRateAtPurchase: ...`, add:

```js
      packRateApplied:       isPackRate,
```

- [ ] **Step 4: Run suite**

Run: `node --check server/controllers/order.controller.js` then `npm test --prefix server` → Expected: 3 pre-existing failures only (the 2 SO-number failures are pre-existing — do not chase them).

- [ ] **Step 5: Commit**

```bash
git add server/models/Order.js server/controllers/order.controller.js
git commit -m "feat(checkout): server-authoritative pricing + quantity-triggered pack payout"
```

---

### Task 6: POS drops the pack trigger (pricelists own POS quantity pricing)

**Files:**
- Modify: `server/controllers/pos.controller.js` (~line 353)
- Modify: `server/routes/pos.routes.js` (~line 165)
- Modify: `server/routes/posCombo.routes.js` (~line 12)

**Interfaces:**
- Consumes: `resolveRevenueRates(tenant, 1)`.
- Produces: POS platform-revenue math always at normal rates; quantity/bulk pricing at POS remains the job of tenant pricelists (`Pricelist` rules with `minQuantity`, already enforced).

- [ ] **Step 1: Replace the three static pack keyings**

In each of the three files, the pattern is:

```js
  // Multi-pack sizes use the tenant's reduced pack rates
  const { markupPct, commissionPct } = resolveRevenueRates(tenant, sizeDoc?.unitsPerPack ?? 1);
```

Replace each (watch the small indent differences — pos.routes.js uses 6-space indent) with:

```js
  // POS quantity/bulk pricing comes from tenant pricelists (minQuantity rules),
  // not the platform pack trigger — always the normal rates here.
  const { markupPct, commissionPct } = resolveRevenueRates(tenant, 1);
```

- [ ] **Step 2: Run suite**

Run: `npm test --prefix server` → Expected: 3 pre-existing failures only.

- [ ] **Step 3: Commit**

```bash
git add server/controllers/pos.controller.js server/routes/pos.routes.js server/routes/posCombo.routes.js
git commit -m "refactor(pos): drop static pack-rate keying — pricelist minQuantity rules own POS bulk pricing"
```

---

### Task 7: Pack-SKU migration script

**Files:**
- Create: `server/scripts/migrate-pack-skus.js`

**Interfaces:**
- Consumes: `Size`, `SubProduct` models.
- Produces: standalone script; dry-run by default, `--apply` to write.

- [ ] **Step 1: Write the script**

Look at an existing script first for the connection pattern (`ls server/scripts/ | head` and read one, e.g. any `backfill-*.js`) and mirror its dotenv/mongoose connection setup exactly. Script body:

```js
/**
 * Retire pack SKUs (Size.unitsPerPack >= 2) in favor of quantity-triggered
 * pack pricing on the single size:
 *   1. find the sibling single size on the same subproduct (same volumeMl)
 *   2. fold the pack's stock into the single (packStock × unitsPerPack)
 *   3. copy unitsPerPack onto the single as its pack threshold
 *   4. deactivate the pack SKU
 *
 * Usage: node server/scripts/migrate-pack-skus.js [--apply]   (dry-run by default)
 */
const APPLY = process.argv.includes('--apply');

async function run() {
  const Size = require('../models/Size');

  const packSizes = await Size.find({ unitsPerPack: { $gte: 2 } });
  console.log(`Found ${packSizes.length} pack SKU size(s)`);

  for (const pack of packSizes) {
    const single = await Size.findOne({
      _id: { $ne: pack._id },
      subproduct: pack.subproduct,
      volumeMl: pack.volumeMl,
      unitsPerPack: 1,
    });
    if (!single) {
      console.log(`SKIP ${pack._id} (${pack.displayName || pack.size}): no matching single size (volumeMl=${pack.volumeMl})`);
      continue;
    }
    const foldedUnits = (pack.stock || 0) * pack.unitsPerPack;
    console.log(`${APPLY ? 'APPLY' : 'DRY'} pack ${pack._id} (${pack.displayName || pack.size}, stock=${pack.stock}) → single ${single._id}: +${foldedUnits} units, threshold=${pack.unitsPerPack}`);
    if (APPLY) {
      single.stock = (single.stock || 0) + foldedUnits;
      single.unitsPerPack = pack.unitsPerPack;
      await single.save();
      pack.status = 'inactive';
      pack.availability = 'out_of_stock';
      pack.stock = 0;
      await pack.save();
    }
  }
  console.log(APPLY ? 'Done.' : 'Dry run complete — re-run with --apply to write.');
}
```

Before finalizing, verify the `Size` schema's actual `status`/`availability` enum values (`grep -n "status\|availability" server/models/Size.js | head -20`) and use valid enum members for deactivation; if `Size` has no `status` field, deactivate via `availability: 'out_of_stock'` plus `stock: 0` only.

- [ ] **Step 2: Dry-run against the dev DB**

Run: `node server/scripts/migrate-pack-skus.js`
Expected: lists the 2 known pack SKUs ("75cl ×6", "1.75L ×6") with fold plans, no writes. Do NOT run `--apply` — that's the user's call at deploy time.

- [ ] **Step 3: Commit**

```bash
git add server/scripts/migrate-pack-skus.js
git commit -m "chore(scripts): pack-SKU → quantity-threshold migration (dry-run default)"
```

---

### Task 8: Client — product page pack price display

**Files:**
- Modify: `client/apps/platform/src/components/Product/Detail/SizeSelector.tsx`
- Modify: the parent that builds `VendorSize[]` from the API payload (find it: `grep -rn "displayPrice" client/apps/platform/src/components/Product/Detail/index.tsx | head`)

**Interfaces:**
- Consumes: `availableAt[].sizes[].pricing.packUnitPrice / packThreshold / packSavingsPct` (Task 3).
- Produces: `VendorSize` gains `packUnitPrice?: number | null; packThreshold?: number | null; packSavingsPct?: number | null;`.

- [ ] **Step 1: Extend the `VendorSize` interface and the size mapping**

In `SizeSelector.tsx` add to `interface VendorSize`:

```ts
  packUnitPrice?: number | null;
  packThreshold?: number | null;
  packSavingsPct?: number | null;
```

Then locate where the parent (`Detail/index.tsx` or equivalent — grep for where `displayPrice`/`currencySymbol` size objects are constructed from `sizeEntry.pricing`) builds the size objects, and map the three new fields through from `sizeEntry.pricing`:

```ts
  packUnitPrice: sizeEntry.pricing?.packUnitPrice ?? null,
  packThreshold: sizeEntry.pricing?.packThreshold ?? null,
  packSavingsPct: sizeEntry.pricing?.packSavingsPct ?? null,
```

- [ ] **Step 2: Add the pack banner to the selected-size summary**

In `SizeSelector.tsx`, inside the `{selectedSizeData && (...)}` summary card (the one showing `{selectedSizeData.stock} items available`), add after the stock/min-qty row:

```tsx
            {selectedSizeData.packUnitPrice && selectedSizeData.packThreshold ? (
              <div className="mt-2 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Buy {selectedSizeData.packThreshold}+ and pay {selectedSizeData.currencySymbol}
                {selectedSizeData.packUnitPrice.toLocaleString()} each
                {selectedSizeData.packSavingsPct ? ` — save ${selectedSizeData.packSavingsPct}%` : ''}
              </div>
            ) : null}
```

Note there are TWO `selectedSizeData &&` summary blocks in the file (horizontal ~line 51 and vertical ~line 166 layouts) — add the banner to both.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p client/apps/platform` (record the error count BEFORE your change first; it must not increase).

- [ ] **Step 4: Commit**

```bash
git add client/apps/platform/src/components/Product/Detail/
git commit -m "feat(platform): show pack price banner on product-detail size selector"
```

---

### Task 9: Client — quantity-aware cart & checkout pricing

**Files:**
- Modify: `client/apps/platform/src/context/CartContext.tsx`
- Modify: `client/apps/platform/src/app/cart/page.tsx`
- Modify: `client/apps/platform/src/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `pricing.packUnitPrice`/`packThreshold` from the product payload; `baseUnitPrice`/`packUnitPrice`/`packThreshold`/`packApplied` from `/validate` results (Task 4).
- Produces: exported `getEffectiveUnitPrice(item)` used by cart page, checkout page, and `cartTotal`.

- [ ] **Step 1: Carry pack fields on the cart item**

In `CartContext.tsx`:

1a. Add to `interface CartItem`:

```ts
  packUnitPrice?: number | null;
  packThreshold?: number | null;
```

1b. Next to `getPriceFromAvailableAt`, add:

```ts
const getPackFromAvailableAt = (product: ProductType, vendorName: string, size: string): { packUnitPrice: number | null; packThreshold: number | null } => {
  const none = { packUnitPrice: null, packThreshold: null };
  if (!product.availableAt || !Array.isArray(product.availableAt)) return none;
  const vendorEntry = product.availableAt.find((v: any) => v.tenant?.name === vendorName);
  const sizeEntry = vendorEntry?.sizes?.find((s: any) => s.size === size);
  if (sizeEntry?.pricing?.packUnitPrice && sizeEntry?.pricing?.packThreshold) {
    return { packUnitPrice: sizeEntry.pricing.packUnitPrice, packThreshold: sizeEntry.pricing.packThreshold };
  }
  return none;
};

/** Per-unit price a line actually pays: pack price once quantity reaches the threshold. */
export const getEffectiveUnitPrice = (item: { price?: number; quantity?: number; packUnitPrice?: number | null; packThreshold?: number | null }): number =>
  item.packUnitPrice && item.packThreshold && (item.quantity || 1) >= item.packThreshold
    ? item.packUnitPrice
    : (item.price || 0);
```

1c. In the `ADD_TO_CART` reducer case (where `price: itemPrice` is set on `newItem`) and the `UPDATE_CART` case (where `price: itemPrice` is set in the map), also set:

```ts
        ...getPackFromAvailableAt(product, selectedVendor, selectedSize),
```

(in `UPDATE_CART` the product is `existingItem` and the vendor/size are the destructured `vendor`/`size`). If `ADD_TO_CART` merges into an existing line instead of pushing (check the reducer), apply the same spread there.

1d. `cartTotal` (~line 510): change `const itemPrice = item.price || 0;` to `const itemPrice = getEffectiveUnitPrice(item);`.

1e. In the validate call payload (~line 459, `price: item.price || 0`), send the effective price so the server's quantity-aware comparison lines up: `price: getEffectiveUnitPrice(item),`. In `applyValidationUpdates` (~line 500), sync the base price and pack fields from the validation result:

```ts
        const newPrice = (v as any).baseUnitPrice > 0 ? (v as any).baseUnitPrice : (v.currentPrice > 0 ? v.currentPrice : item.price);
        return { ...item, price: newPrice, quantity: newQty,
          packUnitPrice: (v as any).packUnitPrice ?? item.packUnitPrice ?? null,
          packThreshold: (v as any).packThreshold ?? item.packThreshold ?? null };
```

Also add `baseUnitPrice?: number; packUnitPrice?: number | null; packThreshold?: number | null; packApplied?: boolean;` to the `CartItemValidation` interface (~line 62).

- [ ] **Step 2: Cart page — effective price, tag, and nudge**

In `client/apps/platform/src/app/cart/page.tsx`:

2a. Import `getEffectiveUnitPrice` from the cart context module.

2b. Line-total display (~line 396): change `formatPrice((item.price || 0) * (item.quantity || 1))` to `formatPrice(getEffectiveUnitPrice(item) * (item.quantity || 1))`.

2c. Below the quantity stepper / price area of each line item, add:

```tsx
{item.packUnitPrice && item.packThreshold ? (
  (item.quantity || 1) >= item.packThreshold ? (
    <span className="inline-block mt-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      Pack price applied — {formatPrice(item.packUnitPrice)} each
    </span>
  ) : (
    <span className="inline-block mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      Add {item.packThreshold - (item.quantity || 1)} more to pay {formatPrice(item.packUnitPrice)} each
    </span>
  )
) : null}
```

2d. Check whether the page computes its own subtotal from `item.price` (grep `item.price` in the file) — replace any such usages with `getEffectiveUnitPrice(item)`; the context `cartTotal` is already effective from Step 1d.

- [ ] **Step 3: Checkout page — post and display effective prices**

In `client/apps/platform/src/app/checkout/page.tsx`, import `getEffectiveUnitPrice` and replace the three `item.price` usages (lines ~348 `price: item.price,`, ~605 `price: item.price || 0,`, ~1165 `fmt(item.price * (item.quantity || 1))`) with `getEffectiveUnitPrice(item)`. (The server recomputes anyway per Task 5, but display/totals must match what will be charged.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p client/apps/platform` → error count must not increase vs the baseline recorded in Task 8.

- [ ] **Step 5: Commit**

```bash
git add client/apps/platform/src/context/CartContext.tsx client/apps/platform/src/app/cart/page.tsx client/apps/platform/src/app/checkout/page.tsx
git commit -m "feat(platform): quantity-aware pack pricing in cart and checkout"
```

---

### Task 10: Full verification

- [ ] **Step 1: Server suite**

Run: `npm test --prefix server`
Expected: only the 3 pre-existing failures (2 SO-number, 1 pricelist-scope). All packPricing tests green.

- [ ] **Step 2: Client type checks**

Run: `npx tsc --noEmit -p client/apps/platform` → no new errors vs baseline.

- [ ] **Step 3: Manual smoke test (dev server + browser)**

With the dev stack running: set a dev-DB size to `unitsPerPack: 6` (its tenant must have `packMarkupPercentage: 10`), then verify: (a) product page shows the "Buy 6+" banner with a cheaper per-unit price rounded to ₦100; (b) adding 6 to the cart flips the line to the pack price with the green tag, 5 shows the amber nudge; (c) checkout order total uses the pack price and the created order's item has `packRateApplied: true` and `revenueRateAtPurchase: 10`.

- [ ] **Step 4: Report** — summarize results to the user; do not push without being asked.
