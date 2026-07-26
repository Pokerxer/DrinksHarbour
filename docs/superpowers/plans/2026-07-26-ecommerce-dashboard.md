# E-Commerce Dashboard Period Filtering + Design Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a period selector to the `/ecommerce` dashboard driven by URL searchParams, fix two data defects in the analytics controller, and clean up the widget layer's dark-mode holes, dead code, and layout rhythm.

**Architecture:** A pure `resolvePeriod` helper on the server turns `?period=` into range and comparison windows; the controller's window-scoped aggregations consume those instead of hardcoded month boundaries. On the client, `page.tsx` forwards searchParams into the existing server-side fetch, and a `PeriodSwitcher` pushes the param inside a React transition — no new client data layer, no API token on the client.

**Tech Stack:** Node/Express + Mongoose (server, `node:test`), Next.js App Router RSC + React context + Tailwind (admin client, Vitest).

## Global Constraints

- Server tests use `node:test` — this repo does **not** use jest. Run with `npm test` from `server/` (`node --test __tests__/`).
- Admin client tests use Vitest. Run with `npm test` from `client/apps/admin/` (`vitest run`).
- Default period is `month`, which must reproduce the pre-change behaviour exactly. A no-param request is a regression test of the old behaviour.
- The dashboard endpoint must never 500 on a bad query string — all validation degrades to `month`.
- Order line items use the field `items.subproduct` (lowercase `p`).
- The `gray-*` Tailwind scale is theme-inverted via CSS variables — `text-gray-900`, `bg-gray-0` etc. are already dark-safe. Only literal colours (`bg-white`) and un-themed palettes (`amber/red/blue-50`) need `dark:` treatment.
- Do **not** remove `@ts-nocheck` pragmas; they cascade into the 479-error `tsc` baseline.
- Do **not** add a `{placedAt, status}` compound index — out of scope by decision.
- Spec: `docs/superpowers/specs/2026-07-26-ecommerce-dashboard-design.md`

---

## File Structure

**Server**
- Create `server/services/dashboardPeriod.helpers.js` — pure date-window resolution, no DB access, no Express coupling. Follows the existing `salesFulfill.helpers.js` pattern so it is unit-testable in isolation.
- Create `server/__tests__/dashboardPeriod.helpers.test.js`
- Modify `server/controllers/analytics.controller.js` — consume the helper, rewrite the Best Sellers aggregation, fix `avgOrderValue`, emit `meta`.

**Client**
- Modify `client/apps/admin/src/services/dashboard.service.ts` — period types, query-string builder, renamed payload fields.
- Create `client/apps/admin/src/services/dashboard.service.test.ts`
- Modify `client/apps/admin/src/app/(hydrogen)/ecommerce/page.tsx` — accept searchParams.
- Modify `.../shared/ecommerce/dashboard/use-dashboard.ts` — widen context, add `useDashboardMeta`.
- Modify `.../shared/ecommerce/dashboard/dashboard-provider.tsx` — carry meta + isRefreshing.
- Create `.../shared/ecommerce/dashboard/period-switcher.tsx` — client segmented control + refresh.
- Modify `.../shared/ecommerce/dashboard/index.tsx` — toolbar, layout bands, alert-chip dark mode.
- Modify 6 widgets for period labels; 2 widgets + nav header for dark mode.
- Delete 3 unused widget files.

---

### Task 1: Period resolution helper

**Files:**
- Create: `server/services/dashboardPeriod.helpers.js`
- Test: `server/__tests__/dashboardPeriod.helpers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolvePeriod(query, now) → { key, rangeStart, rangeEnd, prevStart, prevEnd, label, comparisonLabel }`. All four date fields are `Date` objects. `PERIOD_KEYS` is also exported as a string array.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/dashboardPeriod.helpers.test.js`:

```js
// server/__tests__/dashboardPeriod.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { resolvePeriod, PERIOD_KEYS } = require('../services/dashboardPeriod.helpers');

// Fixed reference point: Wed 15 Jul 2026, 13:45 local time.
const NOW = new Date(2026, 6, 15, 13, 45, 0, 0);

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('exports the seven supported period keys', () => {
  assert.deepStrictEqual(PERIOD_KEYS, ['today', '7d', '30d', 'month', 'quarter', 'year', 'custom']);
});

test('defaults to month and reproduces calendar-month boundaries', () => {
  const p = resolvePeriod({}, NOW);
  assert.strictEqual(p.key, 'month');
  assert.strictEqual(iso(p.rangeStart), '2026-07-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-31');
  assert.strictEqual(p.rangeStart.getHours(), 0);
  assert.strictEqual(p.rangeEnd.getHours(), 23);
  // month compares to the previous calendar month
  assert.strictEqual(iso(p.prevStart), '2026-06-01');
  assert.strictEqual(iso(p.prevEnd), '2026-06-30');
});

test('today compares to yesterday', () => {
  const p = resolvePeriod({ period: 'today' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-07-15');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-15');
  assert.strictEqual(iso(p.prevStart), '2026-07-14');
  assert.strictEqual(iso(p.prevEnd), '2026-07-14');
});

test('7d is an inclusive 7-day window ending today, compared to the prior 7 days', () => {
  const p = resolvePeriod({ period: '7d' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-07-09');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-15');
  assert.strictEqual(iso(p.prevStart), '2026-07-02');
  assert.strictEqual(iso(p.prevEnd), '2026-07-08');
});

test('30d is an inclusive 30-day window ending today', () => {
  const p = resolvePeriod({ period: '30d' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-06-16');
  assert.strictEqual(iso(p.rangeEnd), '2026-07-15');
  assert.strictEqual(iso(p.prevStart), '2026-05-17');
  assert.strictEqual(iso(p.prevEnd), '2026-06-15');
});

test('quarter uses calendar quarters and compares to the previous quarter', () => {
  const p = resolvePeriod({ period: 'quarter' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-07-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-09-30');
  assert.strictEqual(iso(p.prevStart), '2026-04-01');
  assert.strictEqual(iso(p.prevEnd), '2026-06-30');
});

test('year uses the calendar year and compares to the previous year', () => {
  const p = resolvePeriod({ period: 'year' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-01-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-12-31');
  assert.strictEqual(iso(p.prevStart), '2025-01-01');
  assert.strictEqual(iso(p.prevEnd), '2025-12-31');
});

test('custom honours an explicit from/to range', () => {
  const p = resolvePeriod({ period: 'custom', from: '2026-03-01', to: '2026-03-10' }, NOW);
  assert.strictEqual(p.key, 'custom');
  assert.strictEqual(iso(p.rangeStart), '2026-03-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-03-10');
  // previous window of equal length, ending the day before rangeStart
  assert.strictEqual(iso(p.prevEnd), '2026-02-28');
  assert.strictEqual(iso(p.prevStart), '2026-02-19');
});

test('custom swaps a reversed range', () => {
  const p = resolvePeriod({ period: 'custom', from: '2026-03-10', to: '2026-03-01' }, NOW);
  assert.strictEqual(iso(p.rangeStart), '2026-03-01');
  assert.strictEqual(iso(p.rangeEnd), '2026-03-10');
});

test('custom clamps a range longer than 366 days', () => {
  const p = resolvePeriod({ period: 'custom', from: '2020-01-01', to: '2026-03-10' }, NOW);
  const days = Math.round((p.rangeEnd - p.rangeStart) / 86400000);
  assert.ok(days <= 366, `expected <= 366 days, got ${days}`);
  assert.strictEqual(iso(p.rangeEnd), '2026-03-10');
});

test('degrades to month rather than throwing on bad input', () => {
  const monthStart = iso(resolvePeriod({}, NOW).rangeStart);
  for (const bad of [
    { period: 'nonsense' },
    { period: 'custom' },
    { period: 'custom', from: 'not-a-date', to: 'also-bad' },
    { period: 'custom', from: '2026-03-01' },
    { period: null },
  ]) {
    const p = resolvePeriod(bad, NOW);
    assert.strictEqual(p.key, 'month', `expected month fallback for ${JSON.stringify(bad)}`);
    assert.strictEqual(iso(p.rangeStart), monthStart);
  }
});

test('every period carries a human label and comparison label', () => {
  for (const key of PERIOD_KEYS) {
    const q = key === 'custom'
      ? { period: 'custom', from: '2026-03-01', to: '2026-03-10' }
      : { period: key };
    const p = resolvePeriod(q, NOW);
    assert.ok(p.label && typeof p.label === 'string', `${key} missing label`);
    assert.ok(p.comparisonLabel && typeof p.comparisonLabel === 'string', `${key} missing comparisonLabel`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/dashboardPeriod.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/dashboardPeriod.helpers'`

- [ ] **Step 3: Write minimal implementation**

Create `server/services/dashboardPeriod.helpers.js`:

```js
'use strict';

/**
 * Pure date-window resolution for the analytics dashboard.
 *
 * Separated from the controller so it can be unit-tested without a database,
 * following the same pattern as salesFulfill.helpers.js.
 *
 * Two comparison strategies:
 *   - Calendar-aligned periods (month/quarter/year) compare to the previous
 *     calendar unit, which preserves the dashboard's original behaviour.
 *   - Rolling periods (today/7d/30d/custom) compare to an equal-length window
 *     ending immediately before the range starts.
 */

const MS_DAY = 86_400_000;
const MAX_CUSTOM_DAYS = 366;

const PERIOD_KEYS = ['today', '7d', '30d', 'month', 'quarter', 'year', 'custom'];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Rolling comparison: same-length window ending the day before rangeStart. */
function rollingPrevious(rangeStart, dayCount) {
  const prevEnd = endOfDay(addDays(rangeStart, -1));
  const prevStart = startOfDay(addDays(prevEnd, -(dayCount - 1)));
  return { prevStart, prevEnd };
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function resolveCustom(query, now) {
  const from = new Date(query.from);
  const to = new Date(query.to);

  // Missing or unparseable dates → fall back to the default period.
  if (!query.from || !query.to || !isValidDate(from) || !isValidDate(to)) {
    return resolvePeriod({ period: 'month' }, now);
  }

  // Reversed range → swap.
  let [lo, hi] = from <= to ? [from, to] : [to, from];
  let rangeStart = startOfDay(lo);
  const rangeEnd = endOfDay(hi);

  // Clamp over-long ranges to bound aggregation cost, keeping the end fixed.
  const spanDays = Math.round((rangeEnd - rangeStart) / MS_DAY);
  if (spanDays > MAX_CUSTOM_DAYS) {
    rangeStart = startOfDay(addDays(rangeEnd, -(MAX_CUSTOM_DAYS - 1)));
  }

  const dayCount = Math.round((endOfDay(rangeEnd) - rangeStart) / MS_DAY) || 1;
  const { prevStart, prevEnd } = rollingPrevious(rangeStart, dayCount);

  const fmt = (d) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  return {
    key: 'custom',
    rangeStart,
    rangeEnd,
    prevStart,
    prevEnd,
    label: `${fmt(rangeStart)} – ${fmt(rangeEnd)}`,
    comparisonLabel: 'vs previous period',
  };
}

/**
 * @param {object} query   Express req.query (or any {period, from, to} bag)
 * @param {Date}   now     Reference "now", injectable for tests
 */
function resolvePeriod(query = {}, now = new Date()) {
  const raw = query && typeof query.period === 'string' ? query.period : '';
  const key = PERIOD_KEYS.includes(raw) ? raw : 'month';

  if (key === 'custom') return resolveCustom(query, now);

  if (key === 'today') {
    const rangeStart = startOfDay(now);
    return {
      key,
      rangeStart,
      rangeEnd: endOfDay(now),
      ...rollingPrevious(rangeStart, 1),
      label: 'Today',
      comparisonLabel: 'vs yesterday',
    };
  }

  if (key === '7d' || key === '30d') {
    const days = key === '7d' ? 7 : 30;
    const rangeStart = startOfDay(addDays(now, -(days - 1)));
    return {
      key,
      rangeStart,
      rangeEnd: endOfDay(now),
      ...rollingPrevious(rangeStart, days),
      label: `Last ${days} days`,
      comparisonLabel: `vs previous ${days} days`,
    };
  }

  if (key === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const rangeStart = startOfDay(new Date(now.getFullYear(), q * 3, 1));
    const rangeEnd = endOfDay(new Date(now.getFullYear(), q * 3 + 3, 0));
    const prevStart = startOfDay(new Date(now.getFullYear(), q * 3 - 3, 1));
    const prevEnd = endOfDay(new Date(now.getFullYear(), q * 3, 0));
    return { key, rangeStart, rangeEnd, prevStart, prevEnd, label: 'This quarter', comparisonLabel: 'vs last quarter' };
  }

  if (key === 'year') {
    const y = now.getFullYear();
    return {
      key,
      rangeStart: startOfDay(new Date(y, 0, 1)),
      rangeEnd: endOfDay(new Date(y, 11, 31)),
      prevStart: startOfDay(new Date(y - 1, 0, 1)),
      prevEnd: endOfDay(new Date(y - 1, 11, 31)),
      label: 'This year',
      comparisonLabel: 'vs last year',
    };
  }

  // 'month' — the default, matching the dashboard's original windows.
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    key: 'month',
    rangeStart: startOfDay(new Date(y, m, 1)),
    rangeEnd: endOfDay(new Date(y, m + 1, 0)),
    prevStart: startOfDay(new Date(y, m - 1, 1)),
    prevEnd: endOfDay(new Date(y, m, 0)),
    label: 'This month',
    comparisonLabel: 'vs last month',
  };
}

module.exports = { resolvePeriod, PERIOD_KEYS, MAX_CUSTOM_DAYS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/dashboardPeriod.helpers.test.js`
Expected: PASS — 12 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add server/services/dashboardPeriod.helpers.js server/__tests__/dashboardPeriod.helpers.test.js
git commit -m "feat(analytics): add resolvePeriod helper for dashboard date windows"
```

---

### Task 2: Wire the period into the controller

**Files:**
- Modify: `server/controllers/analytics.controller.js:57-116` (window setup + aggs #1/#2), `:146-157` (#8/#9), `:187-222` (#14/#15), `:243-264` (#17), `:410-449` (response)

**Interfaces:**
- Consumes: `resolvePeriod` from Task 1.
- Produces: response `data.statCards.period` and `data.statCards.previous` (each `{orders, revenue}`), plus top-level `data.meta = { period, label, comparisonLabel, rangeStart, rangeEnd }` where the dates are ISO strings.

- [ ] **Step 1: Import the helper and resolve the window**

In `server/controllers/analytics.controller.js`, add to the imports at the top (after the `webAnalyticsService` require on line 7):

```js
const { resolvePeriod } = require('../services/dashboardPeriod.helpers');
```

Then in `exports.getDashboard`, replace the month/range window declarations (lines 60-63, the `thisMonthStart`/`thisMonthEnd`/`lastMonthStart`/`lastMonthEnd` block) with:

```js
  // Selected reporting window (?period=today|7d|30d|month|quarter|year|custom).
  // Defaults to 'month', which reproduces the dashboard's original behaviour.
  const period = resolvePeriod(req.query, now);
  const { rangeStart, rangeEnd, prevStart, prevEnd } = period;
```

Leave `todayStart`, `todayEnd`, `yesterdayStart`, `yesterdayEnd`, and `yearStart` exactly as they are — the hero always means "today" regardless of the selected period, and the customer chart owns its own year window.

- [ ] **Step 2: Point the window-scoped aggregations at the range**

Make these substitutions inside the `Promise.all([...])` block. Each is a `$match` date bound only — no other part of the pipelines changes.

| Agg | Line | Change |
|---|---|---|
| #1 this-period revenue | ~107 | `placedAt: { $gte: thisMonthStart, $lte: thisMonthEnd }` → `placedAt: { $gte: rangeStart, $lte: rangeEnd }` |
| #2 previous revenue | ~113 | `placedAt: { $gte: lastMonthStart, $lte: lastMonthEnd }` → `placedAt: { $gte: prevStart, $lte: prevEnd }` |
| #8 status breakdown | ~148 | `placedAt: { $gte: thisMonthStart }` → `placedAt: { $gte: rangeStart, $lte: rangeEnd }` |
| #9 payment breakdown | ~154 | `placedAt: { $gte: thisMonthStart }` → `placedAt: { $gte: rangeStart, $lte: rangeEnd }` |
| #14 profit this period | ~189 | `placedAt: { $gte: thisMonthStart, $lte: thisMonthEnd }` → `placedAt: { $gte: rangeStart, $lte: rangeEnd }` |
| #15 profit previous | ~208 | `placedAt: { $gte: lastMonthStart, $lte: lastMonthEnd }` → `placedAt: { $gte: prevStart, $lte: prevEnd }` |
| #17 top vendors | ~245 | `placedAt: { $gte: thisMonthStart }` → `placedAt: { $gte: rangeStart, $lte: rangeEnd }` |

Deliberately **unchanged**: #3 today, #4 yesterday, #5 sparkline, #6 pending, #7 12-month sales, #11 recent orders, #12 low stock, #13 YTD customers, #16 12-month profit trend.

- [ ] **Step 3: Rename the derived variables**

Replace the stat-card derivation block (lines 269-276) with:

```js
  const periodOrders   = thisMonthAgg[0]?.orders  ?? 0;
  const periodRevenue  = thisMonthAgg[0]?.revenue ?? 0;
  const prevOrders     = lastMonthAgg[0]?.orders  ?? 0;
  const prevRevenue    = lastMonthAgg[0]?.revenue ?? 0;
  const todayOrders    = todayAgg[0]?.orders  ?? 0;
  const todayRevenue   = todayAgg[0]?.revenue ?? 0;
  const yestOrders     = yesterdayAgg[0]?.orders  ?? 0;
  const yestRevenue    = yesterdayAgg[0]?.revenue ?? 0;
```

Then in the profit block below it (lines 280-287), rename for clarity — these now describe the selected window, not the month:

```js
  const grossPeriod      = profitThisMonthAgg[0]?.grossRevenue   ?? 0;
  const vendorCostPeriod = profitThisMonthAgg[0]?.vendorCost     ?? 0;
  const platformProfit   = profitThisMonthAgg[0]?.platformProfit ?? 0;
  const lastGross        = profitLastMonthAgg[0]?.grossRevenue   ?? 0;
  const lastProfit       = profitLastMonthAgg[0]?.platformProfit ?? 0;
```

Note `orderCountThisMonth` and `avgOrderValue` are intentionally omitted here — Task 4 replaces them. Leave those two lines untouched for now so the file still runs.

- [ ] **Step 4: Update the response payload**

In the `res.json` block, replace the `statCards` object (lines 414-423) with:

```js
      statCards: {
        period:        { orders: periodOrders, revenue: periodRevenue },
        previous:      { orders: prevOrders,   revenue: prevRevenue   },
        today:         { orders: todayOrders,  revenue: todayRevenue  },
        yesterday:     { orders: yestOrders,   revenue: yestRevenue   },
        pendingOrders: pendingCount,
        lowStockCount,
        avgOrderValue,
        sparkline:     last7Days,
      },
```

And update the `profit` object's first four fields (lines 434-439) to the renamed variables:

```js
      profit: {
        thisMonth:    platformProfit,
        lastMonth:    lastProfit,
        // grossRevenue = total revenue across all active orders in the window
        grossRevenue: grossPeriod,
        vendorCost:   vendorCostPeriod,
```

Then add `meta` as a sibling of `statCards`, immediately before the closing `},` of the `data` object (after `topVendors,` on line 447):

```js
      meta: {
        period:          period.key,
        label:           period.label,
        comparisonLabel: period.comparisonLabel,
        rangeStart:      period.rangeStart.toISOString(),
        rangeEnd:        period.rangeEnd.toISOString(),
      },
```

- [ ] **Step 5: Verify the server starts and the default is unchanged**

Run: `cd server && node -e "require('./controllers/analytics.controller.js'); console.log('controller loads OK')"`
Expected: `controller loads OK` with no throw.

Run: `cd server && npm test`
Expected: PASS — the Task 1 suite still green, no new failures versus the baseline (project notes record 2 pre-existing SO-number failures; those may still fail).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/analytics.controller.js
git commit -m "feat(analytics): drive dashboard windows from ?period= query param"
```

---

### Task 3: Make Best Sellers time-scoped

**Files:**
- Modify: `server/controllers/analytics.controller.js:159-165` (agg #10), `:336-360` (topProducts mapping)

**Interfaces:**
- Consumes: `rangeStart`/`rangeEnd` from Task 2.
- Produces: unchanged `data.topProducts[]` shape — `{id, name, image, sku, sold, revenue, stock, stockStatus, margin, vendor}` — so no client change is required. Only the *meaning* of `sold`/`revenue` changes, from lifetime to windowed.

- [ ] **Step 1: Replace the lifetime SubProduct read with a windowed aggregation**

Replace aggregation #10 (the `SubProduct.find({...totalSold: {$gt: 0}})` block, lines 159-165) with:

```js
    // 10. Top 8 products sold *within the selected window*.
    //     Previously this read SubProduct.totalSold, a lifetime counter, so the
    //     widget never reflected any time period at all.
    Order.aggregate([
      { $match: { ...tenantFilter, ...sourceFilter, placedAt: { $gte: rangeStart, $lte: rangeEnd }, status: { $in: ACTIVE_STATUSES } } },
      { $unwind: '$items' },
      ...(isSuperAdmin ? [] : [{ $match: { 'items.tenant': req.user.tenant } }]),
      { $match: { 'items.subproduct': { $exists: true, $ne: null } } },
      { $group: {
        _id:     '$items.subproduct',
        sold:    { $sum: '$items.quantity' },
        revenue: { $sum: '$items.itemSubtotal' },
      }},
      { $sort: { sold: -1 } },
      { $limit: 8 },
      { $lookup: { from: 'subproducts', localField: '_id', foreignField: '_id', as: 'sp' } },
      { $unwind: { path: '$sp', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'products', localField: 'sp.product', foreignField: '_id', as: 'prod' } },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'tenants', localField: 'sp.tenant', foreignField: '_id', as: 'ten' } },
      { $unwind: { path: '$ten', preserveNullAndEmptyArrays: true } },
    ]),
```

The extra tenant `$match` after `$unwind` matters: the outer `tenantFilter` matches *orders containing* the tenant's items, so without it a multi-vendor order would leak other vendors' lines into a tenant's Best Sellers.

- [ ] **Step 2: Update the mapping to the new document shape**

Replace the `topProductsList` mapping (lines 337-360) with:

```js
  const topProductsList = topProductsAgg.map(row => {
    const sp = row.sp ?? {};
    // Margin = (baseSellingPrice - costPrice) / baseSellingPrice × 100
    const margin = (sp.baseSellingPrice && sp.costPrice && sp.baseSellingPrice > 0)
      ? Math.round(((sp.baseSellingPrice - sp.costPrice) / sp.baseSellingPrice) * 100)
      : null;
    return {
      id:          row._id,
      name:        row.prod?.name ?? sp.sku ?? 'Unknown product',
      image:       row.prod?.images?.[0]?.url ?? null,
      sku:         sp.sku ?? '',
      sold:        row.sold ?? 0,
      revenue:     row.revenue ?? 0,
      // Stock is point-in-time by nature — it has no meaningful historical value,
      // so it still comes from the SubProduct document rather than the window.
      stock:       sp.availableStock ?? 0,
      stockStatus: sp.stockStatus ?? 'in_stock',
      margin,
      vendor: row.ten ? {
        id:    row.ten._id,
        name:  row.ten.name,
        slug:  row.ten.slug,
        logo:  row.ten.logo?.url ?? null,
        color: row.ten.primaryColor ?? '#1a202c',
      } : null,
    };
  });
```

- [ ] **Step 3: Verify the controller still loads**

Run: `cd server && node -e "require('./controllers/analytics.controller.js'); console.log('controller loads OK')"`
Expected: `controller loads OK`

- [ ] **Step 4: Verify the collection names are right**

The `$lookup` stages use collection names, not model names. Confirm them:

Run: `cd server && node -e "const m=require('mongoose');['SubProduct','Product','Tenant'].forEach(n=>{require('./models/'+n);console.log(n,'->',m.model(n).collection.name)})"`
Expected: `SubProduct -> subproducts`, `Product -> products`, `Tenant -> tenants`. If any differs, correct the `from:` values in Step 1 to match.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/analytics.controller.js
git commit -m "fix(analytics): scope Best Sellers to the selected window

Aggregation #10 read SubProduct.totalSold, a lifetime counter, so the widget
never reflected any time period. Replaced with an Order-items aggregation over
the selected range, with a post-unwind tenant match so multi-vendor orders
don't leak other vendors' lines into a tenant's list."
```

---

### Task 4: Fix avgOrderValue's basis

**Files:**
- Modify: `server/controllers/analytics.controller.js:283-285`
- Modify: `client/apps/admin/src/app/shared/ecommerce/dashboard/stat-cards.tsx:93` (sub-label)

**Interfaces:**
- Consumes: `periodOrders`/`periodRevenue` from Task 2.
- Produces: `data.statCards.avgOrderValue` now equal to `round(periodRevenue / periodOrders)`, reconciling with the revenue card.

- [ ] **Step 1: Replace the mixed-basis computation**

Replace lines 283-285 (`orderCountThisMonth` and `avgOrderValue`) with:

```js
  // AOV must use the same basis as the revenue card — totalAmount over order
  // count. It previously divided the profit aggregation's grossRevenue (a sum of
  // items.itemSubtotal, which excludes shipping and tax) by a distinct order
  // count, so the two figures on screen could not be reconciled by the reader.
  const avgOrderValue = periodOrders > 0 ? Math.round(periodRevenue / periodOrders) : 0;
```

- [ ] **Step 2: Verify no orphaned reference remains**

Run: `cd server && grep -n "orderCountThisMonth\|grossThisMonth\|vendorCostThisMonth\|thisMonthStart\|lastMonthStart\|thisMonthEnd\|lastMonthEnd" controllers/analytics.controller.js`
Expected: no output. Any hit is a leftover from Task 2 or 4 and must be updated to the new variable names before continuing.

- [ ] **Step 3: Correct the misleading client sub-label**

In `client/apps/admin/src/app/shared/ecommerce/dashboard/stat-cards.tsx`, the Avg Order Value card's `sub` field reads `'from paid orders'`, but the filter is `ACTIVE_STATUSES` (pending, confirmed, processing, shipped, delivered) — not paid. Change line 93 from:

```tsx
      sub: 'from paid orders',
```

to:

```tsx
      sub: 'across active orders',
```

- [ ] **Step 4: Verify**

Run: `cd server && node -e "require('./controllers/analytics.controller.js'); console.log('OK')" && npm test`
Expected: `OK`, then the suite passes at baseline.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/analytics.controller.js client/apps/admin/src/app/shared/ecommerce/dashboard/stat-cards.tsx
git commit -m "fix(analytics): compute AOV on the same basis as the revenue card

AOV divided the profit aggregation's grossRevenue (items.itemSubtotal, which
excludes shipping and tax) by a separate order count, so it could not be
reconciled with the totalAmount revenue shown beside it."
```

---

### Task 5: Client service layer

**Files:**
- Modify: `client/apps/admin/src/services/dashboard.service.ts`
- Test: `client/apps/admin/src/services/dashboard.service.test.ts`

**Interfaces:**
- Consumes: the `meta` and `period`/`previous` payload from Tasks 2-4.
- Produces:
  - `type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'quarter' | 'year' | 'custom'`
  - `interface PeriodMeta { period: PeriodKey; label: string; comparisonLabel: string; rangeStart: string; rangeEnd: string }`
  - `interface DashboardParams { period?: string; from?: string; to?: string }`
  - `buildDashboardQuery(params: DashboardParams): string` — returns `''` or `'?period=...'`
  - `getDashboardData(token: string, params?: DashboardParams): Promise<DashboardData>`
  - `DashboardData.statCards.period` / `.previous`, and `DashboardData.meta: PeriodMeta`

- [ ] **Step 1: Write the failing test**

Create `client/apps/admin/src/services/dashboard.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDashboardQuery, PERIOD_KEYS } from './dashboard.service';

describe('buildDashboardQuery', () => {
  it('returns an empty string when no params are given', () => {
    expect(buildDashboardQuery({})).toBe('');
    expect(buildDashboardQuery({ period: undefined })).toBe('');
  });

  it('serialises a simple period key', () => {
    expect(buildDashboardQuery({ period: '30d' })).toBe('?period=30d');
  });

  it('drops an unrecognised period rather than forwarding it', () => {
    expect(buildDashboardQuery({ period: 'nonsense' })).toBe('');
  });

  it('includes from/to only for the custom period', () => {
    expect(buildDashboardQuery({ period: 'custom', from: '2026-03-01', to: '2026-03-10' }))
      .toBe('?period=custom&from=2026-03-01&to=2026-03-10');
    // from/to are meaningless without period=custom and must not be forwarded
    expect(buildDashboardQuery({ period: '7d', from: '2026-03-01', to: '2026-03-10' }))
      .toBe('?period=7d');
  });

  it('drops custom when from or to is missing', () => {
    expect(buildDashboardQuery({ period: 'custom', from: '2026-03-01' })).toBe('');
    expect(buildDashboardQuery({ period: 'custom' })).toBe('');
  });

  it('exposes the same seven keys the server accepts', () => {
    expect(PERIOD_KEYS).toEqual(['today', '7d', '30d', 'month', 'quarter', 'year', 'custom']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client/apps/admin && npx vitest run src/services/dashboard.service.test.ts`
Expected: FAIL — `buildDashboardQuery` is not exported from `./dashboard.service`

- [ ] **Step 3: Write the implementation**

In `client/apps/admin/src/services/dashboard.service.ts`, add after the `authHeaders` function (line 5):

```ts
export const PERIOD_KEYS = ['today', '7d', '30d', 'month', 'quarter', 'year', 'custom'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export interface PeriodMeta {
  period:          PeriodKey;
  label:           string;
  comparisonLabel: string;
  rangeStart:      string;
  rangeEnd:        string;
}

export interface DashboardParams {
  period?: string;
  from?:   string;
  to?:     string;
}

/**
 * Serialise dashboard params into a query string. Unknown periods are dropped
 * rather than forwarded — the server also degrades to its default, but there is
 * no reason to send a request we already know is meaningless.
 */
export function buildDashboardQuery(params: DashboardParams): string {
  const { period, from, to } = params;
  if (!period || !PERIOD_KEYS.includes(period as PeriodKey)) return '';

  if (period === 'custom') {
    if (!from || !to) return '';
    return `?period=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  return `?period=${period}`;
}
```

Then change the `StatCards` interface (lines 14-23) — rename the first two fields:

```ts
export interface StatCards {
  period:        { orders: number; revenue: number };
  previous:      { orders: number; revenue: number };
  today:         { orders: number; revenue: number };
  yesterday:     { orders: number; revenue: number };
  pendingOrders: number;
  lowStockCount: number;
  avgOrderValue: number;
  sparkline:     SparklineDay[];
}
```

Add `meta` to `DashboardData` (after `topVendors` on line 121):

```ts
  meta:             PeriodMeta;
```

And replace `getDashboardData` (lines 124-129) with:

```ts
export async function getDashboardData(token: string, params: DashboardParams = {}): Promise<DashboardData> {
  const qs   = buildDashboardQuery(params);
  const res  = await fetch(`${API_URL}/api/analytics/dashboard${qs}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await res.json() as { success: boolean; message?: string; data: DashboardData };
  if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load dashboard');
  return data.data;
}
```

`cache: 'no-store'` matters — without it the refresh button would return a cached payload.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client/apps/admin && npx vitest run src/services/dashboard.service.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/services/dashboard.service.ts client/apps/admin/src/services/dashboard.service.test.ts
git commit -m "feat(dashboard): add period params to the dashboard service"
```

---

### Task 6: Thread searchParams through to the context

**Files:**
- Modify: `client/apps/admin/src/app/(hydrogen)/ecommerce/page.tsx`
- Modify: `client/apps/admin/src/app/shared/ecommerce/dashboard/index.tsx:33-47`
- Modify: `client/apps/admin/src/app/shared/ecommerce/dashboard/use-dashboard.ts`
- Modify: `client/apps/admin/src/app/shared/ecommerce/dashboard/dashboard-provider.tsx`

**Interfaces:**
- Consumes: `getDashboardData(token, params)`, `PeriodMeta`, `DashboardParams` from Task 5.
- Produces:
  - `useDashboard(): DashboardData | null` — **signature unchanged**, so the 12 existing widgets need no edit.
  - `useDashboardMeta(): PeriodMeta | null`
  - `useDashboardRefreshControl(): { isRefreshing: boolean; setRefreshing: (v: boolean) => void }`
  - `DashboardProvider` props: `{ data: DashboardData | null; children: React.ReactNode }`

- [ ] **Step 1: Widen the context**

Replace the whole of `use-dashboard.ts` with:

```ts
'use client';

import { createContext, useContext } from 'react';
import type { DashboardData, PeriodMeta } from '@/services/dashboard.service';

export interface DashboardContextValue {
  data: DashboardData | null;
  meta: PeriodMeta | null;
  isRefreshing: boolean;
  setRefreshing: (v: boolean) => void;
}

export const DashboardContext = createContext<DashboardContextValue>({
  data: null,
  meta: null,
  isRefreshing: false,
  setRefreshing: () => {},
});

/** Unchanged signature — existing widgets consume this as-is. */
export function useDashboard(): DashboardData | null {
  return useContext(DashboardContext).data;
}

/** Period labels, for widgets that display which window they are showing. */
export function useDashboardMeta(): PeriodMeta | null {
  return useContext(DashboardContext).meta;
}

/** Used by the period switcher to flag an in-flight transition, and by
 *  DashboardBody to dim the widgets while one is pending. */
export function useDashboardRefreshControl() {
  const { isRefreshing, setRefreshing } = useContext(DashboardContext);
  return { isRefreshing, setRefreshing };
}
```

- [ ] **Step 2: Update the provider to own the refreshing flag**

Replace the whole of `dashboard-provider.tsx` with:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { DashboardContext } from './use-dashboard';
import type { DashboardData } from '@/services/dashboard.service';

export default function DashboardProvider({
  data,
  children,
}: {
  data: DashboardData | null;
  children: React.ReactNode;
}) {
  const [isRefreshing, setRefreshing] = useState(false);

  const value = useMemo(
    () => ({ data, meta: data?.meta ?? null, isRefreshing, setRefreshing }),
    [data, isRefreshing]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
```

- [ ] **Step 3: Accept searchParams on the page**

Replace the whole of `app/(hydrogen)/ecommerce/page.tsx` with:

```tsx
// @ts-nocheck
import EcommerceDashboard from '@/app/shared/ecommerce/dashboard';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('E-Commerce'),
};

export default function eCommerceDashboardPage({
  searchParams,
}: {
  searchParams?: { period?: string; from?: string; to?: string };
}) {
  return <EcommerceDashboard searchParams={searchParams} />;
}
```

- [ ] **Step 4: Forward the params into the fetch**

In `dashboard/index.tsx`, change the component signature and fetch call. Replace lines 33-41:

```tsx
export default async function EcommerceDashboard({
  searchParams,
}: {
  searchParams?: { period?: string; from?: string; to?: string };
}) {
  let dashboardData = null;
  let userName = 'Admin';
  let isTenantUser = false;

  try {
    const user = await getAuthenticatedUser();
    if (user?.token) {
      dashboardData = await getDashboardData(user.token as string, {
        period: searchParams?.period,
        from:   searchParams?.from,
        to:     searchParams?.to,
      });
```

The rest of the `try`/`catch` is unchanged.

- [ ] **Step 5: Update the two widgets reading the renamed fields**

In `stat-cards.tsx` line 55, change the destructure:

```tsx
  const { period, previous, today, yesterday, pendingOrders, lowStockCount, avgOrderValue, sparkline } = data.statCards;
```

Then update lines 57-60 and the two `metric` fields that referenced the old names:

```tsx
  const ordersPct    = pct(period.orders,  previous.orders);
  const revenuePct   = pct(period.revenue, previous.revenue);
  const avgPrevious  = previous.orders > 0 ? Math.round(previous.revenue / previous.orders) : 0;
  const avgPct       = pct(avgOrderValue, avgPrevious);
```

Line 67 `metric: thisMonth.orders.toLocaleString()` → `metric: period.orders.toLocaleString()`
Line 79 `metric: fmt(thisMonth.revenue)` → `metric: fmt(period.revenue)`

In `tenant-revenue-widget.tsx` lines 63-70, rename the three reads:

```tsx
  const periodRevenue = data?.statCards?.period?.revenue ?? 0;
  const prevRevenue   = data?.statCards?.previous?.revenue ?? 0;
  const periodOrders  = data?.statCards?.period?.orders ?? 0;
```

and update the `pct(...)` call and any downstream uses of `thisMonth`/`lastMonth`/`thisMonthOrders` in that file to the new names.

- [ ] **Step 6: Verify nothing still references the old field names**

Run: `cd client/apps/admin && grep -rn "statCards\?\?\.\?thisMonth\|statCards\.thisMonth\|statCards\.lastMonth\|thisMonthOrders" src/`
Expected: no output.

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -c "error TS"`
Expected: a count at or below the 479-error baseline recorded in the project notes. If it rose, the delta is from this task — fix before committing.

- [ ] **Step 7: Commit**

```bash
git add client/apps/admin/src/app/\(hydrogen\)/ecommerce/page.tsx client/apps/admin/src/app/shared/ecommerce/dashboard/
git commit -m "feat(dashboard): thread period searchParams into the server fetch"
```

---

### Task 7: Period switcher + toolbar

**Files:**
- Create: `client/apps/admin/src/app/shared/ecommerce/dashboard/period-switcher.tsx`
- Modify: `client/apps/admin/src/app/shared/ecommerce/dashboard/index.tsx` (insert the toolbar in both layout branches)

**Interfaces:**
- Consumes: `useDashboardMeta` / `useDashboardRefreshControl` from Task 6. (The switcher defines its own `PRESETS` list rather than importing `PERIOD_KEYS`, because `custom` has no button — it is reachable only via the URL.)
- Produces: default-exported `<PeriodSwitcher />` (self-contained, no props) and a named `<DashboardBody>` wrapper, both from `period-switcher.tsx`.

- [ ] **Step 1: Write the component**

Create `period-switcher.tsx`:

```tsx
'use client';

import { useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { PiArrowClockwiseBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useDashboardMeta, useDashboardRefreshControl } from './use-dashboard';

/** Only the presets get a button; `custom` is driven by the URL, not this control. */
const PRESETS: { key: string; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: '7d',      label: '7 days' },
  { key: '30d',     label: '30 days' },
  { key: 'month',   label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year',    label: 'Year' },
];

export default function PeriodSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const meta = useDashboardMeta();
  const { setRefreshing } = useDashboardRefreshControl();

  // Mirror the transition state into context so widgets can dim themselves.
  useEffect(() => {
    setRefreshing(isPending);
  }, [isPending, setRefreshing]);

  const active = meta?.period ?? 'month';

  function select(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'month') {
      // 'month' is the server default — keep the URL clean.
      params.delete('period');
    } else {
      params.set('period', key);
    }
    // from/to only ever apply to the custom period.
    params.delete('from');
    params.delete('to');

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Reporting period"
        className="inline-flex items-center rounded-lg border border-muted bg-gray-0 p-0.5"
      >
        {PRESETS.map(({ key, label }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => select(key)}
              aria-pressed={isActive}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-[#b20202] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {meta?.period === 'custom' && (
        <span className="rounded-lg border border-muted bg-gray-0 px-2.5 py-1.5 text-xs font-medium text-gray-700">
          {meta.label}
        </span>
      )}

      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        aria-label="Refresh dashboard data"
        className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-gray-0 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <PiArrowClockwiseBold className={cn('h-3.5 w-3.5', isPending && 'animate-spin motion-reduce:animate-none')} />
        Refresh
      </button>

      <span aria-live="polite" className="sr-only">
        {isPending ? 'Loading dashboard data' : `Showing ${meta?.label ?? 'this month'}`}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add the dimming wrapper**

Widgets must dim rather than collapse to skeletons during a transition, or the whole page jumps. Append this named export to the bottom of `period-switcher.tsx` — the file already carries `'use client'` at the top, so do not repeat the directive:

```tsx
export function DashboardBody({ children }: { children: React.ReactNode }) {
  const { isRefreshing } = useDashboardRefreshControl();
  return (
    <div
      className={cn(
        'transition-opacity duration-200 motion-reduce:transition-none',
        isRefreshing && 'pointer-events-none opacity-60'
      )}
      aria-busy={isRefreshing}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Mount the toolbar in both layouts**

In `dashboard/index.tsx`, add the import:

```tsx
import PeriodSwitcher, { DashboardBody } from '@/app/shared/ecommerce/dashboard/period-switcher';
```

Insert the toolbar directly after the hero block (after the closing `</div>` of the `-mx-4 ...` wrapper, around line 74), so it is shared by both branches:

```tsx
        <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-muted bg-gray-0/95 px-4 py-3 backdrop-blur md:-mx-5 md:px-5 lg:-mx-6 lg:px-6 3xl:-mx-8 3xl:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-500">
              Showing <span className="font-semibold text-gray-900">{dashboardData?.meta?.label ?? 'This month'}</span>
            </p>
            <PeriodSwitcher />
          </div>
        </div>
```

Then wrap each layout branch's root element in `<DashboardBody>`. For the tenant branch, change `<div className="space-y-6 3xl:space-y-8">` to be wrapped:

```tsx
          <DashboardBody>
            <div className="space-y-6 3xl:space-y-8">
              {/* ...existing tenant content unchanged... */}
            </div>
          </DashboardBody>
```

And likewise wrap the admin branch's `<div className="grid grid-cols-1 gap-6 ...">` in `<DashboardBody>`.

- [ ] **Step 4: Verify it builds and behaves**

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -c "error TS"`
Expected: at or below baseline.

Manual check — start the dev server, open `/ecommerce`:
- clicking "30 days" puts `?period=30d` in the URL and the numbers change
- clicking "Month" removes the param entirely
- the browser back button restores the previous range
- during the switch, widgets dim rather than flashing skeletons
- Refresh spins and re-fetches without changing the URL

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/dashboard/
git commit -m "feat(dashboard): add period switcher and refresh toolbar"
```

---

### Task 8: Period labels on windowed widgets

**Files:**
- Modify: `stat-cards.tsx`, `best-sellers.tsx`, `top-vendors.tsx`, `payment-methods.tsx`, `order-status-breakdown.tsx`, `tenant-revenue-widget.tsx` (all under `client/apps/admin/src/app/shared/ecommerce/dashboard/`)

**Interfaces:**
- Consumes: `useDashboardMeta()` from Task 6.
- Produces: no new exports — presentation only.

- [ ] **Step 1: Label the stat cards**

In `stat-cards.tsx`, import the hook alongside the existing one:

```tsx
import { useDashboard, useDashboardMeta } from './use-dashboard';
```

Inside the component, after `const data = useDashboard();`:

```tsx
  const meta = useDashboardMeta();
  const periodLabel = meta?.label ?? 'This month';
  const comparisonLabel = meta?.comparisonLabel ?? 'vs last month';
```

Replace the two hardcoded titles — line 66 `title: 'Orders This Month'` → `title: \`Orders · ${periodLabel}\``, and line 78 `title: 'Revenue This Month'` → `title: \`Revenue · ${periodLabel}\``.

Then replace the hardcoded comparison text at line 153:

```tsx
                <Text as="span" className="hidden @[240px]:inline-flex">
                  {stat.increased ? 'up' : 'down'} {comparisonLabel}
                </Text>
```

- [ ] **Step 2: Label the four WidgetCard widgets**

Each of `best-sellers.tsx`, `top-vendors.tsx`, `payment-methods.tsx`, and `order-status-breakdown.tsx` renders a `<WidgetCard title="...">`. In each file:

1. Add `useDashboardMeta` to the existing `./use-dashboard` import.
2. Inside the component add:

```tsx
  const meta = useDashboardMeta();
```

3. Add a `description` prop to the `WidgetCard`, which `WidgetCard` already supports as a subtitle:

```tsx
      description={meta?.label ?? 'This month'}
      descriptionClassName="text-xs text-gray-500"
```

- [ ] **Step 3: Label the tenant revenue widget**

`tenant-revenue-widget.tsx` already sets `descriptionClassName` on its WidgetCard (line 87), so only its comparison copy needs updating. Find any hardcoded "vs last month" / "this month" strings in that file and replace with `meta?.comparisonLabel` / `meta?.label`, adding the `useDashboardMeta` import as above.

- [ ] **Step 4: Verify no hardcoded period copy survives**

Run:
```bash
cd client/apps/admin/src/app/shared/ecommerce/dashboard && grep -rn "This Month\|this month\|last month\|Last Month" *.tsx
```
Expected: only fallback defaults of the form `?? 'This month'` / `?? 'vs last month'`. Any remaining hardcoded title or comparison string is a miss — fix it.

- [ ] **Step 5: Confirm WidgetCard accepts `description`**

Run: `cd client/apps/admin && grep -n "description" ../../packages/isomorphic-core/src/components/cards/widget-card.tsx`
Expected: a `description` prop in the component's props type. If it is absent, render the label as a small `<Text>` inside the card's `action` slot instead.

- [ ] **Step 6: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/dashboard/
git commit -m "feat(dashboard): label windowed widgets with the selected period"
```

---

### Task 9: Dark-mode fixes

**Files:**
- Modify: `client/apps/admin/src/app/shared/ecommerce/ecommerce-nav-header.tsx:248`
- Modify: `.../dashboard/stat-cards.tsx:31`
- Modify: `.../dashboard/index.tsx:104,114`
- Modify: `.../dashboard/recent-order.tsx:26-32,128`

**Interfaces:** none — styling only.

- [ ] **Step 1: Fix the nav header's literal white**

In `ecommerce-nav-header.tsx` line 248, change:

```tsx
    className="relative mb-0 flex items-center border-b border-gray-200 bg-white"
```

to:

```tsx
    className="relative mb-0 flex items-center border-b border-muted bg-gray-0"
```

`bg-gray-0` is the theme-inverted token (white in light, black in dark); `border-muted` matches what the rest of the dashboard uses.

- [ ] **Step 2: Fix the skeleton card**

In `stat-cards.tsx` line 31, change `bg-white` to `bg-gray-0`:

```tsx
    <div className="animate-pulse rounded-2xl border border-muted bg-gray-0 p-5">
```

The trailing `dark:bg-gray-100/20` becomes redundant once `bg-gray-0` is used, so drop it.

- [ ] **Step 3: Fix the alert chips**

In `dashboard/index.tsx`, the pending-orders chip (line 104):

```tsx
                  className="ms-auto flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
```

and the low-stock chip (line 114):

```tsx
                  className={`flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 ${pendingOrders > 0 ? '' : 'ms-auto'}`}
```

- [ ] **Step 4: Fix recent-order's payment styles**

In `recent-order.tsx`, replace the `PAY_STYLE` map (lines 26-32) so it matches the `dark:` pattern `STATUS_STYLE` directly above it already uses:

```tsx
const PAY_STYLE: Record<string, string> = {
  paid:               'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending:            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  failed:             'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  partially_refunded: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  refunded:           'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};
```

And the registered-user badge at line 128:

```tsx
                        <span title="Registered user" className="shrink-0 rounded bg-blue-50 p-0.5 dark:bg-blue-900/30">
```

Also update the two fallbacks in the JSX from `'bg-gray-100 text-gray-600'` to `'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'`.

- [ ] **Step 5: Verify**

Run: `cd client/apps/admin/src/app/shared/ecommerce && grep -n "bg-white" dashboard/*.tsx ecommerce-nav-header.tsx`
Expected: no output.

Manual check: toggle the app to dark mode and confirm the nav bar, alert chips, payment badges, and loading skeletons all read correctly.

- [ ] **Step 6: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/dashboard/ client/apps/admin/src/app/shared/ecommerce/ecommerce-nav-header.tsx
git commit -m "fix(dashboard): close dark-mode holes in nav, chips, and payment badges"
```

---

### Task 10: Remove dead code

**Files:**
- Delete: `.../dashboard/promotional-sales.tsx`, `.../dashboard/user-location.tsx`, `.../dashboard/tenant-banner.tsx`
- Modify: `.../dashboard/recent-order.tsx:4-6`

**Interfaces:**
- Produces: `OrdersDataType` continues to be exported from `recent-order.tsx`, now derived from the real `RecentOrder` service type rather than the mock fixture.

- [ ] **Step 1: Confirm the three files have no importers**

Run:
```bash
cd client/apps/admin/src && for f in promotional-sales user-location tenant-banner; do
  echo -n "$f: "; grep -rl "$f" --include="*.tsx" --include="*.ts" . | grep -v "dashboard/$f.tsx" | tr '\n' ' '; echo "(none if blank)";
done
```
Expected: blank for all three. **If any file has an importer, do not delete it** — report and stop.

- [ ] **Step 2: Delete them**

```bash
cd client/apps/admin/src/app/shared/ecommerce/dashboard
git rm promotional-sales.tsx user-location.tsx tenant-banner.tsx
```

- [ ] **Step 3: Drop the mock-data import**

In `recent-order.tsx`, replace lines 4-6:

```tsx
import { orderData } from '@/data/order-data';
// Re-export for backwards compat with columns.tsx and table components
export type OrdersDataType = (typeof orderData)[number];
```

with:

```tsx
import type { RecentOrder as RecentOrderType } from '@/services/dashboard.service';
// Re-export for backwards compat with columns.tsx and table components
export type OrdersDataType = RecentOrderType;
```

- [ ] **Step 4: Verify nothing broke**

Run: `cd client/apps/admin && grep -rn "OrdersDataType" src/ | head`
Expected: the consumers still resolve. Then:

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -c "error TS"`
Expected: at or below baseline. If `OrdersDataType` consumers relied on fields the mock had but `RecentOrder` lacks, errors will surface here — in that case revert this step's type change and keep the mock import, noting it in the commit.

- [ ] **Step 5: Commit**

```bash
git add -A client/apps/admin/src/app/shared/ecommerce/dashboard/
git commit -m "chore(dashboard): delete unused widgets and the mock order-data import"
```

---

### Task 11: Admin layout banding

**Files:**
- Modify: `client/apps/admin/src/app/shared/ecommerce/dashboard/index.tsx` (admin branch only, the `else` block)

**Interfaces:** none — layout only. Every widget keeps its current props except `className`.

- [ ] **Step 1: Regroup the admin branch into bands**

Replace the admin branch's single 12-column grid with five banded sections. The widgets, their order of importance, and their roles are unchanged — only the grouping and vertical rhythm change:

```tsx
          /* ── ADMIN LAYOUT ───────────────────────────────────────────── */
          <DashboardBody>
            <div className="space-y-6 3xl:space-y-8">
              {/* Band 1 — welcome + KPIs + profit */}
              <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">
                <WelcomeBanner
                  title={
                    <>
                      {greeting}, <br /> {userName}{' '}
                      <HandWaveIcon className="inline-flex h-8 w-8" />
                    </>
                  }
                  description={
                    todayOrders !== null
                      ? `Today: ${todayOrders} order${todayOrders !== 1 ? 's' : ''} · ${fmtRev(todayRevenue ?? 0)} revenue. Here's your store at a glance.`
                      : "Here's what's happening in your store today. See the statistics at once."
                  }
                  media={
                    <div className="absolute -bottom-6 end-4 hidden w-[300px] @2xl:block lg:w-[320px] 2xl:-bottom-7 2xl:w-[330px]">
                      <div className="relative">
                        <Image
                          src={welcomeImg}
                          alt="Welcome shop image"
                          className="dark:brightness-95 dark:drop-shadow-md"
                        />
                      </div>
                    </div>
                  }
                  contentClassName="@2xl:max-w-[calc(100%-340px)]"
                  className="border border-muted bg-gray-0 pb-8 @4xl:col-span-2 @7xl:col-span-8 dark:bg-gray-100/30 lg:pb-9"
                >
                  <div className="flex items-center gap-3">
                    <Link href={addProductHref} className="inline-flex">
                      <Button as="span" className="h-[38px] shadow md:h-10">
                        <PiPlusBold className="me-1 h-4 w-4" /> Add Product
                      </Button>
                    </Link>
                    <Link href={routes.eCommerce.orders} className="inline-flex">
                      <Button as="span" variant="outline" className="h-[38px] md:h-10">
                        <PiStorefrontDuotone className="me-1 h-4 w-4" /> Orders
                      </Button>
                    </Link>
                  </div>
                </WelcomeBanner>

                <StatCards className="@2xl:grid-cols-2 @3xl:grid-cols-4 @3xl:gap-6 @4xl:col-span-2 @7xl:col-span-8" />

                <ProfitWidget className="h-[464px] @sm:h-[520px] @7xl:col-span-4 @7xl:col-start-9 @7xl:row-start-1 @7xl:row-end-3 @7xl:h-full" />
              </div>

              {/* Band 2 — trend */}
              <div className="grid grid-cols-1 gap-6 @7xl:grid-cols-12 3xl:gap-8">
                <SalesReport className="@7xl:col-span-8" />
                <OrderStatusBreakdown className="@7xl:col-span-4" />
              </div>

              {/* Band 3 — operational */}
              <RecentOrder className="relative w-full" />

              {/* Band 4 — analysis */}
              <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">
                <BestSellers className="@7xl:col-span-4" />
                <TopVendors className="@7xl:col-span-4" />
                <PaymentMethods className="@7xl:col-span-4" />
              </div>

              {/* Band 5 — customers + inventory */}
              <RepeatCustomerRate className="w-full" />
              <StockReport className="w-full" />
            </div>
          </DashboardBody>
```

Note the bands each own their own grid, so a tall widget in one band no longer creates dead space in another — that was the source of the uneven rhythm.

- [ ] **Step 2: Verify**

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -c "error TS"`
Expected: at or below baseline.

Manual check at several widths (mobile, tablet, 1440px, ultrawide): no horizontal overflow, no orphaned dead space, and the widget order still reads KPI → trend → orders → analysis → inventory.

- [ ] **Step 3: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/dashboard/index.tsx
git commit -m "refactor(dashboard): regroup the admin grid into layout bands"
```

---

## Final verification

- [ ] **Server suite**

Run: `cd server && npm test`
Expected: the new `dashboardPeriod.helpers` tests pass; total failures no worse than the recorded baseline (2 pre-existing SO-number failures).

- [ ] **Client suite**

Run: `cd client/apps/admin && npm test`
Expected: the new `dashboard.service` tests pass; the 65 existing admin tests still green.

- [ ] **Type check**

Run: `cd client/apps/admin && npx tsc --noEmit 2>&1 | grep -v "\.next/types" | grep -c "error TS"`
Expected: at or below the 479-error baseline.

- [ ] **End-to-end smoke (manual, both roles)**

As a platform admin and again as a tenant user:
- each of the six presets changes the numbers and the URL
- Best Sellers now changes between periods — the defect this plan fixes
- AOV × order count reconciles with the revenue card
- the hero's "Today" figures stay constant across period changes (they are intentionally absolute)
- the sparkline and 12-month trend charts also stay constant (intentionally fixed-window)
- light and dark themes both render correctly
- back button restores the previous period
