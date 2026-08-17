# RESUME — recalling a held POS order loaded every line at ₦0.00

Status: **FIXED, test-first, all gates green. Uncommitted.**
Not verified against a live till — that needs the cashier PIN, still descoped.
Date: 2026-08-17 · found while investigating [`RESUME-pos-cart-nan.md`](./RESUME-pos-cart-nan.md), unrelated to it

---

## The symptom

Cashier taps **Hold** on a cart, then **Held Orders → Recall**. Every line came
back priced `₦0.00`, named `"Product"`, with no variant, no sku, no cost, and no
combo grouping — and any per-line discount the cashier had negotiated was gone.

## What was wrong — two failures, same round trip

**1. The price was destroyed at hold time, not lost at recall time.**

`handleHold` (`pos-cart.tsx:1891`) sends the whole cart, `items` included, so
`price` and `discount` did reach the server. `holdPOSOrder` then read only the
identity fields and hard-coded `priceAtPurchase: 0, itemSubtotal: 0,
discountAmount: 0`. `recallPOSOrder` could only return what was stored.

Both halves carried a comment claiming the *other* one handled it — server:
`// client recomputes from grid — server returns 0 as placeholder`; client:
`// skip price 0 placeholders; the grid re-prices them`. Neither skip nor
re-price existed. Read either file alone and the bug is invisible; that is why
the test spans both handlers.

**2. The display fields never reached the database at all.**

`holdPOSOrder` wrote `_name`, `_variant` and `_sku` onto each order item.
`orderItemSchema` (`models/Order.js:7-121`) declares none of them and is strict
by default, so **Mongoose dropped them silently on write**. This was a
hypothesis until the test proved it: the first RED run returned a line literally
named `'Product'`.

Consequence: `getAllPOSOrders:3300`'s `it._name || it.product?.name` fallback is
dead code — no order document has ever had `_name`. Left alone; harmless.

## Why the money was still safe

`createPOSOrder` ignores a client price of `0` (`pos.controller.js:2345` —
`item.clientPrice != null && Number(item.clientPrice) > 0`) and reprices every
line from the database. So a recalled cart was **displayed** at ₦0 but **charged**
correctly at payment. What was genuinely lost was the quoted total in front of
the customer, and the negotiated per-line discount.

## The fix

**`holdMetadata` is the right home for a cart line, and `Order.items` is not.**
It is `Schema.Types.Mixed` and already exists for cart state that is not an
order (customer, cart discount, applied rewards). The line's money cannot live
on `Order.items` regardless: a hold must book zero revenue, because
`getAllPOSOrders` has no `status` filter and a hold carrying a total would land
in POS history and the session report as money taken.

- `pos.controller.js` `holdPOSOrder` — snapshots the cart lines into
  `holdMetadata.cartItems`, mapped field by field rather than storing
  `req.body.items` raw so a client cannot smuggle arbitrary keys into a
  persisted document. `Order.items` keeps its zeros, and the `_name`/`_variant`/
  `_sku` writes that never worked are gone.
- `pos.controller.js` `recallPOSOrder` — returns the snapshot; falls back to the
  old `Order.items` reconstruction for holds parked before this change, because
  refusing to open a parked sale is worse than opening it with prices missing.
- `components/pos-recall-cart-lines.ts` (new, pure) — `recallCartToItems`.
  Every money field coerced through `Number(x) || 0`, which is what stops a
  legacy hold's absent `price` becoming `NaN` and rendering as `₦NaN`.
- `components/pos-cart.tsx` — the inline mapping and its false comment replaced
  by one call.
- `types.ts` — `POSRecallCart.items` widened and its fields made optional, since
  a legacy hold genuinely carries only ids and quantity.

`stock` is deliberately **not** restored from the snapshot: a hold can sit for
hours and its stock figure is stale on recall. The existing `999` placeholder
stands until the grid supplies the live number on mount.

## Gates (measured on this tree)

| Gate | Baseline | After |
|---|---|---|
| server `cd server && node --test '__tests__/*.test.js'` | 2064 / 2061 (3 known fails) | **2071 / 2068** (same 3) |
| admin vitest | 901 / 901 (50 files) | **907 / 907 (51 files)** |
| admin tsc (source-only, `.next/` filtered) | 452 | **452**, zero errors in any touched file |

## Tests

- `server/__tests__/posHoldRecallRoundTrip.test.js` (7) — drives the real
  `holdPOSOrder` and `recallPOSOrder`. **It pushes the captured document through
  the real `Order` model (`new Order(doc).toObject()`) before recalling it** —
  without that, the strict-schema strip never happens and every undeclared field
  appears to survive. That is the only reason failure 2 above was visible.
  Two of the seven passed before the fix on purpose, and guard it: a hold must
  still book no revenue, and a legacy hold must still recall.
- `client/.../components/pos-recall-cart-lines.test.ts` (6) — the client mapping,
  including that a legacy line yields `0` rather than `undefined`.

RED was watched on both. The client module was first written with the old inline
mapping verbatim so the assertions failed on values (`undefined` vs `3000`)
rather than on a missing import.

## Left deliberately

- **Held orders leak into order history.** `getAllPOSOrders` (`:3263`) queries
  `{ 'items.tenant': tenantId, source: 'pos' }` with no `status` filter, and
  held items carry `tenant`, so `status: 'hold'` orders show in POS history and
  the sell-orders list as ₦0.00 orders — where `handleLoadOrder` would load them
  into the cart at price 0. Falls out of the same two functions; not fixed
  because it is a product decision (should a parked sale be visible there at
  all?) rather than a defect with one obvious answer.
- No live-till verification. `/pos/sell` is inside the `src/middleware.ts` path
  matcher (line 301) and behind `pos-lock-screen.tsx`; needs an admin login for
  the tenant plus the cashier PIN. Same descope as the offline-images work.
