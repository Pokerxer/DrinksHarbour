# DRI-33 — /inventory ten-surface backend slice: customer-returns identity, per-variant reorder engine, rules Size populate + per-Size evaluation (extension #9)

**Date:** 2026-11-06 · **Issue:** DRI-33 (parent DRI-2, board extension #9 — comment `8adc1dd3`, user-direct) · **Mode:** local, synthetic-only — no commit, no push, no deploy, no production action, no real tenant data.
**Agent:** DrinksHarbour Backend Engineer · workspace concurrently held by a DRI-2 sibling run + the frontend slice; none of the named server files (`customerReturns/*`, `reorder.service.js`, `ReorderRule.js`) were concurrently edited as of 2026-11-06.

The three real server gaps of the ten-surface checklist were fixed; the checklist's
other six server halves were pinned with payload evidence. Everything else in the
delivery is the fixture walk the board contract requires.

## Gap 1 — customer returns (checklist item 4, server side)

**What was wrong:** `server/services/customerReturns/evidence.js` Size `$lookup` projected
`size, displayName` only — colour/option identity was dropped before the browser
list/detail surfaces printed `row.size`. Restock lever untouched: the POS returns
flow (`pos.controller.js`, orderItemIndex + sizeId — DRI-4-verified) was not modified.

**Fix (data provision only, DRI-29 mirror, no label composition):**
- the Size `$lookup` projection now also carries `colorName colorHexCode optionName`
  verbatim from the Size doc;
- each identity key is **emitted only with identity**: the new `$set` stage writes
  `colorName`/`colorHexCode`/`optionName` with `$cond → $$REMOVE`, so a Size without
  that value leaves NO key behind. Legacy beverage/sizeless rows keep their exact
  pre-change row shape — byte-identical. The stored snapshot `displayName` stays the
  authoritative label; `sources.js` sizeId `$ifNull` paths (L63 sales, L154 POS)
  were not touched and still carry the exact Size id (fixture-verifies the rows
  resolve their own Size's snapshot).

## Gap 2 — procurement (checklist item 9)

**What was wrong:** `server/services/reorder.service.js getReorderSuggestions` was
SubProduct-aggregate only (`$expr availableStock <= reorderPoint`, mapped rows without
`sizeId`) — a subProduct's Emerald and Ivory variants (and a beverage's 750ml and
'Case of 6' rows) collapsed into one line the PO-raising handoff could not aim.

**Fix (per-variant engine, aggregate read is now the sizeless fallback):**
- subProducts **without size rows** map through the EXACT pre-change row (same
  query, same formulas, same key order) — byte-identical list semantics
  (`server/__tests__/reorderProcurementRetailTypes.mongo.test.js` asserts the whole
  sizeless row field-by-field and key-absence of every new key);
- subProducts **with size rows** expand to one suggestion per exact Size row:
  - `currentStock` = Σ over the tenant's WarehouseStock rows for that exact Size of
    `(currentQuantity - reservedQuantity)`, clamped per row exactly like the
    `availableQuantity` virtual, summed over every warehouse;
  - `reorderPoint`/`reorderQuantity`/`unitCost` come off the Size row (Size-level
    `reorderLevel` alias) with fallback to the subProduct fields exactly as before;
  - `urgency`/`suggestedQuantity` reuse the pre-change formulas, recomputed per
    variant, gated per variant with the same on-hand ≤ threshold predicate;
  - each row carries `sizeId` + `size` + `displayName` + verbatim
    `colorName`/`colorHexCode`/`optionName` **emit-only-with-identity** (condition-
    al spreads, DRI-14/DRI-16 precedent) — the colourless beverage volume/pack rows
    carry `sizeId` but no identity keys;
  - `unitType`/`unitsPerPack` ride along for the /purchases verified PO pickers
    (DRI-14 size-identity) — this payload only supplies the rows; the pickers'
    selection logic is not duplicated;
- a size-row subProduct whose stored aggregate no longer describes its variants
  (aggregate high, one variant at threshold) is caught by a **bounded catch-up
  scan** (200 subProducts, the pre-change scan was 50) so the surface stays
  "what to buy right now" per-variant;
- a size-row subProduct with NO WarehouseStock rows at all keeps the legacy
  aggregate representation (no per-Size on-hand to recompute from).

## Gap 3 — replenishment (checklist item 10)

**What was wrong:** `ReorderRule.size` (ref 'Size') existed and `createRule` stored it,
but (a) `checkRules`/`triggerRule` read `subProduct.availableStock || totalStock`
aggregate even for size-scoped rules, and (b) `getRules`/`getRuleById` populate omitted
`size` entirely.

**Fix (recorded decision respected — sizeless rules bit-identical):**
- `getRules` and `getRuleById` now populate `'size', 'displayName size colorName
  colorHexCode optionName'` (DRI-29 populate mirror; identity rides along verbatim;
  sizeless rules populate to nothing — their payload keeps its exact pre-change shape);
- the evaluation engine reads per-Size on-hand for size-scoped rules via the new
  `ruleCurrentStock()` helper: WarehouseStock `(currentQuantity - reservedQuantity)`
  clamped per row, summed over the rule's warehouse scope (`rule.warehouse` set → that
  warehouse only; unset → every warehouse). When no WarehouseStock row exists for the
  exact Size, the persisted per-Size `availableStock` is the degraded on-hand source
  (tenant-scoped lookup, Workstream B) — the subProduct aggregate is NEVER read for a
  size-scoped rule. Sizeless rules take the subProduct aggregate read bit-identical,
  and NO extra query runs for them.

**Sales velocity — stated explicitly:** `Size.salesVelocity` exists in the schema
(`server/models/Size.js` L650), but the engine keeps velocity at the subProduct level
(unchanged expression) — per-Size velocity evaluation is not part of this contract and
is left coarse by design so existing beverage volume/pack rules keep bit-identical
behaviour. Recorded as a possible follow-up for the board.

## Checklist items 1/2/3/5/6/7 — server payload pins (evidence, no code change)

The payloads the browser transfers/receipts/deliveries/internal/adjustments/physical-
inventory surfaces consume already carried identity from DRI-29/DRI-31/DRI-16/DRI-14.
The existing movements fixture was extended with a third, independent test that seeds
real received/sold/damaged/transfer-pair movements per exact Size (per-type, per-size
distinct quantities) plus real adjustment writes through the DRI-29-verified writer,
and pins identity on EVERY consumed feed:

| Feed ↔ surface | Assertion |
|---|---|
| `GET /api/inventory/movements` (unscoped — dashboard, exports, scrap preset source) | distinct exact sizeIds, verbatim displayName/identity per row, per-type per-size quantities |
| `GET /api/inventory/movements?scope=internal` (item 5) | transfer pair per exact Size on the internal scope |
| `GET /api/inventory/movements?category=out` (item 3, deliveries preset query) | sold + damaged rows carry exact-Size identity |
| `GET /api/inventory/movements?category=in` (item 2, receipts preset query) | received rows (plus the DRI-31-verified adjustment_in writer rows) carry identity |
| `GET /api/inventory/movements?scope=adjustments` (item 6 — picker + summary counts) | one row per exact Size; summary total matches |

Transfers lines (item 1) stay pinned by the DRI-14/DRI-16/DRI-32
`warehouseRetailTypes.mongo.test.js` + `purchasesRetailTypes.mongo.test.js` fixtures
(re-run green below); the "adjustments summary" is the movements-browser detail
summary — client-computed from the same scope feed, so the server pin above is the
payload half.

## Deliberately NOT touched (per contract)

- POS returns restock lever (`pos.controller.js` ~L2745+, orderItemIndex + sizeId).
- `getInventorySummary()`'s `recentMovements` populate (`'displayName size'`) — not
  consumed by the /inventory module (DRI-29 recorded; unchanged here).
- `tenant_staff` custom-permission gate, beverage-only `/platform`, admin utils/print
  transforms (stored snapshot bytes stay the print source).
- `updateRule` allowed-fields (sizeId stays create-time; no schema change on
  ReorderRule).
- No per-industry forks anywhere; all fixtures share one seeding helper
  (`__tests__/fixtures/dri33VariantMatrix.js`).

## Flagged atomically (outside this contract — not fixed)

1. **Generic /inventory movement/transfer writers drop `size`** —
   `inventoryService.createMovement` (POST `/api/inventory/movements`) and
   `inventoryService.transferStock` (POST `/api/inventory/transfer`) build their
   InventoryMovement without persisting `data.sizeId`, so movements written through
   those generic writers can never carry variant identity on the feeds. Not part of
   the checklist writer set (the adjustments entry uses `/adjust` — DRI-29-verified
   size writer — and the verified internal transfer flow is the DRI-14
   `warehouseService.transferStock`, which stores size); fail-safe for the label
   fall chain but worth a board decision if those generic writers are ever surfaced
   with exact-Size requirements.
2. **Pre-existing committed test inconsistency (unrelated files, full-suite noise):**
   `server/socket/index.js` (committed `f75795cf`, kiosk phone-pairing work)
   intentionally accepts tokenless sockets, while the committed
   `server/__tests__/posSocketGateway.test.js` "a garbage token and a missing token
   are rejected" still expects tokenless rejection (`/auth required/`) — the test
   fails on every run since that commit. Not touched (not this issue's files).

## Verification (all runs by this agent, local synthetic data)

`node --test` (`npm test` is broken) with the disposable replica-set Mongo on :29127.

| Check | Command | Result |
|---|---|---|
| NEW fixture — customer returns identity walk (8 tenants: 5 retail + Wine Merchant + Restaurant + legacy control) | `… node --test __tests__/customerReturnsRetailTypes.mongo.test.js` | **1/1** |
| NEW fixture — per-variant suggestions + rules Size engine (same 8-tenant matrix; suggestions, rules populate, engine evaluation incl. warehouse-scoped rule + catch-up + legacy byte-parity + cross-tenant 404s) | `… node --test __tests__/reorderProcurementRetailTypes.mongo.test.js` | **1/1** |
| Extended movements fixture (DRI-29 8-tenant walk + DRI-31 row + NEW DRI-33 scope feeds) | `… node --test __tests__/inventoryMovementsRetailTypes.mongo.test.js` | **3/3** (DRI-29 + DRI-31 tests re-run byte-stable) |
| Shared matrix re-runs (transfer lines, receipts, purchases identity, POS till/reports) | `warehouseRetailTypes.mongo.test.js` / `purchasesRetailTypes.mongo.test.js` / `posRetailTypesAcceptance.mongo.test.js` / `posReportsRetailTypes.mongo.test.js` / `posTillAcceptance.mongo.test.js` | **1/1, 2/2, 1/1, 1/1, 1/1** |
| Returns-path focused suites | `customerReturns.test.js` (with `CUSTOMER_RETURNS_TEST_URI`) · `invoiceReturns.*` (Mongo walk with `INVOICE_RETURNS_TEST_URI`) · `linkedReturns*` · `restockPurchasePrefill` · `salesReturn` · `stockTransferReturn` · `posReturnTotals` · `posSalesReturnSnapshot` | **2/2 · 1/1 Mongo walk · 51 pass / 1 env-skip re-run 1/1 · green** |
| Focused plain suites (writer/analytic neighbours) | `stockAdjustment` `retailVariantIdentity` `poReceive.helpers` `vendorReturn.counters` `purchaseAnalyticsLedger` `warehouseTransferTotals` | **59/59** |
| Full server suite (definition of done) | `node --test '__tests__/*.test.js'` with the four env URIs | **5082 tests: 5054 pass / 2 fail / 22 env-skipped / 4 runner-cancelled** |
| Suite-failure re-verification (isolated runs) | `posSocketGateway` (pre-existing committed inconsistency, see flag 2) · `merchantRecoveryRestore` · `venueCourses` · `venueFireConsumption` · `venueReviewCorrections` | all green in isolation except the pre-existing socket test; the other five failures were parallel-load timeout/mongorestore contention artifacts |

Full-suite log: 1.56M-token run pinned at
`/private/var/folders/.../opencode/dri33-full-suite.txt` (env URIs recorded above).

## Fixture matrix (7-industry frame + legacy control, all three fixtures)

Fashion Retail (Emerald #50C878 / Ivory #FFFFF0, `invariant`-distinct rows) ·
Electronics / Beauty / Home / General (optionName-only rows) · profiled beverage
'Wine Merchant' (identity-free 750ml volume_ml + Case-of-6 count_case — the exact
identity-free shape of the legacy control) · Restaurant (same-size 'Regular plate'
rows distinguished by optionName only — Jollof/Goat) · one unprofiled legacy beverage
control whose rows are byte-identical throughout (`Object.keys` deep-equal on the
populated size / suggestion row / returns rows).

## Files touched

- `server/services/customerReturns/evidence.js` — Size projection + emit-only-
  with-identity rows.
- `server/services/reorder.service.js` — per-variant suggestions, rules `size`
  populate, `ruleCurrentStock()` per-Size evaluation for checkRules/triggerRule.
- NEW `server/__tests__/customerReturnsRetailTypes.mongo.test.js`.
- NEW `server/__tests__/reorderProcurementRetailTypes.mongo.test.js`.
- NEW `server/__tests__/fixtures/dri33VariantMatrix.js` (shared 8-tenant matrix module).
- EXTENDED `server/__tests__/inventoryMovementsRetailTypes.mongo.test.js` (third test
  appended; the DRI-29/DRI-31 assertions untouched and re-run green).

## Handoff notes

- The frontend slice (customer-return list/detail labels, procurement rows,
  replenishment rule rows) can now key on the payload shapes above:
  suggestions → `sizeId`, `size`, `displayName`, `colorName?`, `colorHexCode?`,
  `optionName?`, `unitType`, `unitsPerPack`; rules → populated `rule.size` with the
  same identity fields; returns rows → `colorName?`/`colorHexCode?`/`optionName?`
  with the byte-identical absence semantics for the identity-less rows.
- `updateRule`'s sizeId stays create-time-only — if the board wants Size re-targeting
  on rules, that is a separate decision.
- Per-Size sales velocity (field exists on Size) is the natural follow-up for the
  `days_of_stock` trigger type — stated coarse here by design.
