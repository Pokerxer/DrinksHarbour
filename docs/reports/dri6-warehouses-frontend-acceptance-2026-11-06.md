# DRI-17 — /warehouses: analysis / drill drawer / reports variant-plumbing (frontend acceptance)

**Issue:** DRI-17 (DRI-6 board scope extension, /warehouses frontend surfaces share)
**Agent:** Frontend Engineer · **Date:** 2026-11-06
**Status:** DONE — four surfaces fixed/audited + the stacked-chart page wire, legacy beverage byte-identical, verified on this issue.
**CEO decision applied** (`docs/memory/pos-retail-accommodation.md`, "/warehouses extension — 2026-11-06"): warehouse retail surfaces stop collapsing colour/option siblings — rows keyed by **exact Size ID**, presentation via the **shared full label**, identity separate from presentation, no per-industry branching, thresholds untouched.

## User-facing routes proven (board pin, 2026-11-06)

| Route (user-facing) | Shared component | DRI-17 defect point | Evidence |
|---|---|---|---|
| **`/warehouses/analysis`** | `WarehouseAnalysis` pivot/charts | 1 — `warehouse-analysis-helpers.ts` | two-variant fashion fixture ("m" Emerald vs Ivory) + legacy beverage control: grouped, two-level series and hierarchical pivot buckets stay **DISTINCT per Size ID** (`sz-emerald` vs `sz-ivory`) with full labels (`m · Emerald`, `m · Ivory`, `70cl` via `seriesLabels`/`keyLabels`) |
| **`/warehouses/[id]/analysis`** | `LocationAnalysis` (transfers section) | 3 — `warehouse-location-analysis/selected-transfers-report.ts` | colour-sibling transfer rows distinct with full identity labels; legacy sizeName-snapshot rows byte-identical to the verified `'750 ml / W1'` outputs |

Routed pages: `app/(hydrogen)/warehouses/analysis/page.tsx` → `shared/warehouses/warehouse-analysis` (helpers); `app/(hydrogen)/warehouses/[id]/analysis/page.tsx` → `shared/warehouses/warehouse-location-analysis` (LocationAnalysis). Both consume the fixed files above; drill-drawer evidence (surface 2) presents through the shared full label on the same `/warehouses/analysis` drill-downs.

## Surfaces

### 1. Analysis buckets — `warehouse-analysis-helpers.ts`
- `getRowKey('size')` now keys buckets by `sizeRowKey(r)` = `sizeId` with the established fallback to `sizeName` only for legacy rows lacking an ID (poReceive.helpers fallback pattern), then `—`.
- New `getRowLabel(r, dim)` — identity ≠ presentation: `size` presents the full identity label via the shared util; every other dimension's label stays its key (byte-identical presentation for all non-size dims).
- `computeGroupData` labels each bucket from its rows through `getRowLabel`; `computeMultiSeries` additionally returns `seriesLabels` (series Key → full identity label); `computeHierarchicalPivot` returns `keyLabels` (pivot-value key → full label) so the pivot/CSV/Excel exports render labels, not raw Size IDs.
- `formatG1Label(key, dim, keyLabels?)` resolves via the labels map, falling back to the raw key.

### 2. Drill drawer — `stock-drill-drawer.tsx`
- Size sort (former L126) orders by the full identity label (`sizeRowLabel`), so colour siblings sort distinctly; legacy rows sort exactly as before.
- Rows (former L324) render the full identity label + an optional discrete colour dot (`StockRowColorDot`, the POS `POSColorDot` pattern from `components/pos-size-color.tsx` — validated hex only, colour name as `title`; cosmetic, additive).

### 3. Page wire — `warehouse-analysis/index.tsx` (found in the continuation run)
- `computeMultiSeries` already returned `seriesLabels` and every `StackedChart` sub-view (table/line/bar/tooltip) already consumed the prop — but the page left it unwired, so stacked table headers, legends and tooltips showed raw Size IDs once a size column is grouped second. Fixed by passing `seriesLabels={multiSeries.seriesLabels}` to `<StackedChart>`.
- Regression: `warehouse-analysis/bar-layout.test.tsx` — `StackedChart` with two size siblings (`sz-emerald`/`sz-ivory`, labels `m · Emerald`/`m · Ivory`) renders the stacked table with full labels and never leaks `sz-*`.

### 4. Location report — `selected-transfers-report.ts`
- L73 key already on `sizeId || sizeName` (untouched).
- L78 composed label now `[flatRowSizeLabel(item), item.sku].join(' / ')` via the shared util. Verified transfer outputs for legacy sizeName-snapshot rows are **byte-identical** (the 7 pre-existing report tests, including the `'750 ml / W1'` assertions, pass unchanged).

### 5. Sub-product breakdown audit — `subproduct-warehouse-breakdown.tsx`
- Audited: no bucketing defect (one row per stock line), but the label rendered the raw size ref. Aligned via `lineSizeLabel` (`size-variant-label` util) so a populated Size carrying colour/option shows the full identity; colourless/legacy sizes resolve to the stored name byte-for-byte. No shared accessor (`sizeLabelOf`) semantics changed for other consumers.

## Support types (additive, DRI-16 consume side)
- `StockRow`: optional `colorName/colorHexCode/optionName` · `WarehouseStockRow.size` populated branch: optional variant fields · `TransferItem`: optional `colorName/colorHexCode/optionName` snapshot.
- New shared util `flatRowSizeLabel` in `utils/size-variant-label.ts` (denormalized-row flavour of `sizeVariantLabel`).
- **DRI-16 coordination:** server-side plumbing (populate selects / flattened payload) had **not** landed at acceptance time; all consume-side reading is optional, so legacy payloads (colourless, `sizeName` only) render and sort byte-identically before/after and the variant behaviour activates automatically when DRI-16 ships. Their server fixture + six-tenant coverage note live on DRI-16, referenced here per the brief.

## Verification (local, no commit/push/deploy)
- Focused vitest — `client/apps/admin`:
  - `warehouse-analysis-helpers.test.ts` — 20 pass, including the new DRI-17 suite: two-variant fashion fixture ("m" / Emerald / Ivory) + legacy beverage control → buckets **distinct per Size ID** (`sz-emerald` vs `sz-ivory`), full labels (`m · Emerald`, `m · Ivory`, `70cl`), legacy label byte-for-byte `70cl`, CSV contains labels not IDs, two-level series distinct with `seriesLabels`, hierarchical pivot distinct with `keyLabels`, colour-independent `formatG1Label` fallback.
  - `stock-drill-drawer.test.tsx` (new) — 4 pass: distinct variant rows + one dot per colour row, legacy row bare `70cl` with zero title-attrs, size-sort asc order `['70cl','m · Emerald','m · Ivory']`, dot renders only for valid hex.
  - `selected-transfers-report.test.ts` — 8 pass: colour siblings distinct with full labels; all pre-existing verified-label tests unchanged (legacy byte-identity evidence).
  - `bar-layout.test.tsx` — +1 regression (DRI-17): `StackedChart` table view presents series labels and never leaks raw Size IDs (guards the `index.tsx` page wire, surface 3).
  - Full `src/app/shared/warehouses` directory: **22 files / 113 tests pass** (re-run after the page wire + regression test).
- Type check (`tsc --noEmit`, admin app): clean on all touched files. Two unrelated pre-existing errors sit in the concurrent run's uncommitted `src/components/price-checker/use-compare-backup.test.ts` (missing `./compare-rows`) — not a DRI-17 surface.

## Guardrail compliance
- No per-industry branching; no swatch work beyond the single discrete drill dot; no threshold/stock-status default changes.
- Legacy beverage rows (sizeless/colourless) byte-identical before/after across all four surfaces (verified by unchanged pre-existing suites + explicit control assertions).
- No commit / push / deploy / production action performed.
