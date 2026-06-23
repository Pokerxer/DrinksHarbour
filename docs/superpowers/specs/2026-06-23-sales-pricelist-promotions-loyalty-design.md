# Sales Odoo phase-2 — Pricelist selection + Automatic Promotions + Loyalty Redemption

Three independent units, each its own commit, extending the `/sales` Odoo
redesign. They respect the subsystem-1 **totals contract** (tax-exclusive,
per-line, snapshot; `total = (subtotal − discountTotal) + taxTotal`,
`Untaxed Amount = subtotal − discountTotal`).

## Piece 1 — Selectable Pricelist (frontend-only)

Today the pricelist auto-resolves from the customer and is read-only. Make it a
user-selectable field on the create page.

- `sales-create.tsx`: a Pricelist `<select>` in the header next to Customer.
  Options = `pricelists` from `useSalesCustomerPricelist`, plus an empty
  "— Base price —" option.
- State `pricelistId` defaults to the hook's `resolvedId` and tracks it when the
  customer changes **until the user manually overrides**, after which their
  choice persists across customer changes.
- The selected pricelist object feeds the existing `liveUnitPrice(line, pricelist)`
  so every line re-prices live (already reactive via `useMemo`).
- Submit `pricelist: pricelistId || undefined` and the matching
  `appliedPricelist` snapshot.
- Display the applied pricelist name read-only on `sales-order-detail.tsx` and
  `sales-quotation-detail.tsx`.
- No backend change (`createSalesOrderDoc` already accepts `pricelist` +
  `appliedPricelist`). Verify via tsc only.

## Piece 2 — Automatic Promotions (backend + frontend)

Auto-apply active codeless promotions to qualifying product lines, discounting
the **untaxed** base BEFORE tax.

### Totals-contract extension
- Line gains `promoDiscount` (per-unit ₦) and `promoName` (snapshot).
- Order gains `promotionTotal`.
- Untaxed line = `max(0, unitPrice − discount − promoDiscount) × qty`; per-line
  tax computed on that reduced base.
- `Untaxed Amount = subtotal − discountTotal − promotionTotal`;
  `total = untaxed + taxTotal`.

### Service
- `bestPromoForLine(promotions, line)` — pure: from candidate promotions
  (already filtered to this line's subproduct), pick the single best per-unit
  discount (percentage or fixed) via the existing
  `promotion.service.calculateDiscountForItem`. Returns `{ promoDiscount,
  promoName }` or `{ promoDiscount: 0 }`.
- `resolveLinePromotions(items, deps)` — for each product line, fetch active
  promotions for the subproduct (reuse `getActivePromotionsForSubProduct`,
  injected via `deps` for test isolation), run `bestPromoForLine`, attach the
  result. Codeless/auto promotions only (skip any requiring a code).
- `computeTotals(items)` updated to honour `promoDiscount` and emit
  `promotionTotal`. `mapLine` snapshots `promoDiscount`/`promoName`.
  `convertQuotationToOrder` copies them verbatim.

### TDD target
Pure math only: `bestPromoForLine` selection + promo-aware `computeTotals`
(promotion fetch mocked; repo no-DB convention, mirror `salesOrder.tax.test.js`).

### Frontend
Read-only: per-line promo discount display + a `Promotions −₦X` row in the
create totals, order/quotation detail, and invoice. No input (auto-applied).

## Piece 3 — Loyalty Redemption (backend + frontend)

Redeem loyalty points at **confirm** as a payment-side reduction. Does NOT touch
`computeTotals`.

- `computeRedemptionValue(points, posSettings)` — pure: points→₦ from tenant
  loyalty config (`loyaltyPointsPerNaira`/redemption rate), `0` when loyalty
  disabled, capped so redemption never exceeds the order total.
- `capturePayment` accepts `redeemPoints`: reduces amount due, calls
  `mutateLoyalty('redeem')`, rollback-safe alongside the existing earn. Persist
  `loyaltyRedeemed` (₦) and `pointsRedeemed` on the order.
- TDD target: `computeRedemptionValue` (conversion, disabled config, cap).
- Frontend: a "Redeem points" control in the confirm/payment modal on
  `sales-order-detail.tsx`.

## Verification (each piece)
- Backend `cd server && npm test` stays green (222 baseline + new).
- Frontend `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit`
  stays at exactly 27 TS2688, zero others.
- Commit each piece alone: `feat(sales): … (subsystem N of 8)` with the
  `Co-Authored-By: Claude Opus 4.8` trailer.

## Scope guard (YAGNI)
No promotion-code entry (automatic only), no pricelist-rule CRUD (selection
only), no buy-X-get-Y line insertion (percentage/fixed per-line discount only),
no loyalty redemption on drafts (confirm-time only).
