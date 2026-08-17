# RESUME — `₦NaN` on POS cart line totals

Status: **open. Render path pinned. Every named suspect now DISPROVEN against
live data — the search space is empty, not narrow.**
Date: 2026-08-17 (2nd pass) · predates the offline-images work

This bug degrades to a *plausible wrong result*, not an error: nothing throws,
nothing logs, a cashier just sees `₦NaN` where money should be.

---

## What is confirmed

**The render path.** `client/apps/admin/src/app/shared/point-of-sale/components/pos-cart.tsx:1812`
renders `{formatCurrency(lineTotal)}`, and `formatCurrency` (`point-of-sale/utils.ts:8`)
is `Intl.NumberFormat(...).format(amount)`. `Intl` formats `NaN` as the literal
string `NaN`, so the ₦ glyph is prepended to it and you get `₦NaN`. There is no
guard anywhere on this path.

**`Math.max` does not sanitise.** The line math is:

```
pos-cart.tsx:1690  lineGross    = effectivePrice * item.quantity
pos-cart.tsx:1692  itemDiscAmt  = (lineGross * Math.max(0, Math.min(100, item.discount))) / 100
pos-cart.tsx:1710  lineTotal    = Math.max(0, lineGross - itemDiscAmt - bundleDiscAmt)
```

`Math.min(100, NaN)` is `NaN` and `Math.max(0, NaN)` is `NaN`. The `Math.max(0, …)`
at line 1710 *looks* like a floor that would catch this and does not. So **any one**
of `effectivePrice`, `item.quantity` or `item.discount` being `NaN`/`undefined`
poisons the whole line.

---

## DISPROVEN, 2026-08-17 — asked the database instead of arguing

A read-only scan of the live Atlas database (`drinksharbour`). Every one of these
would have to hold a non-finite or absent number for the cart to render `NaN`.
**None does.**

| Checked | Result |
|---|---|
| POS `Order.items` — `priceAtPurchase`, `quantity`, `itemSubtotal` | 6 POS orders (19 orders total), **0 bad items** |
| `SalesOrder.items` — `unitPrice`, `quantity` | 4 docs, **0 bad lines** |
| `SubProduct.baseSellingPrice` where `visibleInPOS` | 962 docs, **0 missing/null** |
| `Size.sellingPrice` | 987 docs, **0 missing/null** |
| `Pricelist.rules` numeric fields | 1 pricelist, **0 non-numeric** |
| `Tenant.posSettings.buyXGetY` | **0 rewards configured on any tenant** |

The scan brute-forced every document rather than relying on `$type`, because
BSON stores `NaN` as a double and no `$type` query can express it.

**This kills the previous session's leading suspects.** `pos-sell-orders.tsx:677`
and `pos-history.tsx:566` read `item.priceAtPurchase` unguarded, but there is no
order in the database for which that field is anything but a finite number — so
the theory is not merely "contradicted by the schema", it is contradicted by the
data. Do not add `?? 0` there hoping it fixes this; it would fix nothing and
close the file on a bug that is still live.

Re-runnable script: this session's scratchpad, `nan-evidence.js`. It writes
nothing. Run it from `server/` (module resolution is by file location, so it
must sit inside `server/` to find `dotenv`/`mongoose` — copy it in, run, delete).

## Also ruled out, by reading every writer

Every construction and mutation site for `price` / `quantity` / `discount` was
walked. All of these are guarded and cannot originate a `NaN`:

- `pos-sell.tsx:120` grid add — `_priceBeforePricelist ?? sellingPrice ?? baseSellingPrice`;
  the server sends `computePOSPricing(...).sellingPrice`, which is `?? 0` guarded
  at `pos.controller.js:364`.
- The dialpad, `pos-cart.tsx:1457` — `parseFloat(input) || 0`. A cashier typing
  `.` or `-` alone yields `0`, not `NaN`.
- `pos-combo-picker.tsx:469/479` — reads `sp.baseSellingPrice` / `sz.sellingPrice`
  unguarded, but `/api/pos/combos` (`pos.routes.js:209`) writes them as
  `computePrice(...) || sp.baseSellingPrice || 0`.
- `salesOrderToCartItems` / `agreedUnitPrice` — `Number(x) || 0` throughout.
- BXGY injection, `store/index.ts:1088,1112` — `?? 0` guarded.
- `applyRuleTransform` / `findMatchingPricelistRules` / `applyPricelistToProduct`
  — `Number(x) || 0` throughout; a `NaN` price passes through unchanged but none
  is created.
- `computeRewardDiscount`'s `Math.min(...items.map(i => i.price))` is guarded by
  a `.length` check, so it cannot return `Infinity`.

## Still theoretically reachable, but no live trigger

- `computeBxgyGroupItems` (`store/index.ts:596-624`) guards `buyQty`/`getQty`
  with `?? 1`, which does **not** catch `0`, and its `if (sets === 0) return []`
  does not catch `NaN`/`Infinity`. A stored reward with `buyQty: 0` would make
  `needBuy = sets * buyQty` be `NaN`, and every injected get-item would carry
  `quantity: NaN`. The BXGY editor clamps both to ≥1 (`pos-loyalty.tsx:2540,2570`),
  the Tenant schema declares `min: 1`, and **no tenant has any BXGY reward
  configured**, so this is latent, not the cause.
- The BXGY get-item row (`pos-cart.tsx:1737-1744`) is the one line-total render
  in the cart with **no `?? 0` on any input** — `originalPrice * (discPct/100)`.
  Same conclusion: latent, no configured rewards.

## The remaining live hypothesis — the persisted cart

The cart lives in `localStorage` via jotai `atomWithStorage`
(`store/index.ts:234-247`, keys `dh-pos-carts-retail` / `dh-pos-carts-wholesale`).
Nothing validates a rehydrated cart.

`JSON.stringify` **silently drops any key whose value is `undefined`**. A line
written during a degraded window — which is exactly what the original report
describes, the stale-backend period with the `WarehouseStock` cast error — comes
back from storage with `price` simply *absent*, and stays that way through every
reload, forever, because no code path re-validates or re-prices a stored line.
That matches every observed property of this bug: it appeared while the backend
was broken, it survived the restart, and it cannot be reproduced from clean data.

**Confirming it needs one thing and only one thing:** read
`localStorage['dh-pos-carts-retail']` (and `-wholesale`) on the terminal that
shows `₦NaN`, before clearing anything. If a line has no `price` key, or a
`null`/`undefined` `price`/`quantity`/`discount`, that is the answer and the fix
is a sanitising rehydration boundary. Clearing the cart destroys the evidence.

## Next step — still reproduce, do not patch

Needs POS access, which no session has had: `/pos/sell` is inside the
`src/middleware.ts` matcher (line 301) and additionally behind the cashier lock
screen (`point-of-sale/pos-lock-screen.tsx`), so it needs an admin login for the
tenant **and** a cashier PIN. Asked for and descoped on 2026-08-17.

With access, in order:

1. **Read `localStorage` first** (above). One `JSON.parse` answers the question.
2. Only if that is clean: add a line to the cart and read the item object, not
   the rendered string — assert on `price`, `quantity`, `discount` and
   `getEffectiveBundlePrice(item).price` individually, because they collapse into
   one `NaN` at line 1690 and the UI cannot tell you which one it was.

Once the origin is identified: fix at the source, and add the failing case as a
test. `pos-cart.tsx` is a component and admin vitest is `environment: 'node'`
with no jsdom, so the assertion has to live in extracted pure logic — the same
constraint that produced `pos-sales-order-lines.ts` and `pos-product-window.ts`.

## Found while looking — a different, definitely-live money bug

The hold/recall round-trip destroys every line's price and discount, so a
recalled held order renders at `₦0.00`. Root-caused and unrelated to `NaN`; its
own file: [`RESUME-pos-hold-recall-price-loss.md`](./RESUME-pos-hold-recall-price-loss.md).
