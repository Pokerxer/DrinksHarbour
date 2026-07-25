# E-Commerce Dashboard — Period Filtering + Design Pass

**Date:** 2026-07-26
**Scope:** `/ecommerce` dashboard page (admin app) and its backing analytics endpoint
**Status:** Design approved, ready for implementation planning

## Problem

The `/ecommerce` dashboard renders once, server-side, against a fixed set of time
windows hardcoded in the controller. There is no way to ask it "how did last
quarter go?" — every number is "this month" or "today", and the only way to get
fresh data is a full page reload.

Reading the controller to plan that change surfaced two data defects worth
fixing in the same pass, plus a set of visual inconsistencies that have
accumulated in the widget layer.

### Current architecture

```
app/(hydrogen)/ecommerce/page.tsx        (server, no searchParams)
  └─ app/shared/ecommerce/dashboard/index.tsx   (server; getAuthenticatedUser → getDashboardData)
       └─ DashboardProvider                      (client context, DashboardData | null)
            ├─ EcommerceNavHeader                (role-aware nav)
            ├─ EcommerceHero                     (tenant-accent gradient strip)
            └─ 12 widgets consuming useDashboard()
```

Two layout branches inside `index.tsx`: **tenant** (quick actions, alert chips,
orders-first) and **admin** (welcome banner + 12-column widget grid). Both are
kept distinct — they serve genuinely different jobs.

### Time semantics in `analytics.controller.js`

The 17 parallel aggregations mix three different kinds of time window. This
distinction drives the entire server design:

| Kind | Aggregations | Follows the period selector? |
|---|---|---|
| Window-scoped | #1 revenue, #2 prev revenue, #8 status breakdown, #9 payment breakdown, #14/#15 profit, #17 top vendors | **Yes** |
| Fixed-window | #5 7-day sparkline, #7 12-month sales, #16 12-month profit, #13 YTD customers | **No** — each is its own chart with an intrinsic window |
| Point-in-time | #6 pending count, #11 recent orders, #12 low-stock count | **No** — no window at all |
| Lifetime (defect) | #10 best sellers | **Yes, after rewrite** — see defect 1 below |

### Data defects found

1. **Best Sellers is not time-scoped at all.** Aggregation #10 reads
   `SubProduct.totalSold` / `totalRevenue`, which are *lifetime* counters. The
   widget has never reflected any time period, despite sitting among widgets
   that all claim "this month".

2. **`avgOrderValue` mixes bases.** It is computed as
   `grossRevenue / orderCount` from the *profit* aggregation, where
   `grossRevenue` sums `items.itemSubtotal` (excludes shipping and tax). The
   revenue card beside it sums `totalAmount` (includes them). The two figures
   cannot be reconciled by the reader. Its sub-label also says "from paid
   orders" when the filter is actually `ACTIVE_STATUSES`.

## Approach

**URL `searchParams` driving the existing RSC fetch.** `?period=30d` on the
page; `page.tsx` forwards it to `getDashboardData`; a client `PeriodSwitcher`
pushes the param inside `useTransition`.

Chosen over a client-side SWR layer (would duplicate the data path and either
regress first paint or require `fallbackData` duplication) and over a hybrid of
the two (two data paths to keep in sync forever, unjustified at this size).
This approach adds no new data layer, keeps the API token server-side, and
makes a range shareable and bookmarkable with a working back button. The cost
is one server round-trip per period change.

## Design

### 1. Server — `server/controllers/analytics.controller.js`

**Contract:** `GET /api/analytics/dashboard?period=<key>[&from=&to=]`

`period` ∈ `today | 7d | 30d | month | quarter | year | custom`, defaulting to
`month`, which reproduces today's behaviour exactly.

A new `resolvePeriod(query, now)` helper returns
`{ key, rangeStart, rangeEnd, prevStart, prevEnd, label, comparisonLabel }`.

**Comparison window rules:**

- Calendar-aligned keys compare to the previous calendar unit — `month` →
  previous calendar month (identical to current behaviour), `quarter` →
  previous quarter, `year` → previous year.
- Rolling keys (`7d`, `30d`, `custom`) compare to an equal-length window ending
  immediately before `rangeStart`.
- `today` → yesterday.

**Validation degrades, never fails.** A dashboard must not 500 on a bad query
string:

- unknown `period` key → fall back to `month`
- `custom` with missing or unparseable `from`/`to` → fall back to `month`
- `from > to` → swap them
- custom range longer than 366 days → clamp, to bound aggregation cost

**Aggregation changes:**

- #1 → `rangeStart`/`rangeEnd`; #2 → `prevStart`/`prevEnd`
- #8, #9, #14, #17 → range; #15 → prev window
- #3, #4, #5, #6, #7, #11, #12, #13, #16 → unchanged. The hero always means
  "today" regardless of the selected period, and the trend charts own their
  windows.

**Best Sellers (#10) rewritten** from the lifetime `SubProduct` read to an
Order-items aggregation over the selected window:

```
$match { tenantFilter, sourceFilter, placedAt: {$gte: rangeStart, $lte: rangeEnd},
         status: {$in: ACTIVE_STATUSES} }
$unwind '$items'
$group  { _id: '$items.subproduct', sold: {$sum: '$items.quantity'},
          revenue: {$sum: '$items.itemSubtotal'} }
$sort   { sold: -1 }
$limit  8
$lookup → SubProduct (name, image, sku, stock, stockStatus, margin inputs)
```

Note the schema field is `items.subproduct` (lowercase `p`). Stock and
stockStatus continue to come from the SubProduct document, since those are
point-in-time by nature and have no meaningful historical value here.

**`avgOrderValue` fixed** to `period.revenue / period.orders` — the same
`totalAmount` basis the revenue card uses, so the two reconcile. Sub-label
corrected to reflect the actual `ACTIVE_STATUSES` filter.

**Response shape:**

- `statCards.thisMonth` → `statCards.period`
- `statCards.lastMonth` → `statCards.previous`
- new top-level `meta: { period, label, comparisonLabel, rangeStart, rangeEnd }`

Renaming is safe: `getDashboardData` has exactly one consumer
(`dashboard/index.tsx`), and `thisMonth`/`lastMonth` appear in only two widgets
(`stat-cards.tsx`, `tenant-revenue-widget.tsx`).

**Known performance caveat (not addressed):** the range `$match`es filter on
`placedAt` + `status`, and no compound index covers that pair — the existing
indexes are `{user: 1, placedAt: -1}` and `{'items.tenant': 1, status: 1}`. At
current data volume this is acceptable. Adding an index speculatively, without
a measurement showing it is needed, is not part of this work.

### 2. Frontend plumbing

- **`page.tsx`** accepts `searchParams` and passes `period`/`from`/`to` through.
- **`services/dashboard.service.ts`** gains the query-string builder, a
  `PeriodMeta` type, and the renamed `period`/`previous` fields.
- **`period-switcher.tsx`** (new, client) — segmented control that
  `router.push`es the param inside `useTransition`. A refresh button beside it
  calls `router.refresh()`. Both live in a sticky toolbar under the hero,
  shared by the admin and tenant layouts.
- **`DashboardContext`** widens from `DashboardData | null` to
  `{ data, meta, isRefreshing }`. While a transition is pending, widgets dim to
  ~60% opacity rather than collapsing back to skeletons — no layout jump.
- **`useDashboard()` keeps its current signature** returning `data`, so the
  widgets that don't care about labels need no edit. A new `useDashboardMeta()`
  serves labels to the six widgets that do: `stat-cards`,
  `tenant-revenue-widget`, `best-sellers`, `top-vendors`, `payment-methods`,
  `order-status-breakdown`.

### 3. Design pass

**Dark-mode holes.** The `gray-*` scale here is theme-inverted through CSS
variables (`--gray-900` is `17 17 17` light, `241 241 241` dark), so
`text-gray-900` and friends are already correct. The genuine holes are literal
and un-themed colours:

- `ecommerce-nav-header.tsx:248` — literal `bg-white` on the nav bar
- `stat-cards.tsx:31` — literal `bg-white` in the skeleton card
- `index.tsx:104,114` — `bg-amber-50` / `bg-red-50` alert chips
- `recent-order.tsx:128` — `bg-blue-50`, and the whole `PAY_STYLE` map, which
  lacks `dark:` variants that the `STATUS_STYLE` map directly above it has

Fix by switching literals to the themed `bg-gray-0` and adding `dark:` variants
that match the pattern `STATUS_STYLE` already establishes.

**Dead code.** `promotional-sales.tsx`, `user-location.tsx`, and
`tenant-banner.tsx` have zero importers anywhere in the app — roughly 260 lines
to delete. Also `recent-order.tsx`'s `import { orderData } from '@/data/order-data'`,
which exists solely to re-export a type; it should derive from the real
`RecentOrder` interface instead.

**Layout rhythm.** The admin 12-column grid mixes widget heights with no
banding. Regroup into KPI → trend → operational → analysis → inventory bands:
same widgets, same roles, coherent vertical rhythm. The tenant layout keeps its
orders-first shape.

**Labels.** Every window-scoped WidgetCard shows the period label as a
subtitle, so a card reads "Best Sellers · Last 30 days" and the reader is never
guessing which window they are looking at.

## Out of scope

- Removing the `@ts-nocheck` pragmas — cascades into the 479-error `tsc`
  baseline recorded in the project notes.
- Adding a `{placedAt, status}` compound index — see the caveat above.
- Export / download of dashboard data.
- Unrelated refactoring of the widget layer.

## Testing

- **Server:** tests use `node:test` (this repo does not use jest). Unit tests
  for `resolvePeriod` covering each period key, the
  calendar-vs-rolling comparison rules, and every degradation path (unknown
  key, bad custom dates, reversed range, over-long range). Integration test
  that `?period=30d` and no-param produce different windows and that the
  no-param result matches the pre-change `month` behaviour.
- **Best Sellers:** test that the new aggregation is window-sensitive — seed
  orders inside and outside a window and assert the excluded ones do not
  appear. This is the regression the current lifetime-counter read cannot catch.
- **`avgOrderValue`:** assert it equals `period.revenue / period.orders` on
  seeded data, i.e. that it reconciles with the revenue card.
- **Frontend:** the repo uses Vitest for admin tests. Cover the query-string
  builder and `useDashboardMeta` label derivation. The layout/visual changes
  are verified by browser smoke test, not unit tests.
- Manual smoke: switch periods, confirm the URL updates, back button restores
  the previous range, widgets dim rather than jump, and both the admin and
  tenant branches render correctly in light and dark themes.
