# SubProduct deletion & archive integrity (2026-11-13)

## Orphan cleanup completed

The 3 historical orphan Size docs were **deleted on 2026-11-13 by explicit
operator instruction** (`scripts/delete-orphan-sizes.js --apply`; snapshot of
each doc + its referencing movements saved to
`server/scripts/orphan-size-deletion-*.json`). Each had zero WarehouseStock
rows (stock written off 2026-08-08) and 3 InventoryMovement rows whose
`size` ref now dangles — same as their already-dangling `subProduct` ref. The
movements themselves are untouched. `mark-orphan-sizes-discontinued.js`
remains as the gentler alternative (mark, don't delete); the new
`delete-orphan-sizes.js` refuses orphans that still hold stock rows.

Investigation opened on a tenant report that Size data survived a SubProduct
deletion, with barcode `6009803813156` as the tracer.

1. **Orphan Size docs existed.** Three `70cl` Size docs (tenant
   `699165839f3308b1baeca8fc`, created 2026-07-17 by bulk import) outlived their
   parent SubProducts. Their stock had been written off 2026-08-08 by
   `scripts/repair-orphan-warehouse-stock.js`, but the Size docs themselves
   remained attached to dead parent ids. No audit trail exists for the parent
   deletions — they predate the current cascade and did not run through
   `deleteSubProduct`'s size cleanup.
2. **The barcode size was never deleted.** `6009803813156` belongs to one live
   Size (`6a68c7c3355794d325e87493`, 75cl) on the ACTIVE listing
   `WYN48B-SWEE92D9-WOGV5D` ("Sweet Kiss Natural Sweet Red"), with 4 inventory
   movements — it was restocked (+18) on 2026-11-12. Any perceived "deleted but
   still present" behavior for this barcode traces to the orphan pattern above,
   not to this listing.
3. **`deleteSubProduct` had no history guard.** It hard-deleted a SubProduct and
   its Size docs unconditionally, even when Orders/Sales/InventoryMovements
   referenced them — dangling immutable history.
4. **Silent no-op bugs in the archive/restore/transfer paths.** Three Size
   queries used the camelCase `subProduct` field; the Size schema field is
   `subproduct` (lowercase). Mongo field names are case-sensitive, so
   `archiveSubProduct`, `restoreSubProduct` and `transferSubProduct` never
   touched their Size docs. `restoreSubProduct` also wrote `subProduct.availability`
   (no such field on SubProduct — dropped by Mongoose), and
   `transferSubProduct` read `size.value` (undefined — the field is `size`).
   `size.metadata` writes were dropped too — Size had no metadata field.

## What changed

- **NEW `server/services/subproduct-deletion.js`** — `assessSubProductDeletionHistory`
  / `assertSubProductDeletable` (exports `REFERENCES` too). Queries 27
  collections (orders, sales, carts, inventory/warehouse ledgers, purchases,
  transfers, vendor bills/returns, reviews, kiosk scans, POS combos,
  promotions, venue consumption/commitments, recipe versions, bundle-deal
  cross-references…). Any hit → ConflictError telling the operator to ARCHIVE
  instead. Deliberately not blockers: PriceHistory / Pricelist / Shipping /
  IngredientProfile / Notification (derived or ephemeral — cleaned during an
  allowed deletion).
  **Path discipline:** every query path was schema-validated — several
  first-guesses did not exist (`InventoryMovement.subProductId`,
  `SalesOrder`/`Cart` root `subproduct`, `OpenedBottle.size`,
  `VenuePackageCommitment.reservations.*` — the real path is
  `stockReservations.*`, `VenueConsumptionEvent.items.size`,
  `POSCombo.choiceLines.items.*`). A path that doesn't exist is silently
  ignored by strictQuery, which would quietly narrow the guard — the
  reference-path assertion in `__tests__/subProductDeletionHistory.test.js`
  fails if any path is invented.
- **`deleteSubProduct`** now runs the history guard FIRST, then the existing
  nonzero-warehouse-stock refusal, then cleans WarehouseStock zero rows,
  deletes the sizes, drops derived records (PriceHistory, Shipping,
  IngredientProfile, unsets Pricelist.subProduct), and removes the SubProduct.
- **Archive/restore/transfer field fixes** (camelCase → `subproduct`;
  `size.value` → `size.size`; restore writes `stockStatus` instead of the
  nonexistent `availability`; archive sets sizes `availability: 'discontinued'`).
- **`models/Size.js`** gained a `metadata: Mixed` field so transfer/archive
  metadata writes persist.
- **`services/size-deletion.js`** gained the missing size-level references
  (OpenedBottle `source.size`, VenueConsumptionEvent `items.size`,
  VenueEventPackage `size`/`components.size`, VenuePackageCommitment
  `packageSnapshot.*.size` + `stockReservations.size`, RecipeVersion
  `output.size`) — `deleteSize` and the update-path size removals are now
  guarded against those too.
- **NEW unit tests**: `__tests__/subProductDeletionHistory.test.js` (reference
  paths must exist on schemas — the strictQuery silent-narrowing trap; hit
  blocks with an archive-pointing reason; clean listing is deletable) and the
  extended `modelNames` list in `__tests__/sizeDeletion.test.js` (33 tests).
- **NEW endpoint** `GET /api/subproducts/:id/deletion` (controller
  `getSubProductDeletionStatus`) — returns `{ canDelete, blockers, message }`
  so the admin UI can swap delete for archive when history exists. WIRED
  2026-11-13: the details-page toolbar and the create/edit page pre-check it
  before opening a delete confirm and offer archive instead when blocked
  (`product-details-toolbar.tsx` `ask()`, `create-edit/index.tsx`
  `requestDelete()`, service `getDeletionStatus`); bulk delete now toasts the
  first server refusal message.
- **NEW `scripts/mark-orphan-sizes-discontinued.js`** (dry-run default,
  `--apply`) marks orphan Size docs discontinued so movement history stays
  resolvable. **Superseded for the production residue on 2026-11-13**: the 3
  orphans were deleted outright via **NEW
  `scripts/delete-orphan-sizes.js`** (`--apply`; refuses orphans holding
  stock rows; JSON snapshot before delete). Production now has 0 orphan
  sizes.
- **NEW `scripts/trace-orphan-sizes.js`** (read-only diagnostic; `BARCODE=…`
  env filters to one barcode) reproduces the investigation.

## Verification

`DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0'`
- NEW `__tests__/subProductDeletionHistory.mongo.test.js`: 3/3 — history guard
  blocks with an archive-pointing message, clean listing deletes with its sizes
  (Product.tenantCount decremented), archive marks sizes discontinued and
  restore recomputes from stock.
- NEW `__tests__/subProductDeletionHistory.test.js` (unit): 4/4 — schema-path
  integrity of every reference, tenant ObjectId scoping, hit-blocks/no-hit-allows.
- `__tests__/sizeDeletion.test.js` 33/33 (modelNames extended with the five new
  reference models).
- `__tests__/subProduct*.test.js` 70/70, `subproduct*` 70/70,
  `inventory*` + `subProductImport*` 18/18, route declaration + guard
  consistency 24/24, `archivedSubProductInventory.mongo` 4/4.
- Full suite rerun after the path corrections: see
  `docs/superpowers/specs/RESUME-subproduct-crud-integrity-2026-11-13.md`.

## Rule going forward

Never hard-delete a SubProduct (or Size) that any transactional document
references — archive is the only safe lifecycle exit once history exists.
New deletion paths must reuse `subproduct-deletion.js` / `size-deletion.js`
rather than re-rolling reference checks.
