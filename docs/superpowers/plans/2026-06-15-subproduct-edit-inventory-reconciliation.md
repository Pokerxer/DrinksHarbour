# Sub-Product Edit-Page Inventory ↔ Warehouse Reconciliation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sub-product edit page treat `WarehouseStock` as the source of truth — stop the form from blind-writing the derived `SubProduct` stock rollup, and show warehouse-derived numbers in the Inventory → Overview tab.

**Architecture:** `SubProduct.{totalStock,reservedStock,availableStock}` are a server-maintained rollup of `WarehouseStock` rows (`recalcSubProductStock`). The edit page must display, never write, those fields, and route on-hand changes through the warehouse adjust/transfer UI (already built in `LocationsTab`). Sales/POS migration off legacy fields is explicitly out of scope (follow-up #2).

**Tech Stack:** Next.js 14 (App Router) + React Hook Form + TypeScript client (`client/apps/isomorphic`); Express + Mongoose server (`server`).

**Spec:** `docs/superpowers/specs/2026-06-15-subproduct-edit-inventory-reconciliation-design.md`

**Testing reality (read first):** This codebase has no client component-test harness; client correctness is verified by `npx tsc --noEmit` (baseline: 27 pre-existing `TS2688` global-typedef errors — any task must add **zero** new errors) plus targeted API/browser checks. Server pure helpers use `node --test`, but `updateSubProduct` is DB-bound and not structured for unit testing, so its verification is an API check. Each task therefore uses **tsc / grep-confirmation / API check** as its verification gate instead of fabricated unit tests. Run all client commands from `client/apps/isomorphic`.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/index.tsx` | Form orchestrator + save | Remove legacy `inventoryService` stock writes from save path; drop unused import |
| `client/apps/isomorphic/src/utils/transformers/subProduct.transformer.ts` | Form↔API mapping | Omit rollup fields from form→API output |
| `server/services/subproduct.service.js` | SubProduct update | Ignore client-supplied rollup fields (defense-in-depth) |
| `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/index.tsx` | Inventory section orchestrator | Source Overview's stock numbers from `getStockByWarehouse` rollup, not legacy summary |
| `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/sizes.tsx` | Sizes step | Add a helper note next to the per-size Stock input |

---

## Task 1: Remove the form save-path legacy stock writes

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/index.tsx` (~70, ~845-888)

- [ ] **Step 1: Read the current save block**

Open `index.tsx` and confirm the edit-branch block (~845-870) reads `currentSubProduct.totalStock`, computes `stockDelta`, and calls `inventoryService.recordReceived` / `inventoryService.adjustInventory`; and the create-branch (~875-885) calls `inventoryService.recordReceived` for initial stock.

- [ ] **Step 2: Replace the edit branch**

Replace lines ~845-870 (the `if (isEditMode && id) { ... }` body up to the `toast.success('Sub Product updated successfully!')`) with the version below — it keeps the update call and toast, drops the stock-delta logic:

```tsx
      if (isEditMode && id) {
        await subproductService.updateSubProduct(id, transformedData, token);
        if (!silent) toast.success('Sub Product updated successfully!');
      } else {
```

- [ ] **Step 3: Replace the create branch**

In the `else` branch (~871-888), remove the initial-stock `inventoryService.recordReceived` call. The branch should read:

```tsx
        const response = await subproductService.createSubProduct(transformedData, token);
        createdId = response?.data?.subProduct?._id || response?.data?.subProduct?.id || null;

        if (createdId) {
          setCreatedSubProductId(createdId);
        }

        if (!silent) toast.success('Sub Product created successfully!');
      }
```

- [ ] **Step 4: Remove the now-unused import**

Delete line ~70: `import { inventoryService } from '@/services/inventory.service';` — but ONLY if no other reference remains.

Run: `grep -n "inventoryService" client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/index.tsx`
Expected: no matches. If any remain, leave the import.

- [ ] **Step 5: Verify no new type errors**

Run (from `client/apps/isomorphic`): `npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "create-edit/index.tsx" || echo "OK: no new errors in file"`
Expected: `OK: no new errors in file`

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/index.tsx
git commit -m "fix(client): stop sub-product save from firing legacy inventory writes"
```

---

## Task 2: Stop the form→API payload from clobbering the rollup

**Files:**
- Modify: `client/apps/isomorphic/src/utils/transformers/subProduct.transformer.ts` (~311-317)

- [ ] **Step 1: Locate the form→API output**

Find the `transformFormData` return object (~311-317) containing `totalStock`, `reservedStock`, `availableStock`. Confirm it is the form→API direction (it maps `sp.*` form values to the API payload), distinct from `transformBackendToForm` (~454-524).

- [ ] **Step 2: Remove the three rollup fields from the payload**

Delete these three lines from the `transformFormData` return object (~315-317):

```ts
    totalStock: Math.max(0, toNumber(sp.totalStock) ?? 0),
    reservedStock: Math.max(0, toNumber(sp.reservedStock) ?? 0),
    availableStock: Math.max(0, toNumber(sp.availableStock) ?? 0),
```

Keep the adjacent `stockStatus: normalizeStockStatus(sp.stockStatus),` line — `stockStatus` is not rollup-managed. Keep the per-size `stock`/`availableStock`/`reservedStock` fields inside `transformSize` (~230,245-246) unchanged — per-size `Size.stock` stays editable.

- [ ] **Step 3: Confirm the fields are gone from the form→API path only**

Run: `grep -nE "totalStock|reservedStock|availableStock" client/apps/isomorphic/src/utils/transformers/subProduct.transformer.ts`
Expected: matches remain only in the `interface`/type defs (~28-29, 90-92), `transformSize` (~245-246), and `transformBackendToForm` (~522-524); NO matches inside the `transformFormData` return body (~311-318).

- [ ] **Step 4: Verify no new type errors**

Run (from `client/apps/isomorphic`): `npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "subProduct.transformer.ts" || echo "OK: no new errors in file"`
Expected: `OK: no new errors in file`

- [ ] **Step 5: Commit**

```bash
git add client/apps/isomorphic/src/utils/transformers/subProduct.transformer.ts
git commit -m "fix(client): omit derived stock rollup from sub-product update payload"
```

---

## Task 3: Server defense-in-depth — ignore client-supplied rollup fields

**Files:**
- Modify: `server/services/subproduct.service.js` (`updateSubProduct`, ~1188 and ~1831-1832)

- [ ] **Step 1: Strip rollup keys at the top of `updateSubProduct`**

In `updateSubProduct` (starts line 1170), immediately after the line `const data = updateData.subProductData || updateData;` (~1188), insert:

```js
  // Stock rollup fields are derived from WarehouseStock by recalcSubProductStock().
  // Never accept them from the client — doing so would overwrite the authoritative
  // per-warehouse sum. (See spec 2026-06-15-subproduct-edit-inventory-reconciliation.)
  delete data.totalStock;
  delete data.reservedStock;
  delete data.availableStock;
```

This neutralizes the downstream `if (data.totalStock !== undefined)` assignments (~1428-1436) and the availableStock-derive blocks guarded by `data.totalStock !== undefined` (~1660-1671).

- [ ] **Step 2: Remove the size-sum rollup overwrite**

Near line ~1831-1832 there is a branch that recomputes the rollup from per-size stock:

```js
        subProduct.totalStock = totalSizeStock;
        subProduct.availableStock = totalSizeStock - (subProduct.reservedStock || 0);
```

Delete those two assignment lines (keep everything else in that block — size persistence and any `stockStatus`/`status` logic stays). The rollup must come only from `WarehouseStock`. If removing them leaves an empty `if`/block, leave a one-line comment `// rollup derived from WarehouseStock; not recomputed from size stock` in their place so the block stays syntactically valid.

- [ ] **Step 3: Confirm the server module still loads**

Run: `cd server && node -e "require('./services/subproduct.service.js'); console.log('loads OK')"`
Expected: `loads OK`

- [ ] **Step 4: Confirm no stray rollup assignment survives in the update fn**

Run: `awk 'NR>=1170 && NR<=1900' server/services/subproduct.service.js | grep -nE "subProduct\.(totalStock|availableStock|reservedStock)[ ]*="`
Expected: no matches in the `updateSubProduct` body (the create function `createSubProduct` near ~890-925 is a different function and may still set these — that is fine, not in scope).

- [ ] **Step 5: Commit**

```bash
git add server/services/subproduct.service.js
git commit -m "fix(server): ignore client-supplied stock rollup fields on subproduct update"
```

---

## Task 4: Repoint Inventory → Overview to the warehouse rollup

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/index.tsx` (~24 import already present, ~169 state, ~289-302 sync effect, ~354-364 tab-fetch effect)

Context: Overview displays `totalStock`/`availableStock`/`reservedStock` read from form `watch` values (~83-85). Those form values are currently overwritten from the **legacy** `inventorySummary.subProduct` by the effect at ~289-302. We switch that source to the `WarehouseStock` rollup. `warehouseStockService` is already imported (~24). The `inventorySummary` fetch stays (History/Moves still use it).

- [ ] **Step 1: Add rollup state**

Find the `inventorySummary` state declaration (~169). Immediately after it, add:

```tsx
  const [warehouseRollup, setWarehouseRollup] = useState<{
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  } | null>(null);
```

(Confirm `useState` is already imported at the top of the file; it is used elsewhere in this component.)

- [ ] **Step 2: Add a rollup fetch callback**

Immediately after the `fetchInventoryData` callback definition (ends ~326), add:

```tsx
  // Stock rollup from WarehouseStock rows — the source of truth for on-hand numbers.
  const fetchWarehouseRollup = useCallback(async () => {
    if (!subProductId || !session?.user?.token) return;
    try {
      const res = await warehouseStockService.getStockByWarehouse(
        subProductId,
        session.user.token
      );
      const rows = (res?.data ?? []) as Array<{
        currentQuantity?: number;
        reservedQuantity?: number;
      }>;
      const totalStock = rows.reduce((s, r) => s + (r.currentQuantity || 0), 0);
      const reservedStock = rows.reduce(
        (s, r) => s + (r.reservedQuantity || 0),
        0
      );
      setWarehouseRollup({
        totalStock,
        reservedStock,
        availableStock: Math.max(0, totalStock - reservedStock),
      });
    } catch (error) {
      console.error('Failed to fetch warehouse rollup:', error);
    }
  }, [subProductId, session?.user?.token]);
```

- [ ] **Step 3: Replace the legacy sync effect**

Replace the effect at ~289-302 (the `// Sync form values from server inventory summary after fetch` block) with one that syncs from the warehouse rollup:

```tsx
  // Sync the displayed stock rollup into the form from WarehouseStock (source of truth).
  useEffect(() => {
    if (warehouseRollup) {
      setValue?.('subProductData.totalStock', warehouseRollup.totalStock);
      setValue?.('subProductData.reservedStock', warehouseRollup.reservedStock);
      setValue?.('subProductData.availableStock', warehouseRollup.availableStock);
    }
  }, [warehouseRollup, setValue]);
```

Note: `stockStatus` is intentionally no longer synced here — it is loaded with the sub-product on initial form load and is not rollup-managed.

- [ ] **Step 4: Fetch the rollup when Overview (or Locations) is active**

Find the tab-driven fetch effect (~354-364, the one calling `fetchInventoryData` when `activeTab` is `history`/`overview`/`moves`). Immediately after that effect, add:

```tsx
  // Overview shows warehouse-derived numbers; refresh the rollup when it (or Locations) is shown.
  useEffect(() => {
    if (!session?.user?.token || !subProductId) return;
    if (activeTab === 'overview' || activeTab === 'locations') {
      fetchWarehouseRollup();
    }
  }, [subProductId, session?.user?.token, activeTab, fetchWarehouseRollup]);
```

- [ ] **Step 5: Refresh the rollup after a Locations-tab change**

Find where `<LocationsTab` is rendered (~1133). Ensure it passes an `onRefresh` that refreshes the rollup. If it already has `onRefresh`, add `fetchWarehouseRollup()` to that handler; otherwise add:

```tsx
            onRefresh={() => {
              fetchWarehouseRollup();
            }}
```

(LocationsTab already accepts an optional `onRefresh` prop.)

- [ ] **Step 6: Verify no new type errors**

Run (from `client/apps/isomorphic`): `npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "inventory/index.tsx" || echo "OK: no new errors in file"`
Expected: `OK: no new errors in file`

- [ ] **Step 7: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/inventory/index.tsx
git commit -m "feat(client): drive sub-product Overview stock from WarehouseStock rollup"
```

---

## Task 5: Per-size Stock input — add a clarifying note

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/sizes.tsx` (~1283-1300)

The per-size Stock input stays editable (it writes `Size.stock`, the sales-path field). Add a one-line helper so users understand it is separate from warehouse on-hand.

- [ ] **Step 1: Add the helper note under the Stock input**

In the `{/* Stock */}` block (~1283), directly after the closing `/>` of the per-size stock `<input>` (the `name={`subProductData.sizes.${index}.stock`}` field, ~1289-1298), and before that field's wrapping `</div>` closes, add:

```tsx
          <p className="mt-1 text-[11px] text-gray-400">
            Sellable count. Warehouse on-hand is managed in the Inventory →
            Locations tab.
          </p>
```

- [ ] **Step 2: Verify no new type errors**

Run (from `client/apps/isomorphic`): `npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "sizes.tsx" || echo "OK: no new errors in file"`
Expected: `OK: no new errors in file`

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/ecommerce/sub-product/create-edit/sizes.tsx
git commit -m "docs(client): clarify per-size stock vs warehouse on-hand in sizes step"
```

---

## Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full type check (no new errors)**

Run (from `client/apps/isomorphic`): `npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "error TS" | wc -l`
Expected: `0`

- [ ] **Step 2: Server boots / modules load**

Run: `cd server && node -e "require('./services/subproduct.service.js'); require('./controllers/subproduct.controller.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Phantom-write check (API)**

With the server running (replica-set Mongo per the multi-warehouse notes) and a valid admin token, pick a sub-product id `SP` that has WarehouseStock rows. Record its current `totalStock` via `GET /api/subproducts/SP`. Then `PUT/PATCH` the sub-product through the edit form (or replay the form payload) changing only a non-stock field (e.g. internal notes). Re-fetch `GET /api/subproducts/SP`.
Expected: `totalStock` / `availableStock` / `reservedStock` are unchanged, and no new `InventoryMovement` was created for `SP` by the save.

- [ ] **Step 4: Overview-matches-rollup check (browser, optional but recommended)**

Open `/ecommerce/sub-products/SP/edit` → Inventory tab. In Locations, adjust on-hand for one warehouse/size. Switch to Overview.
Expected: Overview's Total/Available reflect the new `WarehouseStock` sum (matches `GET /api/subproducts/SP/stock-by-warehouse`).

- [ ] **Step 5: Per-size stock still editable**

Edit a size's Stock value and save.
Expected: the value persists to `Size.stock` (verify via `GET /api/subproducts/SP` size data); the helper note renders under the input.

---

## Self-Review notes

- **Spec coverage:** Change #1 → Task 1; Change #2 → Task 2 (client) + Task 3 (server defense-in-depth); Change #3 → Task 4; Change #4 → Task 5; Change #5 (header chip, no change) → covered by Task 4 making the rollup the form value the chip reads. Verification → Task 6. Follow-up #2 is out of scope (logged separately, see below).
- **Out of scope:** sales/POS → WarehouseStock migration (follow-up #2) — to be captured as a memory note + stub spec by the implementer when work begins.
