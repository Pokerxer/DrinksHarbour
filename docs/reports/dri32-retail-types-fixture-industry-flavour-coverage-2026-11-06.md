# DRI-32 — retail-types fixture industry-flavour coverage (7-industry board correction)

Delivered: 2026-11-06 · Agent: DrinksHarbour Backend Engineer · Issue: DRI-32 (parent DRI-2)
Scope: **fixture/verification only** — no server source change, no commit/push/deploy.

## What the board correction asked

Board comment `9d3ea157` (2026-11-06) corrects accommodation to cover **ALL**
businesses under the canonical 7-industry frame (`server/constants/industries.js`).
Every retail-types Mongo fixture must now exercise **every flavour the surface
uses**: ≥1 profiled beverage tenant, ≥1 hospitality/food-service tenant
(Restaurant), ≥1 retail tenant (Fashion), plus the unprofiled legacy control.
CEO-verified gap: all five fixtures carried 5 retail verticals + only the
unprofiled legacy control.

## What was delivered

The two missing flavours were added to each fixture's seeded tenant matrix
(**5 retail + beverage + restaurant + legacy control = 8 tenants per matrix**;
the DRI-7 till fixture grows 5 → 7 tenants, see below). Seed shapes:

- **Profiled beverage — `Wine Merchant` (→ `['beverage']`)**, Product `wine`
  (isAlcoholic), with TWO colourless rows: `750ml` volume row
  (`unitType volume_ml`, `volumeMl 750`) and a `Case of 6` pack row
  (`unitType count_case`, `volumeMl 4500`) — **no `colorName`/`colorHexCode`/
  `optionName` on the Size**: exactly the identity-free shape the legacy
  control stores, on volume/pack unitTypes.
- **Hospitality/food-service — `Restaurant` (→ `['food-service','hospitality',
  'beverage']`)**, Product `foodservice_staples`, with two SAME-size portion
  rows (`size 'Regular plate'`, `unitType 'serving'`) distinguished by
  **`optionName` identity only** (`'Jollof portion'` / `'Goat portion'`) — the
  identity carrier the surfaces' payloads/composers already use. No new venue
  endpoints invented (per scope; kitchen-screen relevance stays the recorded
  DRI-6 decision point).
- **Retail (Fashion) and the legacy controls kept EXACTLY as-is** — retail
  rows byte-identical produced data; all legacy control rows byte-identical
  (assertions unchanged: `[' _id','displayName','size']` populated key sets,
  absent-packaging print bytes, `bottle` fallback untouched).

Per-fixture deliveries:

| Fixture file | Matrix | New assertions at the established shape |
|---|---|---|
| `server/__tests__/inventoryMovementsRetailTypes.mongo.test.js` (LEADING, DRI-29/DRI-31 pattern) | 6 → 8 tenants in the DRI-29 test; DRI-31 test untouched | Beverage rows emit the legacy control's key set (`_id/displayName/size`, no identity keys); Restaurant rows carry `optionName` verbatim (`_id/displayName/optionName/size`); exact-Size-ID keys, crafted counts, cross-tenant 404s, tenant-scoped projections unchanged |
| `server/__tests__/warehouseRetailTypes.mongo.test.js` (DRI-16 pattern) | 6 → 8 | stock/all rows distinct per exact sizeId with per-flavour identity presence (colour / option-only / identity-free); `/:id/stock` populated Size key set for the identity-free rows equals the control projection; stock-by-warehouse and transfer-item identity checks carry the option-only and identity-free branches |
| `server/__tests__/purchasesRetailTypes.mongo.test.js` (DRI-14/15 pattern) | 6 → 8 in the E2E test; DRI-15 analytics test untouched | Same PO → partial receive → complete → validate → return → over-return refused → bill → print walk; beverage rows take NO entry packaging (legacy `bottle` fallback byte-identical), Restaurant portion rows carry the entry default `'units'`; bill-print labels compose via the shared formatter only when the populated Size carries identity (snapshot fallback for the packaging-less volume rows) |
| `server/__tests__/posRetailTypesAcceptance.mongo.test.js` (DRI-7 pattern) | 5 → 7 tenants (the unprofiled legacy till control remains the byte-stable DRI-4 fixture, re-run separately) | Picker identity per flavour (colour trio / option only / undefined identity), computed sale money (`2×A + 1×B` at each row's seeded price — Wine Merchant case row 3000), per-row stock deduction (8/9), oversell 409, drawer totals; cross-type isolation sweep now 7 × 6 = 42 refusals, zero movements, 7 paid receipts |
| `server/__tests__/posReportsRetailTypes.mongo.test.js` (DRI-10 pattern) | 6 → 8 | Order-list/order-analysis variant labels computed from the seeded shapes through the same `tillLabel` compose the server runs — plain beverage displayName (no separator), Restaurant `Regular plate · Jollof portion`, retail colour compose; Z-report/daily/summary breakdowns keep row identity; tenant-isolation sweep now 8 × 7 |

No hospitality venue-serving/kitchen flow was exercised beyond the portion
rows: none of the five surfaces has an existing venue endpoint to piggyback on,
and inventing one is out of scope.

## Result: NO defect surfaced (the industry-agnostic contract held)

Every new row **passed through every assert as-is** — no server label/identity
code change was needed, matching the recorded decisions (shared composer, no
per-industry forks). The only red herring during the run was a fixture-side
typo (`state.flavour` vs `def.flavour`) in the purchases print branch, fixed in
the fixture itself; two fixture typos elsewhere (`seedType` return shape) were
also fixture-side only.

## Verification evidence (all run from `server/`, node 26.13.0, plain
`node --test` — `npm test` is broken)

| Check | Command | Result |
|---|---|---|
| Touched fixture, full file | `DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' node --test __tests__/inventoryMovementsRetailTypes.mongo.test.js` | **2/2** (DRI-29 8-tenant walk + DRI-31 movements-route row) |
| Touched fixture, full file | `… node --test __tests__/warehouseRetailTypes.mongo.test.js` | **1/1** |
| Touched fixture, full file | `… node --test __tests__/purchasesRetailTypes.mongo.test.js` | **2/2** (E2E 8-tenant + DRI-15 analytics pin re-verified unmodified) |
| Touched fixture, full file | `… node --test __tests__/posRetailTypesAcceptance.mongo.test.js` | **1/1** (7 tenants, 42-pair sweep) |
| Touched fixture, full file | `… node --test __tests__/posReportsRetailTypes.mongo.test.js` | **1/1** (8 tenants) |
| All five together | single `node --test` invocation of the five files | **7 tests / 7 pass / 0 fail** |
| Legacy till control (byte-stable, NOT modified) | `… node --test __tests__/posTillAcceptance.mongo.test.js` | **1/1** |
| Focused plain suites (10 files, not modified) | `node --test __tests__/stockAdjustment.test.js __tests__/inventoryAdjustmentHistory.test.js __tests__/inventoryInternalHistory.test.js __tests__/warehouseMovementHistory.test.js __tests__/retailVariantIdentity.test.js __tests__/posReportVariantParity.test.js __tests__/poReceive.helpers.test.js __tests__/vendorReturn.counters.test.js __tests__/purchaseAnalyticsLedger.test.js __tests__/warehouseTransferTotals.test.js` | **75/75** |

Git footprint: exactly the five fixture files (untracked, consistent with the
local-only delivery convention). No server source, config, policy or eligibility
file touched; `tenant_staff` custom-permission gates untouched; beverage-only
`/platform` scope untouched; print surfaces kept stored snapshot bytes.

## Memory/spec updates

- `docs/memory/pos-retail-accommodation.md` — DRI-32 delivery section added
  under the 7-industry board correction.
- `docs/superpowers/specs/RESUME-paperclip-business-expansion.md` — DRI-32
  marked delivered.

## Open items (none introduced by this slice)

- No new defect to flag. The fixture-only contract closes here; remaining
  7-industry surface extension work belongs to the parent DRI-2/DRI-6 lanes.
