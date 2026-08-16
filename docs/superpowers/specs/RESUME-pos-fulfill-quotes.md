# RESUME — fulfilling a quotation from /pos/sell

**Status:** all five findings FIXED and covered by tests. **UNCOMMITTED**, on
`feat/mobile-phase-1-foundation`. Not yet exercised in a browser against a real
quotation — see *Still to do*.
**Diagnosed:** 2026-08-16. **Built:** 2026-08-16.

Decisions and their reasoning:
[`../plans/2026-08-16-pos-fulfill-quotes.md`](../plans/2026-08-16-pos-fulfill-quotes.md).
Original design spec: `2026-07-03-pos-fulfill-linked-sales-order-design.md`.

The load→sell→reconcile path is unchanged in shape and still **mark-only**: the
POS sale is the sole stock and revenue event; reconcile advances
`fulfilledQty`/`postedQty`/status, with no second deduction and no duplicate
Sales rows.

---

## The one sentence

A quotation's agreed price now reaches the till because the **server re-reads
the Sales Order** instead of trusting the cart, and the order is credited with
**what the till actually took** instead of its own total.

---

## What changed

### §1 The quoted price is authoritative — MONEY

`createPOSOrder` accepted a cart price only within 1% of its own recomputed
price. A negotiated quote price is outside that band *by construction*, so the
customer was charged today's price and told nothing.

- The client sends `linkedSalesOrderId` — **an id, never a price**
  (`pos-payment-modal.tsx`).
- `resolveLinkedSalesOrderPrices()` (`pos.controller.js`, above
  `createPOSOrder`) loads the SO **scoped to the tenant** and returns a Map of
  net unit prices: `(unitPrice·qty − lineDiscount − promoDiscount) / qty`,
  reusing `lineTotalOf` from `salesOrder.service.js` so till and quote compute
  the agreed money in one place. Line tax is *not* folded in — POS lines carry
  their own `taxRate` and tax on top.
- Precedence: cashier `priceOverrides` (permissioned) → SO line price →
  pricelist/bundle → `clientPrice` within 1%.
- **The 1% band is untouched.** It is the tamper guard on a client-supplied
  number, and a quote price is no longer client-supplied.
- Matching key is `subProductId_sizeId`, with a bare `subProductId` fallback
  only when the order names that sub-product **exactly once**. Two sizes of one
  product fall through to ordinary pricing rather than guessing.
- A quoted line is exempt from the cart-wide bundle pass (`_soPriced`) — the
  agreed price already *is* the discount.

**Yes, the quote's discount and promotion reach the till** — folded into the
unit price, because the dialpad's discount field is a percentage and cannot
carry a flat ₦ off a line, and per-unit is the only split of a flat discount
that stays right when 3 of 10 are sold.

### §2 What the till actually took — MONEY

`reconcileSalesOrderFromPOS` ended with `paymentStatus = 'paid'` and
`amountPaid = order.total`, unconditionally. Sell 3 of 10 and the order read
fulfilled-partially, paid-in-full — the receivable for the other seven vanished.

The money moved **into `reconcileFulfillment`** (`salesFulfill.service.js`), so
it is covered by the test file it belongs in:

- fully fulfilled → `amountPaid = order.total`
- partly fulfilled → `amountPaid +=` Σ per-line value × **actual delta**, capped
  at `total`
- `paymentStatus` follows: `paid` / `partial` / `unpaid`

Order-level money (coupon, pricelist cart discount, shipping) is **never**
prorated across a partial sale — it has no honest per-line share, so it lands
whole via the fully-fulfilled branch.

**Idempotency:** the sale's receipt number is passed as `ref` and stored on the
`fulfillments[]` entry. A replay under the same ref returns the order untouched
(`duplicate: true`). Without it the offline queue could not be trusted.

### §3 The load mapping

`handleLoadOrder` read `line.sizeId`, `line.sizeName`, `line.costPrice`; the
schema has `size` and neither of the others. **The picker modal's own `SOLine`
interface declared the wrong names**, which is why nothing ever flagged it.

- New pure module `components/pos-sales-order-lines.ts`
  (`salesOrderToCartItems`, `salesOrderWarehouseId`, `agreedUnitPrice`),
  extracted the way `pos-product-window.ts` was — admin vitest is
  `environment: 'node'` and cannot render the cart.
- The picker's `SOLine` is deleted; it imports `SalesOrderLine` from the new
  module, so a line is declared in exactly one place.
- Cost, stock, image, size name and `productId` come from the POS catalogue
  (`usePOSProducts()`), which the terminal already holds in full. A line whose
  sub-product is missing still loads, with a zero cost.
- Quantity loads as **outstanding** (`quantity − fulfilledQty`), so re-loading a
  part-fulfilled order does not re-sell what was already sold. An order with
  nothing outstanding toasts an error instead of loading an empty cart.

### §4 Offline — queued, not refused

Refusing to load a quotation offline would break the one case the offline POS
exists for. `offline/api.ts` gains `reconcileSalesOrder`, `QueueEntryType` gains
`'reconcile'`, and `runSyncEngine` gains its arm. Safe because the queue drains
in `createdAt` order (so the reconcile replays *after* its sale), reconcile needs
no server-assigned id, and `ref` makes a replay a no-op. The cashier sees
"Offline — sales order will be fulfilled when the network returns", not
"fulfilled".

### §5 The loaded warehouse

`salesOrderWarehouseId()` does `so.warehouseId?._id ?? so.warehouseId`. A ref is
an id even when the server populates it.

### Schema + UI fallout

- `SalesOrder.paymentStatus` enum: `['unpaid','paid']` → `['unpaid','partial','paid']`.
- `fulfillmentSchema.ref` added (the POS receipt number).
- Three admin views said "Unpaid"/"Awaiting payment" over money already taken —
  `sales-order-detail-info.tsx`, `sales-order-detail.tsx`,
  `sales-invoice-view.tsx` now show the partial amount. `salesOrder.service.ts`
  type widened to match.

---

## Tests added

| file | n | covers |
|---|---|---|
| `server/__tests__/posLinkedSalesOrderPricing.test.js` | 9 | §1, driving the real `createPOSOrder` and asserting on the document handed to `Order.create` |
| `server/__tests__/salesFulfill.reconcile.test.js` | +6 (10 total) | §2 — partial settlement, accumulation, discount/tax, replay |
| `client/.../components/pos-sales-order-lines.test.ts` | 16 | §3 + §5 |
| `client/.../offline/sync.test.ts` | 3 | §4 — replay, ordering, 409 parking |

The §1 test stubs every read the handler makes (`Tenant`, `Warehouse`,
`POSSession`, `Order.countDocuments`, `SubProduct`, `Size`, `SalesOrder`,
`InventoryMovement`, `resolveShopPricelist`) and captures `Order.create`. Note
the stub query object must be **thenable as well as chainable** — the handler
awaits some queries without `.lean()`, and a merely-truthy chain object is
mistaken for a document (this cost a 10s Mongoose buffering timeout).

## Verify

```bash
cd server && node --test '__tests__/*.test.js'
cd client/apps/admin && npx vitest run
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -v "\.next/" | wc -l
```

| gate | before | after |
|---|---|---|
| server | 2032/2035 (3 known failures) | **2047/2050**, same 3 |
| admin vitest | 787/787 (41 files) | **806/806** (43 files) |
| admin tsc | 531 | **530** |

The tsc figure moved by one because the `sizeName` excess-property error in
`pos-cart.tsx` — the §3 bug itself — is gone. Every other diff line against the
stashed baseline is a union-member reshuffle or a line-number shift of a
pre-existing error. **Prove a tsc change by diffing the error list, not the
count.** `npm run build` is not a gate: it prints "Skipping validation of types
/ Skipping linting".

## Still to do

1. **Exercise it in a browser** against a real quotation with a negotiated
   price: load → sell part of it → check the SO shows partially fulfilled and
   partially paid for the right amount. Nothing here has been run against a live
   terminal.
2. Then repeat with the network toggled off, and confirm the queued reconcile
   lands on reconnect.
3. Decide whether the POS terminal should *show* the cashier that a line is
   priced from a quotation (today the price is simply right; there is no badge).

## Two traps

- **The POS is an installed PWA.** A client change can appear to do nothing
  because the terminal is running a cached bundle — hard-reload with "Update on
  reload" or unregister the worker before concluding a fix failed.
- **Restart the backend.** Several server changes are uncommitted and
  unrestarted.

Related: [[pos_fulfill_linked_so]], [[sales_module_progress]],
[[pos_catalogue_silent_cap]], `select_narrower_than_consumers` — §3 is that
pattern once more, except the projection was fine and a **local interface
invented the field names**, which is worse: it made the wrong names typecheck.
