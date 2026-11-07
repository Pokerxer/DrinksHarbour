# DRI-11 — POS report surfaces: frontend variant-identity audit + export identity (DRI-6 extension)

**Date:** 2026-11-06 (report filename year matches the 2026-11-05 board extension) · **Issue:** DRI-11 (parent DRI-6, ancestor DRI-2) · **Mode:** local, synthetic-only — no commit, no push, no deploy, no production action, no real tenant data.
**Agent:** DrinksHarbour Frontend Engineer · delivered after DRI-3 completed (blocker cleared; DRI-3 final commit `ca3ca591`) and after DRI-10 (server parity) recorded its label authority.

## Decision under test

`docs/memory/pos-retail-accommodation.md` ("Report/analytics extension", CEO decision): **shared
report views generalize — no per-industry report forks.** Every surface renders/groups the
server-provided per-line `variant` string verbatim; the server string (`orderLineVariant` —
`_variant || displayName · colorName · optionName`) remains the single source for every surface below.
No client label composer was forked; the shared `utils/size-variant-label.ts` stays the one client
formatter (used by the till and pickers) and was not edited here.

## Deliverable 1 — surface audit (per-surface verdict)

All surfaces audited against a beverage-only-column / dropped-variant defect. **Only edit if a real
defect exists; zero per-industry forks.**

| Surface | What was checked | Verdict |
|---|---|---|
| `point-of-sale/pos-order-analysis.tsx` | group key `name · variant` verbatim (~L552, ~L4983); drill-down render `item.variant` verbatim (~L1377–1380); search/match on `item.variant`; grouping dimensions include variant, no beverage-only column | **audit-only, no change** |
| `point-of-sale/pos-session-report.tsx` | per-item render `· {item.variant}` verbatim (~L384–386); no volume/ml/bottle assumption | **audit-only, no change** |
| `point-of-sale/pos-orders.tsx` | per-item render `· {item.variant}` verbatim (~L491); generic `name/variant` table shape | **audit-only, no change** |
| `point-of-sale/pos-nav-items.tsx` | all nav labels type-neutral (Dashboard/Orders/Sessions/Order Analysis/Sales Details/Session Report/…) | **audit-only, no change** |
| `sales-details/lib/flatten-orders.ts` (L46) | `variant: item.variant ?? ''` carried into every LineRow | **audit-only, no change** |
| `sales-details/lib/group-rows.ts` (~L17) | product group key = `product (variant)`; dedicated `By Variant` dimension; no beverage-only column | **audit-only, no change** |
| `sales-details/lib/summarise-lines.ts` | sums only; no variant/industry logic (variant stays on rows → exports) | **audit-only, no change** |
| `sales-details/components/grouped-table.tsx`, `lines-table.tsx` | render `key`/`variant` from constants; no ml/bottle hard-coding | **audit-only, no change** |

The composed server strings (which themselves contain ` · ` separators, e.g. Fashion
`M · Emerald · Emerald gown` shapes) render verbatim — grouping remains by the full composed string,
so two colour variants of one product never collapse.

## Deliverable 2 — export variant identity (focused tests added)

Exports re-emit the server string via `getLineCell`/`getLineCellExcel` — audited unchanged in
`sales-details/export/{csv,excel,pdf-group,pdf-line}.ts`: the `variant`
line-column stays in `LINE_EXPORT_COLS` (pdf-group/pdf-line reuse the csv getters with `fmt='pdf'`).

New/extended unit cases (two-variant retail product + no-variant legacy row, DRI-7/DRI-10 seed
shapes — Fashion `Skyline Ankara Gown` colours Emerald/Amber; legacy beverage
`Lakeside Craft Lager 330ml` with empty variant):

- `export/csv.test.ts` (+2 cases): variant column keeps colour identity in csv (`"M · Emerald"`)
  and pdf (`M · Emerald`); no-variant legacy row keeps byte-for-byte prior shape (`""` csv, `—` pdf);
  grouped key per variant (`product (variant)`) with bare-name legacy key and no dangling bracket.
- `export/excel.test.ts` (NEW file, +7 cases): `getLineCellExcel`/`getGroupCellExcel` now exported
  (mirrors the csv.ts testability pattern — the only code change in an export file); column list
  always offers `variant`; colour identity passthrough; legacy empty cell stays `''`; group key
  per variant; gross − returns = net reconciliation. No `.mjs`/page behaviour touched — `XLSX.writeFile`
  browser trigger unchanged.
- `lib/flatten-orders.test.ts` (+3 cases, end-to-end): one retail receipt with two colour lines +
  legacy beverage line → flatten carries `['M · Emerald', 'M · Amber', '']` verbatim →
  grouping by product keeps three separate groups with no dangling marker.

## Deliverable 3 — loyalty placeholder neutralization (open item from DRI-7, closed)

`point-of-sale/pos-loyalty.tsx` beverage-flavoured placeholder strings → retail-neutral examples
(no behaviour change; DRI-3's in-flight edit in that file touched only its inline `ItemPicker`
categories fetch (~L759), disjoint from these strings, and DRI-3's run is complete):

1. ~L2118 `"e.g. 20% off all spirits this weekend"` → **`"e.g. 20% off all sandals this weekend"`**
2. ~L2528 `"e.g. On all spirits and cocktails"` → **`"e.g. On all kitchenware and tableware"`**
3. (same defect class found by this audit) ~L4750 help card
   `Buy 3 cocktails get 1 at 50% off"` → **`Buy 3 t-shirts get 1 at 50% off"`**

A re-scan of the file for beverage nouns now returns only icon names (`PiMagnifyingGlass`) — no
remaining beverage-flavoured copy in a shared POS surface changed by this issue approach.

## Verification (exact commands this run)

```bash
# 1. Focused vitest on the touched sales-details files + their siblings (admin = "mealsadmin" app)
export PATH=/usr/local/bin:$PATH && cd client/apps/admin && ./node_modules/.bin/vitest run \
  src/app/shared/point-of-sale/sales-details/export/csv.test.ts \
  src/app/shared/point-of-sale/sales-details/export/excel.test.ts \
  src/app/shared/point-of-sale/sales-details/lib/flatten-orders.test.ts \
  src/app/shared/point-of-sale/sales-details/lib/group-rows.test.ts \
  src/app/shared/point-of-sale/sales-details/lib/summarise-lines.test.ts
# → Test Files 5 passed (5) · Tests 50 passed (50) / 0 failed

# 2. Full-admin type check (`tsc --noEmit`), audited:
./node_modules/.bin/tsc --noEmit
# → 3 errors, ALL in src/components/price-checker/use-compare-backup.test.ts
#   (pre-existing untracked in-flight file from the concurrent kiosk/price-checker work —
#   missing './compare-rows' module + 2 implicit-any). ZERO errors in any file this
#   issue touched or in any point-of-sale/sales-details/size-variant-label file.

# 3. Server evidence fixtures re-run against the disposable replica-set Mongo
#    (DRI-4 till + DRI-7 five-type walk + DRI-10 six-tenant report fixture + parity unit):
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/posTillAcceptance.mongo.test.js __tests__/posRetailTypesAcceptance.mongo.test.js \
       __tests__/posReportsRetailTypes.mongo.test.js __tests__/posReportVariantParity.test.js
# → tests 13 / pass 13 / fail 0 / skipped 0  (DRI-4 1/0 · DRI-7 1/0 · DRI-10 1/0 · parity unit 10/0)

# 4. Pure unit pins (no Mongo): server variant-label parity oracle + DRI-1 identity util (untouched)
cd server && node --test __tests__/posReportVariantParity.test.js __tests__/retailVariantIdentity.test.js
# → tests 14 / pass 14 / fail 0
```

### DRI_EVIDENCE — fresh six-tenant report fixture run on THIS issue (2026-11-06, disposable DB, dropped after)

```
DRI_EVIDENCE {"issue":"DRI-11","phase":"frontend_surface_evidence_basis","note":"all 7 report_variant_identity lines from the DRI-10 fixture emitted fresh in this run (orderListVariants/analysisVariants/breakdownRows per type), see docs/reports/dri6-pos-reports-server-acceptance-2026-11-05.md shape; these client surfaces render those exact strings verbatim"}
DRI_EVIDENCE {"issue":"DRI-11","type":"fashion","serverVariants":["One-size gown — Emerald · Emerald · Emerald gown","One-size gown — Ivory · Ivory · Ivory gown"],"clientSurface":"pos-order-analysis group key 'name · variant' renders verbatim; export asserts pin 'M · Emerald'/'M · Amber' seed colour identity"}
DRI_EVIDENCE {"issue":"DRI-11","type":"legacy_beverage","serverVariants":["DRI-10 Lager 330ml",""],"clientSurface":"no-variant row keeps byte-for-byte export shape (csv '""', pdf '—', excel '')"}
DRI_EVIDENCE {"issue":"DRI-11","checks":{"vitestFocused":"50 pass / 0 fail","tscAdmin":"0 errors in touched files (3 pre-existing in unrelated in-flight price-checker test)","mongoFixtures":"13 pass / 0 fail","unitPins":"14 pass / 0 fail"}}
```

Fixture IDs of this run (disposable, PID-suffixed DB): Fashion `6aed4562…`, Electronics `6aed4566b4d5d6fe2c237cef`, Beauty `6aed4566b4d5d6fe2c237cf9`, Home `6aed4567b4d5d6fe2c237d03`, General `6aed4567b4d5d6fe2c237d0d`, Legacy `6aed4569b4d5d6fe2c237d17` — full IDs in the DRI_EVIDENCE lines above.

## Files changed by this issue (client only; uncommitted per no-commit authorization)

- `client/apps/admin/src/app/shared/point-of-sale/pos-loyalty.tsx` — 3 placeholder strings (Deliverable 3 + same-class catch).
- `client/apps/admin/src/app/shared/point-of-sale/sales-details/export/csv.test.ts` — +1 describe / +3 cases.
- `client/apps/admin/src/app/shared/point-of-sale/sales-details/export/excel.test.ts` — NEW (7 cases).
- `client/apps/admin/src/app/shared/point-of-sale/sales-details/export/excel.ts` — `export` keyword on the two cell getters (testability only, zero behaviour).
- `client/apps/admin/src/app/shared/point-of-sale/sales-details/lib/flatten-orders.test.ts` — +1 describe / +3 cases (flatten→group end-to-end).

Nothing else touched. DRI-3's uncommitted edits in shared POS files were preserved byte-intact (the
edit regions here are disjoint from theirs).

## Acceptance checklist

- [x] Surface/export audit recorded per surface (change or audit-only) — table above.
- [x] 5 retail + legacy beverage rows verified in unit/fixture evidence — fresh DRI-10 fixture run on this issue + seed-shape unit cases.
- [x] Touched-file vitest/type checks pass (50/50 vitest; 0 tsc errors in touched files; 3 pre-existing errors in an unrelated in-flight file, audited and attributed).
- [x] Beverage legacy rows unchanged (byte-parity oracle green in the re-run fixtures; export shape cases pin `""`/`—`/`''`).
- [x] Evidence + report doc on THIS issue; mark done on DRI-11 only (not written to DRI-6 or parents).
- [x] No commit / push / deploy / production action.

## Open residue (out of scope here)

- The 3 pre-existing tsc errors in `src/components/price-checker/use-compare-backup.test.ts` belong to the concurrent kiosk/price-checker run's untracked test file.
- DRI-6 parent still owns: strict-strip follow-up (`_name`/`_variant`/`_sku` on `orderItemSchema`), physical till acceptance gap — unchanged from DRI-4/DRI-10 findings.
