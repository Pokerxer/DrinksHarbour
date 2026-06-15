# Sub-Product Edit-Page Inventory ↔ Warehouse Reconciliation

**Date:** 2026-06-15
**Branch:** `fix/po-validate-warehouse-routing`
**Related:** `docs/superpowers/specs/2026-06-14-multi-warehouse-inventory-design.md`, `docs/superpowers/specs/2026-06-15-po-receive-warehouse-selection-design.md`

## Problem

Multi-warehouse inventory moved on-hand stock into `WarehouseStock` rows (per `subProduct × size × warehouse`). The sub-product **edit** page (`/ecommerce/sub-products/:id/edit`) still has legacy single-bucket stock surfaces that read/write `SubProduct.{totalStock, reservedStock, availableStock}` and `Size.stock` directly. These collide with the warehouse model and create phantom writes.

### Investigation findings (source of truth split)

The server now has **two parallel stock systems**:

**Stocking (new — source of truth):**
- `WarehouseStock` rows hold `currentQuantity` + `reservedQuantity` per `(subProduct, size, warehouse)`.
- `warehouse.service.adjustStock` / `transferStock` mutate those rows, then `warehouseStock.helpers.recalcSubProductStock()` **overwrites** `SubProduct.{totalStock, reservedStock, availableStock}` with the sum across rows (`computeRollup`). Those three SubProduct fields are therefore a **derived rollup**, refreshed only when the warehouse path runs. PO-receive already posts through this path (no legacy dual-write).
- `recalcSubProductStock` updates **only** SubProduct-level fields — it never touches per-`Size` documents.

**Selling (legacy — still live, unmigrated):**
- Online orders (`inventory.service.reserve/commitShipment/restoreStock`, called from `order.controller.js`) gate on `SubProduct.availableStock` and decrement `SubProduct.{totalStock,availableStock,reservedStock}` + `Size.stock`.
- POS (`pos.controller.js`) gates on `SubProduct.availableStock` / `Size.availableStock` and decrements the same legacy fields + `Size.stock`.
- Neither reads or writes `WarehouseStock`, and neither selects a warehouse.

### The pre-existing collision (out of scope, documented)

Because `recalcSubProductStock` **overwrites** `availableStock`/`reservedStock` from `WarehouseStock` row sums, any warehouse operation silently undoes sale-driven decrements (sales never touched `WarehouseStock`). This data-integrity issue already exists on the branch via the warehouse UI + PO-receive; it is **not** caused by the edit page and is **not** fixed here (see Follow-up #2).

### Live legacy surfaces on the edit page

1. **Form save path** — `client/.../sub-product/create-edit/index.tsx:852-884`: diffs `totalStock` and fires `inventoryService.recordReceived` / `adjustInventory` (edit branch) + initial-stock `recordReceived` (create branch). Blind increments with no warehouse/size context; create no `WarehouseStock` row; next rollup erases them.
2. **Update payload** — `client/.../utils/transformers/subProduct.transformer.ts:315-317`: `transformFormData` (form→API) sends `totalStock`/`reservedStock`/`availableStock`, so every save `$set`s the rollup fields to the form's stale value.
3. **Inventory section tabs** — `client/.../create-edit/inventory/index.tsx`: Overview/History/Stock-Moves read legacy `inventoryService` (summary + `InventoryMovement`). Locations is already migrated to `WarehouseStock`.
4. **Per-size "Stock" input** — `client/.../create-edit/sizes.tsx:1289`: writes `Size.stock` (sales-path field, not maintained by the warehouse rollup).

(Note: `inventory-tracking.tsx`, `pricing-inventory.tsx`, `product-pricing.tsx` import from the *product* editor and are **not** rendered in the sub-product form — not in scope.)

## Principle

On the edit page, `WarehouseStock` is the source of truth for on-hand quantities. `SubProduct.{totalStock, reservedStock, availableStock}` are a **derived rollup**. The edit page must *display* those numbers and *route all on-hand changes through the warehouse adjust/transfer service* (already built in `LocationsTab`), and must never blind-write them.

## Scope decision

**This task = edit page only.** The sales/POS → `WarehouseStock` migration is a separate, larger effort (Follow-up #2). Confirmed with user.

## Changes

### 1. Remove the form's legacy stock-write path
**File:** `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/index.tsx` (~852-884)

Delete the `totalStock`-delta computation and both `inventoryService.recordReceived` / `adjustInventory` calls in the edit branch, and the create-branch initial-stock `recordReceived`. Remove the now-unused `inventoryService` import if nothing else uses it. Stock is added via warehouse pages / the Locations tab.

### 2. Stop the update payload from clobbering the rollup
**File:** `client/apps/isomorphic/src/utils/transformers/subProduct.transformer.ts` (~315-317)

Omit `totalStock`, `reservedStock`, `availableStock` from the **form→API** output of `transformFormData`. Keep `stockStatus` (not rollup-managed). The create path is unaffected (model defaults these to 0; stock is added later via warehouse adjust).

**Defense-in-depth (server):** in the subproduct update path, ignore/strip client-supplied `totalStock`, `reservedStock`, `availableStock` so no client can overwrite the rollup. (Locate the existing subproduct update controller/service and drop these keys from the accepted update body.)

### 3. Repoint Inventory → Overview to the rollup
**Files:** `client/.../create-edit/inventory/index.tsx`, `client/.../create-edit/inventory/OverviewTab/index.tsx`

Fetch the `getStockByWarehouse` rollup (sum of `currentQuantity` / `reservedQuantity`) at the section level and feed `OverviewTab`'s `totalStock` / `availableStock` props from it instead of `inventoryService.getInventorySummary`. Overview headline numbers then match the warehouse source of truth.

**History and Stock-Moves tabs stay on legacy `InventoryMovement`** — that is still where sales movements are recorded. Locations is already migrated.

### 4. Per-size "Stock" input — no behavior change
**File:** `client/.../create-edit/sizes.tsx` (~1289)

Leave editable (writes `Size.stock`, the only control over sales-path per-size stock until Follow-up #2). Add one small inline helper note pointing to the Inventory → Locations tab for warehouse on-hand, clarifying the relationship.

### 5. Header stat chip — no change
`index.tsx:1271` already shows `watch('subProductData.totalStock')` (the rollup loaded from the server).

## Out of scope — Follow-up #2 (logged)

Migrate the sales/POS decrement path off the legacy single-bucket onto `WarehouseStock`: `order.controller.js`, `pos.controller.js`, `inventory.service.js`, and `Size.stock`. Needs its own spec (warehouse selection on sale, per-row decrement, per-row reservations, sellable-availability derivation). Until it lands, the rollup keeps overwriting sale-driven `availableStock`/`reservedStock`. Capture as a memory note + stub spec.

## Verification

- `npx tsc --noEmit` clean (no new errors vs the 27 pre-existing TS2688 global-typedef errors).
- Edit a sub-product and save → via API, `SubProduct.totalStock` is unchanged (no phantom write) and the save creates no `InventoryMovement`.
- Adjust stock in the Locations tab → Overview headline numbers update to match the warehouse rollup.
- Per-size stock edit still persists to `Size.stock`.
- Server modules load; existing helper tests still green.
