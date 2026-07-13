# Quantity-Triggered Pack Pricing — Design

**Date:** 2026-07-13
**Status:** Approved by user (pending spec review)

## Problem

A tenant's normal markup (e.g. 15%) applies to every unit regardless of quantity, so
buying a pack's worth of bottles (e.g. 6) is barely cheaper than singles, killing
bulk-buy economics. The earlier size-based approach (separate "×6" pack SKUs priced
at pack rates) was reverted on the storefront; the tenant pack-rate fields and
`resolveRevenueRates` survived server-side.

**Goal:** one SKU per size, one stock pool. Units 1–5 sell at the normal tenant
markup; once a cart/order line reaches the size's stored pack quantity (e.g. 6), the
**whole line** is priced at the reduced pack markup (e.g. 10%).

## Decisions (user-confirmed)

1. **Quantity-only model** — no separate pack SKUs on the storefront. The pack
   quantity is stored on the single size.
2. **Whole-line trigger** — at `quantity >= packThreshold`, ALL units on the line get
   the pack price (8 bottles → 8 × pack price). No blended/exact-multiple pricing.
3. **POS uses pricelists, not the pack trigger** — quantity-based pricing at POS is
   the tenant's own concern, served by the existing pricelist `minQuantity` rules
   (`server/models/Pricelist.js:53`) already enforced in POS. The platform pack
   trigger applies only to the platform storefront (cart/checkout).

## 1. Semantics & data model

No schema additions. `Size.unitsPerPack` (existing, default 1) is **reinterpreted**:
it no longer means "this SKU is a pack of N"; it now means "N units of this size make
a pack" (the trigger threshold).

- `unitsPerPack: 1` (default) → no pack pricing; size behaves exactly as today.
- `unitsPerPack >= tenant.packRateMinUnits` → size is **pack-eligible**: singles at
  normal markup, whole line at pack markup once `quantity >= unitsPerPack`.
- Tenant fields unchanged: `packMarkupPercentage` (null → normal rates, i.e. feature
  off for that tenant), `packCommissionPercentage` (null → normal commission),
  `packRateMinUnits` (default 2).
- Order items gain `packRateApplied: Boolean` (default false) for reporting.

## 2. Pricing engine (`server/utils/pricing.js`)

- `calculateSizePricing` always computes the headline `finalPrice` at **normal**
  rates. (Today it silently uses pack rates when `unitsPerPack >= 2`; that behavior
  is removed.) When the size is pack-eligible it additionally runs the same full
  pipeline (platform markup/override, product discount, round-up-to-₦100, undercut)
  at pack rates and returns:
  - `packUnitPrice` — per-unit price at the pack rate
  - `packThreshold` — `unitsPerPack`
  - `packSavingsPct` — vs `finalPrice`
  If `packUnitPrice` is not strictly cheaper than `finalPrice` (tenant has no pack
  rates, or round-up erases the gap), all three are `null` and nothing is advertised.
- New helper `resolveLineRates(tenant, size, quantity)` →
  `{ markupPct, commissionPct, isPackRate }` where `isPackRate` requires BOTH
  eligibility (`unitsPerPack >= packRateMinUnits`) AND `quantity >= unitsPerPack`.
  This is the single quantity trigger used by cart validation and checkout.
- `resolveRevenueRates(tenant, unitsPerPack)` remains as the underlying rate lookup;
  no caller passes `size.unitsPerPack` into it directly anymore.

## 3. Static pricing call sites (display/search)

All sites that currently key pack rates on `size.unitsPerPack` switch back to normal
rates for the headline price:

- `product.service.js` — 7 inline `resolveRevenueRates(tenant, size.unitsPerPack)`
  blocks (lines ~4447, 5486, 7733, 8701, 9130, 9537, 11079) and the 2 price-stats
  aggregations (drop the `$cond` on `unitsPerPack`).
- `buildProductQuery.helper.js` `calculateEffectivePrice` — price filters/sorts match
  the headline single-unit price.
- `chatbot.service.js` — same.

Size payloads shaped in `product.service.js` / `subproduct.service.js` gain
`packUnitPrice` / `packThreshold` / `packSavingsPct` (null when not eligible).

## 4. Storefront (platform app)

- **Product page:** pack-eligible sizes show "₦Y each when you buy N+ (save Z%)".
- **Cart:** when a line crosses the threshold, its unit price flips to
  `packUnitPrice` with a "Pack price applied" tag; below threshold, a nudge shows
  "Add K more to pay ₦Y each". Cart totals use the effective quantity-aware price.

## 5. Cart service (`server/services/cart.service.js`)

- `validateCartItems` computes
  `currentPrice = quantity >= packThreshold ? packUnitPrice : finalPrice` and returns
  `packApplied`, `packUnitPrice`, `packThreshold` so the client can render tags and
  nudges. Existing `price_changed` reconciliation handles threshold crossings.
- `recalculateCartTotals` becomes quantity-aware the same way.

## 6. Checkout (`server/controllers/order.controller.js`)

- The controller stops trusting the client's `item.price` as the authoritative unit
  price: it recomputes it server-side via `calculateSizePricing` + the quantity
  trigger (also closes a pre-existing price-tampering gap).
- Vendor payout uses `resolveLineRates(tenant, size, quantity)` — when the customer
  gets the pack price, the tenant is paid out at the pack markup, keeping the margin
  structure consistent. `revenueRateAtPurchase` records the applied rate;
  `packRateApplied` is set on the order item.

## 7. POS — explicitly out of scope for the trigger

POS pricing (`computePOSPricing` in pos.controller → salesPricing.service, and the
`computePrice` mirrors in `pos.routes.js` / `posCombo.routes.js`) **drops** the
static `resolveRevenueRates(tenant, size.unitsPerPack)` keying and uses normal rates
for the platform revenue math. Quantity-based bulk pricing at POS is served by the
existing tenant pricelist engine (`Pricelist` rules with `minQuantity`, already
enforced authoritatively in POS and sales). No new POS pricing logic is added.

## 8. Migration & rollout

- One-off script `server/scripts/migrate-pack-skus.js`: for each size with
  `unitsPerPack >= 2` (2 exist in prod: "75cl ×6", "1.75L ×6"), find the sibling
  single size on the same subproduct (matched by `volumeMl`), fold pack stock into it
  (`+ packStock × unitsPerPack`), copy `unitsPerPack` onto the single as its
  threshold, deactivate the pack SKU.
- Ships inert: with all singles at `unitsPerPack: 1`, behavior is identical to today.
  Thresholds are set per size via the admin size editor or bulk import (the import
  already carries `unitsPerPack`).

## 9. Edge cases

- `maxOrderQuantity < unitsPerPack` → threshold unreachable → pack fields suppressed.
- Tenant without pack rates configured → `packUnitPrice` null → fully inert.
- Coupons stack on top of the pack-priced subtotal (unchanged).
- Guest carts / `syncCart` / `replaceCart` reuse the same effective-price logic via
  `validateCartItems`.
- Known pre-existing gap left untouched: `search.service.js processProduct` legacy
  pricing path (adds commission on top of sellingPrice; inconsistent with the
  platform pipeline before this change too).

## 10. Testing (node:test, extend `server/__tests__/packPricing.test.js`)

- `resolveLineRates`: boundary at qty = threshold − 1 vs threshold; ineligible size;
  tenant without pack rates.
- `calculateSizePricing`: headline price at normal rates regardless of
  `unitsPerPack`; pack fields present/suppressed correctly.
- Whole-line repricing at qty 8 (threshold 6).
- `order.controller`: server-side price recompute overrides client price; payout at
  pack rate; `packRateApplied` set.
- `validateCartItems`: `packApplied` + price flip across the threshold.
- POS: static pack keying removed (pack-eligible size prices at normal rate at POS).
