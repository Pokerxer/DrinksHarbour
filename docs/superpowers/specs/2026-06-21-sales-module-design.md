# `/sales` Module — Quotations → Sales Orders → Fulfillment

**Date:** 2026-06-21
**Branch base:** `main` (currently has pricelist + loyalty merged)
**Status:** Approved design — ready for implementation planning

## Purpose

A tenant-facing **Sales** module that is the sell-side mirror of the existing
`purchases` module. It manages the full pre-POS sales-document workflow for
B2B / advance / quote-driven sales that are negotiated and fulfilled over time
(as opposed to immediate point-of-sale checkout):

- Quotations (net-new)
- Sales orders (direct, or converted from a quotation)
- Confirmation + payment capture
- Fulfillment, including **partial fulfillment / back-orders**
- Invoicing (reuse the invoice module)
- Sales returns (restock + ledger reversal)
- List / filter / search + in-module nav header + analytics

The `purchases` module is the structural template and its conventions are
mirrored throughout.

## Confirmed decisions (the design forks)

These were explicitly resolved with the user before this spec was written:

1. **New `SalesOrder` model**, single-model / two-`docType` pattern
   (`quotation` | `order`) — a clean mirror of `PurchaseOrder`. The ecommerce
   `Order` model and the POS `Sales` model are **not** overloaded; negotiated
   B2B/quote orders stay fully separate from online-checkout orders.
2. **This spec covers the whole module.** The implementation plan sequences the
   **backend (phases 1–4) first**, then the **client UI (phase 5) last**.
3. **Payment is captured once, for the full order total, at `confirm`** —
   tender + wallet debit + loyalty earn, mirroring `createPOSOrder`.
   **Fulfillment is a separate, additive, partial-capable step** that moves
   stock (`adjustStock type:'shipped'`) and writes `Sales` rows for the shipped
   portion. Payment and physical fulfillment are decoupled in time.
4. **Full wallet + loyalty integration** at confirm: `mutateWallet` (with the
   POS-style compensating-rollback discipline) + `mutateLoyalty`, exactly as
   `createPOSOrder` does today.

## Codebase grounding (verified facts)

- **Idempotency primitive (PO side):** `server/services/poReceive.helpers.js`
  exposes the pure DB-less helpers `applyReceipt` / `outstanding` /
  `poReceiptStatus` / `buildPostingLines`, plus the impure poster
  `postReceivedStock`. Per-line `receivedQty` accumulates and `postedQty`
  tracks what has already posted to stock; `buildPostingLines` projects the
  **unposted delta** (`receivedQty − postedQty`) so repeated posts never
  double-decrement. The sales module reproduces this exactly with
  `fulfilledQty` / `postedQty`.
- **Outbound stock path:** `warehouseService.adjustStock({ warehouseId,
  subProduct, size, quantity, type, notes }, userId, tenantId)` supports
  `type: 'received' | 'shipped' | 'adjusted'`. `'shipped'` does
  `currentQuantity = max(0, currentQuantity − quantity)`. This is the outbound
  counterpart of PO receiving and the path fulfillment uses (it also does the
  SubProduct rollup + `Size.stock` sync + `InventoryMovement` history, same as
  receiving).
- **InventoryMovement enum gotcha:** `InventoryMovement.referenceType` enum is
  `['order','purchase_order','transfer','return','adjustment','audit','manual','']`.
  Sales returns **must** use `referenceType: 'return'`. (`'purchase_order_return'`
  is NOT in the enum — this is the gotcha the prompt warned about.)
- **Sales model:** `server/models/Sales.js` — line-level revenue/analytics
  source of truth. `channel` enum includes `'tenant_manual'`
  (manual entry / phone order / bulk B2B), which is the correct channel for
  sales-order fulfillment rows. Required line fields: `product`, `subproduct`,
  `size`, `quantity`, `priceAtSale`, `itemSubtotal`, `channel`, `tenant`;
  `order` and `user` are sparse.
- **Pricelist resolution:** `server/services/pricelist.service.js` exposes
  `resolveShopPricelist(tenant, tenantId, shopId, customerPricelistId)` and
  `pickPricelistForShop(...)`, bounded to the tenant's allowed pricelists. A
  customer's assigned pricelist (`POSCustomer.pricelist`) takes top precedence
  but is still bounded to the tenant — a customer can never be charged an
  off-tenant pricelist.
- **Wallet / loyalty:** `mutateWallet` (`services/wallet.service.js`) is an
  atomic guarded `$inc` with an overdraw guard; reversals append a compensating
  credit (the ledger is never edited). `mutateLoyalty`
  (`services/loyalty.service.js`) + `loyaltyDelta` (`contact.helpers.js`) handle
  earn/redeem. `createPOSOrder` (pos.controller.js ~L1987) is the reference
  flow: deduct stock → charge wallet (rollback stock on failure) → create order
  → loyalty → write Sales rows, all with compensating reversals on any failure.
- **Number generators:** `server/utils/orderUtils.js` exports
  `generateOrderNumber`, `generateReceiptNumber`, `generateReturnNumber`. The
  sales module adds `generateSalesOrderNumber` (SO-prefixed) following the same
  pattern.

## Data model — `server/models/SalesOrder.js`

```
SalesOrder {
  tenant            (ObjectId ref Tenant, required, index)
  soNumber          (String, required, trim)
  docType           ('quotation' | 'order', required)

  customer          (ObjectId ref POSCustomer, sparse)   // B2B walk-in allowed
  customerSnapshot  { name, phone, email, customerId }   // denormalised for display
  pricelist         (ObjectId ref Pricelist, default null) // resolved at create
  appliedPricelist  { pricelistId, pricelistName }          // snapshot
  currency          ('NGN' default, enum NGN/USD/EUR/GBP)

  items: [{
    product       (ObjectId ref Product)
    subproduct    (ObjectId ref SubProduct)
    size          (ObjectId ref Size)
    sku, name                          // snapshots for display
    quantity      (Number, min 1)
    unitPrice     (Number, snapshot at line creation)
    discount      (Number, default 0)
    lineTotal     (Number)
    fulfilledQty  (Number, default 0)  // units physically shipped
    postedQty     (Number, default 0)  // units already posted to stock (idempotency)
    returnedQty   (Number, default 0)  // units sent back
  }]

  subtotal, discountTotal, total   (Number, NGN integer convention)

  // Quotation lifecycle (only set when docType === 'quotation')
  quoteStatus  ('draft'|'sent'|'accepted'|'rejected'|'expired'|'converted', default undefined)
  validUntil   (Date)              // quote expiry

  // Order lifecycle (only set when docType === 'order')
  orderStatus  ('draft'|'confirmed'|'partially_fulfilled'|'fulfilled'|'cancelled', default undefined)

  // Payment — captured once at confirm, for the full total
  paymentMethod  (String)          // cash|card|bank_transfer|mobile_money|wallet|split
  paymentStatus  ('unpaid'|'paid', default 'unpaid')
  amountPaid     (Number, default 0)
  walletTxRef    (ObjectId ref WalletTransaction, sparse)
  loyaltyEarned  (Number, default 0)

  fulfillments: [{
    warehouseId  (ObjectId ref Warehouse)
    items: [{ lineId, qty, batchNumber?, expiryDate? }]
    status, at (Date), by (ObjectId ref PosUser/User)
  }]

  convertedFrom  (ObjectId ref SalesOrder)   // quotation this order came from
  convertedTo    (ObjectId ref SalesOrder)   // order this quotation became
  relatedInvoice (ObjectId ref Invoice/Order, sparse)
  relatedSales   [ObjectId ref Sales]        // revenue rows written on fulfill

  notes, terms (String)
  timestamps
}

indexes:
  { tenant: 1, docType: 1, quoteStatus: 1 }
  { tenant: 1, orderStatus: 1 }
  { tenant: 1, createdAt: -1 }
  { tenant: 1, soNumber: 1 }   // unique per tenant
```

**Design notes:**

- One model carries both `quoteStatus` and `orderStatus`; only the field
  relevant to `docType` is set — directly mirroring `PurchaseOrder`'s
  `rfqStatus` vs `status` split.
- `outstanding(line) = max(0, quantity − fulfilledQty − returnedQty)` — a
  returned unit is accounted for and is not counted as still outstanding,
  exactly as the PO helper does.
- All queries and the unique index are tenant-scoped.

## Pure helpers — `server/services/salesFulfill.helpers.js`

Direct analogue of `poReceive.helpers.js`. DB-less and unit-tested first
(TDD), mirroring `poReceive.helpers.test.js`.

| Helper | Behaviour |
| --- | --- |
| `outstanding(line)` | `max(0, quantity − fulfilledQty − returnedQty)` |
| `applyFulfillment(soItems, fulfillLines, { allowOver=false })` | Accumulate `fulfilledQty` per line (previous + this fulfillment), clamp to `quantity` unless `allowOver`. Returns `{ lines: [{ lineId, previousFulfilledQty, newFulfilledQty, delta }] }`. `delta` is the accepted increment for **this** fulfillment (what should post to stock). |
| `fulfillStatus(soItems)` | `'fulfilled'` when every line `fulfilledQty ≥ quantity`; `'partially_fulfilled'` when some but not all units shipped; `null` when nothing shipped (caller keeps current status). |
| `buildPostingLines(soItems)` | Project lines with `qty = fulfilledQty − postedQty` (unposted delta); empty when nothing pending. Feeds the poster so repeated fulfill visits are idempotent. |

Plus the impure poster `postShippedStock({ salesOrder, targetWarehouseId,
adjustStock, pickBatchFEFO, recordMovement, userId, tenantId, logger })` —
analogue of `postReceivedStock`: posts each unposted delta via
`adjustStock(type:'shipped')`, picks batches FEFO for batch-tracked items, writes
`InventoryMovement` history (`referenceType:'order'` for the sale movement),
and surfaces per-line failures instead of silently dropping stock.

## Backend endpoints

`server/controllers/salesOrder.controller.js` + `salesOrder.service.js`,
mounted in `server.js` under `/sales` behind the same tenant-auth middleware as
purchases. Mirrors `purchaseOrder.controller.js`.

```
GET    /sales              list (filter docType / status / customer / date range)
GET    /sales/:id          detail
POST   /sales              create quotation or order
                           (resolve customer pricelist → snapshot line prices)
PUT    /sales/:id          edit — re-price ONLY on explicit edit; status-guarded
DELETE /sales/:id          cancel (guards: cannot cancel fulfilled/converted)

POST   /sales/:id/send      quotation: draft → sent
POST   /sales/:id/accept    quotation: sent → accepted
POST   /sales/:id/reject    quotation: sent → rejected
POST   /sales/:id/convert   quotation → order (copy lines + pricing snapshot,
                            set convertedFrom/convertedTo, quoteStatus=converted)

POST   /sales/:id/confirm   order: draft → confirmed + CAPTURE PAYMENT (full total)
                            tender → wallet debit (mutateWallet, rollback on fail)
                            → loyalty earn (mutateLoyalty) → set paymentStatus=paid
POST   /sales/:id/fulfill   additive fulfillment:
                            applyFulfillment → postShippedStock(unposted delta)
                            → write Sales rows (channel:'tenant_manual') for the
                              shipped portion → link relatedSales
                            → set orderStatus via fulfillStatus (partial/full)
POST   /sales/:id/invoice   reuse invoice module to render quote/order/invoice PDF
POST   /sales/:id/return    restock (adjustStock type:'received') + ledger
                            reversal (referenceType:'return'); advance returnedQty
```

**Correctness discipline (carried over from the PO side):**

- **Pricing snapshot at line creation.** Re-pricing happens only on explicit
  edit (`PUT`), never silently on fulfillment. Customer pricelist resolution is
  bounded to the tenant via `pricelist.service`.
- **Idempotent partial fulfillment** via per-line `postedQty` unposted-delta —
  no double stock decrement across repeated confirm/fulfill visits.
- **Stock movement only through `adjustStock`** (+ SubProduct rollup +
  `Size.stock` + `InventoryMovement` history, `type:'shipped'` outbound). Returns
  reverse all three ledgers with `referenceType:'return'`.
- **Payment at confirm is atomic with rollback.** If wallet is too low or the
  order fails to persist, append a compensating wallet credit and leave the
  order in `draft` — balance, ledger, and order state all stay consistent
  (the `createPOSOrder` discipline).
- **State machine guards.** A quotation is editable while `draft`/`sent`; an
  order is fulfillable while `confirmed`/`partially_fulfilled`; cancellation is
  blocked once fulfilled or converted.
- **Money** uses the existing NGN integer convention. **Tenant isolation** on
  every query and index.

## Client — `shared/sales/*` + `(hydrogen)/sales/*` (phase 5, last)

Mirrors `shared/purchases/*` and the customer-pricelist auto-apply UX from the
POS sell page.

**Routes** (`src/app/(hydrogen)/sales/`): thin route shells under
`{ page, create, [id], quotations, orders, fulfill, returns, analytics, settings }/page.tsx`.

**Components** (`src/app/shared/sales/`):

- `sales-nav-header.tsx` — in-module tab nav.
- `sales-quotations.tsx`, `sales-orders.tsx` — list/filter/search.
- `sales-create.tsx` — customer picker with pricelist auto-apply (reuse
  `usePOSCustomerPricelistSync`) + live line pricing; save as quotation or order.
- `sales-order-detail.tsx` — status-machine action buttons (Send / Accept /
  Convert / Confirm / Fulfill / Invoice / Return) + Outstanding column for
  partial fulfillment.
- `sales-quotation-detail.tsx`.
- `sales-fulfill-detail.tsx` — additive fulfill form (like
  `purchases-receipt-detail.tsx`).
- `sales-returns.tsx`, `sales-return-create.tsx`, `sales-return-detail.tsx`.
- `sales-analytics.tsx`, `sales-settings.tsx`.
- Reuse `shared/invoice/*` for quote/order/invoice PDFs.

## Suggested phasing (each TDD'd and independently green)

1. **Pure helpers + model.** `SalesOrder` schema + `salesFulfill.helpers.js`,
   unit tests mirroring `poReceive.helpers.test.js`.
2. **Quotation lifecycle.** create / send / accept / reject / expire +
   convert-to-order endpoints + tests.
3. **Order fulfillment.** confirm (payment: tender + wallet + loyalty) +
   additive fulfill (stock delta posting) + Sales-row creation +
   partial/back-order status; e2e on ephemeral mongod (order 100 → fulfill 60 →
   fulfill 40 → stock decremented exactly 100, status `fulfilled`).
4. **Invoice + returns.** reuse invoice module; sales-return restock + ledger
   reversal (`referenceType:'return'`).
5. **Client UI.** nav header, list/detail/create, fulfill form, returns,
   analytics.

## Acceptance / verification

- **Server:** `NODE_PATH=server/node_modules node --test server/__tests__/` — all
  green (add suites; do not break existing).
- **Client:** `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` —
  no new errors beyond the 27 `TS2688` baseline.
- **E2E on ephemeral mongod:** quotation → convert → confirm (payment +
  loyalty + wallet) → partial fulfill ×2 → invoice → return, verifying: stock
  decremented exactly 100 then restored on return, `Sales` rows written and
  linked, wallet + loyalty ledgers moved with correct compensating reversals,
  and all status transitions correct.

## Out of scope (YAGNI)

- Extending or touching the ecommerce `Order` model.
- Per-fulfillment / on-account (AR) payment timing — payment is a single
  full-total capture at confirm in v1.
- Multi-currency conversion logic beyond the existing currency enum.
