# DRI-30 — /inventory retail variant identity, frontend acceptance (issue DRI-6, child DRI-30)

Date: 2026-11-06 · Frontend Engineer (agent 4ba1f928) · Scope: the 16-client-file
`app/shared/inventory/` `sizeName` sweep → exact-Size-ID keys + shared labels.
CEO decision record: `docs/memory/pos-retail-accommodation.md` ("/inventory
extension — 2026-11-06, board scope extension #7"). Sequenced after DRI-17 (util
landed). DRI-29's server populate (`inventory.service.js` `getMovements` size
populate gains `colorName colorHexCode optionName`, emit-only-with-identity) was
already landed when this run started.

## What landed (16 sweep files, no per-industry forks anywhere)

Label source is the shared DRI-17 util (`client/apps/admin/src/utils/size-variant-label.ts`,
untracked-but-present from DRI-17; no new composer forked):

| File | Change |
|---|---|
| `inventory-stock-search.ts` (8 refs) | `size` SHORTHAND extractor, `fieldTextFor`, the size FIELD_WEIGHT, `STOCK_FIELD_VALUES.size`, size sort comparator all consume `flatRowSizeLabel`; Size GROUP buckets key by exact `sizeId` (`sizeId ‖ sizeName ‖ '—'` fallback, warehouse-analysis `sizeRowKey` pattern) and present the full shared label. The two config struct `field: 'sizeName'` pointers are deliberate keeps — evaluation flows by id through `STOCK_FIELD_VALUES`. |
| `inventory-stock-browser.tsx` (2 refs) | Size cell + select-line aria-label → composed label; legacy rows byte-identical. |
| `inventory-stock-view.ts` | CSV Size cell → composed label (additive columns unchanged). |
| `inventory-stock-detail-header.tsx` · `inventory-stock-detail-panel.tsx` | "sizeName · warehouseName" line and the Size property row → `flatRowSizeLabel`. |
| `inventory-stock-history.ts` + `inventory-stock-history-panel.tsx` | Scope labels (`Wyn City · M · Emerald`; `All warehouses and sizes` strings unchanged) via `flatRowSizeLabel`. |
| `inventory-location-report.ts` | Location search text row line composes the label → retail variant colour searchable. |
| `use-adjustment-entry.ts` | Size picker label composes (sizeId already the key); test file is DRI-27-held, untouched. |
| `inventory-receipts-support.tsx` | `sizeLabel(m)` composes `populatedSizeIdentity(m.size)` → `sizeVariantLabel` when identity present; the legacy fallback chain `sizeName ?? size.displayName ?? size.size ?? null` preserved byte-for-byte (note: NOT `lineSizeLabel`, which would change the sizeless legacy shape). Activates on DRI-29 payloads — already landed; receipts browser list, CSV export and GRN print render it. Per CEO decision item 3 (movement surfaces), not the pricelist print freeze. |
| `inventory-pricelist-print.ts` (12 refs) | Sort keys at the three pricelist sort sites (pricelist lines, CSV grid, `resolveCatalogLines`) via new exported `pricelistSizeCmp` (composed-label compare, exact `sizeId` tiebreak); `PricelistPrintRow`/`PricableStockLine` gain optional additive `colorName/optionName`, carried through `dedupeRowsForPricelist`. `buildPricelistCsv` Size cells compose (CSV/Excel/web-preview = browser-view rule per CEO decision). **Print HTML cells (`lineHtml`) UNTOUCHED — stored sizeName bytes, no identity column (CEO print decision, so-print/bill-print DRI-14 precedent).** Catalog fallback chain `s.displayName ‖ s.sizeName ‖ s.size ‖ 'Standard'` untouched. |
| `inventory-pricelist-columns.ts` | `buildPriceColumnGrid` sort → `pricelistSizeCmp`. |
| `inventory-pricelist-preview.tsx` | Size sub-line → composed label (browser view). |
| `inventory-dashboard.tsx` · `inventory-dashboard-export.ts` | Low-stock product label + CSV Size cell → composed label. |
| `inventory-adjustment-entry-data.ts` | Verified sweep-correction: ZERO raw sizeName; untouched. |

## Identity ≠ presentation

- Bucket/group keys: exact `sizeId` (fallback `sizeName` only for id-less legacy
  rows, then `—`) — same-size Emerald/Ivory never collapse.
- Presentation: `flatRowSizeLabel` everywhere a row-size label renders; legacy
  beverage rows resolve to the stored `sizeName` byte-for-byte (every legacy row
  lacks colour/option), sizeless rows keep the existing `—`/empty fallback
  shapes (`flatRowSizeLabel(r) ‖ r.sizeName` preserves old raw shapes in the
  browser/history detail strings and `‖ '—'` in group labels).
- `tenant_staff` custom-permission middleware gating: UNTOUCHED.

## DRI-29 payload coordination (item 3 verification status)

- Server populate landed (`server/services/inventory.service.js` L768–777,
  DRI-29) → the movement compose is ACTIVE on real payloads, verified by unit
  mocks shaped to the wire payload in `inventory-stock-history.test.ts`
  (populated retail Size → `M · Emerald` / `M · Wi-Fi`; populated legacy Size →
  bare `75cl`; `sizeName` snapshot precedence preserved; sizeless → null).
- No payload-dependent assertion remains pending on my side; the Mongo-fixture
  proof of the movements payload itself belongs to DRI-29's evidence per the
  delegation split.

## Tests (extended existing suites; no new suite except the missing columns file)

- `inventory-stock-search.test.ts` — new describe: Emerald/Ivory same-size 'M'
  distinct buckets with full labels; legacy row group label byte-pin; sizeless
  rows stay one `—` bucket; `size:emerald` shorthand + free-text vs sibling
  isolation; composed-label filter matching; deterministic Emerald<Ivory sort.
- `inventory-stock-browser.test.tsx` — jsdom: same-size colour siblings render
  `Select stock line Shirt w1 M · Emerald`/`Ivory`; legacy `Wine w1 75cl`
  aria-label + size cell byte-pin.
- `inventory-pricelist-print.test.ts` — dedupe carries variant identity; same-
  size sibling sort determinism; legacy ordering unchanged; **print HTML keeps
  stored sizeName bytes and never contains the composed identity**; CSV composes
  while legacy stays `"70cl"`.
- `inventory-pricelist-columns.test.ts` (new — module had no test file) — grid
  keeps siblings distinct, ordered, legacy row byte-identical.
- `inventory-stock-history.test.ts` — movement `sizeLabel` compose + legacy
  parity (see DRI-29 section above); history scope label compose + legacy pin.
- `inventory-location-report.test.ts` — variant colour searchable via composed
  label; legacy `léon` search unchanged.

## Verification (local)

- `client/apps/admin` vitest, whole `src/app/shared/inventory` dir:
  **39 files / 364 tests, 0 fail** — includes DRI-27's mid-edit held test files
  (unmodified by this run, still green → compatible).
- Focused re-run of edited suites (history, browser, search): 109/109.
- `tsc --noEmit -p tsconfig.json` full admin app: **0 errors**.
- DRI-27 mid-edit files audit-only: `services/inventory.service.ts` (untouched —
  additive movement identity typing deliberately avoided; the test casts the
  populated ref and the compose reaches it via `populatedSizeIdentity(unknown)`),
  plus the eight held test files and `VenueInventoryCount.js`. DRI-29's server
  file consumed, not edited. Concurrent edits elsewhere in the tree
  (`format-zod-errors.ts`, `bill-print.ts`) belong to other runs — untouched.

Local/synthetic only; no commit/deploy/production.
