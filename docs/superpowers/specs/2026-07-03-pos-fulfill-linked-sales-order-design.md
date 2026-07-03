# POS — Fulfilling selected Quotations & Orders on the Sell page

**Date:** 2026-07-03
**Surface:** `/point-of-sale/sell` (admin app), server `/api/pos/*` + `salesFulfill.service`

## Problem

The POS Sell page already lets a cashier open the **Quotations & Orders** picker
(`pos-order-picker-modal.tsx`), "Load" a document into the cart (`handleLoadOrder`
in `pos-cart.tsx` stores `linkedSalesOrderId`), and on payment the modal calls
`posApi.fulfillSalesOrder(linkedSalesOrderId, …)`. Two defects make this path
non-functional and, where it does run, incorrect:

1. **Auth mismatch (401).** The POS session carries a **POS-type token**
   (`usePOSAuth().token`). The current fulfill call hits the admin route
   `POST /api/sales-orders/:id/fulfill`, which is behind `protect + tenantUserOnly`
   and rejects POS tokens. The picker already works around this by reading through
   `/api/pos/sales-orders`.

2. **Wrong doc/status + double counting.** `fulfillSalesOrder` requires
   `docType:'order'` and `orderStatus ∈ {confirmed, partially_fulfilled}`, so a
   loaded **quotation** 404s and a **draft order** 409s. And even for a confirmed
   order, the POS payment (`createPOSOrder`) has *already* deducted stock and
   written Sales revenue rows; `fulfillOrder` would deduct stock and write Sales
   rows **again** — double inventory decrement and double revenue.

## Decision

**Mark-only reconciliation.** The POS sale is the single stock/revenue event.
Paying a linked Sales Order reconciles its *status* only — no second stock
deduction, no duplicate Sales rows. Partial POS sales leave the SO
`partially_fulfilled`.

## Design

### 1. Server: `reconcileFulfillment` (new fn in `salesFulfill.service.js`)

Mirrors `fulfillOrder` but **skips** `postShippedStock` and `Sales.create`.

Signature: `reconcileFulfillment({ salesOrder, tenantId, fulfillLines, userId, paymentMethod })`

Steps:
1. Advance `fulfilledQty` per line via existing `applyFulfillment(items, fulfillLines)`
   (clamped to ordered qty). `fulfillLines` are keyed by SO line `_id`.
2. Set `postedQty = fulfilledQty` on advanced lines (keeps posting-idempotency
   invariant true so a later *real* fulfill won't try to post these units).
3. Recompute status via existing `fulfillStatus(items)` → `fulfilled` /
   `partially_fulfilled`.
4. Append a `fulfillments[]` entry with `status:'reconciled'` (auditable; marks it
   as a POS-reconciled, non-stock-posting fulfillment).
5. `save()`; return `{ order }`.

Payment fields (`paymentStatus`, `paymentMethod`, `amountPaid`) are set by the
controller, not the service.

### 2. Server: controller + route (POS-authenticated)

`exports.reconcileSalesOrderFromPOS` in `pos.controller.js`:
- `tenantId = req.tenant._id`.
- Load `SalesOrder.findOne({ _id, tenant })` (any docType). 404 if missing.
- If `docType==='quotation'`: reject only if `quoteStatus ∈ {rejected, expired}`;
  otherwise `convertQuotationToOrder(so)` (reuse `salesOrder.service`) and continue
  with the resulting order.
- Guard: if `orderStatus==='cancelled'` → 409.
- Map the request's sold items → SO line ids: for each `{subProductId, sizeId, quantity}`
  find the first SO line with matching `subproduct` (+ `size` when present) that
  still has outstanding qty, producing `fulfillLines:[{lineId, qty}]`.
- Call `reconcileFulfillment`.
- Set `order.paymentStatus='paid'`, `order.paymentMethod`, `order.amountPaid=order.total`,
  `order.orderStatus='confirmed'` if it was still `draft` (so a zero-line edge case
  still marks confirmed). `save()`.
- Audit + `salesLog.logActivity('Sales Order fulfilled via POS')`.

Route in `pos.routes.js`:
`router.post('/sales-orders/:id/reconcile', protectPOS, requirePOSPermission('pos:sell'), reconcileSalesOrderFromPOS);`

### 3. Client

- `api.ts`: replace `fulfillSalesOrder` with
  `reconcileSalesOrder(token, id, { paymentMethod, items:[{subProductId,sizeId?,quantity}] })`
  → `POST /api/pos/sales-orders/:id/reconcile`.
- `pos-payment-modal.tsx`: post-payment block calls `reconcileSalesOrder` with the
  order's `paymentMethod` and the sold `orderItems`. Keep the existing non-blocking
  status UI (running / "✓ Sales order fulfilled" / error). On success clear
  `linkedSalesOrderId`.

### 4. Picker / load — no change

`pos-order-picker-modal.tsx` and `handleLoadOrder` already load quotations and
orders and set `linkedSalesOrderId`. Loaded cart items carry
`subProductId`/`sizeId`/`quantity`, which is exactly the reconcile payload.

## Testing

Server unit tests for `reconcileFulfillment` and the controller path:
- Quotation → converts to order → `fulfilled`; **no** `adjustStock` call, **no**
  `Sales.create`.
- Partial sold qty → `partially_fulfilled`; `fulfilledQty`/`postedQty` advanced by
  sold qty only.
- Confirmed order full sale → `fulfilled`, `paymentStatus='paid'`.
- Existing `fulfillOrder`/`salesFulfill` tests stay green (unchanged path).

## Out of scope

- Changing POS's own stock/revenue posting.
- Returns against POS-reconciled orders (existing `/return` still applies to
  stock-posted fulfillments only; reconciled lines have `postedQty` advanced so a
  return would restock — acceptable, revisit if it becomes a real workflow).
