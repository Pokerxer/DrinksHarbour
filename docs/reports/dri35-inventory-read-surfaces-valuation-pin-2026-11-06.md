# DRI-35 — /inventory read surfaces backend slice: valuation KPI per-Size payload pin + stock/locations/history feed confirmation (board extension #10)

**Date:** 2026-11-06 · **Issue:** DRI-35 (parent DRI-2, board extension #10 — comment `ae8ec528`, user-direct) · **Mode:** local, synthetic-only — no commit, no push, no deploy, no production action, no real tenant data, **no server source edits**.
**Agent:** DrinksHarbour Backend Engineer · workspace concurrently held by the DRI-2 run; nothing written to any file outside this slice's report set and the new test file.

## 1. Valuation KPI payload pin (item 13, server half) — NEW fixture

`server/__tests__/inventoryValuationRetailTypes.mongo.test.js` (NEW, 3 tests) extends the DRI-33
fixture family (`__tests__/fixtures/dri33VariantMatrix.js`, re-used unmodified — no edits to the
shared module) with per-Size valuation seeding and asserts through the REAL HTTP path
`GET /api/inventory/valuation` on the real inventory router (`protect` + `attachTenant` +
`requireOwnTenant` + `authorizeTenantAction('inventory:read')` + the wired `cacheReport`),
disposable replica-set Mongo on :29127, 8-tenant matrix (five retail types + profiled beverage
'Wine Merchant' + Restaurant + unprofiled legacy byte-parity control).

Per-Size layout (patched onto the Size docs after the fixture seed; every line distinct —
this is what makes any coarser bucketing provably yield different numbers):

| Per tenant | line | units | cost | sell |
|---|---|---|---|---|
| subA size[0] | 6 + 4 over two warehouses | 10 | 1000 | 2000 |
| subA size[1] | 3 + 2 over two warehouses | 5 | 3000 | 4000 |
| subB size[0] | 1 | 1 | 500 | 300 |
| subB size[1] | 2 | 2 | 250 | 600 |

Pinned KPI (profiled flavours): **totalItems 2 · totalUnits 18 · totalValue 26 000 ·
totalRetailValue 41 500 · potentialProfit 15 500**. Legacy control (single Size row per sub:
10 @ 1000 / 5 @ 3000, exact board example numbers): **totalItems 2 · totalUnits 15 ·
totalValue 25 000 · totalRetailValue 40 000 · potentialProfit 15 000** (the board's "Ivory"
analogue reads cost 3000 so the per-line sum lands at 25 000).

- **Per-line proof, no sizeName/aggregate bucketing:** the retail flavours stock both
  variants under ONE identical `sizeName` string ('M' both, or 'Regular plate' both) with
  distinct per-Size costs, so a sizeName bucket, a subProduct bucket, or the
  SubProduct-aggregate branch would collapse Emerald/Ivory (and Jollof/Goat) into one line
  with one cost — none of those shapes can produce the exact pinned totals. `totalItems = 2`
  proves distinct **subProducts** — not the 4 Size rows, not 1, not sizeName-counted.
- **Byte-identical KPI shape:** `Object.keys(data)` deep-equals exactly the pre-change five
  keys (`totalItems totalUnits totalValue totalRetailValue potentialProfit`) on both branches
  — the KPI stays **KPI-only**, no per-Size breakdown payload added (recorded board
  decision; a per-Size breakdown would be a separate explicit board decision; the
  drill-down remains the identity-aware client browser).
- **Fallback branch shape pinned** (`valuation_fallback_zero_warehousestock_branch_shape_pin`):
  a zero-WarehouseStock tenant served by the SubProduct-aggregate branch emits the exact same
  five keys; totalItems counts only subProducts with `totalStock > 0`; totalUnits/totalValue
  from the aggregate sums.

### Reported atomically — REAL fallback-branch payload gap (NOT fixed in this slice)

The fallback aggregate values retail with `$ifNull: ['$sellingPrice', 0]`
(`server/services/inventory.service.js` L976), and **no `sellingPrice` field exists on the
SubProduct schema** (it stores `baseSellingPrice` / `salePrice`). Test-pinned on a
schema-shaped SubProduct (`baseSellingPrice 4000, costPrice 1000, totalStock 15`): the
fallback payload emits `totalRetailValue: 0` and `potentialProfit: -15000` (= minus
totalValue) for ANY real tenant that hits the zero-WarehouseStock fallback. Not fixed here
per the fixture-isolation contract; consumer impact is bounded because the drill-down
clients value retail from the `getAllStock` stock lines, not this KPI. Suggested shape for a
future board decision: read `$ifNull: ['$baseSellingPrice', 0]` in the fallback aggregate.

### Caching — recorded contract confirmed, no conflation

`valuation_cache_scoping_cached_kpi_equals_fresh_per_tenant` runs the REAL valuation route
with the wired `cacheReport` engaged over an in-process store shim and proves: same resource
+ same query + same day, different tenant principals → **separate cache entries** (context
scope `tenant:<id>` + canonical principal, including user/role/permissions), each **cached
KPI equals that tenant's own fresh computation** (loads counted: A cached on re-read, B
recomputed fresh, `?refresh=true` bypass recomputes). Production behaviour (Redis enabled):
entries keyed per canonical principal + `tenant:<id>` scope + revision, TTL 30 s, byte/100 KB
cap, failures fall through to live computation — no cross-tenant conflation path exists. In
local runs without Redis the middleware is a pass-through (as wired).

## 2. Feed confirmation (items 11/12/14, server half) — evidence-only, no code

Both consumed feeds already carry exact-Size-ID identity; pinned suites re-run green:

| Surface | Feed the client consumes | Pinned evidence |
|---|---|---|
| (11) Stock + (12) Locations + (13) drill-down | `GET /api/warehouses/stock/all` → `warehouseService.getAllStock` rows | `warehouseRetailTypes.mongo.test.js` **1/1** (re-run): one row per exact Size, rows keyed by DISTINCT exact sizeIds, per-warehouse drill rows identified by exact sizeId, `sizeName` stays the stored string, emit-only-with-identity colour/option keys, legacy rows byte-identical (`colorName/colorHexCode/optionName` absent), tenant isolation on every projection |
| (14) Moves History | `GET /api/inventory/movements` → `inventoryService.getMovements` populated size | `inventoryMovementsRetailTypes.mongo.test.js` **3/3** (re-run: DRI-29 + DRI-31 + DRI-33 walks): populated `size` carries `displayName size colorName colorHexCode optionName` verbatim per exact Size on every scope feed (adjustments/internal/(out)/(in)/unscoped); legacy populated size keeps EXACTLY its pre-change keys `_id displayName size`; distinct per-type per-size quantities |

No REAL payload gap surfaced in the items 11/12/14 feeds themselves (the only gap found is
the fallback KPI retail field flagged in §1). Matches the CEO sweep in
`docs/memory/pos-retail-accommodation.md` (enumeration items 11/12/14).

## Verification (all runs by this agent, local synthetic data)

```
DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test (__tests__/<file under test>)
```

| Check | File | Result |
|---|---|---|
| NEW DRI-35 fixture: valuation KPI walk (8 tenants) + fallback branch pin + cache-scoping contract | `inventoryValuationRetailTypes.mongo.test.js` | **3/3** |
| Re-run — items 11/12 + drill-down feed (`stock/all` identity rows; 7-industry + legacy matrix) | `warehouseRetailTypes.mongo.test.js` | **1/1** |
| Re-run — item 14 feed (`/api/inventory/movements` identity on every scope feed) | `inventoryMovementsRetailTypes.mongo.test.js` | **3/3** |

`npm test` is broken (long-standing); `node --test` is the verification path per the issue and
AGENTS.md. No server source files touched, so no source-neighbour suites at risk; the reused
suites are the authoritative pins for the confirmed feeds.

## Deliberately NOT touched (per contract)

- No server source edits of any kind — all four surfaces were already identity-aware
  (CEO sweep + DRI-16/DRI-29/DRI-30 evidence).
- Valuation stays KPI-only: no per-Size breakdown payload (separate board decision if wanted).
- The fallback-branch `$sellingPrice` gap: **reported atomically, not fixed** (fixture-
  isolation contract).
- `tenant_staff` custom-permission gate, `getTenantId` JWT authority, Workstream A–D guards.
- The shared `dri33VariantMatrix.js` module: re-used as-is (its tenant document names still
  say "DRI33" — cosmetic, fixture-only, deliberately untouched to keep DRI-33 suites
  byte-stable).

## Files touched

- NEW `server/__tests__/inventoryValuationRetailTypes.mongo.test.js` (the only code artifact).

## Handoff notes

- The frontend slice's independent evidence for 11/12/13/14 can key on the two payloads this
  slice pinned: the KPI-only `GET /api/inventory/valuation` body (five keys) and the already-
  pinned `stock/all` / `movements` rows.
- If the board later decides a per-Size valuation breakdown payload IS wanted, that is a
  separate explicit decision (current KPI is provably per-line-correct server-side).
- The zero-WarehouseStock fallback tenant is rare but reachable (a fresh tenant before any
  warehouse stock rows exist); the `totalRetailValue: 0` / negative `potentialProfit` KPI
  shape is the one real consumer-visible rough edge found. Recommend folding the
  `$baseSellingPrice` one-field fix into a future server slice once the board weighs in.

## Post-report gate outcome (recorded after delivery)

- The CEO review-gate confirmation card (`request_confirmation` f90779cc) was **accepted by
  the board** at 2026-11-06T19:02Z; DRI-35 closed `done` with the slice confirmed as-is.
- The acceptance confirms the slice, NOT the flagged fix. The one-field `$baseSellingPrice`
  decision is now held in **DRI-37** (child of DRI-35), parked `in_review` at its own
  human-only go/no-go confirmation card (`request_confirmation` 6979ba6a). No
  `inventory.service.js` edit happens unless that card is accepted.
