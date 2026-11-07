# DRI-16 — /warehouses: server variant-identity plumbing + six-tenant stock fixture (DRI-6 extension #6)

**Date:** 2026-11-06 · **Issue:** DRI-16 (parent DRI-6, ancestor DRI-2) · **Mode:** local, synthetic-only — no commit, no push, no deploy, no production action, no real tenant data.
**Agent:** DrinksHarbour Backend Engineer · workspace concurrently held by the DRI-6 parent run (ddf80962).

## Defect (verified in repo before fixing)

The warehouse frontend buckets the whole Size dimension by the free `sizeName` string:

- `client/apps/admin/src/app/shared/warehouses/warehouse-analysis-helpers.ts` L285 — `r.sizeName || '—'`;
- `stock-drill-drawer.tsx` L126 (sort) and L324 (render) — `sizeName` verbatim;
- `warehouse-location-analysis/selected-transfers-report.ts` L73/L78 — keying/composition from `item.sizeId || item.sizeName` raw.

`StockRow` carries no `sizeId`-plus-identity client-side even though server stock rows are keyed
SubProduct + Size IDs (DRI-7 evidence). Server-side identity exists; it needed plumbing into the
payloads these surfaces consume.

## What was delivered

### Deliverable 1 — payload identity plumbing (data provision only, no label re-composition)

Exact `sizeId` plus the four Size identity fields (`colorName`, `colorHexCode`, `optionName`, existing
`sizeName`) now reach every warehouse-surface payload. Emission is **conditional** (the DRI-14
emit-only-with-identity precedent in `purchaseOrder.controller.js` L1437–1499): rows whose Size carries
no variant identity — every legacy beverage row, per `server/models/Size.js` ("absent on legacy rows
and every beverage size") — keep their exact pre-change key set, so legacy shapes are byte-identical.
The stored `sizeName` snapshot stays authoritative; no label re-composition anywhere.

- `server/services/warehouse.service.js`
  - `getAllStock()` (GET `/api/warehouses/stock/all` — the source for `warehouse-analysis`,
    `product-inventory/StockRow`, `stock-drill-drawer` and the inventory stock browser): the Size
    populate select gains `colorName colorHexCode optionName`, and each row composes
    `sizeId` (existing) + conditional `colorName`/`colorHexCode`/`optionName` spreads beside the
    existing `sizeName`.
  - `getWarehouseStock()` (GET `/api/warehouses/:id/stock` — per-warehouse drill payload): the Size
    select gains `colorHexCode`; the row already exposes the whole populated Size (with `_id`, `size`,
    `displayName`, `colorName`, `optionName` from the pre-existing DRI-7 select) so identity reads via
    `size._id`/`size.colorName` exactly like the client's `isPopulated` accessors
    (`warehouse-ref-helpers.ts`). Absent-on-legacy columns stay absent keys.
  - `getStockByWarehouse()` (GET `/api/subproducts/:id/stock-by-warehouse` — the
    `subproduct-warehouse-breakdown` source): Size select gains `colorName colorHexCode optionName`.
- `server/controllers/stockTransfer.controller.js` — `getStockTransfer` (GET `/api/stock-transfers/:id`
  — the `selected-transfers-report` data path via `stockTransferService.get(id)`) now attaches Size
  identity to items with `sizeId`, conditionally, from a tenant-scoped Size batch load
  (`Size.find({ _id: { $in }, tenant })`). **Deliberately NOT an `items.sizeId` populate** (the exact
  DRI-14 detail shape): populating flips `sizeId` on the wire from a 24-char string to an embedded doc,
  which breaks legacy string-id consumers that the issue forbids breaking (`stock-transfer-detail.tsx`
  L260 line keys, `invoice-return-summary.ts` L33 string matching, receive/return payloads). Identity
  fields ride along as additional keys only on variant lines; legacy/sizeless lines are byte-identical.
  Consumers without a resolvable/foreign Size keep identical bytes too (`attachTransferSizeIdentity`
  leaves lines whose Size lookup misses untouched).
- Payload shapes are additive everywhere: no existing field removed, no existing key re-typed, no
  warehouse mutation behaviour changed.

### Deliverable 2 — six-tenant warehouse verification fixture

New opt-in Mongo fixture `server/__tests__/warehouseRetailTypes.mongo.test.js` (DRI-10/DRI-14 pattern:
disposable PID-suffixed replica-set Mongo on :29127, real routers; DRI-4/DRI-7/DRI-10/DRI-12/DRI-14
fixtures NOT modified; no pre-existing server-side fixture referenced these endpoints, checked by
grepping the test tree for `api/warehouses`/stock-transfer detail paths — extend-vs-duplicate does not
apply). Per tenant — the five retail business types plus ONE legacy beverage control — over the real
HTTP path (`warehouse.routes` / `subproduct.routes` / `stockTransfer.routes` behind `protect` +
`attachTenant` + `requireOwnTenant`):

1. **Seed** tenant + two warehouses + Product + SubProduct with **TWO same-size colour variants**
   ("M · Emerald" / "M · Ivory" for Fashion; same-size option/sku analogues for Electronics, Beauty,
   Home & Living, General Retail — DRI-14 nouns; legacy beverage gets ONE colourless volume row
   `Legacy Lager 750ml`, no identity columns at all) with zero-balance WarehouseStock rows.
2. **Receipt flow** — POST `/api/warehouses/:id/stock/adjust` `type: 'received'` per variant with
   DISTINCT balances (A=3, B=8, legacy=6) → real WarehouseMovement + ledger posts.
3. **`GET /stock/all`** → per tenant: exactly one payload row per seeded Size, keyed by DISTINCT exact
   `sizeId`s (no Emerald/Ivory conflation), each carrying its own balance, with
   `colorName`/`colorHexCode`/`optionName` verbatim beside `sizeName`; legacy row carries no identity
   keys. Drill-drawer data path (the same rows filtered to the warehouse) identifies each variant row
   specifically — exact `sizeId` present, correct balance.
4. **`GET /:id/stock`** → per-warehouse rows keyed by exact populated `Size._id`; identity read from the
   populated Size; **the legacy row's Size projection keys are asserted byte-identical to the pre-change
   select** (`['_id','costPrice','displayName','sellingPrice','size','sku']` — deep-equal).
5. **`GET /api/subproducts/:id/stock-by-warehouse`** → breakdown rows keyed by exact Size id with
   identity; legacy breakdown Size carries no identity keys.
6. **Transfers** — real `POST /stock-transfers` (draft, both variant lines with exact `sizeId`s) →
   `GET /stock-transfers/:id`: every item's `sizeId` is still a **string** matching
   `/^[a-f\d]{24}$/` AND the seeded exact id (the no-populate wire invariant), the stored `sizeName`
   snapshot is byte-exact, identity fields ride along on variant lines only; legacy line carries no
   identity keys.
7. **Tenant isolation on every projection** — `stock/all` surfaces only own-tenant sub-products;
   cross-tenant `/:id/stock` and `stock-by-warehouse` are empty; every foreign transfer detail is 404.

Evidence:

- **DRI_EVIDENCE_ID:** `DRI_EVIDENCE_DRI16_WAREHOUSES_SERVER_VARIANT_IDENTITY` (printed by the fixture)
- **Tenants probed:** fashion, electronics, beauty, home, general, legacy (6/6)
- **Payload surfaces asserted:** `GET /api/warehouses/stock/all`, `GET /api/warehouses/:id/stock`,
  `GET /api/subproducts/:id/stock-by-warehouse`, `GET /api/stock-transfers/:id`
- **Result:** 1 test, 1 pass, 0 fail, 0 skipped (≈7 s).

## Checks run (exact commands)

```
# In-repo disposable replica-set Mongo (same :29127 host the DRI-10/DRI-14 fixtures use)
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/warehouseRetailTypes.mongo.test.js
# → pass 1 fail 0  (DRI_EVIDENCE_DRI16_WAREHOUSES_SERVER_VARIANT_IDENTITY)

# Focused warehouse + stock-transfer + variant-type suites (17 files):
cd server && node --test __tests__/warehouseManagers.test.js __tests__/warehouseImportHistory.test.js \
  __tests__/warehouseStock.helpers.test.js __tests__/inventoryStockCatalog.test.js __tests__/posLocation.test.js \
  __tests__/venueConfigurationProtection.test.js __tests__/automaticMinimum.test.js __tests__/warehouseIdentity.test.js \
  __tests__/warehouseLastCost.test.js __tests__/warehouseSettings.enforcement.test.js \
  __tests__/warehouse.service.sellReturn.test.js __tests__/stockTransfer.gating.test.js \
  __tests__/stockTransfer.refund.test.js __tests__/stockTransfer.creator.test.js __tests__/salesReturn.test.js \
  __tests__/retailVariantIdentity.test.js __tests__/sizeVariantsIndustries.test.js
# → pass 130 fail 0 skipped 0

# Mongo-touching neighbours (regression guard for the shared fixtures):
cd server && DRINKSHARBOUR_SALES_RESERVATION_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_sales_reservation_test_global?replicaSet=venuePhase0' \
  node --test __tests__/salesReservations.mongo.test.js
# → pass 1 fail 0
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/purchasesRetailTypes.mongo.test.js
# → pass 2 fail 0  (DRI-14 fixture stays green)
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/venueRetailBoundary.mongo.test.js
# → pass 1 fail 0
```

## Frontend zero-touch audit (no edits)

`client/apps/admin` warehouse components were inspected (read-only) to map surfaces → endpoints; no
frontend file was modified this session:

- `warehouse-analysis/index.tsx` + `use-analysis-data.ts` feed `StockDrillDrawer` from
  `GET /stock/all` rows (the drill-drawer data path above);
- `subproduct-warehouse-breakdown.tsx` reads `GET /api/subproducts/:id/stock-by-warehouse` via
  `warehouseStock.service.ts`; `warehouse-ref-helpers.ts` already reads identity via populated refs;
- `selected-transfers-export.tsx` composes via `buildSelectedTransfersReport` from
  `stockTransferService.get(id)` items.
- The frontend plumbing itself (per-row sizeId grouping in `warehouse-analysis-helpers.ts`,
  `stock-drill-drawer.tsx`, `selected-transfers-report.ts`, `StockRow` type) is the separate
  Frontend-Engineer task and was NOT touched.

## Findings / coordination

- **Shared workspace:** `server/services/warehouse.service.js` carries pre-existing uncommitted
  concurrent-DRI-6 changes (venue protected-configuration guards in `createWarehouse`/`updateWarehouse`,
  the `deleteWarehouse` soft-delete + reserved-quantity guard, the DRI-7 `getWarehouseStock` select).
  The DRI-16 deltas are confined to the three projection/populate edits listed above; nothing of the
  concurrent run was altered or reverted. No commit was made by design (issue forbids it), so this is
  coordination-by-tree-state, to be committed by the parent run.
- **Transfers sizeId wire decision** is documented inline at `attachTransferSizeIdentity`
  (`stockTransfer.controller.js`) for the frontend task: identity arrives as sibling keys
  (`colorName`/`colorHexCode`/`optionName`), `sizeId` remains a 24-char string — the frontend report can
  group on exact ids without a populate round-trip and without breaking string-id consumers.
- `subproduct-warehouse-breakdown` has no server endpoint by that name — the provider is
  `GET /api/subproducts/:id/stock-by-warehouse` (`subProduct.controller.js` → `getStockByWarehouse`).
