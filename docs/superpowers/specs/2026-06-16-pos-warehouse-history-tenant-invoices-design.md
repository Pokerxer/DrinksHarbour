# POS Warehouse History + Tenant-Name Invoices — Design

**Date:** 2026-06-16
**Branch:** `feat/pos-warehouse-history-tenant-invoices`

## Goal

1. **Part A** — Surface warehouse history across the remaining POS analytics
   screens (orders, order-analysis, session-report), mirroring the established
   pattern already shipped to pos-history, pos-sell-orders, the order-detail
   panel, and sales-details.
2. **Part B** — Replace the hardcoded "DrinksHarbour" store name in all
   POS/purchase **invoices and receipts** with the tenant's real name.

## Key facts established during exploration

- **One warehouse per POS order.** `createPOSOrder` resolves a single
  `warehouseId` via `resolveShopWarehouse(tenant, tenantId, shopId)` and stamps
  every line item with it. An order never spans warehouses → render **one chip /
  one bucket per order**, reusing the existing helper:
  `getOrderWarehouse(order) = order.items?.find(i => i.warehouse)?.warehouse ?? null`
  (pos-history.tsx:60).
- **Server already populates `items.warehouse`.** `getAllPOSOrders`
  (pos.controller.js:2653) and `getPOSSessionOrders` (pos.controller.js:2713)
  both `.populate('items.warehouse', 'name code')`. These feed pos-orders,
  pos-order-analysis, and pos-session-report. **No server changes required.**
- **Tenant access:**
  - Admin screens (pos-order-analysis, pos-sales-details, pos-session-report,
    purchase detail screens) get the tenant via `useTenant()` from
    `@/context/TenantContext` (`AdminTenantData.name`), provided app-wide by
    `TenantProvider` in `app/layout.tsx`.
  - POS-terminal screens (pos-orders, pos-history, pos-sell-orders,
    pos-order-detail, pos-dashboard) get it via `usePOSAuth().tenant`.

## Decisions

- **Fallback:** every replacement keeps the existing literal as fallback,
  preserving per-surface casing — `tenant?.name ?? 'DRINKS HARBOUR'` where the
  surface is uppercase, `?? 'DrinksHarbour'` where mixed-case.
- **Scope:** invoices and receipts only. Visible chrome (logo alt text, page
  `<title>` metadata, `site.config`, nav-header/dashboard/order-detail/
  warehouses-list branding text) stays as the hardcoded "Drinks Harbour" literal
  and is **out of scope**.

## Part A — Warehouse into the remaining POS screens

### A1. pos-orders.tsx (order list — no warehouse today)
- Add `warehouse?: { _id; name; code } | null` to its order-item type and a
  local `getOrderWarehouse` helper (same shape as pos-history).
- Render a warehouse chip on each order row, mirroring pos-history /
  pos-sell-orders chip styling.
- Show the warehouse in the `OrderDetail` slide-over panel.

### A2. pos-order-analysis.tsx (pivot table — no warehouse today)
- Extend `GroupByKey` (L46-47) with `'warehouse'`.
- Add `{ key: 'warehouse', label: 'Warehouse' }` to `GROUP_BY_ITEMS` (L82).
- Treat warehouse as an **order-level** dimension (like `cashier` / `terminal` /
  `payment_method`), **not** an item dimension — do **not** add it to
  `ITEM_DIMS`. Add a `warehouse` branch to the order-level resolvers:
  - the `keyOf`/bucket function (~L349-362),
  - the group-label resolver (~L481-508).
  - Value = `getOrderWarehouse(o)?.name ?? 'No warehouse'`.
- Confirm the pivot row/col dimension pickers surface the new key (they read
  from `GROUP_BY_ITEMS`).

### A3. pos-session-report.tsx (session order list + PDFs)
- Add `warehouse?: { _id; name; code } | null` to the `SessionOrder` items type
  (~L119).
- Show a warehouse chip on each order row and in the per-order expand.
- A session report aggregates a single session, so **no group-by is added**;
  warehouse appears per-order only.

### A4. pos-sales-details.tsx — audit only
- Already has the warehouse column (L3259) and the "By Warehouse" group-by
  (L1462). Confirm consistency with the other screens; no functional change
  expected.

## Part B — Tenant name in invoices & receipts

### B1. utils/purchaseInvoice.ts (no tenant access today)
- Remove module-level `const COMPANY = 'DrinksHarbour'`.
- Add a `company` param to `headerBand(left, right, company)` and
  `footerRow(company)`.
- Add a `companyName: string` argument to the exported builders and their print
  wrappers: `buildBillInvoice`, `printBillInvoice`, `buildPOInvoice`,
  `printPOInvoice`, `buildTransferInvoice`, `printTransferInvoice`. Thread
  `companyName` into the header band, footer, and the "Bill To" / "Ship To"
  cells.
- Callers add `useTenant()` and pass `tenant?.name || 'DrinksHarbour'`:
  - `app/shared/purchases/purchases-bill-detail.tsx` (printBillInvoice)
  - `app/shared/purchases/purchases-po-detail.tsx` (printPOInvoice)
  - `app/shared/purchases/stock-transfer-detail.tsx` (printTransferInvoice)

### B2. POS receipts / PDFs
- **pos-sales-details.tsx** — add `useTenant()`; pass a `storeName` param into
  `drawPdf1Header`, `drawPdfMiniHeader`, `addPdfPageFooters`; replace the 3
  `doc.text('DrinksHarbour', …)` sites (L761, L883, L903). Fallback
  `'DrinksHarbour'`.
- **pos-session-report.tsx** — add `useTenant()`; thread `storeName` through
  `buildSessionReportPdf`, `buildZReportPdf`, `printSessionReport`, and the HTML
  builders; replace the 6 hardcoded sites (L153, L355, L383, L514, L587, L667).
  Fallback `'DrinksHarbour'`.
- **pos-history.tsx:227** — HTML receipt; use `usePOSAuth().tenant` already in
  scope: `tenant?.name?.toUpperCase() || 'DRINKS HARBOUR'`.
- **pos-sell-orders.tsx:286** — HTML receipt; same pattern, `?? 'DRINKS HARBOUR'`.

## Out of scope (explicitly)

- Server / aggregation pipeline changes (data already populated).
- Visible chrome branding (dashboard, order-detail, nav headers, warehouses-list,
  not-found, site.config, page `<title>` metadata, image `alt`).
- Any group-by/filter for warehouse in session-report (single-session scope).

## Verification

- `tsc --noEmit` on the touched client files (no new type errors).
- No server changes → no server smoke-check needed.
- Manual QA:
  - Open `/point-of-sale/orders`, `/order-analysis`, `/session-report`,
    `/sales-details` → warehouse appears on rows; analysis offers a "Warehouse"
    group-by/pivot dimension.
  - Print a POS receipt (history + sell-orders), a sales-details PDF, a
    session/Z report, a vendor bill, and a PO invoice → the tenant's real name
    renders (fallback to literal only when tenant unresolved).
