# Plan — fulfilling a quotation from /pos/sell

Diagnosis: [`../specs/RESUME-pos-fulfill-quotes.md`](../specs/RESUME-pos-fulfill-quotes.md).
Design already settled and unchanged: **mark-only** — the POS sale is the sole
stock and revenue event; reconcile advances `fulfilledQty`/`postedQty`/status only.

This file records the five decisions the spec asked for, and why. The code is
downstream of it; if the two disagree, this file is the intent.

---

## §1 — Whose price wins on a loaded quotation

**Decision: the Sales Order's line price wins, re-read from the database.**

The client sends `linkedSalesOrderId` on the create-order payload — an *id*,
never a price. `createPOSOrder` loads that SO scoped to the tenant and derives
each line's net unit price itself. Nothing about the money crosses the wire from
the till.

Precedence, highest first:

1. `priceOverrides[key]` — a cashier holding `pos:price_override` deliberately
   typing a price still wins. It is a permissioned, audited act.
2. The linked SO's line price — for lines the SO actually contains.
3. Pricelist rules → bundle deals → `clientPrice` within 1% — every ordinary
   sale, unchanged.

**The 1% tolerance is not widened.** It stays exactly what it was: the tamper
guard for a price that arrived from the client. A quote price never goes through
it, because a quote price never arrives from the client.

### What "the line's price" means — the discount decision

The spec asks separately whether the quote's `discount` / `promoDiscount` should
reach the till. **They should, folded into one net unit price:**

```
netUnitPrice = (lineTotalOf(line) − promoDiscount) / quantity
             = (unitPrice·qty − lineDiscount − promoDiscount) / qty
```

Reusing `lineTotalOf` from `salesOrder.service.js`, so the till and the quote
compute the agreed money in exactly one place.

Why folded rather than carried as separate fields:

- The till's per-line discount is a **percentage from the dialpad**. An SO line's
  discount may be a flat ₦ off the whole line (`discountType: 'fixed'`) *plus* a
  separate ₦ `promoDiscount`. There is no lossless mapping into one percentage.
- Folding prorates correctly. Selling 3 of a quoted 10 charges 3 × the agreed
  per-unit price — including 3/10 of a flat line discount. Any other split of a
  flat discount across a partial sale is arbitrary.
- The quote's own presentation (discount as its own column) is preserved on the
  SO, which is the document the customer was issued. The receipt shows what was
  charged, which is the same money.

Tax is **not** folded in: POS lines carry their own `taxRate` and the till taxes
on top, so folding the quote's tax into the unit price would tax it twice.

### Matching a cart line to an SO line

Key is `subProductId_sizeId`, or `subProductId` for an unsized line — the same
key `priceOverrides` uses. If no exact key matches and the SO has exactly **one**
product line for that sub-product, that line is used; ambiguity (two sizes of one
product) falls through to ordinary pricing rather than guessing. This mirrors the
reconcile matcher's own behaviour.

---

## §2 — What the till actually took

**Decision: `amountPaid` accrues from the SO's own lines; `paymentStatus`
follows from it. `'partial'` joins the enum.**

```
order fully fulfilled  → amountPaid = order.total          (the till took the lot)
order partly fulfilled → amountPaid += Σ settled(line, Δqty), capped at total
```

where `settled(line, Δ) = round((lineTotalOf − promoDiscount + lineTaxOf) × Δ / quantity)`
— per-line money only, prorated by the quantity **actually** reconciled (the
delta `reconcileFulfillment` clamped to, not the quantity the till asked for).

Consequences that matter:

- Sell 3 of 10 and the receivable for 7 survives, which is the whole bug.
- Accruing on the *delta* is necessary but **not sufficient** for a safe replay:
  replaying "fulfil 3" against an order with 7 outstanding fulfils 3 more and
  takes ₦3,000 more, because the server cannot tell a replay from a genuine
  second sale of the same product. The sale's **receipt number** therefore rides
  along as `ref` and is stored on the `fulfillments[]` entry
  (`fulfillmentSchema.ref`, new); a call whose ref is already present returns the
  order untouched. That, not the clamp, is what makes §4's queue safe.
- Order-level adjustments (`couponDiscount`, `pricelistCartDiscount`,
  `shippingFee`) are deliberately **not** prorated across partial sales — there
  is no honest per-line share of a cart coupon or a delivery charge. They land
  whole, at the moment the order completes, via the fully-fulfilled branch.

**Schema change:** `SalesOrder.paymentStatus` enum `['unpaid','paid']` →
`['unpaid','partial','paid']`. The three admin views that render it test
`=== 'paid'` and already have an else-branch, so `partial` renders as the
not-paid state until the badge is taught the third value.

---

## §3 — The load mapping

**Decision: extract it, and enrich from the POS catalogue.**

`handleLoadOrder(so: any)` becomes a thin caller of a pure module,
`components/pos-sales-order-lines.ts`, the way `pos-product-window.ts` was
extracted — admin vitest is `environment: 'node'` and cannot render the cart.

Field-by-field, against the real `lineSchema`:

| cart field | today | from now on |
|---|---|---|
| `sizeId` | `line.sizeId` → always `undefined` | `line.size` |
| `variant` | `line.sizeName` → always `undefined` | the matching `POSSize.displayName` |
| `costPrice` | `line.costPrice` → always `0` | `size.costPrice ?? product.costPrice` from the loaded catalogue |
| `price` | `line.unitPrice` | the same **net** unit price §1 makes authoritative, so cart and charge agree |
| `image`, `stock`, `activeBundles`, `productId` | absent / `''` | from the catalogue row |

The catalogue is already in scope in `pos-cart.tsx` (`usePOSProducts()`), holds
`costPrice` per product and per size, and is exactly what the grid builds a cart
item from — so a loaded line and a tapped line become the same shape. A line
whose sub-product is not in the catalogue still loads, with the SO's own name and
price and a zero cost, because refusing to load it would be worse.

`quantity` clamps to what is still outstanding (`quantity − fulfilledQty`), so
re-loading a part-fulfilled order does not re-sell what was already sold.

---

## §4 — Offline

**Decision: queue the reconcile, don't refuse the load.**

Refusing to load a quotation while offline would break the one case the offline
POS exists for — the network is down and there is a customer holding a quote.
Queueing is safe here for reasons specific to this endpoint:

- The sync engine replays `pending` entries **sorted by `createdAt`** and
  `break`s out on a retryable failure, so a `reconcile` entry queued right after
  its `order` entry replays after it, in order.
- Reconcile does not depend on the order's server-assigned id — it needs the SO
  id and the sold lines, both known offline.
- Replay is made idempotent by the `ref` above (the receipt number, or the
  temporary one assigned offline), which is stable across replays of the same
  queue entry.

So: `reconcileSalesOrderOffline()` in `offline/api.ts` beside `createOrder` /
`refundOrder` / `voidOrder`, a `'reconcile'` arm in `QueueEntryType`, and a
matching arm in `runSyncEngine`. The payment modal calls it instead of
`posApi.reconcileSalesOrder` directly.

---

## §5 — The loaded warehouse

**Decision: `so.warehouseId?._id ?? so.warehouseId`,** inside the pure mapper so
it is covered by a test. The list endpoint populates the ref, and a populated ref
stringifies to `"[object Object]"`; since `715862d7` the products endpoint guards
against that and silently falls back to the shop's warehouse, so the symptom is
not a crash but a cashier selling the wrong warehouse's stock. A ref is an id
even when the server populates it.

---

## Tests

| # | Where | What it asserts |
|---|---|---|
| §1 | `server/__tests__/posLinkedSalesOrderPricing.test.js` | the real `createPOSOrder`; a quoted price >1% from today's POS price reaches `priceAtPurchase`; an unlinked sale still gets the 1% guard |
| §2 | `server/__tests__/salesFulfill.reconcile.test.js` | sell 3 of 10 → not `paid`, `amountPaid` is the 3's worth; full sale → `paid` at `total`; replay adds nothing |
| §3/§5 | `client/.../components/pos-sales-order-lines.test.ts` | a `{size, unitPrice}` line becomes a cart line carrying that size and that price; cost comes from the catalogue; a populated `warehouseId` yields its `_id` |
| §4 | same client test file / sync arm | a queued reconcile replays through `posApi.reconcileSalesOrder` |

Assertions are on the payload that reaches the wire, not on helpers: every one
of these degrades to a plausible wrong number rather than to an error.

## Baselines (measured 2026-08-16, before any change)

server **2032/2035** (3 known failures) · admin vitest **787/787** (41 files) ·
admin tsc **531**, list stashed at `scratchpad/tsc-baseline.txt` — prove a change
by diffing the list, not the count.
