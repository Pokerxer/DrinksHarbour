# Sales Pricelist/Editable-Price/Edit-UI/Invoice-Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sales quotations/orders authoritatively apply the tenant's pricelist (incl. bundle/volume rules) server-side, let staff edit a line's unit price (with an override flag), add a real edit capability for existing draft/sent documents, and show Payment Terms on the invoice view.

**Architecture:** Extract the pricelist-rule/bundle-picking math that already exists inline in `pos.controller.js` into a pure, shared module; reuse it from a new sales-pricing service that recomputes line prices server-side unless a line is explicitly operator-overridden. On the client, the create page's line table gets an editable Unit Price input and is generalized into a `create`/`edit` mode so it can also power a new `/sales/[id]/edit` route.

**Tech Stack:** Express + Mongoose (`server/`), Next.js App Router + React + TypeScript (`client/apps/admin/`), `node:test` for server tests (no `mongodb-memory-server` — Mongoose model methods are mocked with `t.mock.method`).

## Global Constraints

- Server tests use `node --test __tests__/` from `server/` (per `server/package.json`'s `test` script) and mock Mongoose models with `t.mock.method` — never boot a real DB connection in a test.
- Any code path that touches a live Mongoose model must stay safe when `mongoose.connection.readyState !== 1` (disconnected) — the existing `defaultPromotionEngine` pattern in `salesOrder.service.js` is the precedent: return `null`/skip rather than let an unmocked query hang on command buffering.
- Client typecheck: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` must show no new errors beyond the existing TS2688 baseline (currently 27).
- Money is NGN-integer convention throughout; round with `Math.round(x * 100) / 100` only where the codebase already does (per-unit price), never introduce new fractional-kobo drift.
- Follow this repo's existing per-line money model: `unitPrice` is a single per-unit snapshot; there is no separate "bundle discount" schema field on `SalesOrder.items` — bundle/rule savings fold into `unitPrice` directly (see spec `docs/superpowers/specs/2026-06-24-sales-pricelist-editable-price-payment-terms-design.md` §1 note).

---

### Task 1: Shared pricelist-rule + bundle-picking pure functions

**Files:**
- Create: `server/services/pricelistPricing.service.js`
- Test: `server/__tests__/pricelistPricing.service.test.js`

**Interfaces:**
- Produces: `findMatchingPriceRules(rules, subProductId, quantity)`, `applyPriceRules(price, costPrice, sortedRules)`, `pickBestBundle(dbBundles, pricelistRules, quantity, subProductId, { price, costPrice })`, `applyBundleOverride(price, bestBundle, costPrice, originalPrice)` → `{ price, overridden }`, `computeBundleLineDiscount(bestBundle, lineGross, quantity, itemDiscAmt, bundleOverridePrice)` → number. All pure, no DB/Mongoose imports.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/pricelistPricing.service.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test __tests__/pricelistPricing.service.test.js`
Expected: FAIL — `Cannot find module '../services/pricelistPricing.service'`

- [ ] **Step 3: Write the implementation**

Create `server/services/pricelistPricing.service.js`:

```js
// server/services/pricelistPricing.service.js
//
// Pure pricelist-rule + bundle-picking math, lifted verbatim from the inline
// logic in pos.controller.js's createPOSOrder so both POS and the /sales
// module compute pricing identically. No DB access — every function takes
// plain data and returns plain data.

/**
 * Eligible price rules (fixed/formula/discount/flash_sale — excludes bundle),
 * filtered by date window + minQuantity, then sorted: ascending sequence,
 * then descending minQuantity (so a higher volume tier wins a tie). Product-
 * specific rules shadow all-products rules entirely when any exist.
 */
function findMatchingPriceRules(rules, subProductId, quantity) {
  if (!rules?.length) return [];
  const now = new Date();
  const pid = String(subProductId);

  const eligible = rules.filter((r) =>
    r.priceType !== 'bundle' &&
    !(r.endDate && new Date(r.endDate) < now) &&
    !(r.startDate && new Date(r.startDate) > now) &&
    (Number(r.minQuantity) || 0) <= quantity
  );

  const specific = eligible.filter((r) => {
    const rid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
    return rid && rid === pid;
  });
  const global = eligible.filter((r) => !r.subProduct);
  const pool = specific.length > 0 ? specific : global;

  return pool.sort((a, b) => {
    const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
    return seqDiff !== 0 ? seqDiff : (Number(b.minQuantity) || 0) - (Number(a.minQuantity) || 0);
  });
}

/** Sequentially applies already-sorted price rules to a base price. */
function applyPriceRules(price, costPrice, sortedRules) {
  let result = price;
  for (const rule of sortedRules || []) {
    if (rule.priceType === 'fixed') {
      const fp = Number(rule.fixedPrice);
      if (fp > 0) result = fp;
    } else if (rule.priceType === 'formula') {
      const markup = Number(rule.markupPercentage || 0);
      if (costPrice > 0) result = Math.round(costPrice * (1 + markup / 100) * 100) / 100;
    } else if (rule.priceType === 'discount') {
      if (rule.discountType === 'fixed') {
        const amt = Number(rule.discountAmount || 0);
        if (amt > 0) result = Math.max(0, result - amt);
      } else {
        const pct = Number(rule.discountPercentage || 0);
        if (pct > 0) result = Math.max(0, result * (1 - pct / 100));
      }
    } else if (rule.priceType === 'flash_sale') {
      const pct = Number(rule.flashSalePercentage || 0);
      if (pct > 0) result = Math.max(0, result * (1 - pct / 100));
    }
  }
  return result;
}

/**
 * Merges DB bundleDeals with pricelist `priceType:'bundle'` rules scoped to
 * subProductId, filters to qualifying (active, not expired, quantity met),
 * and returns the single best-savings candidate (or null).
 */
function pickBestBundle(dbBundles, pricelistRules, quantity, subProductId, { price, costPrice }) {
  const now = new Date();
  const candidates = [...(dbBundles || [])];

  for (const r of pricelistRules || []) {
    if (r.priceType !== 'bundle' || !r.bundleQuantity) continue;
    if (r.endDate && new Date(r.endDate) < now) continue;
    if (r.startDate && new Date(r.startDate) > now) continue;
    if (r.bundleDiscountType !== 'no_discount' && !r.bundleDiscount) continue;
    if ((Number(r.minQuantity) || 0) > quantity) continue;
    const rid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
    if (rid && rid !== String(subProductId)) continue;
    candidates.push({
      name: r.bundleName || `Buy ${r.bundleQuantity}+`,
      quantity: r.bundleQuantity,
      discount: r.bundleDiscount || 0,
      discountType: r.bundleDiscountType || 'percentage',
      active: true,
      validUntil: r.endDate || null,
    });
  }

  const qualifying = candidates.filter((bd) =>
    bd.active !== false &&
    (!bd.validUntil || new Date(bd.validUntil) >= now) &&
    quantity >= (bd.quantity || 1)
  );
  if (!qualifying.length) return null;

  const savings = (bd) => {
    const d = bd.discountType || 'percentage';
    if (d === 'fixed') return (bd.discount || 0) * quantity;
    if (d === 'markup_on_cost') return Math.max(0, price - costPrice * (1 + (bd.discount || 0) / 100)) * quantity;
    if (d === 'no_discount') return 0;
    return (price * quantity * Math.min(100, bd.discount || 0)) / 100;
  };

  return qualifying.sort((a, b) => savings(b) - savings(a))[0];
}

/**
 * markup_on_cost / no_discount bundle types replace the per-unit price
 * outright. percentage/fixed types do NOT change price here — the caller
 * applies those as a separate line-level discount via computeBundleLineDiscount.
 */
function applyBundleOverride(price, bestBundle, costPrice, originalPrice) {
  if (!bestBundle) return { price, overridden: false };
  const dt = bestBundle.discountType || 'percentage';

  if (dt === 'markup_on_cost') {
    const markup = bestBundle.discount || 0;
    if (costPrice > 0) {
      return { price: Math.round(costPrice * (1 + markup / 100) * 100) / 100, overridden: true };
    }
  } else if (dt === 'no_discount') {
    if (originalPrice && originalPrice > price) {
      return { price: originalPrice, overridden: true };
    }
  }
  return { price, overridden: false };
}

/**
 * The percentage/fixed bundle savings as a flat amount across the whole
 * line (POS keeps this separate from the per-unit price; see
 * applyBundleOverride). Returns 0 when the bundle already overrode price.
 */
function computeBundleLineDiscount(bestBundle, lineGross, quantity, itemDiscAmt, bundleOverridePrice) {
  if (!bestBundle || bundleOverridePrice) return 0;
  const dt = bestBundle.discountType || 'percentage';
  const amt = dt === 'fixed'
    ? Math.min((bestBundle.discount || 0) * quantity, lineGross - itemDiscAmt)
    : parseFloat(((lineGross * Math.min(100, bestBundle.discount || 0)) / 100).toFixed(2));
  return Math.max(0, amt);
}

module.exports = {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test __tests__/pricelistPricing.service.test.js`
Expected: PASS — all 17 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/pricelistPricing.service.js server/__tests__/pricelistPricing.service.test.js
git commit -m "feat(server): extract pricelist rule + bundle picking into a shared pure module"
```

---

### Task 2: Refactor `pos.controller.js` to use the shared module

**Files:**
- Modify: `server/controllers/pos.controller.js:26` (import line), `server/controllers/pos.controller.js:2153-2213` (price rules block), `server/controllers/pos.controller.js:2215-2306` (bundle block), `server/controllers/pos.controller.js` (export `computePOSPricing`)

**Interfaces:**
- Consumes: `findMatchingPriceRules`, `applyPriceRules`, `pickBestBundle`, `applyBundleOverride`, `computeBundleLineDiscount` from Task 1.
- Produces: `exports.computePOSPricing` (newly exported, used by Task 4).

This is a **behavior-preserving extraction** — the resulting `createPOSOrder` must compute byte-identical `effectivePrice`/`bundleDiscAmt`/`appliedPlRuleSnapshot` values to before. There's no dedicated automated test for this math today (confirmed: no POS pricing test suite exists), so verification is the full test run staying green plus a manual sanity check.

- [ ] **Step 1: Add the import**

In `server/controllers/pos.controller.js`, find line 26:

```js
const { calcPlatformCostPrice, calcPlatformSellingPrice, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');
```

Add immediately after it:

```js
const {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
} = require('../services/pricelistPricing.service');
```

- [ ] **Step 2: Replace the inline price-rules block**

Find this block (currently lines ~2153-2213):

```js
      // ── Apply pricelist price rules sequentially (mirrors client findMatchingPricelistRules) ──
      // Multiple rules can apply in sequence order: base → rule1 → rule2 → ...
      // e.g. fixed price rule, then percentage discount, then volume tier discount.
      let appliedPlRuleSnapshot = null;
      if (selectedPricelist?.rules?.length) {
        const plNow = new Date();
        const pid   = String(subProductId);

        const eligible = selectedPricelist.rules.filter(r =>
          r.priceType !== 'bundle' &&
          !(r.endDate   && new Date(r.endDate)   < plNow) &&
          !(r.startDate && new Date(r.startDate) > plNow) &&
          (Number(r.minQuantity) || 0) <= quantity
        );

        const specific = eligible.filter(r => {
          const rid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
          return rid && rid === pid;
        });
        const global = eligible.filter(r => !r.subProduct);
        const pool   = specific.length > 0 ? specific : global;

        // Sort: ascending sequence, then descending minQuantity (volume tier)
        const sortedRules = pool.sort((a, b) => {
          const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
          return seqDiff !== 0 ? seqDiff : (Number(b.minQuantity) || 0) - (Number(a.minQuantity) || 0);
        });

        // Apply each rule sequentially — each transforms the result of the previous
        for (const plRule of sortedRules) {
          if (plRule.priceType === 'fixed') {
            const fp = Number(plRule.fixedPrice);
            if (fp > 0) finalPrice = fp;
          } else if (plRule.priceType === 'formula') {
            const cost   = sizePricing.costPrice || 0;
            const markup = Number(plRule.markupPercentage || 0);
            if (cost > 0)
              finalPrice = Math.round(cost * (1 + markup / 100) * 100) / 100;
          } else if (plRule.priceType === 'discount') {
            if (plRule.discountType === 'fixed') {
              const amt = Number(plRule.discountAmount || 0);
              if (amt > 0) finalPrice = Math.max(0, finalPrice - amt);
            } else {
              const pct = Number(plRule.discountPercentage || 0);
              if (pct > 0) finalPrice = Math.max(0, finalPrice * (1 - pct / 100));
            }
          } else if (plRule.priceType === 'flash_sale') {
            const pct = Number(plRule.flashSalePercentage || 0);
            if (pct > 0) finalPrice = Math.max(0, finalPrice * (1 - pct / 100));
          }
        }

        // Record the first applied rule for the audit trail
        if (sortedRules.length > 0) {
          appliedPlRuleSnapshot = {
            ruleId:    sortedRules[0]._id,
            priceType: sortedRules[0].priceType,
            sequence:  sortedRules[0].sequence,
          };
        }
      }
```

Replace it with:

```js
      // ── Apply pricelist price rules sequentially (shared with /sales — pricelistPricing.service) ──
      let appliedPlRuleSnapshot = null;
      const sortedPriceRules = findMatchingPriceRules(selectedPricelist?.rules, subProductId, quantity);
      finalPrice = applyPriceRules(finalPrice, sizePricing.costPrice || 0, sortedPriceRules);
      if (sortedPriceRules.length > 0) {
        appliedPlRuleSnapshot = {
          ruleId:    sortedPriceRules[0]._id,
          priceType: sortedPriceRules[0].priceType,
          sequence:  sortedPriceRules[0].sequence,
        };
      }
```

- [ ] **Step 3: Replace the inline bundle-picking + override block**

Find this block (currently lines ~2215-2284):

```js
      // ── Bundle deals: find best qualifying deal for this line quantity ────────
      const nowBd = new Date();

      // Combine DB bundle deals with pricelist bundle rules (dynamic, not in DB)
      const allBundleCandidates = [...(sp.bundleDeals || [])];
      if (selectedPricelist?.rules?.length) {
        for (const r of selectedPricelist.rules) {
          if (r.priceType !== 'bundle' || !r.bundleQuantity) continue;
          if (r.endDate   && new Date(r.endDate)   < nowBd) continue;
          if (r.startDate && new Date(r.startDate) > nowBd) continue;
          if (r.bundleDiscountType !== 'no_discount' && !r.bundleDiscount) continue;
          // minQuantity: overall rule activation threshold (separate from bundleQuantity)
          if ((Number(r.minQuantity) || 0) > quantity) continue;
          const rid = r.subProduct?._id ? String(r.subProduct._id) : r.subProduct ? String(r.subProduct) : null;
          if (rid && rid !== String(subProductId)) continue;
          allBundleCandidates.push({
            name:         r.bundleName || `Buy ${r.bundleQuantity}+`,
            quantity:     r.bundleQuantity,
            discount:     r.bundleDiscount || 0,
            discountType: r.bundleDiscountType || 'percentage',
            active:       true,
            validUntil:   r.endDate || null,
          });
        }
      }

      // Pick the bundle that delivers the most absolute savings for the cashier
      const qualifyingBundles = allBundleCandidates.filter(bd =>
        bd.active !== false &&
        (!bd.validUntil || new Date(bd.validUntil) >= nowBd) &&
        quantity >= (bd.quantity || 1)
      );

      const bestBundle = qualifyingBundles.sort((a, b) => {
        // For price-override types, rank by estimated savings vs finalPrice
        const savings = (bd) => {
          const d = bd.discountType || 'percentage';
          if (d === 'fixed')          return (bd.discount || 0) * quantity;
          if (d === 'markup_on_cost') return Math.max(0, finalPrice - sizePricing.costPrice * (1 + (bd.discount || 0) / 100)) * quantity;
          if (d === 'no_discount')    return 0; // restores full price — 0 net "savings"
          return finalPrice * quantity * Math.min(100, bd.discount || 0) / 100;
        };
        return savings(b) - savings(a);
      })[0];

      // ── Effective unit price (some bundle types override finalPrice) ──────────
      let effectivePrice      = finalPrice;
      let bundleOverridePrice = false;

      if (bestBundle) {
        const dt = bestBundle.discountType || 'percentage';

        if (dt === 'markup_on_cost') {
          // price = costPrice × (1 + markup%)
          const cost   = sizePricing.costPrice || 0;
          const markup = bestBundle.discount  || 0;
          if (cost > 0) {
            effectivePrice      = Math.round(cost * (1 + markup / 100) * 100) / 100;
            bundleOverridePrice = true;
          }

        } else if (dt === 'no_discount') {
          // Charge the pre-sale base price — removes flash sale / regular sale discount
          const priceBeforeSale = sizePricing.originalPrice;
          if (priceBeforeSale && priceBeforeSale > finalPrice) {
            effectivePrice      = priceBeforeSale;
            bundleOverridePrice = true;
          }
        }
      }
```

Replace it with:

```js
      // ── Bundle deals: find best qualifying deal for this line quantity (shared) ──
      const bestBundle = pickBestBundle(sp.bundleDeals, selectedPricelist?.rules, quantity, subProductId, {
        price: finalPrice,
        costPrice: sizePricing.costPrice || 0,
      });

      // ── Effective unit price (some bundle types override finalPrice) ──────────
      const bundleOverride   = applyBundleOverride(finalPrice, bestBundle, sizePricing.costPrice || 0, sizePricing.originalPrice);
      let effectivePrice      = bundleOverride.price;
      let bundleOverridePrice = bundleOverride.overridden;
```

- [ ] **Step 4: Replace the inline `bundleDiscAmt` computation**

Find this block (currently lines ~2299-2306):

```js
      // Bundle discount amount (only for percentage / fixed types; override types already set effectivePrice)
      let bundleDiscAmt = 0;
      if (bestBundle && !bundleOverridePrice) {
        const dt = bestBundle.discountType || 'percentage';
        bundleDiscAmt = dt === 'fixed'
          ? Math.min((bestBundle.discount || 0) * quantity, lineGross - itemDiscAmt)
          : parseFloat((lineGross * Math.min(100, bestBundle.discount || 0) / 100).toFixed(2));
        bundleDiscAmt = Math.max(0, bundleDiscAmt);
      }
```

Replace it with:

```js
      // Bundle discount amount (only for percentage / fixed types; override types already set effectivePrice)
      const bundleDiscAmt = computeBundleLineDiscount(bestBundle, lineGross, quantity, itemDiscAmt, bundleOverridePrice);
```

- [ ] **Step 5: Export `computePOSPricing`**

`computePOSPricing` is declared as a plain `function computePOSPricing(sp, sizeDoc, tenant) {` at line 339 with no existing export. Find the line right after its closing brace (search for the function and its matching closing `}` — it ends just before the next function/comment block following its `return { sellingPrice, ... }` statement) and add an export immediately after the function body:

```js
exports.computePOSPricing = computePOSPricing;
```

- [ ] **Step 6: Run the full server test suite**

Run: `cd server && node --test __tests__/`
Expected: PASS — same pass count as before this task (no POS-pricing-specific suite exists, so this confirms nothing else broke: routes still load, no syntax errors, existing suites unaffected).

- [ ] **Step 7: Manual sanity check**

Start the server (`cd server && npm run dev` or however it's normally run) and exercise one POS sale with a pricelist that has a percentage discount rule and a bundle rule, confirming the receipt total matches what it did before this refactor (compare against a sale made before this change if possible, or simply confirm the math is internally consistent: line total = effectivePrice × quantity − bundleDiscAmt − cashier discount).

- [ ] **Step 8: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "refactor(server): pos.controller uses shared pricelistPricing.service (no behavior change)"
```

---

### Task 3: `SalesOrder` model — add `priceOverridden` to line items

**Files:**
- Modify: `server/models/SalesOrder.js:6-23` (lineSchema)
- Test: `server/__tests__/salesOrder.model.test.js`

**Interfaces:**
- Produces: `SalesOrder.items[].priceOverridden: Boolean` (default `false`), consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Read `server/__tests__/salesOrder.model.test.js` first to match its existing style, then add a test to it:

```js
test('a line item defaults priceOverridden to false and can be set true', () => {
  const SalesOrder = require('../models/SalesOrder');
  const doc = new SalesOrder({
    tenant: new (require('mongoose')).Types.ObjectId(),
    soNumber: 'SO000001',
    docType: 'order',
    items: [{ quantity: 1, unitPrice: 100, lineTotal: 100 }],
    orderStatus: 'draft',
  });
  assert.strictEqual(doc.items[0].priceOverridden, false);
  doc.items[0].priceOverridden = true;
  assert.strictEqual(doc.items[0].priceOverridden, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/salesOrder.model.test.js`
Expected: FAIL — `priceOverridden` is `undefined`, not `false`.

- [ ] **Step 3: Add the field**

In `server/models/SalesOrder.js`, find:

```js
  returnedQty:  { type: Number, default: 0, min: 0 },
});
```

Replace with:

```js
  returnedQty:  { type: Number, default: 0, min: 0 },
  priceOverridden: { type: Boolean, default: false }, // true = operator typed a manual unitPrice; server pricing skips this line
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/salesOrder.model.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/models/SalesOrder.js server/__tests__/salesOrder.model.test.js
git commit -m "feat(server): add priceOverridden flag to SalesOrder line items"
```

---

### Task 4: `salesPricing.service.js` — authoritative per-line price computation

**Files:**
- Create: `server/services/salesPricing.service.js`
- Test: `server/__tests__/salesPricing.service.test.js`

**Interfaces:**
- Consumes: `findMatchingPriceRules`, `applyPriceRules`, `pickBestBundle`, `applyBundleOverride`, `computeBundleLineDiscount` (Task 1); `exports.computePOSPricing` (Task 2).
- Produces: `computeLineUnitPrice({ subProductId, sizeId, quantity, pricelist, tenant })` → `Promise<number|null>`; `computeAuthoritativeLinePrices(items, { tenantId, pricelistId })` → `Promise<items>` (each non-overridden, subproduct-bearing item gets a recomputed `unitPrice`). Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/salesPricing.service.test.js`:

```js
// server/__tests__/salesPricing.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SubProduct = require('../models/SubProduct');
const Pricelist = require('../models/Pricelist');
const Tenant = require('../models/Tenant');
const { computePOSPricing } = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();

/** Minimal stand-in for a chained Mongoose query (.select().populate().lean()). */
function chainable(doc) {
  const obj = {
    select: () => obj,
    populate: () => obj,
    lean: async () => doc,
  };
  return obj;
}

test('computeAuthoritativeLinePrices leaves priceOverridden lines untouched without touching the DB', async (t) => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');
  // No model mocks set up — if this function tried to hit the DB it would
  // hang on Mongoose command buffering (no live connection in tests).
  const items = [{ subproduct: oid(), quantity: 3, unitPrice: 7777, priceOverridden: true }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId: oid(), pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 7777);
});

test('computeAuthoritativeLinePrices passes through a line with no subproduct unchanged', async () => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');
  const items = [{ quantity: 1, unitPrice: 50, priceOverridden: false }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId: oid(), pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 50);
});

test('computeAuthoritativeLinePrices recomputes unitPrice from the subproduct pipeline + a pricelist discount rule', async (t) => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');

  const tenantId = oid();
  const subProductId = oid();
  const pricelistId = oid();

  const tenantDoc = { _id: tenantId, revenueModel: 'markup', markupPercentage: 25, commissionPercentage: 12 };
  const spDoc = {
    _id: subProductId,
    product: { platformMarkup: 10 },
    baseSellingPrice: 5000,
    costPrice: 3000,
    isOnSale: false,
    flashSale: {},
    bundleDeals: [],
  };
  const pricelistDoc = {
    _id: pricelistId,
    tenant: tenantId,
    rules: [{ priceType: 'discount', discountType: 'fixed', discountAmount: 500, minQuantity: 0, sequence: 0 }],
  };

  t.mock.method(Tenant, 'findById', () => chainable(tenantDoc));
  t.mock.method(SubProduct, 'findById', () => chainable(spDoc));
  t.mock.method(Pricelist, 'findOne', () => chainable(pricelistDoc));

  const baseline = computePOSPricing(spDoc, null, tenantDoc).sellingPrice;

  const items = [{ subproduct: subProductId, quantity: 2, unitPrice: 1, priceOverridden: false }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId, pricelistId });

  assert.strictEqual(result[0].unitPrice, Math.round((baseline - 500) * 100) / 100);
});

test('computeAuthoritativeLinePrices leaves the line untouched if the subproduct lookup fails (best-effort)', async (t) => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');
  const tenantId = oid();

  t.mock.method(Tenant, 'findById', () => chainable({ _id: tenantId }));
  t.mock.method(SubProduct, 'findById', () => { throw new Error('db unavailable'); });

  const items = [{ subproduct: oid(), quantity: 1, unitPrice: 999, priceOverridden: false }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId, pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 999);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test __tests__/salesPricing.service.test.js`
Expected: FAIL — `Cannot find module '../services/salesPricing.service'`

- [ ] **Step 3: Write the implementation**

Create `server/services/salesPricing.service.js`:

```js
// server/services/salesPricing.service.js
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Pricelist = require('../models/Pricelist');
const Tenant = require('../models/Tenant');
const { computePOSPricing } = require('../controllers/pos.controller');
const {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
} = require('./pricelistPricing.service');

/**
 * The authoritative per-unit price for one line: runs the subproduct through
 * the same base pricing pipeline as POS (computePOSPricing), then the
 * tenant's pricelist price rules + bundle rules on top. Percentage/fixed
 * bundle savings fold into the per-unit price (Sales has no separate
 * line-level discount field the way POS's receipt breakdown does).
 */
async function computeLineUnitPrice({ subProductId, sizeId, quantity, pricelist, tenant }) {
  const sp = await SubProduct.findById(subProductId)
    .select('product sku baseSellingPrice basePriceBeforePricelist costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue flashSale bundleDeals')
    .populate('product', 'platformMarkup platformDiscount')
    .lean();
  if (!sp) return null;

  const sizeDoc = sizeId ? await Size.findById(sizeId).lean() : null;
  const pricing = computePOSPricing(sp, sizeDoc, tenant);
  if (!(pricing.sellingPrice > 0)) return pricing.sellingPrice;

  const cost = pricing.costPrice || 0;
  const sortedPriceRules = findMatchingPriceRules(pricelist?.rules, subProductId, quantity);
  let price = applyPriceRules(pricing.sellingPrice, cost, sortedPriceRules);

  const bestBundle = pickBestBundle(sp.bundleDeals, pricelist?.rules, quantity, subProductId, { price, costPrice: cost });
  const bundleOverride = applyBundleOverride(price, bestBundle, cost, pricing.originalPrice);
  if (bundleOverride.overridden) {
    price = bundleOverride.price;
  } else if (bestBundle) {
    const lineGross = price * quantity;
    const lineDiscount = computeBundleLineDiscount(bestBundle, lineGross, quantity, 0, false);
    if (lineDiscount > 0) price = Math.max(0, price - lineDiscount / quantity);
  }

  return Math.round(price * 100) / 100;
}

/**
 * Recomputes unitPrice for every line that has a subproduct and is not
 * priceOverridden. Best-effort per line: a lookup failure leaves that one
 * line's price untouched rather than failing the whole order.
 */
async function computeAuthoritativeLinePrices(items, { tenantId, pricelistId }) {
  const needsPricing = items.some((it) => !it.priceOverridden && it.subproduct);
  if (!needsPricing) return items;

  const tenant = await Tenant.findById(tenantId)
    .select('revenueModel markupPercentage commissionPercentage')
    .lean();
  const pricelist = pricelistId
    ? await Pricelist.findOne({ _id: pricelistId, tenant: tenantId }).lean()
    : null;

  const out = [];
  for (const it of items) {
    if (it.priceOverridden || !it.subproduct) {
      out.push(it);
      continue;
    }
    try {
      const unitPrice = await computeLineUnitPrice({
        subProductId: it.subproduct,
        sizeId: it.size,
        quantity: Number(it.quantity) || 0,
        pricelist,
        tenant,
      });
      out.push(unitPrice != null ? { ...it, unitPrice } : it);
    } catch {
      out.push(it);
    }
  }
  return out;
}

module.exports = { computeLineUnitPrice, computeAuthoritativeLinePrices };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test __tests__/salesPricing.service.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/services/salesPricing.service.js server/__tests__/salesPricing.service.test.js
git commit -m "feat(server): authoritative per-line sales pricing from subproduct + pricelist"
```

---

### Task 5: Wire authoritative pricing into `salesOrder.service.js`

**Files:**
- Modify: `server/services/salesOrder.service.js`
- Test: Create `server/__tests__/salesOrderPricing.test.js`

**Interfaces:**
- Consumes: `computeAuthoritativeLinePrices` (Task 4).
- Produces: `resolveLinePricing(items, deps)` (exported, injectable like `resolveLinePromotions`), used by `createSalesOrderDoc` and `applyEdit`. `mapLine` now carries `priceOverridden` through.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/salesOrderPricing.test.js`:

```js
// server/__tests__/salesOrderPricing.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

test('resolveLinePricing returns items unchanged when no pricing engine is available (no live DB connection)', async () => {
  const svc = require('../services/salesOrder.service');
  const items = [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }];
  const result = await svc.resolveLinePricing(items, { tenantId: oid(), pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 1234);
});

test('resolveLinePricing uses an injected pricing engine to recompute unitPrice', async () => {
  const svc = require('../services/salesOrder.service');
  const items = [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }];
  const fakeEngine = async (its) => its.map((it) => ({ ...it, unitPrice: 999 }));
  const result = await svc.resolveLinePricing(items, {
    tenantId: oid(), pricelistId: null, computeAuthoritativeLinePrices: fakeEngine,
  });
  assert.strictEqual(result[0].unitPrice, 999);
});

test('resolveLinePricing falls back to the original items if the injected engine throws', async () => {
  const svc = require('../services/salesOrder.service');
  const items = [{ subproduct: oid(), quantity: 1, unitPrice: 500, priceOverridden: false }];
  const throwingEngine = async () => { throw new Error('boom'); };
  const result = await svc.resolveLinePricing(items, {
    tenantId: oid(), pricelistId: null, computeAuthoritativeLinePrices: throwingEngine,
  });
  assert.strictEqual(result[0].unitPrice, 500);
});

test('mapLine carries priceOverridden through into the stored line shape', () => {
  const svc = require('../services/salesOrder.service');
  const line = svc.mapLine({ quantity: 1, unitPrice: 100, priceOverridden: true });
  assert.strictEqual(line.priceOverridden, true);
  const line2 = svc.mapLine({ quantity: 1, unitPrice: 100 });
  assert.strictEqual(line2.priceOverridden, false);
});

test('applyEdit updates pricelist + appliedPricelist when present in the patch body', async () => {
  const svc = require('../services/salesOrder.service');
  const so = {
    tenant: oid(),
    items: [],
    createdAt: new Date(),
    pricelist: null,
    appliedPricelist: undefined,
  };
  await svc.applyEdit(so, { pricelist: 'pl1', appliedPricelist: { pricelistId: 'pl1', pricelistName: 'Wholesale' } });
  assert.strictEqual(so.pricelist, 'pl1');
  assert.strictEqual(so.appliedPricelist.pricelistName, 'Wholesale');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test __tests__/salesOrderPricing.test.js`
Expected: FAIL — `svc.resolveLinePricing is not a function`, `appliedPricelist` not updated, etc.

- [ ] **Step 3: Add `resolveLinePricing` and wire it in**

In `server/services/salesOrder.service.js`, find:

```js
/**
 * The real promotion engine, but ONLY when a DB connection is live. Without one
 * (unit tests, offline) it returns null so resolveLinePromotions skips the
 * lookup instead of hanging on Mongoose command buffering.
 */
function defaultPromotionEngine() {
```

Insert immediately **before** that comment block:

```js
/**
 * The authoritative pricing engine, but ONLY when a DB connection is live —
 * same guard as defaultPromotionEngine below: without one (unit tests,
 * offline) resolveLinePricing skips the lookup instead of hanging on
 * Mongoose command buffering, leaving items' submitted unitPrice untouched.
 */
function defaultPricingEngine() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      return require('./salesPricing.service').computeAuthoritativeLinePrices;
    }
  } catch {
    // mongoose/salesPricing.service unavailable — treat as no recompute
  }
  return null;
}

/**
 * Recompute unitPrice for every line against the tenant's pricelist (price
 * rules + bundle deals) unless a line is priceOverridden — those are trusted
 * verbatim (the operator typed a manual price). Best-effort: a missing DB
 * connection or a lookup failure leaves items unchanged. The engine fn is
 * injected for test isolation; defaults to salesPricing.service.
 */
async function resolveLinePricing(items, deps = {}) {
  const compute = deps.computeAuthoritativeLinePrices || defaultPricingEngine();
  if (!compute) return items;
  try {
    return await compute(items, { tenantId: deps.tenantId, pricelistId: deps.pricelistId });
  } catch {
    return items;
  }
}

```

- [ ] **Step 4: Call `resolveLinePricing` from `createSalesOrderDoc`**

Find:

```js
async function createSalesOrderDoc({ tenantId, body }) {
  const docType = body.docType === 'quotation' ? 'quotation' : 'order';
  const withPromos = await resolveLinePromotions(body.items || [], { tenantId });
```

Replace with:

```js
async function createSalesOrderDoc({ tenantId, body }) {
  const docType = body.docType === 'quotation' ? 'quotation' : 'order';
  const priced = await resolveLinePricing(body.items || [], { tenantId, pricelistId: body.pricelist });
  const withPromos = await resolveLinePromotions(priced, { tenantId });
```

- [ ] **Step 5: Call `resolveLinePricing` from `applyEdit`, and let `applyEdit` update the pricelist**

Find:

```js
async function applyEdit(so, body) {
  if (Array.isArray(body.items)) {
    const withPromos = await resolveLinePromotions(body.items, { tenantId: so.tenant });
    so.items = withPromos.map(mapLine);
    const totals = computeTotals(so.items);
    so.subtotal = totals.subtotal;
    so.discountTotal = totals.discountTotal;
    so.promotionTotal = totals.promotionTotal;
    so.taxTotal = totals.taxTotal;
    so.total = totals.total;
  }
  if (body.notes !== undefined) so.notes = body.notes;
```

Replace with:

```js
async function applyEdit(so, body) {
  if (body.pricelist !== undefined) {
    so.pricelist = body.pricelist || null;
    so.appliedPricelist = body.appliedPricelist || undefined;
  }
  if (Array.isArray(body.items)) {
    const pricelistId = body.pricelist !== undefined ? body.pricelist : so.pricelist;
    const priced = await resolveLinePricing(body.items, { tenantId: so.tenant, pricelistId });
    const withPromos = await resolveLinePromotions(priced, { tenantId: so.tenant });
    so.items = withPromos.map(mapLine);
    const totals = computeTotals(so.items);
    so.subtotal = totals.subtotal;
    so.discountTotal = totals.discountTotal;
    so.promotionTotal = totals.promotionTotal;
    so.taxTotal = totals.taxTotal;
    so.total = totals.total;
  }
  if (body.notes !== undefined) so.notes = body.notes;
```

- [ ] **Step 6: Carry `priceOverridden` through `mapLine` and `convertQuotationToOrder`**

Find:

```js
function mapLine(it) {
  return {
    product: it.product, subproduct: it.subproduct, size: it.size,
    sku: it.sku, name: it.name,
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
    taxRate: Math.max(0, Number(it.taxRate) || 0),
    promoDiscount: Math.max(0, Number(it.promoDiscount) || 0),
    promoName: it.promoName || '',
    taxAmount: lineTaxOf(it),
    lineTotal: lineTotalOf(it),
  };
}
```

Replace with:

```js
function mapLine(it) {
  return {
    product: it.product, subproduct: it.subproduct, size: it.size,
    sku: it.sku, name: it.name,
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
    taxRate: Math.max(0, Number(it.taxRate) || 0),
    promoDiscount: Math.max(0, Number(it.promoDiscount) || 0),
    promoName: it.promoName || '',
    taxAmount: lineTaxOf(it),
    lineTotal: lineTotalOf(it),
    priceOverridden: !!it.priceOverridden,
  };
}
```

Find (inside `convertQuotationToOrder`):

```js
    items: quotation.items.map((it) => ({
      product: it.product, subproduct: it.subproduct, size: it.size,
      sku: it.sku, name: it.name,
      quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount,
      taxRate: it.taxRate, taxAmount: it.taxAmount,
      promoDiscount: it.promoDiscount, promoName: it.promoName,
      lineTotal: it.lineTotal,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
    })),
```

Replace with:

```js
    items: quotation.items.map((it) => ({
      product: it.product, subproduct: it.subproduct, size: it.size,
      sku: it.sku, name: it.name,
      quantity: it.quantity, unitPrice: it.unitPrice, discount: it.discount,
      taxRate: it.taxRate, taxAmount: it.taxAmount,
      promoDiscount: it.promoDiscount, promoName: it.promoName,
      lineTotal: it.lineTotal,
      priceOverridden: it.priceOverridden,
      fulfilledQty: 0, postedQty: 0, returnedQty: 0,
    })),
```

- [ ] **Step 7: Export `resolveLinePricing`**

Find:

```js
module.exports = {
  lineTotalOf, lineTaxOf, mapLine, computeTotals, createSalesOrderDoc,
  canEdit, canCancel, applyEdit, convertQuotationToOrder,
  PAYMENT_TERMS, computeDueDate, normalizePaymentTerms, normalizeAddress,
  resolveLinePromotions,
};
```

Replace with:

```js
module.exports = {
  lineTotalOf, lineTaxOf, mapLine, computeTotals, createSalesOrderDoc,
  canEdit, canCancel, applyEdit, convertQuotationToOrder,
  PAYMENT_TERMS, computeDueDate, normalizePaymentTerms, normalizeAddress,
  resolveLinePromotions, resolveLinePricing,
};
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd server && node --test __tests__/salesOrderPricing.test.js`
Expected: PASS — all 5 tests green.

- [ ] **Step 9: Run the full server suite to confirm no regressions**

Run: `cd server && node --test __tests__/`
Expected: PASS — same pass count as before (the existing `createSalesOrderDoc persists a tenant-scoped order with snapshot totals` test in `salesOrder.api.test.js` has no live DB connection, so `resolveLinePricing` skips recompute there exactly as it did before this task; its `unitPrice` assertions stay correct).

- [ ] **Step 10: Commit**

```bash
git add server/services/salesOrder.service.js server/__tests__/salesOrderPricing.test.js
git commit -m "feat(server): sales orders authoritatively recompute pricing unless a line is manually overridden"
```

---

### Task 6: Client types — `priceOverridden` and editable pricelist on updates

**Files:**
- Modify: `client/apps/admin/src/services/salesOrder.service.ts`

**Interfaces:**
- Produces: `SalesLineItem.priceOverridden?: boolean`, `SalesOrderLineInput.priceOverridden?: boolean`, `UpdateSalesOrderInput.pricelist?`/`appliedPricelist?`. Consumed by Tasks 8, 9.

- [ ] **Step 1: Add `priceOverridden` to the line types**

Find:

```ts
export interface SalesLineItem {
  _id: string;
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate?: number;
  taxAmount?: number;
  promoDiscount?: number;
  promoName?: string;
  lineTotal: number;
  fulfilledQty: number;
  postedQty: number;
  returnedQty: number;
}
```

Replace with:

```ts
export interface SalesLineItem {
  _id: string;
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate?: number;
  taxAmount?: number;
  promoDiscount?: number;
  promoName?: string;
  lineTotal: number;
  fulfilledQty: number;
  postedQty: number;
  returnedQty: number;
  priceOverridden?: boolean;
}
```

Find:

```ts
export interface SalesOrderLineInput {
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}
```

Replace with:

```ts
export interface SalesOrderLineInput {
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  priceOverridden?: boolean;
}
```

- [ ] **Step 2: Add pricelist fields to `UpdateSalesOrderInput`**

Find:

```ts
export interface UpdateSalesOrderInput {
  items?: SalesOrderLineInput[];
  notes?: string;
  terms?: string;
  validUntil?: string;
  paymentTerms?: string;
  invoiceAddress?: SalesOrderAddress;
  deliveryAddress?: SalesOrderAddress;
}
```

Replace with:

```ts
export interface UpdateSalesOrderInput {
  items?: SalesOrderLineInput[];
  pricelist?: string;
  appliedPricelist?: { pricelistId?: string; pricelistName?: string };
  notes?: string;
  terms?: string;
  validUntil?: string;
  paymentTerms?: string;
  invoiceAddress?: SalesOrderAddress;
  deliveryAddress?: SalesOrderAddress;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`
Expected: same error count as baseline (27 TS2688) — these are additive optional fields, nothing should break.

- [ ] **Step 4: Commit**

```bash
git add client/apps/admin/src/services/salesOrder.service.ts
git commit -m "feat(client): add priceOverridden + pricelist update fields to sales order types"
```

---

### Task 7: `ProductLineSearch` — carry bundle/original-price data through

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/product-line-search.tsx`

**Interfaces:**
- Produces: `ProductLineSelection.bundleDeals?: POSBundleDeal[]`, `ProductLineSelection.originalPrice?: number`. Consumed by Task 8.

- [ ] **Step 1: Import `POSBundleDeal` and extend the selection/option types**

Find:

```ts
import { subproductService } from '@/services/subproduct.service';
import { routes } from '@/config/routes';

export interface ProductLineSelection {
  name: string;
  sku: string;
  subProductId: string;
  productId?: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  sizeId?: string;
  sizeName?: string;
}
```

Replace with:

```ts
import { subproductService } from '@/services/subproduct.service';
import { routes } from '@/config/routes';
import type { POSBundleDeal } from '@/app/shared/point-of-sale/types';

export interface ProductLineSelection {
  name: string;
  sku: string;
  subProductId: string;
  productId?: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  sizeId?: string;
  sizeName?: string;
  bundleDeals?: POSBundleDeal[];
  originalPrice?: number;
}
```

Find:

```ts
interface ProductOption {
  _id: string;
  productId?: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  sellWithoutSizeVariants: boolean;
  sizes: SizeOption[];
}
```

Replace with:

```ts
interface ProductOption {
  _id: string;
  productId?: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  sellWithoutSizeVariants: boolean;
  sizes: SizeOption[];
  bundleDeals: POSBundleDeal[];
}
```

- [ ] **Step 2: Populate `bundleDeals` in `mapProducts`**

Find:

```ts
function mapProducts(raw: any[]): ProductOption[] {
  return raw.map((sp: any) => ({
    _id: sp._id,
    productId: sp.product?._id ?? sp.product,
    name: sp.product?.name ?? sp.name ?? '',
    sku: sp.sku ?? '',
    sellingPrice: sp.baseSellingPrice ?? 0,
    costPrice: sp.costPrice ?? 0,
    taxRate: sp.taxRate ?? 0,
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    sizes: (sp.sizes ?? []).map((s: any) => ({
      size: String(s._id ?? s.size ?? ''),
      displayName: s.displayName ?? s.size ?? '',
      sku: s.sku ?? sp.sku ?? '',
      sellingPrice: s.sellingPrice ?? 0,
      costPrice: s.costPrice ?? sp.costPrice ?? 0,
      availableStock: s.availableStock ?? s.stock ?? 0,
    })),
  }));
}
```

Replace with:

```ts
function mapProducts(raw: any[]): ProductOption[] {
  return raw.map((sp: any) => ({
    _id: sp._id,
    productId: sp.product?._id ?? sp.product,
    name: sp.product?.name ?? sp.name ?? '',
    sku: sp.sku ?? '',
    sellingPrice: sp.baseSellingPrice ?? 0,
    costPrice: sp.costPrice ?? 0,
    taxRate: sp.taxRate ?? 0,
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    bundleDeals: sp.bundleDeals ?? [],
    sizes: (sp.sizes ?? []).map((s: any) => ({
      size: String(s._id ?? s.size ?? ''),
      displayName: s.displayName ?? s.size ?? '',
      sku: s.sku ?? sp.sku ?? '',
      sellingPrice: s.sellingPrice ?? 0,
      costPrice: s.costPrice ?? sp.costPrice ?? 0,
      availableStock: s.availableStock ?? s.stock ?? 0,
    })),
  }));
}
```

- [ ] **Step 3: Pass `bundleDeals`/`originalPrice` through both pick paths**

Find:

```ts
  function pickSizeless(p: ProductOption) {
    onSelect({
      name: p.name,
      sku: p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
      taxRate: p.taxRate,
    });
    setText(p.name);
    setOpen(false);
  }
```

Replace with:

```ts
  function pickSizeless(p: ProductOption) {
    onSelect({
      name: p.name,
      sku: p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
      taxRate: p.taxRate,
      bundleDeals: p.bundleDeals,
      originalPrice: p.sellingPrice,
    });
    setText(p.name);
    setOpen(false);
  }
```

Find:

```ts
  function pickSize(p: ProductOption, s: SizeOption) {
    const displaySize = s.displayName ?? s.size;
    onSelect({
      name: `${p.name} – ${displaySize}`,
      sku: s.sku ?? p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: s.sellingPrice,
      costPrice: s.costPrice,
      taxRate: p.taxRate,
      sizeId: s.size,
      sizeName: displaySize,
    });
    setText(`${p.name} – ${displaySize}`);
    setOpen(false);
  }
```

Replace with:

```ts
  function pickSize(p: ProductOption, s: SizeOption) {
    const displaySize = s.displayName ?? s.size;
    onSelect({
      name: `${p.name} – ${displaySize}`,
      sku: s.sku ?? p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: s.sellingPrice,
      costPrice: s.costPrice,
      taxRate: p.taxRate,
      sizeId: s.size,
      sizeName: displaySize,
      bundleDeals: p.bundleDeals,
      originalPrice: s.sellingPrice,
    });
    setText(`${p.name} – ${displaySize}`);
    setOpen(false);
  }
```

> Note: `originalPrice` here is set equal to the current selling price as a proxy — this create/edit flow doesn't model the subproduct's own active sale/flash-sale discount client-side (it never has; `sellingPrice` is already `baseSellingPrice` with no sale layered in). This only affects the live-preview's `no_discount` bundle case (a no-op when orig === current), which is acceptable since Task 5's server-side recompute is authoritative regardless.

- [ ] **Step 4: Typecheck**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`
Expected: baseline 27 TS2688, no new errors.

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/app/shared/sales/product-line-search.tsx
git commit -m "feat(client): thread bundle deal data through ProductLineSearch selections"
```

---

### Task 8: Editable unit price + bundle-aware live preview in `sales-create.tsx`

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-create.tsx`

**Interfaces:**
- Consumes: `getEffectiveBundlePriceForItem` (already exists in `point-of-sale/store/index.ts`), `ProductLineSelection.bundleDeals`/`originalPrice` (Task 7), `SalesOrderLineInput.priceOverridden` (Task 6).
- Produces: `DraftLine.priceOverridden: boolean`, `DraftLine.activeBundles?`, `DraftLine.originalPrice?`. Consumed by Task 9 (edit-mode seeding uses the same `DraftLine` shape).

This task only changes pricing/editing behavior in the existing create flow — it does not yet add edit mode (Task 9).

- [ ] **Step 1: Update imports**

Find:

```tsx
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import type { POSCartItem } from '@/app/shared/point-of-sale/types';
import { computeItemPriceWithPricelist } from '@/app/shared/point-of-sale/store';
```

Replace with:

```tsx
import type { POSCustomer, POSBundleDeal } from '@/app/shared/point-of-sale/types';
import type { POSCartItem } from '@/app/shared/point-of-sale/types';
import { getEffectiveBundlePriceForItem } from '@/app/shared/point-of-sale/store';
```

- [ ] **Step 2: Extend `DraftLine` and `blankLine()`**

Find:

```tsx
interface DraftLine {
  key: string;
  subProductId: string;
  product?: string;
  name: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  baseUnitPrice: number;
  discount: number;
  taxRate: number;
  costPrice: number;
}

function blankLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    subProductId: '',
    name: '',
    sku: '',
    quantity: 1,
    baseUnitPrice: 0,
    discount: 0,
    taxRate: 0,
    costPrice: 0,
  };
}
```

Replace with:

```tsx
interface DraftLine {
  key: string;
  subProductId: string;
  product?: string;
  name: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  baseUnitPrice: number;
  discount: number;
  taxRate: number;
  costPrice: number;
  /** True once the operator has typed a manual unit price for this line — it
   * then ignores the live pricelist/bundle computation and the server trusts
   * it verbatim. Reset to false whenever a new product/size is picked. */
  priceOverridden: boolean;
  activeBundles?: POSBundleDeal[];
  originalPrice?: number;
}

function blankLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    subProductId: '',
    name: '',
    sku: '',
    quantity: 1,
    baseUnitPrice: 0,
    discount: 0,
    taxRate: 0,
    costPrice: 0,
    priceOverridden: false,
  };
}
```

- [ ] **Step 3: Update `liveUnitPrice` to honor the override and apply bundle rules**

Find:

```tsx
/** Live unit price after pricelist rules, via the shared pure pricing function. */
function liveUnitPrice(line: DraftLine, pricelist: any): number {
  if (!line.subProductId || !pricelist) return line.baseUnitPrice;
  const pricingItem: POSCartItem = {
    subProductId: line.subProductId,
    productId: line.product ?? line.subProductId,
    sizeId: line.sizeId,
    name: line.name,
    variant: line.sizeName ?? '',
    sku: line.sku,
    price: line.baseUnitPrice,
    quantity: line.quantity,
    discount: 0,
    stock: 0,
    costPrice: line.costPrice,
  };
  return computeItemPriceWithPricelist(pricingItem, pricelist);
}
```

Replace with:

```tsx
/** Live unit price after pricelist + bundle rules, unless the operator overrode it. */
function liveUnitPrice(line: DraftLine, pricelist: any): number {
  if (line.priceOverridden) return line.baseUnitPrice;
  if (!line.subProductId || !pricelist) return line.baseUnitPrice;
  const pricingItem: POSCartItem = {
    subProductId: line.subProductId,
    productId: line.product ?? line.subProductId,
    sizeId: line.sizeId,
    name: line.name,
    variant: line.sizeName ?? '',
    sku: line.sku,
    price: line.baseUnitPrice,
    quantity: line.quantity,
    discount: 0,
    stock: 0,
    costPrice: line.costPrice,
    activeBundles: line.activeBundles,
    originalPrice: line.originalPrice,
  };
  return getEffectiveBundlePriceForItem(pricingItem, pricelist).price;
}
```

- [ ] **Step 4: Reset the override + carry bundle data when a product/size is picked**

Find:

```tsx
                        <ProductLineSearch
                          token={token}
                          query={line.name}
                          onSelect={(info: ProductLineSelection) =>
                            updateLine(line.key, {
                              subProductId: info.subProductId,
                              product: info.productId,
                              name: info.name,
                              sku: info.sku,
                              sizeId: info.sizeId,
                              sizeName: info.sizeName,
                              baseUnitPrice: info.sellingPrice,
                              costPrice: info.costPrice,
                              taxRate: info.taxRate,
                            })
                          }
                        />
```

Replace with:

```tsx
                        <ProductLineSearch
                          token={token}
                          query={line.name}
                          onSelect={(info: ProductLineSelection) =>
                            updateLine(line.key, {
                              subProductId: info.subProductId,
                              product: info.productId,
                              name: info.name,
                              sku: info.sku,
                              sizeId: info.sizeId,
                              sizeName: info.sizeName,
                              baseUnitPrice: info.sellingPrice,
                              costPrice: info.costPrice,
                              taxRate: info.taxRate,
                              priceOverridden: false,
                              activeBundles: info.bundleDeals,
                              originalPrice: info.originalPrice,
                            })
                          }
                        />
```

- [ ] **Step 5: Make the Unit Price cell an editable input with an override marker**

Find:

```tsx
                      <td className="px-2 py-2 text-right text-sm font-medium text-gray-900">
                        {fmtCur(line.unitPrice, 'NGN')}
                      </td>
```

Replace with:

```tsx
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {line.priceOverridden && (
                            <span
                              title="Manually set"
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                            />
                          )}
                          <input
                            type="number"
                            min={0}
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(line.key, {
                                baseUnitPrice: Math.max(0, Number(e.target.value) || 0),
                                priceOverridden: true,
                              })
                            }
                            className={`${INLINE_CELL_CLS} w-24`}
                          />
                        </div>
                      </td>
```

- [ ] **Step 6: Send `priceOverridden` per line on save**

Find:

```tsx
          items: filled.map((l) => ({
            product: l.product,
            subproduct: l.subProductId,
            size: l.sizeId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
          })),
```

Replace with:

```tsx
          items: filled.map((l) => ({
            product: l.product,
            subproduct: l.subProductId,
            size: l.sizeId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
            priceOverridden: l.priceOverridden,
          })),
```

- [ ] **Step 7: Typecheck**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`
Expected: baseline 27 TS2688, no new errors. (`getEffectiveBundlePriceForItem` and `POSBundleDeal` are already exported from their respective modules — confirmed during planning — so no import errors are expected.)

- [ ] **Step 8: Manual check**

Run the client dev server, open `/sales/create`, pick a customer whose pricelist has a bundle rule, add a line for the matching product at a qualifying quantity, and confirm the Unit Price cell reflects the bundle discount. Then type directly into the Unit Price field and confirm: the amber dot appears, the Line Total updates immediately, and changing quantity afterward does NOT revert your typed price.

- [ ] **Step 9: Commit**

```bash
git add client/apps/admin/src/app/shared/sales/sales-create.tsx
git commit -m "feat(client): editable unit price with override flag + bundle-aware live pricing preview"
```

---

### Task 9: Generalize `sales-create.tsx` into create/edit modes

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-create.tsx`

**Interfaces:**
- Produces: `SalesCreate({ mode?: 'create' | 'edit', initial?: SalesOrder })` — default export signature change. Consumed by Task 10's new edit route.

- [ ] **Step 1: Import `SalesOrder` and the helpers needed for seeding/labels**

Find:

```tsx
import {
  salesOrderService,
  type SalesOrderAddress,
} from '@/services/salesOrder.service';
```

Replace with:

```tsx
import {
  salesOrderService,
  type SalesOrder,
  type SalesOrderAddress,
} from '@/services/salesOrder.service';
```

Find:

```tsx
import { PAYMENT_TERMS } from './sales-helpers';
```

Replace with:

```tsx
import {
  PAYMENT_TERMS,
  addressesDiffer,
  quoteStatusLabel,
  orderStatusLabel,
} from './sales-helpers';
```

- [ ] **Step 2: Accept `mode`/`initial` props and move the pricelist state up**

Find:

```tsx
export default function SalesCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('immediate');
  const [invoiceAddress, setInvoiceAddress] = useState<SalesOrderAddress>({});
  const [deliverDifferent, setDeliverDifferent] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<SalesOrderAddress>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<CreateTab>('lines');
```

Replace with:

```tsx
export default function SalesCreate({
  mode = 'create',
  initial,
}: {
  mode?: 'create' | 'edit';
  initial?: SalesOrder;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('immediate');
  const [invoiceAddress, setInvoiceAddress] = useState<SalesOrderAddress>({});
  const [deliverDifferent, setDeliverDifferent] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<SalesOrderAddress>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<CreateTab>('lines');
  // Moved up from below the useSalesCustomerPricelist call (Step 3 removes
  // the duplicate declaration there) so the seeding effect below can set them.
  const [pricelistId, setPricelistId] = useState('');
  const [pricelistOverridden, setPricelistOverridden] = useState(false);

  // Seed every field from the loaded document once, in edit mode.
  useEffect(() => {
    if (!initial) return;
    if (initial.customerSnapshot?.customerId) {
      const [firstName, ...rest] = (initial.customerSnapshot.name ?? '').split(' ');
      setCustomer({
        _id: initial.customerSnapshot.customerId,
        firstName: firstName ?? '',
        lastName: rest.join(' '),
        email: initial.customerSnapshot.email,
        phone: initial.customerSnapshot.phone,
        loyaltyPoints: 0,
        walletBalance: 0,
      });
    }
    setLines(
      initial.items.map((it) => ({
        key: it._id,
        subProductId: it.subproduct ?? '',
        product: it.product,
        name: it.name ?? '',
        sku: it.sku ?? '',
        sizeId: it.size,
        quantity: it.quantity,
        baseUnitPrice: it.unitPrice,
        discount: it.discount,
        taxRate: it.taxRate ?? 0,
        costPrice: 0,
        priceOverridden: !!it.priceOverridden,
      }))
    );
    setNotes(initial.notes ?? '');
    setTerms(initial.terms ?? '');
    setValidUntil(initial.validUntil ? initial.validUntil.slice(0, 10) : '');
    setPaymentTerms(initial.paymentTerms ?? 'immediate');
    setInvoiceAddress(initial.invoiceAddress ?? {});
    setDeliverDifferent(
      !!initial.deliveryAddress &&
        addressesDiffer(initial.deliveryAddress, initial.invoiceAddress)
    );
    setDeliveryAddress(initial.deliveryAddress ?? {});
    if (initial.pricelist) {
      setPricelistId(initial.pricelist);
      setPricelistOverridden(true);
    }
    // Seeds once when the document loads; `initial` is a stable fetch result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
```

- [ ] **Step 3: Remove the now-duplicate pricelist state declaration below `useSalesCustomerPricelist`**

Find:

```tsx
  const {
    pricelists,
    resolvedId,
    selected: autoPricelist,
  } = useSalesCustomerPricelist(token, customer?._id ?? '');

  // Pricelist defaults to the customer's auto-resolved list, but the user can
  // override it; once they do, their pick sticks across customer changes.
  const [pricelistId, setPricelistId] = useState('');
  const [pricelistOverridden, setPricelistOverridden] = useState(false);
  useEffect(() => {
    if (!pricelistOverridden) setPricelistId(resolvedId ?? '');
  }, [resolvedId, pricelistOverridden]);
```

Replace with:

```tsx
  const {
    pricelists,
    resolvedId,
    selected: autoPricelist,
  } = useSalesCustomerPricelist(token, customer?._id ?? '');

  // Pricelist defaults to the customer's auto-resolved list, but the user can
  // override it; once they do, their pick sticks across customer changes.
  // In edit mode, the seeding effect above sets pricelistOverridden=true as
  // soon as the loaded document has one, so this auto-resolve effect backs off.
  useEffect(() => {
    if (!pricelistOverridden) setPricelistId(resolvedId ?? '');
  }, [resolvedId, pricelistOverridden]);
```

- [ ] **Step 4: Add the "Save Changes" path for edit mode**

Find:

```tsx
  async function handleSave(asOrder: boolean) {
```

Insert immediately **before** it:

```tsx
  async function handleSaveEdit() {
    if (!initial) return;
    const filled = priced.filter((l) => l.subProductId);
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    const badQty = filled.find((l) => !(l.quantity > 0));
    if (badQty) {
      toast.error(`Quantity for "${badQty.name}" must be at least 1`);
      return;
    }
    setSaving(true);
    try {
      await salesOrderService.update(
        initial._id,
        {
          items: filled.map((l) => ({
            product: l.product,
            subproduct: l.subProductId,
            size: l.sizeId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
            priceOverridden: l.priceOverridden,
          })),
          pricelist: pricelistId || undefined,
          appliedPricelist: pricelist
            ? { pricelistId: pricelist._id, pricelistName: pricelist.name }
            : undefined,
          validUntil: validUntil || undefined,
          paymentTerms,
          invoiceAddress,
          deliveryAddress: deliverDifferent ? deliveryAddress : invoiceAddress,
          notes: notes || undefined,
          terms: terms || undefined,
        },
        token
      );
      toast.success('Changes saved');
      router.push(routes.eCommerce.salesDetails(initial._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

```

- [ ] **Step 5: Swap the action buttons and stage pills in edit mode**

Find:

```tsx
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving || !hasLines}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" />
              {saving ? 'Saving…' : 'Create Order'}
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving || !hasLines}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <PiFloppyDisk className="h-4 w-4" />
              Save as Quotation
            </button>
            <Link
              href={routes.eCommerce.salesOrders}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <StagePill label="Quotation" active />
            <StagePill label="Quotation Sent" active={false} />
            <StagePill label="Sales Order" active={false} />
          </div>
        </div>
```

Replace with:

```tsx
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving || !hasLines}
                className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
              >
                <PiFloppyDisk className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving || !hasLines}
                  className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
                >
                  <PiCheck className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Create Order'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving || !hasLines}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <PiFloppyDisk className="h-4 w-4" />
                  Save as Quotation
                </button>
              </>
            )}
            <Link
              href={
                mode === 'edit' && initial
                  ? routes.eCommerce.salesDetails(initial._id)
                  : routes.eCommerce.salesOrders
              }
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            {mode === 'edit' && initial ? (
              <StagePill
                label={
                  initial.docType === 'quotation'
                    ? quoteStatusLabel(initial.quoteStatus)
                    : orderStatusLabel(initial.orderStatus)
                }
                active
              />
            ) : (
              <>
                <StagePill label="Quotation" active />
                <StagePill label="Quotation Sent" active={false} />
                <StagePill label="Sales Order" active={false} />
              </>
            )}
          </div>
        </div>
```

- [ ] **Step 6: Update the header text and breadcrumb for edit mode**

Find:

```tsx
        <span>/</span>
        <span className="font-medium text-gray-900">New Sale</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">New</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Save as a quotation or create the order directly.
          </p>
        </div>
```

Replace with:

```tsx
        <span>/</span>
        <span className="font-medium text-gray-900">
          {mode === 'edit' && initial ? initial.soNumber : 'New Sale'}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {mode === 'edit' ? 'Edit' : 'New'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {mode === 'edit'
              ? 'Update the draft and save your changes.'
              : 'Save as a quotation or create the order directly.'}
          </p>
        </div>
```

- [ ] **Step 7: Typecheck**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`
Expected: baseline 27 TS2688, no new errors.

- [ ] **Step 8: Manual check (create mode unaffected)**

Visit `/sales/create` and confirm it behaves exactly as before (no `initial` prop passed yet — Task 10 wires that up). The two original buttons and stage pills should still appear since `mode` defaults to `'create'`.

- [ ] **Step 9: Commit**

```bash
git add client/apps/admin/src/app/shared/sales/sales-create.tsx
git commit -m "feat(client): generalize sales-create.tsx into create/edit modes"
```

---

### Task 10: New `/sales/[id]/edit` route + Edit buttons on the detail pages

**Files:**
- Modify: `client/apps/admin/src/config/routes.ts`
- Create: `client/apps/admin/src/app/(hydrogen)/sales/[id]/edit/page.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-quotation-detail.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-order-detail.tsx`

**Interfaces:**
- Consumes: `SalesCreate({ mode, initial })` (Task 9).
- Produces: `routes.eCommerce.salesEdit(id)`, route `/sales/[id]/edit`.

- [ ] **Step 1: Add the route helper**

In `client/apps/admin/src/config/routes.ts`, find:

```ts
    salesDetails: (id: string) => `/sales/${id}`,
```

Replace with:

```ts
    salesDetails: (id: string) => `/sales/${id}`,
    salesEdit: (id: string) => `/sales/${id}/edit`,
```

- [ ] **Step 2: Create the edit route page**

Create `client/apps/admin/src/app/(hydrogen)/sales/[id]/edit/page.tsx`:

```tsx
'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesCreate from '@/app/shared/sales/sales-create';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';

function EditSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-gray-100" />
      <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

export default function SalesEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <EditSkeleton />
        ) : !so ? (
          <div className="py-20 text-center text-sm text-gray-500">
            Not found
          </div>
        ) : (
          <SalesCreate mode="edit" initial={so} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add the Edit button to the quotation detail page**

In `client/apps/admin/src/app/shared/sales/sales-quotation-detail.tsx`, find:

```tsx
import {
  PiArrowLeft,
  PiPaperPlaneTilt,
  PiCheck,
  PiX,
  PiArrowsClockwise,
} from 'react-icons/pi';
```

Replace with:

```tsx
import {
  PiArrowLeft,
  PiPaperPlaneTilt,
  PiCheck,
  PiX,
  PiArrowsClockwise,
  PiPencilSimple,
} from 'react-icons/pi';
```

Find:

```tsx
        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => salesOrderService.send(so._id, token),
                  'Quotation sent'
                )
              }
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiPaperPlaneTilt className="h-4 w-4" /> Send
            </button>
          )}
```

Replace with:

```tsx
        <div className="flex items-center gap-2">
          {(status === 'draft' || status === 'sent') && (
            <Link
              href={routes.eCommerce.salesEdit(so._id)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiPencilSimple className="h-4 w-4" /> Edit
            </Link>
          )}
          {status === 'draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => salesOrderService.send(so._id, token),
                  'Quotation sent'
                )
              }
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiPaperPlaneTilt className="h-4 w-4" /> Send
            </button>
          )}
```

- [ ] **Step 4: Add the Edit button to the order detail page**

In `client/apps/admin/src/app/shared/sales/sales-order-detail.tsx`, find:

```tsx
import {
  PiArrowLeft,
  PiCreditCard,
  PiTrayArrowDown,
  PiArrowUUpLeft,
  PiReceipt,
  PiX,
} from 'react-icons/pi';
```

Replace with:

```tsx
import {
  PiArrowLeft,
  PiCreditCard,
  PiTrayArrowDown,
  PiArrowUUpLeft,
  PiReceipt,
  PiX,
  PiPencilSimple,
} from 'react-icons/pi';
```

Find:

```tsx
        <div className="flex items-center gap-2">
          {canConfirm && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiCreditCard className="h-4 w-4" /> Confirm Order
            </button>
          )}
```

Replace with:

```tsx
        <div className="flex items-center gap-2">
          {canConfirm && (
            <Link
              href={routes.eCommerce.salesEdit(so._id)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiPencilSimple className="h-4 w-4" /> Edit
            </Link>
          )}
          {canConfirm && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiCreditCard className="h-4 w-4" /> Confirm Order
            </button>
          )}
```

`canConfirm` is already `status === 'draft'` (declared earlier in this file) — reusing it keeps the Edit button's visibility exactly aligned with the server's `canEdit` guard for orders.

- [ ] **Step 5: Typecheck**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`
Expected: baseline 27 TS2688, no new errors.

- [ ] **Step 6: Manual check**

Create a draft quotation, open its detail page, click Edit, change the quantity on a line and the payment terms, click Save Changes, confirm it redirects to the detail page and the changes are reflected. Repeat for a draft order (skip the quotation lifecycle — use "Create Order" from `/sales/create` directly), confirming the Edit button appears only while `orderStatus === 'draft'`.

- [ ] **Step 7: Commit**

```bash
git add client/apps/admin/src/config/routes.ts \
        "client/apps/admin/src/app/(hydrogen)/sales/[id]/edit/page.tsx" \
        client/apps/admin/src/app/shared/sales/sales-quotation-detail.tsx \
        client/apps/admin/src/app/shared/sales/sales-order-detail.tsx
git commit -m "feat(client): add edit route + Edit buttons for draft/sent sales documents"
```

---

### Task 11: Payment Terms on the invoice view

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-invoice-view.tsx`

- [ ] **Step 1: Import `paymentTermsLabel`**

Find:

```tsx
import { addressIsEmpty, addressesDiffer, addressLines } from './sales-helpers';
```

Replace with:

```tsx
import {
  addressIsEmpty,
  addressesDiffer,
  addressLines,
  paymentTermsLabel,
} from './sales-helpers';
```

- [ ] **Step 2: Add the Payment Terms block next to Payment Method**

Find:

```tsx
          {so.paymentMethod && (
            <>
              <Title as="h6" className="mb-1 mt-3 font-semibold">
                Payment Method
              </Title>
              <Text className="capitalize">
                {so.paymentMethod.replace('_', ' ')}
              </Text>
            </>
          )}
        </div>
      </div>
```

Replace with:

```tsx
          {so.paymentMethod && (
            <>
              <Title as="h6" className="mb-1 mt-3 font-semibold">
                Payment Method
              </Title>
              <Text className="capitalize">
                {so.paymentMethod.replace('_', ' ')}
              </Text>
            </>
          )}
          <Title as="h6" className="mb-1 mt-3 font-semibold">
            Payment Terms
          </Title>
          <Text>
            {paymentTermsLabel(so.paymentTerms)}
            {so.dueDate && ` · due ${new Date(so.dueDate).toLocaleDateString()}`}
          </Text>
        </div>
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`
Expected: baseline 27 TS2688, no new errors.

- [ ] **Step 4: Manual check**

Open any sales order's Invoice view (the "Invoice" button on the order detail page) and confirm a "Payment Terms" line appears with the due date when one is set.

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/app/shared/sales/sales-invoice-view.tsx
git commit -m "feat(client): show Payment Terms on the sales invoice view"
```

---

## Self-Review

**Spec coverage:**
- Spec §1 (shared pricing module) → Task 1.
- Spec §1 POS refactor → Task 2.
- Spec §2 (server recompute, `priceOverridden` model field, `mapLine`/`convertQuotationToOrder`/`applyEdit` pricelist update) → Tasks 3, 4, 5.
- Spec §3 (client live preview parity) → Task 8 (folded in with editable price since both touch `liveUnitPrice`/the same render block).
- Spec §4 (editable unit price + override flag, client types) → Tasks 6, 8.
- Spec §5 (edit capability: generalized form, new route, Edit buttons) → Tasks 9, 10.
- Spec §6 (invoice payment terms) → Task 11.

**Placeholder scan:** No "TBD"/"implement later" strings; every step has complete code. (One accidental placeholder marker was inserted and immediately reverted during plan authoring — not present in the final document.)

**Type consistency check:** `priceOverridden` is spelled identically across `SalesOrder` model (Task 3), `salesPricing.service.js`/`salesOrder.service.js` (Tasks 4–5), `salesOrder.service.ts` client types (Task 6), and `DraftLine`/payload mapping (Tasks 8–9). `computeAuthoritativeLinePrices` / `computeLineUnitPrice` names match between Task 4's export and Task 5's `require('./salesPricing.service')`. `findMatchingPriceRules` / `applyPriceRules` / `pickBestBundle` / `applyBundleOverride` / `computeBundleLineDiscount` names match between Task 1's exports and their use in Tasks 2 and 4. `routes.eCommerce.salesEdit` matches between Task 10's routes.ts addition and its use in the two detail-page Edit buttons and the spec's route convention (`editStockTransfer`-style).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-sales-pricelist-editable-price-payment-terms.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
