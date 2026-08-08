# Free Delivery on First Purchase — Design

**Date:** 2026-08-08
**Scope:** `server/` + `client/apps/platform/`
**Status:** Approved, implementation in progress

## Goal

A signed-in customer placing their first order gets their delivery fee waived, up to
₦5,000, on orders of ₦50,000 or more delivered inside FCT / Abuja.

## Decisions

| Question | Decision |
|---|---|
| Who qualifies | Signed-in users only. Guests see a sign-in nudge. |
| What disqualifies | Any existing order whose `status` is **not** `cancelled` or `hold`. |
| Minimum subtotal | ₦50,000 |
| Maximum waived | ₦5,000 (customer pays any excess) |
| Geography | `FCT - Abuja` only |
| Mechanism | Dedicated rule engine; a `FIRSTDELIVERY` coupon doc acts as the on/off switch |
| Default when coupon doc absent | **ON** — the feature works on deploy; the doc exists to disable or time-box it |

`hold` is a saved cart rather than a purchase, so it does not burn the perk. `cancelled`
does not either. `pending`, `confirmed`, `processing`, `partially_shipped`, `shipped`,
`delivered` and `refunded` all do — a refunded order was still a real purchase.

This is deliberately stricter than the existing `Coupon.firstPurchaseOnly` method, which
counts only `completed`/`delivered` and can therefore be farmed by placing several orders
before any is delivered. That method is left untouched so other coupons keep their
current behaviour.

## Server

### `services/firstOrderPerk.helpers.js` — pure, the testable seam

```js
FIRST_ORDER_PERK = { couponCode: 'FIRSTDELIVERY', minSubtotal: 50000, maxWaiver: 5000, states: ['FCT - Abuja'] }

evaluateFirstOrderPerk({ signedIn, enabled, hasPriorOrder, subtotal, state, baseFee })
  → { eligible, waivedAmount, payableFee, reason }
```

`reason` ∈ `not_signed_in | disabled | already_purchased | below_minimum | outside_zone |
no_fee | ok`. The client renders per-reason copy, so the nudges ("add ₦12,000 more",
"sign in to claim") derive from this one function instead of being recomputed in the UI.

### `services/firstOrderPerk.service.js` — the DB half

- `hasPriorOrder(userId)` → `Order.exists({ user, status: { $nin: ['cancelled', 'hold'] } })`
- `isPerkEnabled()` → reads the `FIRSTDELIVERY` coupon; absent ⇒ enabled. Cached 60s so a
  shipping quote does not add a DB round-trip per keystroke.
- `resolveFirstOrderPerk({ user, subtotal, state, baseFee })` — composes both with the
  pure evaluator.

### `scripts/seed-first-order-perk.js`

Creates the coupon doc (`firstPurchaseOnly`, `autoApply`, `discountType: 'free_shipping'`)
so the perk appears in the existing admin coupon UI and accrues usage analytics.

### `GET /api/shipping/calculate`

Gains `optionalProtect` — it is currently anonymous, which is why it cannot tell who is
asking. Response keeps its shape and adds:

```
baseFee            what delivery actually costs
fee                what the customer pays (existing field, now net of waiver)
isFree             existing field, true when fully waived
firstOrderPerk     { eligible, waivedAmount, reason, minSubtotal, maxWaiver }
```

Checkout already branches on `isFree`, so its "Free Delivery" card and green summary row
light up without changes to that logic.

### `GET /api/shipping/first-order-perk` (new)

`optionalProtect`. No address or cart required — a cheap probe for the header bar and cart
banner. Returns `{ enabled, signedIn, eligible, alreadyPurchased, minSubtotal, maxWaiver, states }`.

### `POST /api/orders` (`createOrder`)

Server-authoritative. The client sends `shippingInfo.baseFee`; the server recomputes the
waiver from **that**, never from the already-reduced `shippingFee`, and persists
`shippingFee = payableFee`.

`totalAmount` is recomputed **only when the waiver applies**, leaving the untouched path
byte-identical — server and client subtotals legitimately diverge under pack pricing.

When the coupon doc exists, `recordUsage` fires so uptake shows in coupon analytics.

### Shipping-fee hardening (folded in)

`createOrder` currently accepts whatever `shippingFee` the client sends — anyone can post
`0`. The server now recomputes a zone-based floor with `calculateShipping(state, lga,
subtotal)` and rejects an under-quote that the waiver does not explain.

### `models/Order.js`

New `deliveryWaiver: { applied: Boolean, amount: Number, reason: String }`. Deliberately
**not** folded into `discountTotal`: `email.service.js` and revenue reconciliation sum that
field, and a shipping waiver is not an item discount.

## Client — `client/apps/platform`

- **`src/lib/first-order-perk.ts`** (+ `first-order-perk.test.mjs`, in the style of
  `cart-line.test.mjs`) — types and copy helpers. The ₦50,000 / ₦5,000 figures live only on
  the server and arrive in the API response, so there is no second copy to drift.
- **`src/context/FirstOrderPerkContext.tsx`** — fetches the probe endpoint once per
  auth-state change; added to `GlobalProvider`. All surfaces read it: one request, not three.
- **Checkout** — adds the missing `credentials: 'include'` to the `/api/shipping/calculate`
  fetch (without it the cookie never reaches the server and nobody is ever eligible),
  renders the waiver in the rate card and summary row, sends `baseFee`, and shows the
  signed-out nudge with a sign-in link that returns to checkout.
- **Cart page** — banner strip with three states: eligible, signed-out, below minimum.
- **Header** — `FirstOrderPerkBar` beside the existing `AnnouncementBanner` slot; renders
  only when eligible, dismissible via localStorage.

## Known limitation: the payment race

Gateways are initialised with a client-computed `total` before the order exists. Two
concurrent tabs both quote free delivery; only the first order should get it. The server is
authoritative at `createOrder`, so the second order records the real fee — but payment was
already captured at the lower amount. That order is stamped
`deliveryWaiver.reason = 'race_lost'` so it is visible in admin rather than silently
undercharged. Reserving the perk at payment-init would close it properly, at a cost of
machinery disproportionate to the frequency.

## Out of scope

- Guest-checkout waivers
- A bespoke admin editor for the perk (seeded coupon doc + existing coupon UI covers it)
- Changing how other coupons evaluate `firstPurchaseOnly`

## Testing

- `server/__tests__/firstOrderPerk.test.js` — the `evaluateFirstOrderPerk` matrix across
  every `reason`, cap boundaries, and the min-subtotal boundary.
- `client/apps/platform/src/lib/first-order-perk.test.mjs` — copy/state selection.
- Baselines that must not regress: server **1481/1484** (3 pre-existing failures, unrelated).
