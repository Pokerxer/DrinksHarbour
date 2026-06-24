# Design: Sales Module — Authoritative Pricelist, Editable Unit Price, Quotation/Order Editing, Invoice Payment Terms

**Date:** 2026-06-24
**Scope:** `client/apps/admin/src/app/(hydrogen)/sales/*`, `client/apps/admin/src/app/shared/sales/*`, `server/services/salesOrder.service.js`, `server/controllers/salesOrder.controller.js`, `server/controllers/pos.controller.js`.

## Problem

The `/sales` quotation/order module (built across earlier sessions, see `sales_module_progress` memory) has three gaps surfaced by manual use:

1. **Pricelist is not fully/authoritatively applied.** The create-page live price preview (`liveUnitPrice` in `sales-create.tsx`) only runs the 4 plain pricelist rule types (`fixed`/`formula`/`discount`/`flash_sale` via `computeItemPriceWithPricelist`) — it never applies **bundle**-type rules (volume deals), which POS does via `getBestBundleForItem`/`getEffectiveBundlePriceForItem`. Worse, the server (`salesOrder.service.js`) does **zero** validation of the submitted `unitPrice` against the pricelist — it persists whatever the client sends. POS, by contrast, recomputes price server-side from the resolved pricelist (with a `clientPrice` escape hatch only for display-rounding consistency).
2. **Unit price is not editable.** In the create page's line table, Unit Price renders as static text. There is also no edit UI at all for an existing draft/sent quotation or draft order — line items can only ever be entered once, at creation.
3. **Payment terms is missing from the invoice view.** Payment Terms is otherwise fully wired (create-page selector → server due-date computation → quotation/order detail display) but `sales-invoice-view.tsx` shows only Payment Method.

## Goals

- The quote/order's stored `unitPrice` always reflects the real pricelist (all 5 rule types, including bundles) unless a staff member explicitly typed a custom price for that line.
- Staff can edit a line's unit price directly, both when creating a new document and when editing an existing draft/sent quotation or draft order.
- Staff can edit other fields of an existing draft/sent quotation or draft order (lines, payment terms, addresses, notes/terms, valid-until) — there is currently no edit UI at all beyond status-transition actions.
- The rendered invoice shows Payment Terms (and due date), matching the detail pages.

## Non-goals

- No change to the payment-capture flow, fulfillment, returns, or promotion engine.
- No change to POS's own pricing *behavior* — only a refactor-extraction of its existing rule/bundle logic into a shared module, so Sales can reuse it without a third copy. POS's `clientPrice` override behavior is preserved exactly as-is.
- Quotation ↔ order doc-type conversion stays exclusively via the existing "Convert to Order" action — the new edit capability does not let you change `docType`.

## Design

### 1. Shared server-side pricing module (`server/services/pricelistPricing.service.js`, new file)

Lift the pricelist-rule and bundle-picking logic currently inlined in `pos.controller.js` (`createPOSOrder`, ~lines 2153–2284) into pure, exported functions:

- `applyPricelistPriceRules(price, costPrice, rules, quantity, subProductId)` — sequential fixed/formula/discount/flash_sale application (mirrors `findMatchingPricelistRules` + `applyRuleTransform` filtering already used client-side).
- `pickBestBundle(dbBundles, pricelistRules, quantity, subProductId, { price, costPrice })` — merges DB `bundleDeals` with pricelist `priceType:'bundle'` rules, returns the best-savings qualifying bundle or `null`.
- `applyBundleOverride(price, bestBundle, costPrice, originalPrice)` — applies `markup_on_cost`/`no_discount` overrides directly to the per-unit price; returns `{ price, overridden }`.
- `computeBundleLineDiscount(bestBundle, lineGross, quantity, itemDiscAmt)` — the percentage/fixed bundle-savings amount as a flat ₦ amount across the line (today's inline `bundleDiscAmt` math: `fixed` = `min(discount*quantity, lineGross-itemDiscAmt)`, `percentage` = `lineGross * discount/100`; returns `0` for `markup_on_cost`/`no_discount` since those go through `applyBundleOverride` instead).

`pos.controller.js` is refactored to call these four functions instead of its inline copy, in the same order, producing identical output. This is a behavior-preserving extraction: `bundleDiscAmt` is still combined into `itemDiscountAmount` exactly as today, and the existing `clientPrice` override (`item.clientPrice != null && Number(item.clientPrice) > 0 → effectivePrice = item.clientPrice`) stays exactly where it is, untouched.

**Note on the percentage/fixed bundle case for Sales:** POS represents it as a *separate line-level discount amount* (`priceAtPurchase` stays the rack price; `discountAmount` absorbs the bundle savings) — that fits POS's receipt breakdown. Sales has no equivalent second field; a quote line is just `unitPrice` × `quantity` minus the staff-editable `discount`. So Sales' caller (Section 2) folds `computeBundleLineDiscount`'s result back into a single per-unit price (`unitPrice -= lineDiscount / quantity`, floored at 0) rather than introducing a new schema field — consistent with how Sales already collapses pricelist `discount`-type *price rules* directly into `unitPrice` today.

### 2. Authoritative server-side recompute for Sales

In `server/services/salesOrder.service.js`:

- New async helper `resolveLinePricing(items, { tenantId, pricelistId })`, called in `createSalesOrderDoc` and `applyEdit` before `resolveLinePromotions`:
  - Loads the tenant's `Pricelist` doc by `pricelistId` (validated `tenant: tenantId`) once per call, not per line.
  - For each item with a `subproduct` and `priceOverridden` not `true`: fetch the `SubProduct` (+ `Size` doc if `size` given), compute its base price the same way POS does (reuse `computePOSPricing` — export it from `pos.controller.js` if not already exported, or relocate it next to the new pricing module if that's cleaner once seen in context), then run `applyPricelistPriceRules` → `pickBestBundle` → `applyBundleOverride`. If the picked bundle is a percentage/fixed type (not already handled by `applyBundleOverride`), also call `computeBundleLineDiscount` and fold the result back into the per-unit price (`price -= lineDiscount / quantity`, floored at 0) per the note above. The resulting number becomes the line's authoritative `unitPrice`, overwriting whatever the client sent.
  - For each item with `priceOverridden: true`: keep the client-submitted `unitPrice` verbatim (still coerced/clamped the same way `mapLine` already does — `Number(it.unitPrice) || 0`).
  - Lines with no `subproduct` (shouldn't occur given `handleSave` always filters to filled lines, but defensively) pass through unchanged.
- `mapLine` gains `priceOverridden: !!it.priceOverridden` in its returned shape.
- `SalesOrder` model (`server/models/SalesOrder.js`) item subschema gains `priceOverridden: { type: Boolean, default: false }`.
- `convertQuotationToOrder` already copies the line snapshot verbatim (no re-pricing) — carry `priceOverridden` through that copy too, unchanged from today's behavior of trusting the snapshot.

### 3. Client-side live preview parity (`sales-create.tsx`, `product-line-search.tsx`)

- `ProductLineSelection` (in `product-line-search.tsx`) gains optional `bundleDeals?` and `originalPrice?`, populated from whatever the `/api/subproducts` list response already contains for those fields (best-effort: if absent, downstream bundle matching just finds nothing, falling back to today's price-rules-only preview — no regression).
- `DraftLine` carries `activeBundles` and `originalPrice` through from the selection.
- `liveUnitPrice()` switches from `computeItemPriceWithPricelist(pricingItem, pricelist)` to `getEffectiveBundlePriceForItem(pricingItem, pricelist).price` — the same function POS's cart uses — so the preview reflects bundle/volume deals too.
- This is a preview-only change; Section 2's server recompute is the actual source of truth for the saved price.

### 4. Editable unit price + override flag (`sales-create.tsx`)

- `DraftLine` gains `priceOverridden: boolean` (default `false`).
- The Unit Price table cell changes from a static `<td>{fmtCur(...)}</td>` to a number `<input>` (same `INLINE_CELL_CLS` styling as Discount/Tax). `onChange` sets `unitPrice` directly on the line and flips `priceOverridden: true`.
- The `priced` memo: when `line.priceOverridden` is true, use `line.unitPrice` as-is; otherwise compute via `liveUnitPrice()` as today (so non-overridden lines keep tracking pricelist/quantity changes live).
- Selecting a product/size via `ProductLineSearch` on an existing row resets `priceOverridden: false` (fresh line → fresh auto price) in addition to the fields it already sets.
- Overridden lines get a small visual marker next to the price input (e.g. a dot with a `title="Manually set"` tooltip) so staff can see at a glance which lines aren't pricelist-driven.
- `handleSave`'s POST/PUT payload includes `priceOverridden` per line; `CreateSalesOrderInput`/`UpdateSalesOrderInput`/`SalesLineItem` (`salesOrder.service.ts`) gain the field.

### 5. Edit capability for existing draft/sent documents

- `sales-create.tsx` is generalized to accept `mode: 'create' | 'edit'` (default `'create'`) and an optional `initial?: SalesOrder`. When `initial` is present, all local state (`customer`, `lines`, `notes`, `terms`, `validUntil`, `paymentTerms`, `invoiceAddress`/`deliverDifferent`/`deliveryAddress`, `pricelistId`/`pricelistOverridden`) is seeded from it on mount, including each line's `priceOverridden`.
- In `'edit'` mode:
  - The two save buttons ("Create Order" / "Save as Quotation") are replaced with a single "Save Changes" button calling `salesOrderService.update(id, patch, token)`, then redirecting to the detail page (`routes.eCommerce.salesDetails(id)`).
  - The doc-type stays whatever it already is — no UI to flip `quotation`↔`order` (unchanged: that's still only via "Convert to Order").
  - Stage pills reflect the document's real current status (`quoteStatus`/`orderStatus`) instead of hardcoding "Quotation" active.
- New route `client/apps/admin/src/app/(hydrogen)/sales/[id]/edit/page.tsx`: thin shell that fetches the `SalesOrder` by id (same loader pattern as `SalesDetail`) and renders `<SalesCreate mode="edit" initial={so} />`, with a loading skeleton and a "not found"/error state matching `SalesDetail`'s.
- `sales-quotation-detail.tsx`: add an **Edit** button/link to `/sales/[id]/edit`, visible exactly when `quoteStatus` is `draft` or `sent` (mirrors server `canEdit` for quotations).
- `sales-order-detail.tsx`: add an **Edit** button/link, visible exactly when `orderStatus` is `draft` (mirrors server `canEdit` for orders).
- Customer prefill in edit mode: build a minimal `POSCustomer`-shaped object from `so.customerSnapshot` (`firstName`/`lastName` split from `name`, `phone`, `email`, `_id: customerSnapshot.customerId`) to pass as `CustomerSearch`'s `selected` prop. Staff can re-search to change the customer entirely if needed; pricelist auto-resolution re-runs the same way it does today since it's keyed off `customer?._id`.

### 6. Invoice view payment terms (`sales-invoice-view.tsx`)

Add a "Payment Terms" block next to/below the existing "Payment Method" line, using the same `paymentTermsLabel(so.paymentTerms)` + due-date formatting already used in `sales-quotation-detail.tsx`/`sales-order-detail.tsx`.

## Risks / open considerations

- `computePOSPricing` may not currently be exported from `pos.controller.js`; resolving this (export it, or relocate it) is part of Section 2's implementation, decided when the implementer is in that file.
- The `/api/subproducts` list endpoint's exact field shape for `bundleDeals`/`originalPrice` needs a quick check at implementation time — Section 3 is written to degrade gracefully if those fields turn out to be absent.
- Editing a line's product/size on an `edit`-mode document re-triggers the same "fresh auto price" reset as create mode — acceptable since the server re-validates/recomputes on save regardless.

## Verification

- Server: extend/add `server/__tests__/sales*.test.js` covering: a line with a fixed/discount/bundle pricelist rule gets server-recomputed regardless of submitted `unitPrice`; a line with `priceOverridden: true` keeps the client price; `applyEdit` re-running pricing on an edit; the extracted `pricelistPricing.service.js` pure functions unit-tested directly (mirroring `poReceive.helpers.test.js` style).
- Server: existing POS test suites must stay green after the `pos.controller.js` extraction (behavior-preserving refactor).
- Client: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` — no new errors beyond the existing TS2688 baseline.
- Manual E2E: create a quotation against a customer with a pricelist that has a bundle rule → confirm the line price reflects the bundle once quantity qualifies; manually override a line's price → confirm it sticks through save and reload; edit an existing draft quotation (change qty, payment terms, address) → save → confirm detail page reflects changes; render the invoice view → confirm Payment Terms + due date appear.
