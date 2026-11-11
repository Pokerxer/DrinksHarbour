---
title: SubProduct Purchased/Sold counters computed from Orders and PurchaseOrders
date: 2026-11-11
status: fix shipped (detail stamping + expand-time stats endpoint), suites green
---

# Sub-product "Purchased 0 / Sold 0" — counters now agree with their panels

## Report (2026-11-11, Sunblessed Vinho Branco)

Detail toolbar showed **Purchased 0 / Sold 0** while the Purchase History panel
held 1 PO / 1,200 units and the Sales History panel 6 orders (₦2.5M). The list's
expanded row showed **Total Sold 0 / Total Revenue ₦0** for the same product.

## Root cause

The toolbar (`create-edit/index.tsx`) and expanded row
(`ExpandedSubProductRow.tsx`) read the SubProduct DOCUMENT's analytics fields:

- `SubProduct.totalSold` is incremented by exactly ONE code path — the POS
  controller (`pos.controller.js`). Marketplace/ERP sales never touch it. This
  gap is already documented in `services/orderDemand.helper.js` (98.5% of live
  products tie at zero).
- `SubProduct.purchaseCount` has **no increment path anywhere** in the codebase.

Meanwhile the drill-down panels compute real records live:
`/api/orders?subProductId=` (matches `items.subproduct`, any status) and
`/api/purchase-orders?subProductId=` (matches `tenant` + `items.subProductId`,
any status). Counter and panel disagreed by construction.

## Fix (TDD; parity rule: a counter equals what its panel's "All" view shows)

1. **`server/services/subproductStats.js` (new)** — source-of-truth stats,
   ONE aggregation per collection, bounded by an id set:
   - sold units/revenue: Orders `$match items.subproduct $in` → `$unwind` →
     re-match → `$group` sum `items.quantity` / `items.itemSubtotal`
   - purchased units: PurchaseOrders `$match {tenant?, items.subProductId $in}`
     → `$unwind` → re-match → `$group` sum `items.quantity`
   - failures degrade to zeros; missing ids read zero, never undefined
2. **Detail stamping** — `subProductService.getSubProduct` now stamps
   `totalSold` / `totalRevenue` / `purchaseCount` from the live stats (the
   toolbar already read those keys; no client change needed there).
3. **`GET /api/subproducts/:id/stats` (new route + controller +
   `getSubProductStatsFor` service)** — ownership-checked (404 for another
   tenant's listing), returns `{ totalSold, totalRevenue, purchaseCount }`.
4. **List expanded row fetches on expand** — the Sub-Products list loads the
   WHOLE catalog (`limit: 5000`, client-side filtering), so per-row stamping on
   every list load was off the table (M0 connection budget, DRI-40).
   `ExpandedSubProductRow` fetches stats on mount (falls back to payload
   counters on failure); `table.tsx` passes the session token; new
   `subproductService.getSubProductStats`.

## Tests (all written first, watched RED)

- `__tests__/subproductStats.test.js` — pipeline shapes, ObjectId casting
  (string `$in` silently matches nothing), zero defaults, error resilience
- `__tests__/subproductDetailStats.mongo.test.js` — real replica fixture:
  2+3 units sold across order lines (a third line for another subproduct must
  not leak), 1,200 + 10 (draft included) purchased, ANOTHER TENANT's PO for the
  same subproduct excluded
- `expanded-row-stats.test.tsx` (vitest/jsdom) — fetch-on-expand renders live
  numbers; failure keeps the row rendering
- Green: 41/41 subproduct suites (fixture URI set), 225/225
  platformBeverageGate/product/brand/order/purchase/db suites, 327/327 client
  sub-product + service vitest, `tsc --noEmit` clean

## Deliberately unchanged

- The stored `totalSold`/`purchaseCount` schema fields still exist (other
  surfaces — POS catalogue sort, popularity ranking — read them); only the
  sub-product detail/expanded-row views now compute past them.
- Marketplace ranking still uses `orderDemand.helper.js`; making checkout
  write `totalSold` remains the documented "durable fix" there.
