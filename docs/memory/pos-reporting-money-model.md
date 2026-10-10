---
name: pos-reporting-money-model
description: Who owns each POS money figure (server vs client), the tender-vs-commercial split, and the four landmines that made POS reports overstate revenue
type: fact
---

# POS reporting: one authority per money figure

Fixed 2026-09-29. Before this, `pos-order-analysis.tsx` computed every figure
itself from a single `limit: 500` page of the order list, and the same measure
had four different implementations across the chart, the pivot and the group table.

## The split

There are exactly **two** money authorities. Do not add a third.

| Authority | File | Owns |
|---|---|---|
| **Server** | `server/services/posReturnTotals.service.js` → `posReportOrder.service.js` | What each receipt *is*: `netSales`, `returnDeduction`, `grossRevenue`, `tipAmount`, `roundingAmount`, `netCollections`, per-line `netSales` / `costPriceAtPurchase` / `discountAmount` |
| **Client** | `client/.../point-of-sale/analysis/measures.ts` | How to *group* those figures: every measure, every pivot cell, every KPI, every chart series |

`applyMeasure(measure, scope)` is the only measure implementation. If you add a
measure, add it there — never in a component.

**The analysis endpoint returns compact rows, not pre-aggregated KPIs.** That is
deliberate: a server-side aggregation would be a third implementation, and the
headline figure would eventually disagree with the chart built from the same receipts.

## Tender basis ≠ commercial basis

This is the distinction the old code got wrong repeatedly.

- **Commercial** (`netSales`, `grossRevenue`) = what the goods sold for. **Excludes** gratuities and cash rounding.
- **Tender** (`netCollections`, `total`) = what the customer actually handed over. Goods **+** tip ± rounding.

A tip is not product income. A rounding kobo is not income. They are reported
as their own measures (`tips`, `rounding`) so bar staff earnings never inflate
revenue.

## The four landmines

1. **Silent truncation.** The page pulled `limit: 500` and derived every KPI from
   it. Past 500 receipts each figure was quietly wrong with nothing on screen
   saying so. Now `GET /api/pos/orders/analysis` returns the whole period plus
   `meta.truncated`; the page renders a banner when it is partial. **Never
   reintroduce a page-size limit into a report.**

2. **Discounts double-counted, or not counted.** Discounts live in two places: a
   per-line `discountAmount` and a receipt-footer `discountTotal`. The footer
   total is *already deducted* from `netSales` server-side, so profit must
   **not** subtract it again. Report both separately: `total_discount` (footer)
   and `line_discount`.

3. **Profit from an uncosted line.** Using the *current* `sizeCostPrice` for a
   past sale is hindsight. Use `costPriceAtPurchase`. When a line has no cost
   snapshot, **exclude it** and report it as `uncostedRevenue` — booking a
   never-costed line at 100% margin is worse than showing a gap.

4. **Split tender counted twice.** A receipt split cash+card was fanned into
   *both* method buckets, and the chart divided by `total` (which includes the
   tip) while the grouping did not — so the two disagreed with each other.
   Rule: `paymentAttribution()` credits the method that took the most money, to
   exactly one of them. Proportional allocation was rejected because it must be
   applied to revenue, quantity, line count and profit separately, and any
   missed field makes the totals not add up.

## Also

- `subtotal` is **tax-inclusive** in this codebase. It is not "gross revenue".
- Item-level grouping must report **that item's** figures, not the whole basket.
- Date dimensions all use the **local** calendar. Mixing `toISOString()` for the
  day with local getters for the week put a late-evening sale in a different day
  bucket than the week containing it.
- Walk-ins are reported as `walkInSales`, never folded into a customer count.
  Keying customers on `phone` collapsed every walk-in into one identity.

## A card row must reconcile

`pos-orders.tsx` sat three summary cards side by side — Gross Sales, Refunds,
Net Revenue — and none of them agreed:

- Gross Sales summed `total`, which includes gratuities and cash rounding.
- Refunds counted only cash, so goods restocked through Sales were invisible.
- Net Revenue used the commercial basis.

So `Gross − Refunds` was never `Net Revenue`, and no arithmetic on screen could
make it so. They now all come from `summariseOrders()` (`orders-summary.ts`),
which derives gross from the two figures that must tie:

```
grossSales = netRevenue + returns      // therefore gross − returns === net
```

**If you add a card, add it to `summariseOrders` and keep that identity.** A card
computed inline in the component is how the three drifted apart in the first place.

`orderStatus()` also matters: a return is judged on the **commercial** figures.
Comparing `returnDeduction` against `total` mixed the two bases, so a fully
returned receipt carrying a gratuity could never satisfy `returned >= total` and
was permanently mislabelled "Part. Returned".

## Completeness is a fact the server states

`GET /api/pos/orders` clamps `limit` (ceiling 2,000, `services/posPage.service.js`)
and now returns a `meta` block — `matched`, `included`, `limit`, `missing`,
`truncated`. The client's `getAllOrders` returns `{ data, meta }`.

**Never infer completeness from a row count.** The bug this replaced:

```ts
setTruncated(!all && rows.length === 500);   // 500 was the server's clamp
```

"Load all" asked for 2,000, the server clamped it to 500, the client received 500
rows, and `!all` made it *clear the warning*. The user was told the day was
complete while looking at the newest 500 receipts. Every list page now renders
`meta.truncated` and states how many of how many are shown.

A missing `meta` means **unknown**, not complete — fall back to the conservative
reading. `pos-sell-orders` reads through the offline wrapper (IndexedDB), where
there is no server `meta` at all, so it assumes partial at the page ceiling.

## Two `getAllOrders` — do not confuse them

- `posApi.getAllOrders(token, params)` → `{ data, meta }`. The server-backed list.
- `offline/api.ts` `getAllOrders(token, shopId)` → `OrderRecord[]`, served from
  IndexedDB when offline, no `meta`. It is a **cache fill**, not a report, so a
  bounded result there is a cache-size decision rather than a wrong figure.

## A sales-details line reconciles the same way a card does

`sales-details` is a **line-level** view, so its money model is the line's share
of the receipt:

```
grossShare − returnedValue === netSales      // server-enforced, exact
```

`orderLineNetTotals()` (server) returns per line the commercial share and the
returned value, with the identity above guaranteed by construction. A gratuity is
never "returned value" — the share is taken from the **commercial** gross
(`services/posReturnTotals.service.js`), and a direct test pins that a receipt
with a 20 tip has returnedValue 0.

`summariseLines()` (client) aggregates those into the strip, where the identity
becomes `gross − returns === revenue`. **A discount is disclosed, not subtracted**
— the net figure already has it taken out, and presenting it as a step between
gross and net asks the user to double-subtract.

If you touch a feature that reports a line or group of lines, keep these, in order:

1. **Line cost comes from the purchase-time snapshot** (`costPriceAtPurchase`),
   falling back to `sizeCostPrice` only for legacy lines. `sizeCostPrice` is the
   Size model's *current* cost — using it for a historical profit report rewrites
   history every time a cost price is edited. `report-totals.lineCost()` is the
   single precedence rule.
2. **Uncosted revenue is a disclosed gap, not a 0% margin.** `hasCost: false`,
   profit 0, `uncostedRevenue` surfaced in the summary/PDF/PDF tiles. Margin is
   ALWAYS `profit / costedRevenue`, never over total revenue, or uncosted lines
   drag the reported margin below what real stock actually earned.
3. **Losses are shown.** The old cells hid `profit <= 0` — a real loss printed an
   em dash. Losses render red and negative; only an uncosted line shows the dash.
4. **Split tender is one method per line.** A split receipt is attributed to the
   method that took the most money (`paymentAttribution`), and every export names
   each leg (e.g. `Cash 2000.00 + Card/POS 8000.00`) so the file can be
   reconciled against the till.

The sales-details export chain is `csv.ts` (serves CSV **and** PDF cell values),
`excel.ts`, `pdf-utils.ts` — three surfaces that must stay in lockstep with the
screen. `PdfMeta.summary` is literally the same `LinesSummary` type the strip
renders.


## VAT at the till

Tax was quotation-only, so an ordinary tenant paid no VAT. Now the tenant
setting decides:

- `posSettings.taxEnabled` (default **false** — Nigeria levies VAT only above a
  turnover threshold, so a default-on switch would overtax small bars) and
  `posSettings.taxRate`.
- `server/services/posTax.service.js` and
  `client/.../store/cart-tax.ts` **must agree exactly** — the server recomputes
  and returns 409 if the till's total differs, so drift refuses the sale. Both
  carry a duplicated `PARITY` table of expected numbers on purpose.
- A quotation's agreed rate always wins, **including an explicit zero** — a
  zero-rated quotation is a real instruction.
- `showTaxOnReceipt` (print a breakdown) is deliberately *not* the same switch as
  `taxEnabled` (charge VAT). Printing a breakdown must never invent tax.
