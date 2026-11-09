# Beverage bottle sizes restored to the size picker (2026-11-08)

New-row defaults (same change, 2026-11-08): `sizePresetMeasurements` in
`business-size-options.ts` — the seam that fills a new/changed size row — now
returns `unitsPerPack: 6` and `packaging: 'pack-6'` (the "6-Pack" option)
instead of `unitsPerPack: 1` / no packaging. `pack-N`/`case-N` codes keep
their own counts and packaging values ('pack-12' → 12, packaging 'pack-12').
The Size enum already accepted 'pack-6', and every server creation path
(`updateSubProduct` per-row create, standalone `addSize`, import pipeline)
already defaults `unitsPerPack` to 6 — this closes the last client seam.

## Complaint

On the sub-product size form, the standard beverage bottles — 75cl, 70cl,
50cl etc. — no longer appeared in the size options "as it was before" for
beverage businesses.

## Root cause

The size dropdown used to render the entire static `SIZE_OPTIONS` pool
(grouped by category). Commit `88b5be1c` switched it to per-type presets via
`businessSizeOptions(options, type, guidance, tenantIndustries)`:
presets come from `localSizeGuidance` or the server `GET
/api/products/size-guidance` (`getSizesForType`, `server/constants/productTypes.js`),
plus only `custom`/`variable`. That restriction dropped the plain metric
bottle sizes for several beverage types:

- wine/red_wine/… return only the named wine scale (`split-187ml`,
  `half-375ml`, `standard-750ml`, `magnum`, `jeroboam`, … + case/pack
  groups) — no `75cl`;
- beer returns `25/33/35/37.5/50cl` + cans + kegs — no `75cl`.

So a beverage listing's picker lost the bottle families the size picker always
showed previously.

## Fix (`client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/business-size-options.ts`)

- Added `BEVERAGE_COMMON_BASELINE` — the most-retailed bottles in sales-order
  (`75cl, 70cl, 50cl, 1L, 1.5L, 2L, 3L, 33cl, 35cl, 25cl, 5cl, 10cl, 20cl`).
- `businessSizeOptions` now, **only when `business === 'beverage'`**, unions
  the common bottles FIRST, then **the entire static `SIZE_OPTIONS` pool**
  (all bottle families, glassware, gift sets, single serves, multi-packs —
  the pre-restriction plenitude), then the type-only preset extras
  (`magnum`, `keg-20L`…), then `custom`/`variable` last — deduped by value.
  Non-beverage businesses are unchanged (guidance-only with neutral labels).
- `byCode` now keeps the FIRST metadata for a duplicated code — the Wine &
  Champagne entry carries the richer label ("75cl (Standard)") instead of the
  plain Spirits listing overwriting it.

## Behaviour

- Any beverage listing keeps every size the pre-restriction picker offered —
  a wine listing now renders 243 unique options (full static pool + the
  named-wine extras) with 75cl/70cl/50cl leading so the 12 quick-add chips
  surface them immediately.
- Wine keeps `magnum`, `split-187ml` etc.; beer keeps cans/kegs/cases; the
  union only adds, never removes.

## Verification

- `business-size-options.test.ts` — 9 vitest tests, incl. two new: baseline
  included + ordered for beverage types with the type presets preserved and
  dedupe verified; baseline withheld for non-beverage; and a permanent
  integration check importing the real `SIZE_OPTIONS` from `sizes.tsx`
  (wine/beer/whiskey) + the "offline presets aligned with every server product
  type" oracle still passing. Also: newly measured presets default to
  `Units Per Pack` 6 with packaging `pack-6` (6-Pack), while `pack-N`/`case-N`
  codes keep their own counts and packaging.
- Whole sub-product suite: 34 files / 176 tests green. `tsc --noEmit` clean
  for the touched files.

## Notes

- Server guidance is untouched: `getSizesForType` remains authoritative for
  per-type presets; the client just unions the baseline bottle families for
  beverage businesses.
- `models/Size.js` already accepts every baseline code (they mirror its enum).
