# Implementation Prompt: `/sales` Module (Quotations → Sales Orders → Fulfillment)

> Build a tenant-facing **Sales** module that is the **sell-side mirror** of the existing
> `purchases` module. It manages the full pre-POS sales document workflow: **quotations**
> (net-new), **sales orders**, conversion, fulfillment (incl. partial delivery), invoicing, and
> returns — for B2B / advance / quote-driven sales that are negotiated and fulfilled over time,
> as opposed to immediate point-of-sale checkout.

## Context (study these before designing anything)

DrinksHarbour is a multi-tenant drinks-commerce SaaS. Backend: Express + Mongoose in `server/`.
Tenant dashboard client: `client/apps/isomorphic`. Routing convention:
`src/app/(hydrogen)/<module>/<sub>/page.tsx` = thin route shells; `src/app/shared/<module>/<module>-*.tsx`
= the real components; a `<module>-nav-header.tsx` provides the in-module tab nav.

**The `purchases` module is the template — read it first and mirror its conventions:**

- Routes: `(hydrogen)/purchases/{page,create,[id],receive,validate,returns,bills,vendors,
  agreements,pricelists,analytics,settings,...}/page.tsx`.
- Components: `shared/purchases/purchases-{orders,create,edit,po-detail,receipt-detail,receive,
  returns,return-create,return-detail,bills,vendors,vendor-detail,agreements,pricelists,
  analytics,settings,nav-header,...}.tsx`.
- Model: `server/models/PurchaseOrder.js` — note the **single-model, two-docType** pattern:
  `docType: 'rfq' | 'po'`, `rfqStatus: draft → sent → quoted → approved → rejected → converted →
  expired → cancelled`, plus a separate `status` order lifecycle, `approvalStatus`, and per-line
  `postedQty`/receipt tracking.
- Controller/service: `server/controllers/purchaseOrder.controller.js`,
  `server/services/purchaseOrder.service.js`, and the partial-receive math in
  `server/services/poReceive.helpers.js` (pure `applyReceipt` / `poReceiptStatus` / `outstanding`
  / `buildPostingLines`, the per-line `postedQty` "unposted delta" idempotency primitive).

**Existing sell-side surfaces to integrate with (do not duplicate):**

- `server/models/Order.js` — ecommerce orders (online checkout).
- `server/models/Sales.js` — line-level sale records (`order` sparse, `user` sparse for walk-ins,
  `tenant` required); the analytics/ledger source of truth for revenue.
- `client/apps/isomorphic/src/app/(hydrogen)/point-of-sale/*` — immediate POS checkout (a sales
  order that is paid + fulfilled on the spot). The new module is for orders that exist **before**
  fulfillment/payment.
- `(hydrogen)/ecommerce/orders` + `shared/ecommerce/order/*` — existing order list/detail/form.
- `(hydrogen)/invoice` + `shared/invoice/*` — existing invoice rendering to reuse for quote/order PDFs.
- **Customers**: `POSCustomer` (tenant CRM) + the unified contact model + the newly merged
  **customer-assigned pricelist** (`POSCustomer.pricelist`, `pricelist.service` resolution) and
  **loyalty** ledger — selecting a customer on a quotation/order should auto-apply their pricelist,
  exactly like the POS sell page does (`usePOSCustomerPricelistSync`).
- **Inventory**: stock is moved through `warehouseService.adjustStock(...)` (+ SubProduct rollup +
  Size.stock + `InventoryMovement` history). Fulfillment is the **outbound** counterpart of PO
  receiving — reuse that machinery (`type: 'shipped'`, FEFO batch picking).

## Goal

A `/sales` module that lets tenant staff:

1. **Create & send quotations** — pick customer (auto-apply their pricelist), add line items
   (product/subproduct/size with snapshotted prices + discounts), set validity/expiry, terms; send
   to the customer; track status (`draft → sent → accepted → rejected → expired → converted`).
2. **Convert a quotation to a sales order** (one click; carries lines + pricing snapshot).
3. **Create sales orders directly** (skip quotation), confirm, and **fulfill** them — including
   **partial fulfillment / back-orders**, mirroring PO partial-receive (per-line `fulfilledQty` /
   outstanding, idempotent posting that decrements stock only on the delta).
4. **Invoice** confirmed/fulfilled orders (reuse the invoice module) and record revenue into
   `Sales` on fulfillment so analytics/loyalty stay consistent.
5. **Handle sales returns** (mirror `purchases-returns`): restock + ledger reversal.
6. List / filter / search quotations and orders, with an in-module nav header and analytics.

## Recommended data model

Mirror `PurchaseOrder`'s single-model, two-docType pattern with a **new `SalesOrder` model**
(do **not** overload the ecommerce `Order` model — keep online-checkout orders separate, same as
the buy side keeps `PurchaseOrder` separate):

- `SalesOrder` — `tenant` (required), `docType: 'quotation' | 'order'`, `customer`
  (POSCustomer/contact ref) + snapshot, `pricelist` (resolved at create), `currency`,
  line items `[{ product, subproduct, size, quantity, unitPrice (snapshot), discount, lineTotal,
  fulfilledQty, postedQty }]`, totals, `quoteStatus` (`draft|sent|accepted|rejected|expired|
  converted`), `orderStatus` (`draft|confirmed|partially_fulfilled|fulfilled|cancelled`),
  `validUntil` (quote expiry), `convertedFrom`/`convertedTo` links, `notes`/terms,
  fulfillment entries `[{ warehouseId, items:[{lineId, qty, batch/expiry}], status, at }]`,
  `relatedInvoice`, `relatedSales: [ObjectId]`, timestamps + indexes on
  `{tenant, docType, quoteStatus}` / `{tenant, orderStatus}` / `{tenant, createdAt}`.

Reuse the **pure helpers pattern**: a `server/services/salesFulfill.helpers.js` with unit-tested
`applyFulfillment` (accumulate + clamp, report delta), `fulfillStatus`, `outstanding(line)`,
`buildPostingLines` — the exact analogue of `poReceive.helpers.js`. Fulfillment posts the unposted
delta via `adjustStock(type:'shipped')` so repeated confirm/fulfill visits never double-decrement.

## Backend endpoints (mirror purchaseOrder.controller)

- `GET /sales` (list, filter by docType/status/customer/date), `GET /sales/:id`,
  `POST /sales` (create quotation or order), `PUT /sales/:id`, `DELETE/cancel`.
- `POST /sales/:id/send` (quotation → sent), `POST /sales/:id/accept|reject`,
  `POST /sales/:id/convert` (quotation → order).
- `POST /sales/:id/confirm` (order draft → confirmed), `POST /sales/:id/fulfill` (additive,
  records a fulfillment entry, posts the stock delta, advances `fulfilledQty`/`postedQty`, sets
  `partially_fulfilled` vs `fulfilled` by outstanding), `POST /sales/:id/invoice`,
  `POST /sales/:id/return` (restock + ledger reversal, mirror `returnPurchaseOrder`).
- On fulfillment, write `Sales` rows (so revenue/analytics/loyalty are consistent with POS) and
  link them on the order.

## Client (`shared/sales/*` + `(hydrogen)/sales/*`)

- Routes: `sales/{page (list), create, [id] (detail), quotations, orders, fulfill, returns,
  analytics, settings}/page.tsx`.
- Components: `sales-nav-header.tsx`, `sales-quotations.tsx`, `sales-orders.tsx`,
  `sales-create.tsx` (customer picker w/ pricelist auto-apply + live line pricing, save as
  quotation or order), `sales-order-detail.tsx` (status machine actions: Send / Accept / Convert /
  Confirm / Fulfill / Invoice / Return; Outstanding column for partial fulfillment),
  `sales-quotation-detail.tsx`, `sales-fulfill-detail.tsx` (additive fulfill form, like
  `purchases-receipt-detail`), `sales-returns.tsx` / `sales-return-create.tsx` /
  `sales-return-detail.tsx`, `sales-analytics.tsx`, `sales-settings.tsx`. Reuse the invoice
  components for quote/order/invoice PDFs.

## Correctness requirements (carry over the PO discipline)

- **Pricing snapshot** at line creation; re-pricing only on explicit edit (never silently on
  fulfillment). Customer pricelist resolution bounded to the tenant (reuse `pricelist.service`).
- **Idempotent partial fulfillment** via per-line `postedQty` unposted-delta (no double stock
  decrement across repeated confirm/fulfill).
- **Stock movement** only through `adjustStock` (+ rollup + Size.stock + `InventoryMovement`
  `type:'shipped'`); returns reverse all three ledgers (watch the enum — PO returns previously
  threw on a non-enum `referenceType`; use a valid one).
- **State machine**: a quotation is editable while `draft`/`sent`; an order is fulfillable while
  `confirmed`/`partially_fulfilled`; cancellation guards.
- **Money** = match existing NGN integer convention.
- Tenant isolation on every query/index.

## Suggested phasing (each TDD'd and independently green)

1. **Pure helpers + model**: `SalesOrder` schema + `salesFulfill.helpers.js` (unit tests mirroring
   `poReceive.helpers.test.js`).
2. **Quotation lifecycle**: create/send/accept/reject/expire + convert-to-order endpoints + tests.
3. **Order fulfillment**: confirm + additive fulfill (stock delta posting) + `Sales` row creation
   + partial/back-order status; e2e on ephemeral mongod (order 100 → fulfill 60 → fulfill 40 →
   stock decremented exactly 100, status fulfilled).
4. **Invoice + returns**: reuse invoice module; sales-return restock + ledger reversal.
5. **Client UI**: nav header, list/detail/create, fulfill form, returns, analytics — mirroring
   `purchases` components and the customer-pricelist auto-apply UX.

## Acceptance / verification

- Server: `NODE_PATH=server/node_modules node --test server/__tests__/` — all green (add suites;
  don't break existing).
- Client: `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` — no new errors beyond
  the 27 TS2688 baseline.
- E2E on ephemeral mongod: quotation → convert → confirm → partial fulfill ×2 → invoice → return,
  verifying stock ledgers, `Sales` rows, and status transitions.
- Branch off `main` (currently has pricelist + loyalty merged).

## Open item to confirm before building

- **Model choice**: this prompt recommends a **new `SalesOrder` model** (clean mirror of
  `PurchaseOrder`, keeps quotation/B2B orders separate from ecommerce `Order` and POS `Sales`).
  The alternative — extending the existing `Order` model with quotation/fulfillment states — risks
  entangling online-checkout orders with the negotiated-sales workflow. Confirm the new-model
  approach (recommended) or override before phase 1.
- **Boundary with POS/ecommerce**: confirm that a confirmed sales order's fulfillment should write
  `Sales` rows (so revenue/loyalty/analytics match POS), and whether payment is captured here or
  handed off to POS / an invoice/payment flow.
