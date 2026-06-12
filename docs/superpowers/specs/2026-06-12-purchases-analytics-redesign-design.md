# Purchases Analytics Redesign — Phase 1

## Goal

Port the design, functionality, and analytical logic of `/point-of-sale/order-analysis`
(`pos-order-analysis.tsx`, ~4,860 lines — an Odoo-style ad-hoc analysis tool) onto
`/purchases/analytics` (`purchases-analytics.tsx`, ~1,148 lines), and fix the data
plumbing it depends on.

Given the size of the reference implementation, work is split into three phases.
**This spec covers Phase 1 only.**

- **Phase 1 (this spec):** bug fixes, expanded group-by dimensions (incl.
  category/subcategory/brand), 2-level grouping with stacked charts, sort controls,
  saved searches, and a PO drill-down drawer with a read-only PO summary panel.
- **Phase 2 (future):** Odoo-style hierarchical pivot table view (expand/collapse,
  heatmap, CSV/Excel export).
- **Phase 3 (future):** secondary KPI/breakdown dashboard (status/vendor/product
  charts, monthly trend, approval breakdown) using `purchaseAnalyticsService`.

## Background / Current Bugs

`purchases-analytics.tsx` imports `PurchaseAnalyticsSummary` from
`app/shared/purchases/types.ts`, which defines:

```ts
interface PurchaseAnalyticsSummary {
  totalOrders: number;
  totalSpend: number;
  pendingBills: number;
  pendingBillsAmount: number;
  overdueAmount: number;
  topVendors: { vendorName: string; totalSpend: number; orderCount: number }[];
}
```

But `purchaseAnalyticsService.getSummary()` (in
`services/purchaseAnalytics.service.ts`) actually returns a **differently-shaped**
`PurchaseAnalyticsSummary`:

```ts
interface PurchaseAnalyticsSummary {
  totalPOs: number;
  totalAmount: number;
  statusBreakdown: { draft: number; confirmed: number; received: number; validated: number; cancelled: number };
  approvalBreakdown: { pending: number; approved: number; rejected: number };
  topVendors: { name: string; count: number; amount: number }[];
  monthlyTrend: { month: string; count: number; amount: number }[];
  pendingApprovals: number;
  sizeBreakdown: {...}[];
  topProducts: {...}[];
}
```

Result: `summary?.pendingBills`, `summary?.overdueAmount` are always `undefined`,
and the "Top Vendors by Spend" table renders `undefined` for every cell
(`v.vendorName`, `v.totalSpend`, `v.orderCount` don't exist on the real objects).

**Fix:** import the correct type from `purchaseAnalytics.service.ts`, fix the
Top Vendors table to use `name` / `count` / `amount`, and replace the broken
"Pending Bills" KPI card with **"Pending Approvals"** (`summary.pendingApprovals`,
a real field already computed server-side).

## File Structure

Split the current single 1,148-line file into four focused files (mirrors how
the rest of `app/shared/purchases/` is organized):

1. **`purchases-analytics.tsx`** — main page component: state, data fetching,
   page layout, control bar, filter/group-by/saved-search panel, KPI cards,
   top-vendors table.
2. **`purchases-analytics-helpers.ts`** — types, constants (`PALETTE`, `MEASURES`,
   `GROUP_BY_ITEMS`, `GROUP_BY_DATE_ITEMS`, `FILTER_STATIC`, `IS_CURRENCY`),
   `applyFilters`, `computeGroupData`, `computeMultiSeries`, formatting helpers
   (`fmtNaira`, `fmtCompact`, `fmtAxisVal`, `fmtMeasureVal`, `buildDateFilterItems`),
   `ProdMeta` type + helpers for resolving group keys per `GroupByKey`.
3. **`purchases-analytics-charts.tsx`** — `MainChart` (single group-by) and
   `StackedChart` (2-level group-by), bar/line/pie/table renderers, click-to-drill
   wiring, `Dropdown`/`DropItem`/`DropSection` primitives (moved here from the
   current file).
4. **`po-drill-drawer.tsx`** — `PODrillDrawer` (right-side overlay: KPI strip,
   search, status filter tabs, sortable PO table) and `POSummaryPanel`
   (read-only single-PO view + "View full PO →" link).

## Data Model & Types

### Expanded `GroupByKey`

```ts
type GroupByKey =
  | 'vendor' | 'product' | 'product_category' | 'subcategory' | 'brand'
  | 'status' | 'currency'
  | 'order_day' | 'order_week' | 'order_month' | 'order_quarter' | 'order_year';
```

`product_category` / `subcategory` / `brand` are item-level groupings, resolved
via a `ProdMeta` map:

```ts
interface ProdMeta { catId: string; catName: string; subCatId?: string; subCatName?: string; brandId: string; brandName: string; }
```

Built once on mount via `posApi.getProducts(token, { limit: 500 })`, keyed by
`item.productName` (parent product name) — same pattern POS uses for `prodMeta`,
and already used elsewhere in the purchases module
(`purchases-create.tsx`, `purchases-agreement-create.tsx`).

For item-level groupings, the lookup key into `ProdMeta` is `item.productName`
(not `itemName(item)`, which includes the variant/sub-product name).

### `GROUP_BY_ITEMS` (Dimensions section of Group By dropdown)

```ts
const GROUP_BY_ITEMS = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'product', label: 'Product' },
  { key: 'product_category', label: 'Product Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'brand', label: 'Brand' },
  { key: 'status', label: 'Status' },
  { key: 'currency', label: 'Currency' },
];
```

`GROUP_BY_DATE_ITEMS` (Order Date section) is unchanged: year/quarter/month/week/day.

### Measures — unchanged

`total_cost`, `untaxed_total`, `tax_total`, `avg_order`, `product_qty`,
`received_qty`, `line_count`, `count`.

### Filters — extended

- Existing: `not_cancelled`, `status_draft|confirmed|received|validated`,
  date filters (`date_today`, `date_week`, `date_m_*`, `date_q_*`, `date_y_*`),
  `vendor_search:`, `product_search:`.
- New: `category_<catId>`, `brand_<brandId>` checkbox filters (item-level,
  mirrors POS `FilterListSection`), plus `catname_search:` smart-search type.

### Sort

```ts
interface SortCriterion { field: 'value' | 'label' | 'orders'; dir: 'asc' | 'desc'; }
```

`sortStack: SortCriterion[]` — small sort-picker dropdown in the control bar.
Default behavior unchanged when `sortStack` is empty (date dims sort by isoKey
asc, others by value desc); when non-empty, `sortStack` overrides.

### Saved Searches

```ts
interface SavedSearch {
  id: string; name: string;
  filters: string[]; groupBy: GroupByKey | null; groupBy2: GroupByKey | null;
  measure: Measure;
}
```

Persisted to `localStorage` under `dh-purchases-analysis-searches`. UI: a
"Favorites" column in the filter/group-by panel — save current view, apply,
delete, with an "active" checkmark when current state matches a saved entry.

## Core Analytics Engine

### `applyFilters(orders, filters, prodMeta)`

Extends the current implementation:
- Existing status/date/vendor/product search filters unchanged.
- New: `category_*` / `brand_*` filters narrow to POs whose items resolve
  (via `prodMeta[item.productName]`) to a matching category/brand.
- New: `catname_search:` matches items whose category/subcategory name
  contains the query.

### `computeGroupData(orders, groupBy, measure, prodMeta, toBase, itemFilter?)`

Extends current implementation:
- `isItemGroup = groupBy in {product, product_category, subcategory, brand}`.
- For item-level groups, bucket key resolves via `prodMeta[item.productName]`:
  `product` → `itemName(item)`; `product_category` → `catName || 'Uncategorized'`;
  `subcategory` → `subCatName || catName || 'Uncategorized'` (falls back to
  category when the product has no subcategory); `brand` → `brandName || 'No Brand'`.
  This mirrors POS's `getOrderG1Key`/`computeGroupData` fallback behavior exactly.
- Per-group value computation factored into a shared
  `aggregateMeasure(orderList, items, measure, toBase)` (also used by
  `computeMultiSeries`), covering all 8 measures.
- Sorting: applies `sortStack` if non-empty, else default (isoKey asc for
  date dims, value desc otherwise) — same as today.

### `computeMultiSeries(orders, groupBy, groupBy2, measure, prodMeta, toBase)`

New. Returns `{ rows: GroupRow2[], series: string[], orderMap: Record<string, Record<string, PurchaseOrder[]>> }`.

- A helper resolves a single string key for a PO along any `GroupByKey`
  dimension (vendor/status/currency/date dims read PO-level fields;
  product/category/subcategory/brand read the PO's first item via `prodMeta`).
- `nested[g1][g2] → PurchaseOrder[]`; `series` = sorted union of all `g2` keys;
  each row aggregates via `aggregateMeasure` per series.
- Sorting: `sortStack` if non-empty, else isoKey asc (date dims) / `__total__`
  desc otherwise.

## UI Changes

### Control Bar

- **Filters** dropdown: status, date (today/week/months/quarters/years/custom
  range), category checkboxes, brand checkboxes — all from `FilterListSection`.
- **Group By** dropdown: supports up to **2** levels. Selecting a 2nd dimension
  shows a numbered badge (① / ②) next to each selection; clicking a selected
  dim again removes it and shifts the stack.
- **Measure** dropdown: unchanged (8 measures).
- **Sort** dropdown: add/remove/toggle-direction sort criteria (`sortStack`).
- **Chart type** switch: bar / line / pie / table — unchanged.
- **Smart search**: vendor / product / category-name suggestions (extends
  current vendor/product-only search).
- **Favorites panel**: saved searches (save current view / apply / delete),
  shown alongside Filters and Group By when the panel is expanded.

### Charts (`purchases-analytics-charts.tsx`)

- **`MainChart`**: single group-by — bar (vertical/horizontal depending on
  item count), line (with stats strip: total/avg/peak/trough), pie (donut +
  legend, top 10 + "N others"), table (rank, label, value, %, orders, cumulative %).
  All variants call `onBarClick(label, poList)` to open the drill drawer.
- **`StackedChart`**: 2-level group-by — stacked bar/line/pie/table across
  `series`, with `orderMap[rowKey][seriesKey]` driving drill-down for each
  segment/cell.

### PO Drill-Down Drawer (`po-drill-drawer.tsx`)

- **`PODrillDrawer`**: right-side overlay opened with `{ orders: PurchaseOrder[], title }`.
  - KPI strip: Total Spend (base-currency via `toBase`), PO Count, Avg Order,
    Receipt Rate (`Σmin(receivedQty,quantity) / Σquantity`).
  - Search (PO#, vendor name) + status filter tabs (All/Draft/Confirmed/
    Received/Validated/Cancelled) + sortable table (date, PO#, vendor,
    currency, total, status).
  - Row click → `POSummaryPanel` (with back button).
- **`POSummaryPanel`**: read-only — PO#, status + approval/lock badges, vendor,
  dates, items table (product, qty, unit cost, line total), totals
  (untaxed/tax/total), received %, and a **"View full PO →"** button linking
  to `routes.eCommerce.purchaseDetails(po._id)` (`/purchases/[id]`). No action
  buttons are duplicated here — `purchases-po-detail.tsx` remains the single
  place for approve/confirm/receive/validate/bill/lock actions.

### KPI Cards & Top Vendors (bug fix)

- Import `PurchaseAnalyticsSummary` from `services/purchaseAnalytics.service.ts`.
- 5th KPI card: "Pending Approvals" ← `summary.pendingApprovals` (was broken
  "Pending Bills" ← `summary.pendingBills`, which never existed in the real
  response).
- "Top Vendors by Spend" table: `summary.topVendors[].name / .amount / .count`
  (was `.vendorName / .totalSpend / .orderCount`, which don't exist).

## Out of Scope (Phase 1)

- Pivot table view (`viewMode`, hierarchical pivot, heatmap, CSV/Excel export) — Phase 2.
- Secondary KPI/breakdown dashboard (status pie, monthly trend, approval
  breakdown, top-products chart) beyond the existing/fixed Top Vendors table — Phase 3.
- 3-level grouping (`groupBy3`) — POS supports it; Phase 1 caps at 2 levels per
  the agreed scope.
- Changes to `purchases-orders.tsx` or other list pages to reuse
  `PODrillDrawer`/`POSummaryPanel` — built as standalone, reusable components
  but integration elsewhere is not in scope unless trivial.

## Verification

After implementation, run the dev server and manually verify:
- Each of the 7 group-by dimensions × 8 measures × 4 chart types renders
  sensible data (spot-check a representative subset).
- 2-level grouping renders stacked bar/line/pie/table correctly.
- Category/Subcategory/Brand grouping resolves real category/brand names
  (not all "Uncategorized"/"No Brand") for at least one product with catalog data.
- Drill-down: click a bar/pie-slice/table-row/series-segment → drawer shows
  matching POs → click a PO → summary panel → "View full PO →" navigates to
  `/purchases/[id]`.
- Saved searches: save current view, reload page, apply saved search, delete it.
- Sort controls change ordering of `MainChart`/`StackedChart`/table.
- KPI cards show real "Pending Approvals" count; Top Vendors table shows real
  vendor names/amounts/counts (not blank/undefined).
