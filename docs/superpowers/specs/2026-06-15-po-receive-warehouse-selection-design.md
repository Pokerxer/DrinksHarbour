# Design: choose destination warehouse when receiving a PO

**Date:** 2026-06-15
**Branch:** `feat/multi-warehouse-inventory`
**Status:** Approved

## Problem

The multi-warehouse model lets a tenant hold stock across many warehouses, but
there is no UI to add the **first** stock row to a warehouse — both the
warehouse detail page and the subproduct Locations tab only adjust rows that
already exist. The real-world way stock enters a warehouse is by **receiving a
purchase order**, so that is where warehouse selection belongs.

Today, purchase-order validation already posts stock, but:

- it writes through the **legacy** `inventoryService.recordReceived`, not the
  new `WarehouseStock` model;
- it computes `getDefaultWarehouse(tenant)` into `defaultWarehouseId` and then
  **never uses it** — stock is not associated with any warehouse;
- the user cannot choose where received goods land.

## Goal

When validating a PO receipt, the user picks **one destination warehouse** for
the whole receipt. Received quantities post into that warehouse's stock via the
new multi-warehouse model (`warehouseService.adjustStock`), which updates the
warehouse stock row, the warehouse movement log, and the subproduct rollup. The
legacy inventory write is removed from this path (no dual-write, no
double-counting).

## Decisions

- **Granularity:** one destination warehouse per receipt (not per line item).
- **Legacy write:** replace `inventoryService.recordReceived` with
  `warehouseService.adjustStock` on the validated path.
- **When stock posts:** on `validated` (unchanged). The warehouse is chosen in
  the receive/validate panel and passed with the `validated` status call.

## Components

### 1. Server — `server/controllers/purchaseOrder.controller.js`

In `updatePurchaseOrderStatus`, `status === "validated"` branch:

- Read `warehouseId` from `req.body`.
- Resolve `targetWarehouseId = warehouseId || (await getDefaultWarehouse(tenantId))`.
  Wrap the default lookup so a missing default yields `null` rather than throwing.
- If `targetWarehouseId` is falsy → throw
  `ValidationError("Select a destination warehouse (or set a default) before validating.")`
  **before** posting any stock, so validation fails cleanly with nothing written.
- For each item with `quantityToAdd > 0` (keep existing
  `receivedQty > 0 ? receivedQty : quantity` fallback):
  - Require both `item.subProductId` and `item.sizeId`. If either is missing,
    skip the line, increment `failCount`, and log a clear reason (mirrors the
    existing `subProductId` guard).
  - Call:
    ```js
    await warehouseService.adjustStock(
      {
        warehouseId: targetWarehouseId,
        subProduct: item.subProductId,
        size: item.sizeId,
        quantity: quantityToAdd,
        type: 'received',
        notes: `PO Receipt: ${purchaseOrder.poNumber}`,
      },
      req.user?._id || purchaseOrder.createdBy,
      tenantId
    );
    ```
- Remove the `inventoryService.recordReceived(...)` call from this branch.
  `adjustStock` already creates/increments the `WarehouseStock` row, writes a
  `WarehouseMovement`, and calls `recalcSubProductStock` to keep subproduct
  totals correct.
- Leave untouched: `fullyReceivedDate`, the success/fail counting/logging, the
  vendor pricelist auto-sync, and the `received` branch that records
  `receivedQty`.

Add `const warehouseService = require("../services/warehouse.service");` (the
controller already imports the `Warehouse` model).

### 2. Client — `client/apps/isomorphic/src/services/purchaseOrder.service.ts`

Extend `updatePurchaseOrderStatus`:

```ts
async updatePurchaseOrderStatus(
  id: string,
  status: string,
  token: string,
  receivedItems?: { itemId: string; receivedQty: number }[],
  warehouseId?: string,
): Promise<CreatePOResponse>
```

Include `warehouseId` in the PATCH body when provided
(`{ status, ...(receivedItems && { receivedItems }), ...(warehouseId && { warehouseId }) }`).

### 3. Client — `client/apps/isomorphic/src/app/shared/purchases/purchases-receipt-detail.tsx`

- On mount, load active warehouses:
  `warehouseService.getWarehouses(token, { isActive: true })`.
- Add a **required** "Destination warehouse" `<select>` in the confirm panel
  (`#confirm-panel`), pre-selected to the warehouse with `isDefault`, else the
  first active warehouse. Store the selected id in component state.
- If **no warehouses exist**: disable the Validate action and show an inline
  notice that links to `/warehouses` ("Create a warehouse first to receive
  stock").
- In `handleValidate`, pass the selected `warehouseId` to the `'validated'`
  status call only (the `'received'` call is unchanged):
  ```ts
  await purchaseOrderService.updatePurchaseOrderStatus(id, 'received', token, receivedItems);
  await purchaseOrderService.updatePurchaseOrderStatus(id, 'validated', token, undefined, warehouseId);
  ```
- Update the success toast to name the destination, e.g.
  `Receipt validated — stock added to ${warehouseName}`.

## Data flow

1. User enters received quantities per line.
2. User picks the destination warehouse (defaulted).
3. Validate → `PATCH /api/purchase-orders/:id/status { status: 'received', receivedItems }`.
4. `PATCH /api/purchase-orders/:id/status { status: 'validated', warehouseId }`.
5. Server resolves target warehouse, posts each line via `adjustStock`.
6. Warehouse stock row + `WarehouseMovement` + subproduct rollup updated.
7. UI confirms and routes to the PO detail page.

## Edge cases

- **No warehouse resolvable:** blocked on the client (disabled Validate) and on
  the server (`ValidationError` before any write).
- **Item missing `sizeId` or `subProductId`:** line skipped, counted as failed,
  logged; other lines still post.
- **Partial receipts:** unchanged — still governed by the existing
  `allowPartialReceipts` tenant setting in the `received` branch.
- **Already-validated POs:** not backfilled (out of scope).

## Testing

- **Server `node:test`** for the `validated` branch (with an in-memory/standalone
  Mongo as used by existing warehouse tests):
  - posts received quantities to the chosen `warehouseId`;
  - falls back to the tenant default warehouse when `warehouseId` omitted;
  - throws when no warehouse is resolvable (and writes nothing);
  - skips a line missing `sizeId` while still posting the others;
  - subproduct rollup reflects the received quantity.
- **Manual browser check:** receive a confirmed PO → pick WH-A → validate →
  WH-A detail shows the incremented stock and the subproduct total updates.

## Out of scope (YAGNI)

- Per-line warehouse selection / split shipments across warehouses.
- Choosing the warehouse at the `received` step (vs `validated`).
- Backfilling stock for POs validated before this change.
- Dual-writing to the legacy inventory service.
