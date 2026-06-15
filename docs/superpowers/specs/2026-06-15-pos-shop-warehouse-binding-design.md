# Design: bind POS shops to a warehouse

**Date:** 2026-06-15
**Branch:** `feat/pos-shop-warehouse-binding`
**Status:** Approved

## Problem

`Tenant.posSettings.shops` ("DRIVE-THRU", "VIP BAR", etc.) is currently
cosmetic. The `ShopSelector` in the POS nav header shows a dropdown of
built-in (RETAIL/WHOLESALE) and custom shops, but the selection is local
`useState` — never persisted, never sent to the server. `getPOSProducts` and
`createPOSOrder` always read/write the tenant-wide aggregate stock
(`SubProduct.availableStock` / `Size.availableStock`), with no concept of
"this shop's warehouse."

Tenants running the multi-warehouse model want each physical till/shop bound
to one warehouse, so that:

- the product list only shows what's actually on the shelf at that location
  (sourced from `WarehouseStock.currentQuantity`), and
- a sale there deducts from that warehouse (and is auditable as such).

## Goal

1. Admin assigns a `Warehouse` to each `posSettings.shops` entry (optional —
   unassigned shops keep today's aggregate behavior).
2. Cashier selects their shop via the (now-functional) `ShopSelector`. The
   choice persists client-side and is sent with `getPOSProducts` /
   `createPOSOrder`.
3. When the active shop has a bound warehouse:
   - `getPOSProducts` returns only products/sizes with
     `WarehouseStock.currentQuantity > 0` in that warehouse, reporting that
     quantity as `availableStock`.
   - A sale atomically decrements that `WarehouseStock` row (guarded against
     overselling unless `allowOverselling`), writes a `WarehouseMovement`, and
     recalculates the `SubProduct` rollup.
   - The `InventoryMovement` audit and the order line item are stamped with
     that warehouse.
   - Refunds/voids restore stock to the same warehouse the sale came from.
4. When the active shop has **no** bound warehouse (including the built-in
   RETAIL/WHOLESALE shops), behavior is **unchanged** — aggregate stock,
   legacy deduction/restock path.

## Decisions

- **Shop selection mechanism:** make the existing `ShopSelector` functional.
  Persist the chosen shop client-side (same `atomWithStorage` pattern as
  `dh-pos-terminal`); send its id with product-list and order requests. A
  cashier can switch shops anytime — no re-login, no `POSSession`/token
  changes. Built-in RETAIL/WHOLESALE remain warehouse-less.
- **Zero-stock display:** hard-filter. Products/sizes with
  `currentQuantity <= 0` in the bound warehouse are excluded entirely from the
  warehouse-scoped product list.
- **Refund/void parity:** included. `Order.items[]` gets a `warehouse` field,
  stamped at sale time; `restoreStock` honors it.
- **No warehouse bound → fallback to aggregate** (today's behavior),
  preserving backwards compatibility for tenants not using multi-warehouse.

## Components

### 1. Data model

**`server/models/Tenant.js`** — `posSettings.shops[]` (~line 395) gets:
```js
warehouse: { type: ObjectId, ref: 'Warehouse', default: null },
```

**`server/models/Order.js`** — `orderItemSchema` gets:
```js
warehouse: { type: ObjectId, ref: 'Warehouse', required: false },
```
Simple additive field on a flat, `_id: false` sub-schema — backwards
compatible with existing documents (reads back as `undefined`).

### 2. Server — Shop CRUD (`server/controllers/pos.controller.js`)

- `createPOSShop` (~1458) and `updatePOSShop` (~1478): accept an optional
  `warehouse` field (or `warehouse: null` to unbind). Validate with
  `Warehouse.findOne({ _id: warehouse, tenant: tenantId, isActive: true })` —
  reject with 400 if it doesn't resolve.
- `listPOSShops` (~1451) and `getPOSSettings` (~1077): populate
  `posSettings.shops.warehouse` with `name code` so the client can display and
  use it.

### 3. Client — admin settings UI (`settings/page.tsx`, `pos_shops` section)

- `POSShop` type (`types.ts:709`) gets
  `warehouse?: { _id: string; name: string; code: string } | null`.
- Create-shop form gets a "Warehouse" `<select>` — default
  "— No warehouse (aggregate stock) —", options from
  `warehouseService.getWarehouses(token, { isActive: true })` (same pattern as
  `TransferModal.tsx`).
- Each existing shop row gets the same `<select>` inline; `onChange` calls
  `posApi.updateShop(token, shop._id, { warehouse })` (the API method already
  exists but is currently unused on the client — this wires it up). This is
  the only "edit" UI needed; no separate edit modal.

### 4. Client — functional `ShopSelector` (`pos-nav-header.tsx`, `store/index.ts`)

- New persisted atom in `store/index.ts`:
  ```ts
  const posActiveShopIdAtom = atomWithStorage<string | null>('dh-pos-shop', null);
  ```
  `null` (or a `BUILT_IN` synthetic id like `'retail'`/`'wholesale'`) means "no
  shop bound" → aggregate behavior.
- New `usePOSActiveShop()` hook resolves the atom against
  `usePOSShops().shops` to return `{ _id, warehouse } | null`.
- `ShopSelector`'s click handler writes to this atom instead of local
  `useState`.
- The client only sends `shopId` to the server when it's a real
  `posSettings.shops._id` (an ObjectId from the fetched shops list) — never
  for the synthetic `'retail'`/`'wholesale'` BUILT_IN ids.

### 5. Client — threading `shopId` into requests

- `posApi.getProducts(token, { search?, category?, limit?, shopId? })` →
  `GET /api/pos/products?...&shopId=...`.
- `pos-product-grid.tsx`'s `fetchProducts` reads the active shop from
  `usePOSActiveShop()`, passes its id, and refetches when it changes.
- `createOrder` body includes `shopId` (already typed as
  `Record<string, unknown>`, no signature change needed).
- Offline (IndexedDB) product cache is unchanged — it reflects whichever shop
  was last fetched online, same staleness class as today.

### 6. Server — `getPOSProducts` (pos.controller.js:1648)

1. Resolve `shopId` (query param) → `tenant.posSettings.shops.id(shopId)` →
   `warehouseId = shop?.warehouse || null`.
2. If `warehouseId` is set:
   - `WarehouseStock.find({ tenant: tenantId, warehouse: warehouseId, subProduct: { $in: subProductIds } }).select('subProduct size currentQuantity')`
     → build `Map<subProductId, Map<sizeId, currentQuantity>>`.
   - For `sellWithoutSizeVariants` subproducts: `availableStock` = warehouse
     qty for `sp.defaultSize` (default 0). Drop the product if 0.
   - For sized subproducts: each size's `availableStock` = warehouse qty for
     that size (default 0). Drop zero-qty sizes from the `sizes` array; drop
     the whole subproduct if no sizes remain.
   - Skip the existing "normalise size-level vs aggregate" reconciliation
     block (lines ~1708-1736) — warehouse numbers are authoritative.
3. If `warehouseId` is null (no shop, built-in shop, or shop with no
   warehouse): unchanged — today's aggregate logic including the
   reconciliation block.

Pricing (`computePOSPricing`) is unaffected — only stock numbers change.

### 7. Server — `createPOSOrder` / `deductStock` / `restoreStock`

**`createPOSOrder`** (pos.controller.js:1780):
- Reads `shopId` from the body, resolves
  `shop = tenant.posSettings.shops.id(shopId)`,
  `warehouseId = shop?.warehouse || null`.
- Adds `'defaultSize'` to the `SubProduct.findById(subProductId).select(...)`
  (~line 1834) so it's available for the warehouse path.
- Passes `warehouseId` into `deductStock(...)`.
- Stamps `orderItems.push({ ..., warehouse: warehouseId || undefined })`.

**`deductStock`** (pos.controller.js:43) — new branch taken only when
`warehouseId` is set:
- `whSizeId = sizeId || sp.defaultSize`.
- Atomically decrement the `WarehouseStock` row via `findOneAndUpdate` with a
  `{ currentQuantity: { $gte: quantity } }` guard (skipped if
  `allowOverselling`); throws `'Insufficient stock'` on guard failure, matching
  today's error for the legacy path.
- Write a `WarehouseMovement` (`type: 'shipped'`, `balanceAfter` from the
  updated row) and call `recalcSubProductStock(subProductId)` to refresh the
  `SubProduct` rollup.
- `InventoryMovement` audit: `warehouse: warehouseId` (explicit — no
  `resolveMovementWarehouse` fallback needed), `quantityBefore`/`quantityAfter`
  from the `WarehouseStock` row's before/after values.
- **Does not** touch `Size`/`SubProduct` via the legacy `$inc` path —
  `recalcSubProductStock` already overwrites the `SubProduct` rollup from
  `WarehouseStock` sums, so doing both would double-count (per prior
  multi-warehouse work).
- When `warehouseId` is null: 100% unchanged legacy path.

New helper in `server/services/warehouse.service.js` for the atomic guarded
decrement/increment (the existing `adjustStock(type:'shipped'|'received')` is
not atomic and has no overselling guard — fine for the manual admin
ship/receive actions, not safe for concurrent POS sales). Exact
signature/naming is an implementation detail for the plan.

**`restoreStock`** (pos.controller.js:184) — gains a `warehouseId` param
(read from `orderItem.warehouse`):
- If set: atomic `$inc currentQuantity: +quantity` on the same
  `(warehouse, subProduct, whSizeId)` row (upsert if missing), write a
  `WarehouseMovement` (`type: 'returned'`), call `recalcSubProductStock`.
- If unset (pre-existing orders, or the sale wasn't warehouse-scoped):
  unchanged legacy path.

**`refundPOSOrder`** and **`voidPOSOrder`** (pos.controller.js ~2244, ~2392):
pass `orderItem.warehouse` / `item.warehouse` into `restoreStock`.

## Non-goals / known limitations

- `Size.availableStock` / `Size.stock` are **not** decremented for
  warehouse-scoped sales (only the `SubProduct` rollup, via
  `recalcSubProductStock`). For tenants using shop→warehouse binding, this can
  make `Size.availableStock` drift from `WarehouseStock` — full reconciliation
  of the sales/online-order path with `WarehouseStock` is "Follow-up #2" from
  the multi-warehouse-inventory work and is out of scope here.
- `GET /api/pos/combos` is not warehouse-scoped (still reads aggregate stock).
- If a shop's warehouse binding is changed after sales were made, refunds for
  those earlier sales still restore to the warehouse stamped *at sale time*,
  not the shop's current binding.
- POS sessions (`POSSession`) are unchanged — shop selection is independent of
  the retail/wholesale cash-drawer session.

## Testing

No server test runner config exists for this area beyond focused
`node --test` scripts (see multi-warehouse-inventory precedent). Plan:
- `node --test` cases for the new atomic warehouse adjust/restore helper
  (insufficient stock, overselling allowed, missing row on restore/upsert).
- `require()` parse smoke-checks for touched controllers/services.
- Manual QA: assign a warehouse to a shop, confirm the POS list only shows
  that warehouse's in-stock products with correct quantities; make a sale;
  confirm `WarehouseStock` decremented, a `WarehouseMovement` and
  warehouse-stamped `InventoryMovement` were written, and the `SubProduct`
  rollup updated; refund the sale and confirm stock returns to the same
  warehouse.
