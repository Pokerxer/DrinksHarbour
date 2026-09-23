---
name: transfer-return-from-history
description: Warehouse movement history now lets you return/refund a transfer — stock reverses to the origin and, for StockTransfer module transfers, the destination→source money and tax snapshot are reversed too. Endpoint POST /api/warehouses/movements/:movementId/return.
type: feature
---

Warehouse movement history now supports returning/refunding a transfer.

Entry point: `/warehouses/[id]` → product drawer → **History** tab → the
**Return/Refund** button on a `transfer_in`/`transfer_out` movement →

`POST /api/warehouses/movements/:movementId/return` with `{ quantity, note }`.

How it works (`server/services/stockTransferReturn.js`, DI-tested):

- **Resolution** (`resolveTransferReturn`): StockTransfer-module movements are
  found by their `reference` (`Transfer TRF-…`); lightweight warehouse transfers
  by their `transferGroupId` pair. Module returns cap at `receivedQty −
  returnedQty`.
- **Stock** (`returnTransferStock`): server-authoritative check on the holding
  warehouse (original destination); holding −qty, origin +qty (upsert), batch
  FEFO back (module revalues at original `effectiveUnitCost`), a
  `transfer_out`(giving) + `returned`(origin) `WarehouseMovement` pair,
  `InventoryMovement` mirror, recalc.
- **Money** (`reverseTransferMoney`, module only): `receivedQty`/`transferredQty`
  down, `returnedQty` up, `returns[]` entry pushed, totals recomputed over
  `quantity − returnedQty`, tax re-snapshotted (`reverseDocumentTax` +
  `captureDocumentTax`), `completed` drops to `partially_received`/`in_transit`.

Schema: `StockTransfer.returns[]`, `StockTransferItem.returnedQty`.

Key invariants:
- Either side may initiate, but the holding warehouse must actually have the
  qty; over-return past what was received is rejected.
- Money reversal applies only to StockTransfer-module transfers (lightweight
  transfers carry no money).
- Return-generated movements (`Return of transfer …`) are not re-resolvable, so
  the same goods can't be double-returned; the UI hides the button on them.
- No mongoose transaction — consistent with the single-writer document workflow
  of `stockTransferReceive.js`.

Full suite green: `cd server && node --test '__tests__/*.test.js'` = 2831 pass.
New tests: `server/__tests__/stockTransferReturn.test.js` (9 cases).

---

## Follow-up (2026-09): refunds fully traced + purchase refunds (full loop)

Two additions landed on top of the feature above. Full suite now 2838 pass.

### 1. Transfer refunds are properly tracked in history
- Both return movements now carry `WarehouseMovement.parentMovement →` the
  original transfer movement (`server/services/stockTransferReturn.js`), so the
  DB trail is immutable even if the original is later edited.
- Warehouse drawer (`subproduct-inventory-drawer.tsx`): the giving side reads
  **"Return out"** and the origin **"Return in"** (amber) instead of a second
  bland "Transfer out"; `return_out` (vendor-return restock-outs from the new
  purchase flow) read **"Returned to vendor"**.
- A **traceable link** is rendered on module refund rows: `refundTransferNumber()`
  parses `Return of transfer TRF-…` and links to
  `routes.eCommerce.stockTransfers?q=<number>` (the transfers list pre-filters).
- Product history (`ServerMovementsList.tsx`): `isRefundOut()` classifies
  `return_out` and giving-side transfer refunds under the **Returns** tab with a
  plus/minus-aware sign (refund-out shows −, refund-in shows +).

### 2. Purchase (vendor) refunds do the full loop: restock + history + money
A confirmed vendor return now removes the returned goods from a warehouse, posts
a `return_out` movement, mirrors it into the product ledger, recalculates stock,
and the existing money-refund module (`recordRefund`) completes the loop.

- **Schema** (`VendorReturn`): new `warehouse` (ObjectId → Warehouse) and
  `stockAdjusted` (Boolean) idempotency flag.
- **New service** `server/services/vendorReturn.stock.js` (DI-tested):
  `applyVendorReturnStock()` pre-flights every line against on-hand at the return
  warehouse, then decrements `WarehouseStock`, posts `return_out` movements
  (`reference: Vendor return RET-…`) + `InventoryMovement` mirrors
  (`referenceType: 'vendor_return'`, PO + supplier linked) + recalc, then flips
  `stockAdjusted`. `reverseVendorReturnStock()` re-adds the goods as `returned`
  movements on cancellation (reinstating rows that were fully drained). Both are
  idempotent.
- **Controller** (`vendorReturn.controller.js`): stock applied in
  `updateReturnStatus` on `draft→confirmed` and reversed on `cancelled`
  (PO-linked or not), warehouse pass-through on create + `from-bill`, and a guard
  rejecting warehouse changes once stock is deducted. `getVendorReturn` populates
  `warehouse`.
- **New movement types**: `return_out` added to `WarehouseMovement` and
  `InventoryMovement` enums.
- **Client**: create screen (`purchases-return-create.tsx`) gained a
  "Return from warehouse" picker (defaults to the PO's warehouse) with a hint
  that confirmation removes stock + posts to history; the return detail
  (`purchases-return-detail.tsx`) shows the warehouse + a `stock deducted` chip,
  and the Confirm dialog spells out the stock effect.
- **New tests**: `server/__tests__/vendorReturn.stock.test.js` (7 cases).

Money flow is unchanged: refunds are recorded as money against the vendor return
(`POST /api/vendor-returns/:id/refund`) — only the goods ledger is new here. The
stock-moving step is **confirmation**, not creation (drafts touch nothing), so
a create-as-confirmed path is deliberately not used.

### Refund button un-gated (2026-09)
The **Record Refund** buttons on the return detail (statuses `confirmed` and
`received`) were previously hidden unless a paid/partial vendor bill was linked
to the PO (`{bill && …}`), so most returns couldn't be refunded. The gate is
removed — refunds can now be recorded on any confirmed/received return. The
refund modal already handles no-bill returns (max/placeholder/percent buttons
fall back to `ret.totalAmount` via `bill?.paidAmount ?? total`), and the server
(`recordRefund`) never required a bill.

### Inventory-drawer history display fixes (2026-09)
`/warehouses/[id]` → product drawer **History** tab:
- **Size-less lines** (products with no variants) never loaded history/batches:
  `loadData` was gated on `sizeId`, so the tab spun on `<LoadingRows/>` forever.
  Now it gates on `subProductId` only and omits the `size` filter for size-less
  rows (server queries correctly without it; `getBatches`/`getWarehouseMovements`
  both take optional `size`).
- History was silently capped at the latest 50 movements with no way to page.
  Added a `historyLimit` state + **"View older movements"** button that bumps the
  query to the server cap (200, `MAX_MOVEMENTS_LIMIT`) and reloads.