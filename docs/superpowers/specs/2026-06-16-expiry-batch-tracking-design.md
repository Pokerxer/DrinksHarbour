# Expiry-Date & Batch Tracking — Design Spec

**Date:** 2026-06-16
**Branch:** `feat/expiry-batch-tracking`
**Status:** Approved (brainstorming complete)

## Goal

Capture **expiry dates** and **batch numbers** at the receiving level, track each
batch's quantity per-warehouse, deplete batches first-expiry-first-out (FEFO) on
sales/transfers, and send recurring notifications to deplete batches nearing
expiry until their quantity hits zero.

Batch numbers are broadly useful (lot tracking, recalls) and may apply to any
product including alcoholic ones; **expiry dates** are the perishable concern that
drives FEFO ordering and the expiry alerts.

## Confirmed current state

- **Non-alcoholic signal:** `Product.isAlcoholic` is a dedicated indexed boolean
  (`server/models/Product.js:245`) — authoritative, cleaner than the `type` enum.
  `SubProduct` refs the parent `product` and carries no `isAlcoholic`/`type`.
- **Receiving:** client `purchases-receipt-detail.tsx` submits
  `receivedItems: [{ itemId, receivedQty }]` + `warehouseId`; server
  `purchaseOrder.controller.js` receive endpoint records `receivedQty`, then on
  validation calls `postReceivedStock` → `adjustStock({ type:'received' })` per
  line. Helpers in `poReceive.helpers.js`.
- **Stock:** `WarehouseStock` = one row per `(tenant, warehouse, subProduct, size)`;
  `WarehouseMovement` = audit; `warehouse.service.js` exposes
  `adjustStock`/`sellStock`/`returnStock`/`transferStock`, each calling
  `recalcSubProductStock` (rolls WarehouseStock → SubProduct totals).
- **POS sales** persist to `Order` (`pos.controller.js` requires `Order`); line
  items are `orderItemSchema` (`Order.js:6`); refunds already reference
  `orderItemIndex` (`Order.js:365`).
- **Notifications:** `Notification` model + `createNotification` service exist
  (enum even has an unused `low_stock_alert`). **No cron / scheduler exists** —
  an explicit TODO notes "Implement scheduled jobs system (Bull/node-cron)".
- **Settings:** `Tenant.purchaseSettings` and `Tenant.posSettings` exist; there is
  **no** inventory settings block yet.

## Design decisions (resolved in brainstorming)

1. **Tracking gate:** new explicit per-`Product` boolean `tracksBatch`, defaulting
   from `!isAlcoholic`, overridable per product.
2. **Batch grain:** keyed per `(tenant, warehouse, subProduct, size, batchNumber)` —
   matches the `WarehouseStock` key exactly.
3. **Batch vs expiry:** one flag (`tracksBatch`). When on, receiving always asks
   for a batch number; expiry date is **required for non-alcoholic, optional for
   alcoholic**. No-expiry batches sort FEFO-last and never trigger alerts.
4. **Source of truth:** `WarehouseStock` stays authoritative; `WarehouseBatch` is a
   reconcilable sub-ledger for tracked products. Invariant:
   `Σ open-batch quantity ≤ WarehouseStock.currentQuantity`; the slack is
   untracked/legacy stock. No migration of WarehouseStock.
5. **Batch numbering:** auto `{SKU}-{YYYYMMDD}-{seq}` (seq scoped to
   `(tenant, wh, sub, size, date)`); manual re-use **tops up** the existing batch
   when expiry matches, **rejects** on expiry conflict.
6. **Depletion:** FEFO with **full traceability** — sale lines record
   `batchAllocations`; refunds restore exact batches; transfers carry batches
   (with expiry) to the destination; adjust-down depletes FEFO, adjust-up lands in
   untracked slack.
7. **Alert trigger:** `node-cron` daily in-process scan, env-guarded (off in tests).
8. **Alert behavior:** one live notification per batch (dedup `metadata.batchId`),
   refreshed with escalating priority until the batch is depleted/expired-out, then
   archived.
9. **Recipients:** active `tenant_owner` + `tenant_admin` + `tenant_staff`.
10. **Window config:** tenant-level only — `Tenant.inventorySettings.expiryWarningDays`,
    default 90 (≈3 months).

## Architecture

### 1. Data model

**`Product`** — add `tracksBatch: Boolean`. A `pre-validate` hook defaults it to
`!isAlcoholic` when `undefined`; fully overridable in the product editor. A
one-time idempotent backfill script sets it on existing docs; receiving code treats
`undefined` defensively as `!isAlcoholic`.

**`WarehouseBatch`** (new model):

```
tenant        ref Tenant      (required, index)
warehouse     ref Warehouse   (required, index)
subProduct    ref SubProduct  (required, index)
size          ref Size        (required, index)
product       ref Product     (denormalized for recall/lookup)
batchNumber   String          (required)
quantity      Number          (remaining, min 0, default 0)
initialQuantity Number        (as received, for reporting)
expiryDate    Date            (optional)
receivedDate  Date            (default now)
sourcePO      ref PurchaseOrder (optional, audit)
poNumber      String          (optional, audit)
```

Indexes:
- Unique `(tenant, warehouse, subProduct, size, batchNumber)`.
- FEFO `(tenant, warehouse, subProduct, size, expiryDate)`.
- Cron scan `(tenant, expiryDate, quantity)`.

**Invariant:** for any `(wh, sub, size)`, `Σ open-batch quantity ≤
WarehouseStock.currentQuantity`. The difference is untracked/legacy stock.
`WarehouseStock.currentQuantity` remains the authoritative total and the
`sellStock` guard; `recalcSubProductStock` is unchanged.

**`Order.orderItemSchema`** (`Order.js:6`) — add:

```
batchAllocations: [{
  batch       ref WarehouseBatch,
  batchNumber String,
  quantity    Number,
  expiryDate  Date,
}]
```

Enables full traceability and exact refund restoration (refunds carry
`orderItemIndex`).

**`Tenant.inventorySettings`** (new block):

```
inventorySettings: {
  expiryWarningDays: { type: Number, min: 1, max: 365, default: 90 },
}
```

**`Notification`** — add enum type `batch_expiry_alert`.

### 2. Service layer (`warehouse.service.js` + new `batch.helpers.js`)

- `generateBatchNumber({ tenantId, warehouseId, subProduct, size, sku, date })` →
  `{SKU}-{YYYYMMDD}-{seq}`; `seq` zero-padded from count of existing batches in
  `(tenant, wh, sub, size, date)`; retry on the unique index (mirrors
  `generateWarehouseCode`).
- **Receiving** (transactional): for a tracked line, create/merge a
  `WarehouseBatch` **and** increment `WarehouseStock` in the same session. Manual
  number that exists → same expiry tops up `quantity`/`initialQuantity`; different
  expiry → `ValidationError`. Auto number always distinct (seq guarantees it).
- `allocateFefo({ tenant, warehouse, subProduct, size, quantity }, session)` →
  deplete open batches ordered by `expiryDate` asc (nulls last), then untracked
  slack for any remainder; returns `[{ batch, batchNumber, quantity, expiryDate }]`.
- `sellStock` → wrap the existing guarded decrement + FEFO allocation in a
  transaction; return allocations to `pos.controller` to persist on the line. Only
  runs allocation when the product `tracksBatch`.
- `returnStock` → with `batchAllocations`: restore exact batches (increment
  `quantity`, re-opening depleted ones) + increment WarehouseStock. Without:
  increment WarehouseStock into untracked slack (refunded unit loses batch
  identity).
- `transferStock` → FEFO-pull batches from source (decrement source batch +
  WarehouseStock), recreate twin batches at destination (same `batchNumber` +
  `expiryDate`, preserving expiry across warehouses), increment dest WarehouseStock
  — all within the existing transaction.
- `adjustStock` → `adjusted` down: FEFO deplete batches to match; up: untracked
  slack. `received` (non-PO): untracked slack unless a batch context is supplied.

### 3. Expiry scan job (new `server/jobs/expiryScan.job.js`)

- `node-cron` daily (`0 2 * * *`), started from `server.js` behind an env guard
  (e.g. `ENABLE_CRON` / skip when `NODE_ENV === 'test'`).
- `scanExpiringBatches()`: per tenant, `window = inventorySettings.expiryWarningDays
  ?? 90`. Find batches `quantity > 0 && expiryDate != null && expiryDate <= now +
  window`. For each: upsert one notification deduped by `metadata.batchId` among
  active/unread ones — refresh message + escalate priority by days-to-expiry
  (e.g. `<30d` urgent, `<60d` high, else normal). Archive notifications whose batch
  is now depleted (`quantity === 0`) or no longer qualifying.
- Recipients: active users where `tenant = X && role ∈ {tenant_owner,
  tenant_admin, tenant_staff}`, via the `recipients[]` fan-out.

The job is a pure-ish `scanExpiringBatches(tenantId, now)` core (testable) wrapped
by the cron scheduler (untested glue).

### 4. Receiving UI (`client/.../purchases/purchases-receipt-detail.tsx`)

- PO item payload includes `tracksBatch` + `isAlcoholic` (sourced from the parent
  product). For tracked items, render per-line **batch number** (text; blank =
  auto-generate) + **expiry date** (date picker; required when non-alcoholic).
- `receivedItems` entries gain optional `batchNumber` / `expiryDate`. The receive
  controller validates (expiry required for non-alcoholic tracked lines; reject
  manual-number/expiry conflicts) and forwards them through `postReceivedStock`.
- Light read surface: batches listed with expiry badges on the warehouse-stock
  detail row; alerts surface via the existing notification bell.

### 5. Testing (`node:test`, `server/__tests__/`)

- Batch number generation: format, scoped sequence, uniqueness, manual merge
  (same expiry) vs reject (conflict).
- Receiving: creates/merges a batch + increments WarehouseStock; invariant holds;
  alcoholic line allows blank expiry, non-alcoholic requires it.
- FEFO allocation: expiry-asc ordering, no-expiry last, slack remainder.
- Sell: records `batchAllocations`; refund restores exact batches; over-sell guard
  unchanged.
- Transfer: carries batches with expiry to destination.
- Adjust: down depletes FEFO, up goes to untracked.
- Expiry-window detection: scan selects the right batches, priority escalation,
  dedup by `batchId`, archive on depletion.

### 6. Migration / back-compat

- No `WarehouseStock` migration — existing rows are untracked slack with no
  batches.
- `tracksBatch` backfilled `= !isAlcoholic`; receiving treats `undefined`
  defensively.
- Alcoholic products default `tracksBatch=false`, can opt in; expiry optional.

## Out of scope (YAGNI)

- Per-product expiry-window override (tenant-level only for now).
- External job queue (Bull/Agenda) — `node-cron` in-process is sufficient.
- Full batch-management CRUD UI beyond receiving capture + read-only listing.
- Wiring the unused `low_stock_alert` (separate concern; the cron is reusable for
  it later).
