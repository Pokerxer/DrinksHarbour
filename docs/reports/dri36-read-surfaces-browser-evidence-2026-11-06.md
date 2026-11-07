# DRI-36 acceptance evidence — /inventory four READ surfaces browser-view sweep

Date: 2026-11-06 · Deliverer: DrinksHarbour Frontend Engineer · Issue: DRI-36
(board scope extension #10, child of DRI-2). Local/synthetic only — no
commit/push/deploy. Review-gated: issue moved to `in_review`, NOT done.

## Scope executed

Per `docs/memory/pos-retail-accommodation.md`, "«/inventory read surfaces
enumeration» (board scope extension #10)": browser-view evidence for the four
READ surfaces — (11) Stock, (12) Locations, (13) Valuation, (14) Moves
History — each bound to all seven industries. **No UI code change** was
expected or made (every surface was already exact-Size-ID with the shared
`size-variant-label` util per the CEO sweep); the slice is evidence delivery
in the DRI-34 vitest patterns. Recorded decisions bound the work: no
per-industry forks; legacy/sizeless rows byte-identical; valuations drill-down
stays the identity-aware browser (no new print or payload surface);
`tenant_staff` custom-permission gate untouched.

## Evidence — new focused suites (`vitest run`)

Synthetic rows follow the DRI-34 matrix in every suite: 750ml volume
colourless + Case of 6 (4500) pack, portion rows distinguished by optionName
only ('Regular plate · Jollof portion' vs 'Goat portion'), Fashion 'M ·
Emerald' vs 'M · Ivory', option-only electronics/home rows, identity-less
legacy control.

| # | Surface | Suite | Result |
|---|---------|-------|--------|
| 11 | Stock | `inventory-stock-read-identity.test.tsx` — real browser render over the flavour matrix: every row (Emerald/Ivory, both portions, electronics/home option-only, 750ml/Case of 6) shows the full composed identity in the Size cell and has its own selectable `Select stock line …` target; legacy control cell pinned to exact bytes `'75cl'`; CSV export (`stockViewCSV`) Size column composes `flatRowSizeLabel` per flavour with the legacy Size cell byte-identical; Size GROUP buckets key on the exact sizeId (`groupStockRows` → 9 distinct buckets) and a static pin asserts `inventory-stock-filter-panel.tsx` contains **zero** `size` references (its filters can never collapse or merge siblings) | 4/4 |
| 12 | Locations | `inventory-location-read-identity.test.tsx` — `locationReports` groups the StockRows per warehouse with per-variant rows intact (Emerald/Ivory as 2 of 5 Wyn-City lines; units 24, never the merged 7); variant search resolves the full composed label ('M Emerald') through the real `InventoryLocations` browser and the matched warehouse keeps all 5 sibling lines ('5 lines' — the group never collapses to the matched row); legacy bare `75cl` resolves through the same path; `filterLocations` name/units/value sorting is quantity/value arithmetic with outputs pinned for colourless/legacy rows | 3/3 |
| 13 | Valuation | `inventory-valuation-read-identity.test.tsx` — real render of `InventoryStockBrowser mode="valuation"` (the `/inventory/valuation` page): per-line value rows keyed by the exact Size — the two 'M' lines are separate rows each valued from its own cost basis (₦1,500 Emerald vs ₦1,600 Ivory, never a sizeName bucket), both portion lines separate (₦5,400 / ₦2,400); colourless 750ml/Case of 6 separate (₦800 / ₦1,440); legacy row keeps bare `'75cl'` bytes with its own ₦720; CSV Size column composes `flatRowSizeLabel` (legacy exact). Units KPI = 40; `getAllStock(includeUnstocked)` pinned. NO new print/payload surface exercised (decision 3) | 3/3 |
| 14 | Moves History | `inventory-history-read-identity.test.tsx` — real render of `StockHistoryPanel` over the subProduct-scoped history feed: line scope is exact-Size (the Emerald row's history holds ONLY the sz-em move; the same-size Ivory sibling is excluded; the 750ml beverage row keeps the 750ml move and excludes the pack sibling); all-product scope shows 7 move rows each with its own composed identity ('Wyn City · M · Emerald', '· M · Ivory', '· Regular plate · Jollof portion', '· Goat portion', '· 750ml', '· Case of 6 (4500)', identity-less '— · No size recorded'); legacy control: scope line `'Wyn City · 75cl'` + empty-state bytes; print doc (`buildStockHistoryDocument`) line-scope meta composes over the legacy fallback to the exact stored bytes ('Wyn City · 75cl' / 'Wyn City · M · Emerald') and every table row `Warehouse/Size` sub carries per-variant identity without merging | 4/4 |

## Suite counts (own runs, `vitest run`, 2026-11-06)

- DRI-36 suites: **4 files / 14 tests green**.
- Whole `app/shared/inventory` vitest dir: **51 files / 402 tests green**
  (DRI-34 baseline 47 files / 388 — growth is exactly the +4 suites/+14
  tests of this slice; nothing regressed).
- Full-admin `tsc --noEmit` (via `npm run type:check`): **0 errors**.

## Hard constraints audit

- **No UI code change** — only new test files were added; no shared source
  file edited by this slice (the one TS adjustment was local to a test
  fixture: the `InventoryMovement.size` wire shape is widened inside the
  suite because the DRI-29 populate lands colour/option verbatim at runtime
  while the service interface type is narrower; production types untouched).
- No per-industry forks — all labels assert the shared
  `flatRowSizeLabel`/`sizeLabel` compose paths.
- Legacy/sizeless rows byte-identical — pinned per surface (browser cell,
  CSV cell, scope lines, print meta, empty states).
- Valuation stays the identity-aware browser — decision 3 held; no print or
  payload surface was exercised or added.
- `tenant_staff` custom-permission gate / beverage-only `/platform`
  untouched. No commit/push/deploy.

## Atomic flag (REAL observation, NOT fixed in this slice)

`utils/print/stock-print.ts` `buildStockDoc` (the Stock Report / Inventory
Valuation Report / Count Sheet print document) renders the Size column as
bare `r.sizeName || '—'` — it does NOT compose the shared
`flatRowSizeLabel`. Retail same-size colour siblings therefore print
indistinguishable lines ('M', same product and sku). This is pre-existing
behaviour, is outside the four enumerated read surfaces (the sweep covered
the CSV export, browser rows and detail panel for 11; the client browser for
13) and predates this slice. Reported atomically per the issue instruction;
composition there (or a recorded print-snapshot rule for it) is a separate
explicit board decision — NOT fixed here.

## Coordination notes for the CEO/board

1. All four surfaces are verified identity-aware in the browser view; no
   follow-up is required from the frontend for the read surfaces.
2. The stock/valuation PRINT doc identity gap above is the only open item.
3. Working tree carries concurrent DRI-2 sibling work (expected; coordinated
   via commits).
