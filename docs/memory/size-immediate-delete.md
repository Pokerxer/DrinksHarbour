# Size removal deletes from the database immediately (2026-11-08)

## Complaint

On `/sub-products/[id]/edit`, removing a size that has no stock record showed
the row gone from the form, but the size reappeared after a refresh — the
database was never updated by the Remove action itself.

## Root cause

- The Remove button (`create-edit/components/RemoveSizeButton.tsx`) only
  removed the row from react-hook-form state (`remove(index)`), which is
  browser-local. Database deletion was deferred to the NEXT full form save:
  `updateSubProduct` compares the incoming `sizes` payload against the DB rows
  and deletes the ones the payload omits (`removedSizes` +
  `assertSizesDeletable` in `server/services/size-deletion.js`, applied in
  `updateSubProduct`).
- A direct reproduction (`server/__tests__/sizeDeletionPersist.mongo.test.js`)
  proved the save path deletes correctly when it actually fires with the row
  omitted. The failure mode is that the save frequently does not fire before
  the user refreshes/leaves — the beforeunload auto-save is best-effort and the
  browser can cancel it, so nothing was ever persisted.
- The server already had a purpose-built immediate endpoint,
  `DELETE /api/subproducts/:id/sizes/:sizeId` (`deleteSize` service: checks
  stock/history via `sizeDeletionStatus`, deletes `WarehouseStock` rows,
  deletes the `Size` document, unlinks it from `subProduct.sizes`, fixes
  `defaultSize`) — but the edit UI never called it.

## Fix

- `RemoveSizeButton` now deletes from the database on confirm: it calls
  `DELETE /api/subproducts/:id/sizes/:sizeId` right after the eligibility check
  passes, then drops the row from the form and toasts "Size deleted from
  product". A rejection (stock or referenced history appeared since the check)
  keeps the dialog open and shows the server reason; the row survives.
- Rows without a `_id` (unsaved new rows) still remove form-locally — no
  document exists to delete.
- Dialog copy updated: "The size is deleted from the database immediately — no
  save needed."
- Both gates stay intact: the eligibility check (`GET …/deletion`) before
  enabling confirm, and the server-side `assertSizesDeletable` re-check inside
  `deleteSize`/`updateSubProduct` as defense in depth.

## Verification

- `server/__tests__/sizeDeletionPersist.mongo.test.js` — 2 tests: (1) a save
  payload omitting a no-stock size deletes the Size doc and unlinks it; (2)
  `service.deleteSize` deletes a no-stock size immediately and rejects a size
  with stock. Run with
  `DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' node --test __tests__/sizeDeletionPersist.mongo.test.js`
- `RemoveSizeButton.test.tsx` — 3 vitest tests: saved row triggers DELETE then
  `onRemove`; rejection keeps the row and surfaces the reason; unsaved row
  removes locally with no network call.
- `npx vitest run src/app/shared/ecommerce/sub-product` — 34 files, 173 tests
  green. Server `sizeDeletion.test.js` + `sizePricingFieldsPersist.test.js`
  (33 tests) green. `tsc --noEmit` clean for the touched files.

## Conventions preserved

Deletion eligibility still comes from the server (the browser's stock counters
are never trusted), and marketplace orders/carts/reviews referencing a size
still block deletion exactly as before.
