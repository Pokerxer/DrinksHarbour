# Sales List (Odoo-style) — Continuation Prompt

> Paste this whole file as the first message of the next session.

## Mission

Finish the **Sales list page** (`/sales/quotations` and `/sales/orders`) so it matches the
4 Odoo reference screenshots **exactly** — both design AND behaviour. **Every button,
menu item, filter, and toggle visible in the screenshots must actually work, wired
end-to-end on BOTH the server and the client.** Do not leave any control as a dead/no-op
button. Keep iterating until all of it is functional. Use superpowers.

The structural rebuild is already done (see "Already done" below). What remains is: (1) the
**dark Odoo theme**, and (2) **wiring every control to real server + client logic**.

---

## Reference screenshots (what the page must look + behave like)

**Screenshot A — full list (dark theme):**
- Dark top app bar: `Sales` (purple logo) · nav items `Orders` `To invoice` `Products`
  `Reporting` `Configuration` · right side company switcher `CLOUD BAY VENTURES`.
- Dark sub-toolbar: purple **New** button · `Quotations ⚙` (title + gear) · centered search
  with caret toggle · `1-80 / 10000+` record count · `‹ ›` pager · view-toggle icon group ·
  column-chooser icon.
- Table columns: **Number, Creation Date, Customer, Website, Salesperson, Activities,
  Total, Warehouse, Status**. Rows are dark. Salesperson shows a small red avatar + name
  (e.g. "Chinaza"). Activities = clock icon. Total right-aligned currency. Warehouse =
  "CLOUD BAY VENTURES". Status = green **Sales Order** pill / gray **Quotation** pill.

**Screenshot B — gear dropdown (dark):** `Upload Request For Quotation` (top) · divider ·
`Import records` · `Export All` · divider · `Knowledge ▶` · `Spreadsheet ▶`.

**Screenshot C — search/filter panel (dark, 3 columns):**
- **Filters** (pink funnel): `✓ My Quotations` (teal check) · divider · `Quotations` ·
  `Sales Orders` · divider · `Create Date ▼` · `Custom Filter...`
- **Group By** (teal layers): `Salesperson` · `Customer` · `Order Date ▼` ·
  `Payment Method` · divider · `Custom Group ▼`
- **Favorites** (yellow star): `Save current search ▼`
- Search bar above shows magnifier · purple chip `My Quotations ✕` · `Search...` · up-caret.

**Screenshot D — column chooser (right-side dropdown):** checkbox list — `Creation Date ✓`,
`Delivery Date`, `Expected Date`, `Website`, `Salesperson ✓`, `Activities ✓`, `Sales Team`,
`Untaxed Amount`, `Taxes`, `Total ✓`, `Tags`, `Warehouse ✓`, `Status ✓`, `Invoice Status`,
`Customer Reference`, `Expiration`, then `+ Add Custom Field`. (Note: the `Website` column
shows values like "Wyn City" for some rows.)

---

## Already done (do NOT redo)

- `client/apps/admin/src/app/shared/sales/sales-list.tsx` — NEW unified component. Has the
  toolbar, gear dropdown, 3-col filter panel, active-filter chips, column chooser, checkbox
  selection, bulk bar, list/kanban toggle, pagination. **Currently LIGHT-themed and most
  dropdown items are visual-only (no logic).**
- `sales-quotations.tsx` / `sales-orders.tsx` now just render
  `<SalesList defaultDocType="quotation|order" />`.
- `salesOrder.service.ts` — `SalesOrder` type gained `warehouseId?: {_id,name}|string|null`
  and `salesperson?: {_id,name}|null`; `list()` accepts a `salesperson` param.
- `server/controllers/salesOrder.controller.js` `getSalesOrders` — now
  `.populate('warehouseId', 'name')`.

Files type-check clean (`npx tsc --noEmit` → only pre-existing TS2688 ambient-module noise).

---

## TODO — implement every control, server + client

### 1. Dark Odoo theme (visual)
- Repaint `sales-list.tsx` toolbar + dropdowns + table to the dark Odoo palette (near-black
  `#1f1d2b`-ish toolbar, white text, purple `#b20202`/maroon New button, teal accents on
  checks, pink funnel / teal layers / yellow star section icons). Match screenshots A–D.
- Decide with the user whether the **table rows** are dark (as in screenshots) or stay light
  to match the rest of the admin app. Default: dark toolbar + dropdowns, light rows, UNLESS
  user wants full dark. (Ask once if unclear.)

### 2. Gear dropdown — wire each item
- **Upload Request For Quotation** → file picker (PDF/image) → POST to a new endpoint that
  runs the existing scan/OCR pipeline (`server/services/documentText.service.js` /
  `scanMatch.service.js`) and creates a draft quotation. Reuse the sales-scan-drawer flow.
- **Import records** → CSV upload → bulk-create endpoint
  (`POST /api/sales-orders/import`), with column mapping. Server: parse + validate + insert.
- **Export All** → `GET /api/sales-orders/export?format=xlsx|csv` honoring current filters;
  client downloads the file.
- **Knowledge / Spreadsheet** → if there's no backing feature, make them open a real
  sub-menu and either link to an existing module or clearly defer (confirm with user). Do
  not leave as silent no-ops.

### 3. Search / Filter panel — wire each control
- **My Quotations** → filter `salesperson == currentUser`. Needs server support: add
  `salesperson`/`createdBy` to `SalesOrder` (model + `createSalesOrderDoc`) so it can be
  filtered and shown in the Salesperson column. The list query already accepts `salesperson`.
- **Quotations / Sales Orders** → already drive `docType` client-side; keep + make the chips
  reflect them.
- **Create Date ▼** → sub-menu of periods (Today, This Week, This Month, This Quarter, This
  Year, Last Month…) → client-side date filter on `createdAt` (or server `from`/`to` params).
- **Custom Filter...** → builder (field / operator / value) → applied client-side or via
  server query params.
- **Group By: Salesperson / Customer / Order Date / Payment Method** → render the table
  grouped with collapsible group headers + per-group subtotals (Odoo style). Order Date ▼
  has period granularity. **Custom Group ▼** picks any field.
- **Favorites → Save current search** → persist the active filter+group+columns set. Server:
  a small `SavedSearch` collection (per user, scoped to "sales") with CRUD; client lists
  saved searches in the Favorites column and applies/deletes them.

### 4. View toggles (icon group, top-right)
- **List** (done) · **Kanban** (build real cards grouped by stage) · plus any of
  calendar / pivot / graph / activity / map shown in the screenshot — implement the ones
  that make sense for sales; for the rest confirm scope with user. No dead icons.

### 5. Column chooser — wire to real data
- Make every optional column actually render real values:
  - `Website` (Wyn City etc. — needs a `website`/`source` field on SalesOrder),
    `Delivery Date`, `Expected Date`, `Sales Team`, `Untaxed Amount` (have),
    `Taxes` (`taxTotal`), `Tags`, `Invoice Status`, `Customer Reference`, `Expiration`
    (`validUntil`).
  - Add missing fields to the `SalesOrder` model + `createSalesOrderDoc`/`applyEdit` +
    populate them in the list query. Persist the user's chosen columns (localStorage at
    minimum; ideally the SavedSearch).
- **+ Add Custom Field** → confirm scope with user (likely defer or simple metadata map).

### 6. Bulk actions (when rows checked)
- Real **Export** (selected), **Print** (batch PDF), **Delete/Cancel** (server bulk endpoint
  `POST /api/sales-orders/bulk` with action + ids), with confirm. Wire each.

### 7. Top app nav (`sales-nav-header.tsx`)
- The screenshot's `Orders / To invoice / Products / Reporting / Configuration` menus — make
  sure each routes somewhere real (or is built). "To invoice" and "Reporting" may be new.

---

## Server endpoints likely needed (create/extend)
- `GET  /api/sales-orders/export` (xlsx/csv, honors filters)
- `POST /api/sales-orders/import` (CSV bulk create)
- `POST /api/sales-orders/upload-rfq` (OCR → draft quotation)
- `POST /api/sales-orders/bulk` (delete/cancel/print selected)
- `GET/POST/DELETE /api/saved-searches?scope=sales`
- Extend `SalesOrder` model: `salesperson`/`createdBy`, `website`/`source`, `salesTeam`,
  `tags`, `customerRef`, `expectedDate`, `deliveryDate`, `invoiceStatus`. Set them in
  `salesOrder.service.js` `createSalesOrderDoc` + `applyEdit`, and populate `salesperson`
  (and any refs) in `getSalesOrders`.

## Method
- Work through sections 1→7 as a todo list. For each control: server first (endpoint +
  model), then client wiring, then verify. Re-check `npx tsc --noEmit` (ignore TS2688).
- Keep the `#b20202` brand red. Match spacing/typography to the screenshots.
- **Watch session cost** — the prior session hit ~$51. Batch edits; avoid re-reading large
  files already in context.

## Key files
- `client/apps/admin/src/app/shared/sales/sales-list.tsx` (main)
- `.../sales/sales-nav-header.tsx`, `.../sales/sales-helpers.ts`
- `client/apps/admin/src/services/salesOrder.service.ts`
- `server/controllers/salesOrder.controller.js`, `server/services/salesOrder.service.js`
- `server/models/SalesOrder.js`, `server/routes/sales*.routes.js`
- OCR reuse: `server/services/documentText.service.js`, `scanMatch.service.js`,
  `client/apps/admin/src/app/shared/sales/sales-scan-drawer.tsx`
