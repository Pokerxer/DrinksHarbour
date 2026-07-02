# Pricelist Rule Extensions — Design Spec

**Date:** 2026-07-02
**Scope:** Three independent pricelist rule features, built as three sequential commits in one worktree session:
1. Customer-group targeting (string tags on customer + pricelist-level filter)
2. Buy X Get Y cross-product bundles (extend existing bundle type)
3. Cart spend-threshold discount (new `cart_threshold` priceType)

Server stays the pricing authority. The client POS cart mirrors the engine for display; the server recomputes on order creation.

---

## Feature 1: Customer-Group Targeting

### Problem
Pricelists can only be scoped by shop/warehouse. There's no way to offer a pricelist to "wholesale customers" or "VIP members" specifically.

### Schema

**`POSCustomer`** (`server/models/POSCustomer.js`):
- Add `tags: [{ type: String }]` — default `[]`. Lightweight string tags (e.g. `['wholesale', 'vip']`).

**`Pricelist`** (`server/models/Pricelist.js`, parent `pricelistSchema`):
- Add `customerTags: [{ type: String }]` — default `[]`. When non-empty, the pricelist is only resolvable/allowed for customers whose `tags` intersect. When empty (default), unscoped by customer (existing behavior).

### Engine

`pickPricelistForShop` in `server/services/pricelist.service.js`:
- Add a `customerTags` parameter (string array from the selected customer's `tags`).
- Filter the candidate pool: if a pricelist has `customerTags.length > 0`, include it only when `customerTags` and the customer's tags have at least one intersection. Pricelists with empty `customerTags` are always included (unscoped).
- The customer's manually-assigned `pricelist` (`POSCustomer.pricelist`, the per-customer override) **bypasses** the tag filter — it's an explicit assignment, not a group match.

### Client

- `usePOSAvailablePricelists` hook: pass the current customer's `tags` into the resolution (the hook already has the customer context from the sell screen).
- Pricelist detail panel: add a "Customer tags" chip input alongside the existing shops/warehouses bindings. Comma-separated or chip-style entry.
- POSCustomer form: add a "Tags" input (comma-separated → string array).

### Tests (`pricelist.service.test.js`)
- Tagged pricelist excluded from allowed/resolved when customer has no matching tags.
- Tagged pricelist included when customer has at least one matching tag.
- Untagged pricelist always included regardless of customer tags.
- Customer's manually-assigned pricelist bypasses the tag filter.

---

## Feature 2: Buy X Get Y Cross-Product Bundle

### Problem
The existing `bundle` rule type is per-line: buy N of product A, get a discount on A. There's no way to do "Buy 6 of Carlo Rossi, get 10% off Sparkling Water."

### Schema

**`priceRuleSchema`** (`server/models/Pricelist.js`):
- Add `bundleTargetSubProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: false }` — the "get" product. When null/absent, same-product bundle (existing behavior). When present, cross-product: buy `bundleQuantity` of `subProduct` (trigger), get the discount applied to `bundleTargetSubProduct` lines.

No new `priceType` — extends the existing `bundle` type.

### Engine

New function `applyCartBundles(lines, pricelistRules)` in `server/services/pricelistPricing.service.js`:
1. Scan `pricelistRules` for `bundle` rules with `bundleTargetSubProduct` set.
2. For each, check if the cart has `>= rule.bundleQuantity` of the trigger `subProduct` (sum across all lines of that product — though typically one line per product).
3. If the trigger qty is met, find the target product's lines and apply the discount:
   - `percentage`/`fixed`: add a line-level discount to the target line(s), matching `computeBundleLineDiscount` semantics.
   - `markup_on_cost`/`no_discount`: override the target line's per-unit price, matching `applyBundleOverride` semantics.
4. Return `{ lineAdjustments: Map<lineKey, { discountAmount?, overridePrice? }> }`.

The existing per-line `pickBestBundle` (same-product bundles) is unchanged — it still runs per-line. `applyCartBundles` runs as a separate cart-level pass.

### Application hooks

**Server** (`createPOSOrder` in `pos.controller.js`): after per-line pricing + per-line bundle discounts (line ~2196), call `applyCartBundles` with the cart lines + pricelist rules. Apply returned adjustments to the target lines' `itemSubtotal`/`itemDiscountAmount`.

**Client** (`store/index.ts`): after per-line `computeSubtotal`, call `applyCartBundles` with the cart items + selected pricelist. Apply adjustments to the target lines before computing the cart total.

### Client UI

In the rule modal (`pos-pricelists.tsx`), when `priceType === 'bundle'`:
- Show an optional "Get product" picker (same product search dropdown as the trigger). When blank = same-product bundle (existing). When filled = cross-product.
- Auto-generate the bundle name as "Buy {qty}+ of {A} → {disc} off {B}" when blank.
- `RULE_EMPTY` gets `bundleTargetSubProduct: ''`.
- `buildPayload` sends `bundleTargetSubProduct: form.bundleTargetSubProduct || undefined`.
- `ruleToFormValues` reads it back.

### Tests (`pricelistPricing.service.test.js`)
- `applyCartBundles`: trigger qty met → target line discounted.
- Trigger qty not met → no discount.
- Target product not in cart → no discount.
- Same-product bundle (no `bundleTargetSubProduct`) still works via existing per-line path (not double-applied).
- `percentage`/`fixed`/`markup_on_cost`/`no_discount` discount types all apply correctly to the target.

---

## Feature 3: Cart Spend-Threshold Discount

### Problem
There's no way to automatically discount the whole cart when a spend threshold is met (e.g. "Spend ₦50,000+ get 5% off"). The existing cart discount is manual (cashier types it).

### Schema

**`priceRuleSchema`** (`server/models/Pricelist.js`):
- Add `'cart_threshold'` to the `priceType` enum.
- Add `thresholdAmount: { type: Number, min: 0, default: 0 }` — the spend floor.
- Reuses existing `discountType` (`percentage`/`fixed`) + `discountPercentage`/`discountAmount` for the reward.
- Reuses `minQuantity` (0 = no qty gate), `startDate`/`endDate` for validity window.
- `ruleCategory` derives to `'dynamic'` (session-only).

### Engine

New function `findCartThresholdRules(pricelistRules, cartSubtotal)` in `server/services/pricelistPricing.service.js`:
- Filter rules: `priceType === 'cart_threshold'`, date window valid, `cartSubtotal >= thresholdAmount`.
- Return qualifying rules sorted by `sequence` (they stack sequentially — each applies its discount to the running subtotal, like `applyPriceRules`).

New function `computeCartThresholdDiscount(rules, subtotal)`:
- Sequentially apply each rule's discount to the running amount, return the total discount.
- `percentage`: `running * discountPercentage / 100`. `fixed`: `min(discountAmount, running)`.

### Application hooks

**Server** (`createPOSOrder`, after line 2275 — after manual `orderDiscountAmount`):
```js
const thresholdRules = findCartThresholdRules(pricelistRules, subtotal);
const thresholdDiscountAmount = computeCartThresholdDiscount(thresholdRules, subtotal);
const total = Math.max(0, subtotal - orderDiscountAmount - thresholdDiscountAmount);
```
Store `thresholdDiscountAmount` on the Order document (new field `thresholdDiscount`).

**Client** (`store/index.ts`, between lines 708-718):
```ts
const thresholdDiscount = useMemo(() => {
  const rules = findCartThresholdRules(pricelist?.rules, subtotal);
  return rules.length ? computeCartThresholdDiscount(rules, subtotal) : 0;
}, [pricelist, subtotal]);
const total = Math.max(0, subtotal - discountAmount - thresholdDiscount - rewardsDiscountTotal);
```

### Client UI

Rule modal gets a 6th type button "Spend Threshold" (icon: `PiStorefront` or `PiShoppingCart`):
- `thresholdAmount` input (₦, the spend floor).
- Reuses the existing discount type/value pair (discountType segment + discountPercentage/discountAmount inputs).
- Label: "Spend ₦{thresholdAmount}+ → {discountPercentage}% off cart".

Constants (`pricelist-constants.ts` + `pos-pricelists.tsx`):
- `RULE_TYPE_META.cart_threshold`: label, color, bg, border, hint, Icon.
- `RULE_CATEGORY.cart_threshold: 'dynamic'`.
- `RULE_EMPTY` gets `thresholdAmount: ''`.

### Validation

`validateRuleFields` (in `pricelist.routes.js`, from last commit): add `cart_threshold` case:
- `thresholdAmount > 0` required.
- `discountType`/`discountPercentage`/`discountAmount` required (same as discount type).

### Tests (`pricelistPricing.service.test.js`)
- `findCartThresholdRules`: subtotal below threshold → no rules; subtotal above → rule qualifies; date window invalid → excluded.
- `computeCartThresholdDiscount`: single rule percentage; single rule fixed; multiple rules stack sequentially.
- Server test: `createPOSOrder` applies threshold discount after manual discount.

---

## Shared changes across all three features

### `RULE_FIELDS` whitelist (server `pricelist.routes.js`)
Add: `bundleTargetSubProduct`, `thresholdAmount`.

### `validateRuleFields` (server `pricelist.routes.js`)
Add `cart_threshold` case: `thresholdAmount > 0` + discount value required.
`bundle` case: if `bundleTargetSubProduct` is present, it's valid (no extra validation — it's just a subproduct ref).

### `deriveRuleCategory` (server `pricelist.routes.js`)
Add `'cart_threshold'` → `'dynamic'`.

### `RULE_EMPTY` + `buildPayload` + `ruleToFormValues` (client `pos-pricelists.tsx`)
Add: `bundleTargetSubProduct: ''`, `thresholdAmount: ''`.

### Constants (`pricelist-constants.ts` + `pos-pricelists.tsx`)
Add `cart_threshold` to `RULE_TYPE_META` (both files) + `RULE_CATEGORY`.

### Client `pricelist.service.ts` `req()` wrapper
Already attaches `body` to errors (from last commit). No change needed.

---

## Implementation order

1. **Commit 1 — Customer-group targeting** (schema + resolution + UI tags input)
2. **Commit 2 — Buy X Get Y cross-product bundle** (schema + `applyCartBundles` engine + server/client hooks + UI Get product picker)
3. **Commit 3 — Cart spend-threshold discount** (schema + `findCartThresholdRules`/`computeCartThresholdDiscount` engine + server/client hooks + UI 6th type button)

Each commit: failing tests first (TDD), then implementation, then verify server suite + client tsc baseline.