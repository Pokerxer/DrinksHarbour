# Sales Create / Detail Improvements — Design

**Date:** 2026-07-01
**Scope:** `client/apps/admin/src/app/shared/sales/*` components behind
`/sales/create` and `/sales/[id]` (+ `[id]/edit`). No server changes.
**Context:** produced in an unattended session; assumptions are listed instead
of clarifying questions. Server pricing stays authoritative — every client
change either fixes a real defect or aligns display with the server math in
`server/services/salesOrder.service.js`.

## Goals

Fix logic/calculation defects and UX gaps in four areas: pricelist,
warehouse, customer, and Scan & Match. Keep the server as the single source
of truth for prices/totals; the client only mirrors its math.

## Changes

### 1. Shared line mapping + metadata hydration (pricelist correctness)

Problem: `useSalesCreateForm`'s edit-load mapper and `sales-create.tsx`'s
`handleUpdatePrices` duplicate the SalesOrder-item → DraftLine mapping, and
both zero out `costPrice`, `sizeName`, `availableStock`, `activeBundles`,
`originalPrice`. Consequences: stock badges disappear after "Update Prices",
markup-on-cost / no-discount bundle rules silently stop applying client-side
(cost/original price = 0), size labels vanish.

Design:
- `soItemToDraftLine(it)` in `sales-create-pricing-helpers.ts` — single mapper
  used by both paths (`priceOverridden: !!it.priceOverridden`).
- `hydrateLineMeta(lines)` inside `useSalesCreateForm`: for each distinct
  subproduct on product lines, fetch catalog data and patch **metadata only**
  (`sizeName`, `costPrice`, `availableStock`, `activeBundles`,
  `originalPrice`) — never `baseUnitPrice`/`priceOverridden`. When a
  warehouse is selected, fetch via `getSubProducts({ search: sku,
  warehouseId })` so `availableStock` is per-warehouse (the list endpoint
  filters to in-stock rows, so an empty result ⇒ stock 0 in that warehouse);
  otherwise fall back to `getSubProduct(id)` (global stock). Runs:
  - after edit-mode initial load (replaces the current stock-only effect),
  - after Update Prices (`applyServerItems`),
  - when the selected warehouse changes (stock refresh for existing lines).
- `applyServerItems(items)` exposed from the form hook; `handleUpdatePrices`
  uses it instead of hand-mapping.

### 2. Warehouse

- Autosave: add `warehouseId` to the autosave timer deps in
  `useSalesAutosave` — today a warehouse-only change is never autosaved.
- Scan drawer: pass `warehouseId` through to its embedded `ProductLineSearch`
  (manual override picker) so manual matches respect the warehouse.
- `ProductLineSearch`: include `warehouseId` in the search effect deps
  (currently a stale closure until the text changes).
- Line stock refresh on warehouse change (via hydration above).
- Out of scope: warehouse-scoped stock in AI scan results (`/api/scan/match`
  has no warehouse param — server change).

### 3. Customer

- `handleClearCustomer` in the form hook: clearing the customer also strips
  the auto-filled `name`/`phone` from invoice (and mirrored delivery)
  addresses **only when they still match the outgoing customer** — hand-typed
  values are preserved. Pricelist auto-resolution already resets via the
  existing hook.

### 4. Scan & Match (`sales-scan-drawer.tsx`)

- Row identity: give each review row a positional `rowKey` (duplicate
  extracted names currently patch each other's qty/size/override).
- Crash guard: `buildSelection` returns `null` when the AI reports a match
  but `matchedSubProducts` is empty; such rows are treated as unmatched.
- Quantity: `onAdd(selection, qty)` once per row instead of calling `onAdd`
  qty times (`addProductFromCatalog` gains an optional `qty` param,
  default 1 — catalog modal unaffected).
- Stock: selections carry `availableStock` so scan-added lines show stock
  badges; the review stock icon uses only the *selected* size's stock (the
  current fallback shows the first size's stock for the wrong size).
- Pairing expiry: honor `expiresAt` — stop polling once expired and surface
  "Pairing code expired — regenerate" instead of polling forever every 2s.

### 5. Calculations / display consistency

- Discount toggle ₦→% clamps the value to ≤ 100 at toggle time (server
  clamps at save; the UI shouldn't show 500%).
- `sales-line-table.tsx` imports `resolveDiscount` from
  `sales-create-pricing-helpers` (removes the duplicated copy).
- Detail pages (order + quotation lines): render a **Promotion** row when
  `promotionTotal > 0` and show per-line `promoName`/`promoDiscount` under
  the product; show the Subtotal row when either discount or promotion is
  non-zero. Without this the visible rows don't sum to Total whenever the
  server applied an automatic promotion.
- Create-page totals: first row relabelled "Subtotal" (same figure the
  detail pages call Subtotal; "Untaxed Amount" was misleading since the
  server's untaxed figure is post-discount).
- Dead imports removed from the detail components.

## Error handling

Hydration and stock refresh are best-effort: failures leave lines unchanged
(same policy as the current edit-load effect). Scan guard rows degrade to the
manual-search flow instead of throwing.

## Testing

No server changes → server suite must stay green (run via
`node --test __tests__/*.test.js`; the bare directory form is broken in this
environment). Client: `tsc` typecheck for the admin app against the known
TS2688-only baseline. Manual browser smoke test remains pending (consistent
with prior sales work).

## Assumptions (in lieu of live Q&A)

1. Server remains pricing authority; no server-side edits in this pass.
2. Per-warehouse stock via SKU search is acceptable (one request per distinct
   line subproduct, mirroring the existing per-id hydrate).
3. Relabelling "Untaxed Amount" → "Subtotal" is wanted for consistency.
4. Scan results keep global stock until the scan API grows warehouse support.
