# SubProduct & Size Bulk Import — Design

**Date:** 2026-07-04
**Status:** Approved (design)
**Area:** Admin › Inventory › Stock (`client/apps/admin/src/app/(hydrogen)/inventory/stock`) + server subproduct/warehouse services

## Goal

Add a bulk import on the Inventory › Stock page that ingests a CSV or Excel
(`.xlsx`) file and creates `SubProduct` records with their `Size` variants in the
database, optionally seeding opening stock into a chosen warehouse. The import
shows a validation **preview** before committing.

## Decisions (from brainstorming)

- **Import goal:** bulk CSV/Excel upload that creates SubProducts + Sizes.
- **Parent Product linkage:** match an existing central `Product` by name; if none
  matches, create a new Product from the row (brand/category resolved by name).
- **Row granularity:** one row = one Size; parent columns repeat across a
  SubProduct's size rows. Opening stock is **optional** per row.
- **Opening stock:** when a row has `openingQty > 0`, it is applied through the
  existing warehouse `adjustStock` path (type `received`) — never by writing
  `WarehouseStock` directly — so movement history, valuation, and rollups stay
  consistent.
- **Warehouse:** a single target warehouse is chosen in the import UI; all opening
  stock goes there (no per-row warehouse column).
- **File formats:** CSV **and** `.xlsx`, parsed client-side into normalized JSON
  rows before hitting the server.
- **Flow:** preview (dry run, no writes) → user confirms → commit.

## Architecture

Thin orchestration layer that reuses existing services rather than writing
low-level model documents (preserves SKU generation, pricing calc, availability
rollups, and movement history).

### Backend (`server/`)

**`services/subProductImport.service.js`**
- `parseRows(rows)` — normalize client-parsed JSON rows into typed records
  (trim, coerce numbers, uppercase SKUs to match schema).
- `validateImport(rows, { warehouseId }, tenantId, user)` — **dry run, no writes.**
  Groups rows by SubProduct identity, resolves each parent Product by name, and
  returns a per-group report classifying each group as
  `willCreateProduct | willLinkProduct | willUpdateSubProduct`, with size count
  and row-level errors. Also enforces the missing-warehouse-with-qty guard.
- `commitImport(rows, { warehouseId }, tenantId, user)` — for each valid group:
  1. Resolve parent Product (match by name, else mark for creation).
  2. Call `subproduct.service.createSubProductCore(data, tenantId, user)` with the
     group's sizes at `stock: 0` (SubProduct + Sizes created in one call; Product
     is created via the core's existing `createNewProduct`/`newProductData` path
     when no match).
  3. For each size with `openingQty > 0`, call
     `warehouse.service.adjustStock({ warehouseId, subProduct, size, quantity, type: 'received', notes: 'Bulk import opening stock' }, userId, tenantId)`.
  4. For an **existing** SubProduct (matched by SKU or product+tenant), add only
     its **new** sizes (existing size values skipped, never duplicated).
  - Returns `{ createdProducts, createdSubProducts, createdSizes, stockApplied, skipped, errors }`.

**`controllers/subProductImport.controller.js`** — `previewImport`, `commitImport`;
tenant-scoped, audit-logged in the style of `salesImport.controller.js`.

**Routes** (added to `routes/subproduct.routes.js`, `tenantAdminOrSuperAdmin`):
- `POST /api/subproducts/import/preview`
- `POST /api/subproducts/import/commit`

### Frontend (`client/apps/admin/`)

**`services/subProductImport.service.ts`** — `preview(rows, opts, token)`,
`commit(rows, opts, token)`.

**`app/shared/inventory/inventory-stock-import.tsx`** — a drawer opened by a new
**Import** button in the Stock browser control bar (rendered only when
`mode === 'stock'`). Uses `react-dropzone` (installed) for the drop zone and
`xlsx` (installed, `^0.18.5`) to parse `.csv`/`.xlsx` client-side into row
objects with normalized headers. Includes a **Download template** button, a
target-warehouse selector (warehouses sourced from the loaded stock rows /
existing warehouse list), then:
- **Step 1:** upload → parse → `POST preview` → render per-group/row report table
  (create / link / update / skip / error with messages).
- **Step 2:** confirm → `POST commit` → success toast + call the browser's
  `load()` to refresh the stock list.

### Data flow

```
file → xlsx parse (client) → rows JSON
     → POST /import/preview  → report  (no writes)
     → user confirms
     → POST /import/commit
         → resolve/create Product
         → createSubProductCore (sizes at stock 0)
         → adjustStock('received') per size with openingQty
     → refresh stock list
```

## Column schema (template)

One row = one Size. Parent columns repeat across a SubProduct's size rows.

| Column | Required | Notes |
|---|---|---|
| `productName` | Yes | Grouping + Product match key |
| `productType` | Yes, only when a new Product must be created | Must be a valid `Product.type` enum value; row errors if a new Product is needed and this is blank/invalid |
| `brand` | No | Looked up or created by name |
| `category` | No | Looked up by name (not created) |
| `subCategory` | No | Looked up by name (not created) |
| `subProductSku` | No | Grouping key + idempotency; auto-generated if blank |
| `costPrice` | Yes, when linking an existing Product | SubProduct cost basis |
| `sellingPrice` | No | SubProduct `baseSellingPrice` |
| `size` | Yes | Must match the `Size` enum (e.g. `75cl`, `can-330ml`) |
| `sizeSku` | No | Size identifier |
| `barcode` | No | Unique per tenant |
| `sizePrice` | No | Per-size `sellingPrice` |
| `sizeCostPrice` | No | Per-size `costPrice` |
| `openingQty` | No | If > 0, seeded into the UI-selected warehouse via `adjustStock('received')` |

**Grouping:** rows grouped by `subProductSku` (else `productName` + `brand`). Each
group = one SubProduct with N sizes.

## Validation rules (preview, no writes)

- Missing `productName` → row error.
- New Product needed but `productType` missing / not in enum → row error.
- `size` not in the `Size` enum → row error (report the offending value).
- Duplicate `size` within a group → keep first, warn on the rest.
- Non-numeric `costPrice` / `sizePrice` / `sizeCostPrice` / `openingQty` → row error.
- Existing SubProduct + size already exists → **skip** that size (reported as
  "exists", not an error).
- No target warehouse selected but some row has `openingQty > 0` → block commit
  with a clear message.

## Error handling (commit)

- Per-group `try/catch` — one bad group never aborts the batch.
- Opening-stock failures are recorded per-size but do not roll back the created
  catalog records.
- Response carries `errors[]` with row/group context; the frontend renders them
  in the report.

## Testing

- Server `node:test` (repo convention — **not** jest) in `server/test/`:
  - parse/normalize rows
  - size-enum validation
  - grouping by SKU / name
  - product match-vs-create decision
  - opening stock routed through `adjustStock`
  - existing-size skip (no duplication)
  - malformed-row isolation (one bad group doesn't abort the batch)
  - missing-warehouse-with-qty guard
- Manual browser smoke test of the drawer: upload → preview → commit → stock list
  refresh.

## Out of scope

- Per-row warehouse targeting (single UI-selected warehouse only).
- Updating pricing/fields on existing sizes (existing sizes are skipped).
- Background/async processing for very large files (synchronous request/response).
- Image import.
