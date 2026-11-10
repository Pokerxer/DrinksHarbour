# Purchase-order presentation lines + purchase catalogue (2026-11-08)

The sales create form's action bar (Add a section / Add a note / Catalogue /
Scan & Match) now exists in the purchases create AND edit forms
(`/shared/purchases/purchases-create.tsx`, `purchases-edit.tsx`) and in the
stock transfer create/edit form (`stock-transfer-create.tsx` — both
`/purchases/transfers/create` and `/purchases/transfers/:id/edit` render it;
edit passes `editId`). The backend persists the new line kinds on both
documents (PurchaseOrder + StockTransfer).

## Data model (backend)

`server/models/PurchaseOrder.js` — `items[]` gained:

- `lineType`: `'product' | 'section' | 'note'` (default `'product'`).
- `name`: section heading text.
- `description`: note body.

`subProductId`, `subProductName`, `quantity` are now **conditionally**
required — mandatory only when `lineType` is `'product'` (dangling legacy docs
without `lineType` still validate as product lines). Presentation lines carry
no catalog ref and quantity 0, so existing totals, receiving (`outstanding`,
`applyReceipt`, `poReceiptStatus`), inventory posting (`buildPostingLines`)
and vendor-bill generation (filters `qty > 0` and product lines only) skip
them without any change.

`server/utils/purchaseOrderItems.js` (new): `sanitizePurchaseOrderLines(items)`
normalises the wire payload in place — product lines keep the exact legacy
mapping (`productName → subProductName`, `unitPrice → unitCost`,
`packSize → packagingQty`); section/note lines are **zeroed** (quantity,
receivedQty, postedQty, unitCost, packPrice, totalCost all 0, catalog ids
stripped) and must carry a non-empty `name` (section) / `description` (note).
`lineTypeOf(item)` treats anything else as `'product'`.

`validateSubProducts` now validates product lines only; a pure presentation
payload no longer trips the "at least one subProductId" guard.

Both `createPurchaseOrder` and `updatePurchaseOrder` call the sanitizer before
validation/enrichment.

Test: `server/__tests__/purchaseOrderLines.test.js` (node --test; model
`validateSync` + sanitizer contract).

## Client — shared pure helpers

`purchases-create-lines.ts` (new, no React):

- `appendPresentationLine(lines, 'section'|'note', blankOf)` — appends the
  presentation line while keeping an unfinished trailing product row *after*
  it (sales parity).
- `computeSectionSubtotals(lines, subtotalOf)` — running subtotal per section
  (product lines beneath it until the next section; keyed by line object).
- `catalogQtyMap(lines)` — `subProductId|sizeId` → quantity map for the modal.
- `purchasePayloadLines(lines)` — save-payload mapping: drops unsaved empty
  product rows and empty presentation rows; zeroed presentation payloads;
  product lines mapped with the legacy wire aliases.
- `lineTypeOf`, `catalogLineKey`, `PurchaseLine` structural type (LineItem in
  create/edit extends it).

Test: `purchases-create-lines.test.ts` (vitest).

## Client — purchases create form

- Line list is discriminated by `lineType`: product rows render as before;
  sections render as an editable bold title + running untaxed subtotal
  (`bg-gray-50/70`); notes render as a free-text textarea
  (`bg-amber-50/40`). All rows keep HTML5 drag-to-reorder.
- Header "Add Line" / "Scan & Match" pills were replaced by an action bar
  under the lines: **Add a product · Add a section · Add a note · Catalogue ·
  Scan & Match** (`PiCamera` icon), mirroring
  `sales/sales-line-table.tsx`. "Add a product" is gated while an empty
  product row exists.
- Catalogue: `purchases-catalog-modal.tsx` + `purchases-catalog-card.tsx` +
  `purchases-catalog-data.ts` + `use-purchase-catalogue.ts`. Reuses the sales
  catalogue endpoint `GET /api/subproducts?view=catalogue` (search, filters,
  facets, pagination) **without** `pricing=true` — the purchase card prices by
  `costPrice` ("Cost" label). Selections map to purchase lines via
  `purchaseSizelessSelection` / `purchaseSizeSelection` (cost → unitPrice,
  unitsPerPack → packSize); add/set/remove semantics mirror the sales form's
  qty map (a catalogue add behaves exactly like a Scan & Match accept).
  **NOT scoped by the destination warehouse** (fix 2026-11-09): the sales
  endpoint's `warehouseId` filter keeps only products *already stocked* in
  that warehouse, and a purchase order orders stock the destination does not
  have yet — scoping emptied the modal ("No products in this warehouse") as
  soon as a destination was picked. Stock badges show tenant-wide
  availability. The sales create form keeps its own warehouse scoping
  (fulfillment semantics); the transfer catalogue scopes by the SOURCE
  warehouse's stock on purpose.
- `App:*` — `useSalesCatalogue` (`sales/use-sales-catalogue.ts`) gained an
  optional `loader` parameter (defaults to the sales loader) so the purchase
  catalogue reuses the same search/filter/pagination plumbing. Optional
  pass-throughs added: `colorName/optionName/unitType` on CatalogSize sizes,
  `packaging` on `ProductLineSelection` (retail-row packaging noun, DRI-14).
- Payload: `purchasePayloadLines(items)`.

## Purchases edit form (full parity)

`purchases-edit.tsx` has the **complete** sales-parity action bar —
Add a product · Add a section · Add a note · Catalogue · Scan & Match —
replacing the old header pills and the "Add another line" footer button:

- Loader carries `lineType/name/description` so created sections/notes
  round-trip; rows render with the same create-form branches.
- The save payload includes zeroed presentation payloads and keeps
  `receivedQty` on product lines (already-received lines stay intact).
- The catalog modal (`purchases-catalog-modal`) is mounted with the loaded
  warehouse and currency; catalogue adds/setQty/remove mirror the create
  form exactly (a catalogue add behaves like a Scan & Match accept via
  `appendScannedLines`; `derivePurchasePack` re-derives packPrice/packQty).
- "Add a product" is gated while an empty product row exists (create parity).

Shared code: the selection→line mapper (`catalogDraftFromSelection`) and the
pack derivation (`derivePurchasePack`) live in `purchases-create-lines.ts`
(tested in `purchases-create-lines.test.ts`) and are imported by BOTH forms —
create and edit no longer duplicate that logic.

**Sales edit has no changes needed:** `sales-edit.tsx` delegates to
`SalesCreate mode="edit"`, which renders the same `SalesLineTable` + overlays,
so Add a product/section/note/Catalogue/Scan & Match were already live there.

## PO detail

`purchases-po-detail.tsx` renders `lineType: 'section'` rows as bold section
headings and `lineType: 'note'` rows as italic notes (colSpan full width); a
zero-quantity presentation line can never be received or billed, so the rest
of the detail/receive/bill surfaces are unaffected.

## Scan & Match interaction

`appendScannedLines` (purchases-scan-selection.ts) previously dropped ANY
trailing row without a productName — including a deliberate section/note
heading. It now stops dropping at non-product (`lineType !== 'product'`)
rows. Test added to `purchases-scan-selection.test.ts`.

## Stock transfers (create + edit, same component)

`stock-transfer-create.tsx` (serves both `/purchases/transfers/create` and
the `:id/edit` route) now has the same action bar: Add a product · Add a
section · Add a note · **Catalogue** · **Scan & Match**.

Backend (see `server/__tests__/stockTransferLines.test.js` +
`server/__tests__/restockValidators.test.js`):

- `StockTransfer.items` gained `lineType/name/description`; `subProductId`,
  `subProductName` conditionally required (product lines only); `quantity`
  min relaxed to 0 for presentation lines (the tenant-facing sanitizer keeps
  product-line quantities ≥ 1).
- `server/utils/stockTransferItems.js` (new): `sanitizeStockTransferLines`
  (same contract as the PO one, transfer wire names). Wired into
  `createStockTransfer` (after tax stamping → presentation lines stay 0%) and
  `updateStockTransfer`; `duplicateStockTransfer` carries presentation lines
  through so a duplicated draft keeps its structure.
- Safety analysis (no changes needed): `computeTransferMoney` valuations are
  0 for zero-qty lines; `assertSourceStock` passes (0 requested); receive
  rejects any quantity above `outstanding` (0 for presentation lines);
  shortfall/receipts/returns all quantity-gated (`returnable = receivedQty −
  returnedQty = 0`); the receive panel's `outstandingOf` leaves them
  disabled. Delivery charge weight-share only accumulates over lines with
  net > 0.
- Recommendation validators (`restock/purchase.js`,
  `restock/transfer-purchase.js`) now count/match **product lines only** —
  a buyer adding a section/note to a recommended order no longer trips
  `items.length` plan-reference checks. (This was a latent break for the PO
  payload change too, not just transfers.)

Frontend:

- `lineTypeOf` / `appendPresentationLine` / `computeSectionSubtotals` in
  `purchases-create-lines.ts` generalized to a structural
  `PresentationLineShape` so PO and transfer line lists share them.
- `stock-transfer-lines.ts` (new, no React): `appendTransferScannedLines`
  (PO-style blank-dropping with the presentation guard, transfer field
  names, scan `unitPrice → costPrice` seeding), `transferPayloadLines`
  (zeroed presentation payloads). Test: `stock-transfer-lines.test.ts`.
- Transfer **Catalogue** = the SOURCE WAREHOUSE's stock (no tenant-catalogue
  endpoint involved): `stock-transfer-catalog-modal.tsx` lists the already
  loaded `StockRowOption`s (search via the shared CatalogueSearch, cost or
  wholesale price per the form's Price toggle, qty steppers, per-row
  above-stock warning). Add/set/remove merge into the line list by
  `subProductId::sizeId` exactly like the PO catalogue.
- **Scan & Match** reuses `PurchasesScanDrawer` (scan API is domain-neutral):
  accepted rows map onto transfer lines, seeding `sourceStock`,
  `costSourcePrice`, `wholesalePrice`, `packSize` from the loaded source
  stock when the item is stocked (0 otherwise — the exceeds-stock guard and
  server-side dispatch assert keep unstocked lines unsendable).
- Bulk-tax and Cost/Wholesale toggles skip presentation lines naturally
  (no `subProductId`); payloads use `transferPayloadLines`; edit hydration
  carries `lineType/name/description`.
- `stock-transfer-detail.tsx` renders sections as bold headings and notes as
  italic gray rows; `utils/print/transfer-print.ts` prints them as a styled
  first-cell row with blank filler cells (the print model zips rows 1:1
  against 8 columns — `flatMap` forced the product row to nest one level
  deeper, regression tests: `transfer-print-lines.test.ts`).

## Verification status

- Backend: `node --test __tests__/purchaseOrderLines.test.js` + all purchase
  suites green (`purchaseOrder.creator`, `purchasesRetailTypes.mongo`,
  `restockPurchasePrefill`, vendor purchases). Unrelated market/retail Mongo
  suites fail identically before and after (pre-existing environment issue).
- Client: `npm test` (vitest) — purchases + sales suites all green
  (460 tests); `npm run type:check` clean.
- Not yet exercised: a live POST/PATCH through the dev server with sections
  and notes on a real draft (needs `server` + Mongo running).

## Search loading state (2026-11-09)

The PO create/edit product picker (`ProductSearch`) flashed "No products
match" while the debounced server search was still pending — the empty state
labelled the query even though no results for it existed yet. The picker now
tracks which query the current result list answers (`resultsFor`) and shows a
searching skeleton (`product-search-skeleton.tsx`, vitest-tested rows +
spinner caption) whenever the typed query has drifted from it or a fetch is in
flight; a definitive empty message only appears once results for that exact
query have landed. The input's inline "…" became a spinning icon
(`PiSpinner`). Follow-up candidates with the same symptom: the sales
`product-line-search.tsx` picker and the PO `VendorSearch` placeholder.

## Pack Size edits become the size's default (2026-11-09)

When the operator edits a PO/transfer line's **Pack Size** and leaves the
field (blur/Enter; also the UOM-conversion pick), that value is committed as
the Size document's new default packaging quantity (`unitsPerPack`) via the
existing `PATCH /api/subproducts/:id/sizes/:sizeId` endpoint — the size's
default is updated immediately, not only on the line's wire payload:
- `pack-size-input.tsx` gained `onCommitDefault` (once per real edit; typing
  never fires it — tests in `pack-size-input.test.tsx`).
- Wired in `purchases-create.tsx`, `purchases-edit.tsx` and
  `stock-transfer-create.tsx` (transfer form also updates its loaded
  stock-row snapshot so later picks/catalogue rows show the new default).
- Pickers stay consistent within the session via the parent's
  `packSizeOverrides` (sizeId → unitsPerPack) consumed at pick time in the
  create/edit `ProductSearch` (list badge + picked packSize); failed
  persistence only toasts an error and skips the override so future picks use
  server truth. Sizeless lines (no `sizeId`) never persist.
