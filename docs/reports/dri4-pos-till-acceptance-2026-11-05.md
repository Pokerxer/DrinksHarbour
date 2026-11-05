# DRI-4 — POS and till acceptance for exact retail variants (2026-11-05)

Synthetic till fixture run for DRI-4, continuing DRI-2's POS/till verification scope. All
data is synthetic and payment is locally simulated cash (no Paystack, no gateway, no
live tenant data).

## How it ran

- **Physical till:** not used — no POS hardware is available to this agent run. Recorded
  below as the specific acceptance gap.
- **Isolated device fixture:** `server/__tests__/posTillAcceptance.mongo.test.js` boots the
  real POS HTTP router (`server/routes/pos.routes.js`) through
  `__tests__/helpers/routeAuthHarness.js` and connects to a disposable replica-set Mongo
  (`venuePhase0` on :29127, owned PID-suffixed database, dropped in the test's `after`).
  All POS JWTs are hand-signed per the suite convention (`venuePOSLive.mongo.test.js`).

Run:

```
DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/posTillAcceptance.mongo.test.js
```

Result (2026-11-05, Node `node --test`): **1 pass, 0 fail** (~5.7 s). CI seeds the same
URI via the mongo:7.0 `venuePhase0` container (`.github/workflows/ci.yml`).

## Entities selected by the fixture (record IDs from the run)

| Entity | Value |
|---|---|
| Tenant (retail business, `plan starter`, `posSettings.retailWarehouse`) | `6aec1c08fee670c679bb40e8` |
| POS-enabled warehouse (`Retail Shop`, `isActive: true`, `posEnabled: true`) | `6aec1c08fee670c679bb40ea` |
| Exact-retail SubProduct (two colour variants of the SAME 750 ml size) | `6aec1c09fee670c679bb40ee` |
| Size variant 1 — `Green` / `#046A38` / sku `VAR-GRN` | `6aec1c09fee670c679bb40ef` |
| Size variant 2 — `Amber` / `#FFBF00` / sku `VAR-AMB` | `6aec1c09fee670c679bb40f0` |
| Legacy beverage control SubProduct / Size (no colour fields) | `6aec1c09fee670c679bb40f9` / `6aec1c09fee670c679bb40fa` |
| Open till session | `6aec1c0bfee670c679bb4112` |
| Receipts | `RCP-20261105-0001` (exact-variant sale), `RCP-20261105-0002` (legacy control) |

## Flow exercised (Fred's scan-or-picker steps)

1. **Scan / picker selection** — `GET /api/pos/products` returns the exact-retail
   SubProduct with BOTH 750 ml colour variants sellable (`availableStock: 10` each) and
   the till cart labels intact: `colorName`, `colorHexCode`, `optionName`, `sku`,
   `sellingPrice` (₦1,000 each). The legacy beverage control sells from the same grid
   with **no** colour labels (`colorName` absent) — that is the legacy control pass.
   An untrusted warehouse override is refused: `GET /products?warehouseId=<foreign
   tenant's warehouse>` → **400 "Products must come from the POS stock location."**
   The server-owned picker location cannot be redirected.
2. **Till session** — `POST /sessions/open` (opening cash ₦5,000) → 201; session's
   `warehouse` is the tenant-owned POS-enabled warehouse.
3. **Payment simulation** — `POST /api/pos/orders` with `items: [green x2, amber x1]`,
   `paymentMethod: 'cash'`, `amountTendered: 5000`: receipt `paymentMethod cash`,
   total ₦3,000, change ₦2,000 (local cash-sale simulation), `paymentStatus paid`,
   `source pos`, `posWarehouse` = the warehouse, `posSessionId` = the open session.
4. **Sale stock deduction (both exact-retail rows, before → after):**

   | Row | Before | After | WarehouseMovement |
   |---|---|---|---|
   | Green (₦1,000 × 2) | 10 | 8 | `shipped` qty 2, `balanceAfter 8` |
   | Amber (₦1,000 × 1) | 10 | 9 | `shipped` qty 1, `balanceAfter 9` |
   | Legacy control (₦1,000 × 3) | 10 | 7 | `shipped` qty 3, `balanceAfter 7` |

5. **Wrong-tenant / tampered Size ID checks — all refused, zero stock movement:**

   | Tamper | Status | Body |
   |---|---|---|
   | Other tenant's SubProduct (+its Size) | 409 | `Product is unavailable for this POS.` |
   | Own SubProduct + foreign tenant's Size ID | 409 | `Size does not belong to this product.` |
   | Own SubProduct + non-existent (random) Size ID | 409 | `Size does not belong to this product.` |

   After all three refusals the WarehouseStock rows still read 8 / 9 / 7 and exactly
   two `pos` receipts exist in the DB.
6. **Oversell refusal** — 10 × Amber against 9 on-hand → 409
   `Insufficient unreserved stock for this sale.` (atomic `$gte` guard in
   `sellStock`), stock unchanged.
7. **Drawer money** — session totals after two receipts: `orderCount 2`,
   `totalSales 6000`, `cashSales 6000`.

## Acceptance gap

- **No physical POS terminal ran in this acceptance.** The entire journey executed on
  the isolated device fixture (same real HTTP routes + real Mongo models). For a true
  physical-till pass, `seed-pos-staff.js` exists (`server/scripts/`) to seed tenant
  `premium-spirits-wine` against a live `MONGODB_URI`, and a human with a till device
  would repeat steps 1–4 there. Everything except the physical hardware (scanner,
  drawer, receipt printer) is covered by the fixture.
- Authenticated browser acceptance of the till UI is tracked in DRI-4's sibling issue
  and is not this run's scope.

## Runner re-execution after the environment change (2026-11-05, board directive)

After the board's fixturing-environment change (OpenCode v2 bridge runner; ChatGPT
quota irrelevant; disposable loopback Mongo/HTTP fixtures allowed from runs), the
assignment was re-executed on this runner:

- **POS/till acceptance:** same command as above (URI `…/drinks_venue_test_dri4global?…`)
  → 1 pass, 0 fail. The `DRI4_EVIDENCE` line recorded fresh synthetic IDs — tenant
  `6aec1f38…c05884`, POS warehouse `6aec1f38…40ea`→`6aec1f38…05886`, Green
  `6aec1f3b…0588b`, Amber `6aec1f3b…0588c`, legacy control `6aec1f3c…05895/05896` —
  with every flow outcome identical (10→8 / 10→9 / 10→7; 409 refusal set unchanged;
  drawer totals unchanged). The fixture reseeds per run by design; recorded IDs differ
  per execute cycle and the outcomes are the stable contract.
- **Sales reservation integration battery (same run, exit 0):** `salesReservations.mongo`
  (concurrent confirm / retry / top-up / tenant boundaries), `salesReservationTransaction`,
  `salesReservationProjection`, `salesReservationQuantities` — **6/6 pass** (~20 s total
  for the five-file battery) with
  `DRINKSHARBOUR_SALES_RESERVATION_TEST_MONGO_URI='…:29127/drinks_sales_reservation_test_dri4?replicaSet=venuePhase0'`.
- **Fixtures:** reused the persistent disposable `venuePhase0` mongod (:29127; every test
  owns and drops a PID-suffixed database); stood up and initiated a disposable :27029
  `peerTest` replica (CI shape, `.github/workflows/ci.yml`) for the broad sweep.
- **Broad-suite sweep** (error-correction tracking authorization): a correction to
  note — the first sweep ran without the fixture env exported and produced an invalid
  66-failure baseline (all `AssertionError: '' vs venue-URI regex` from
  `helpers/venueMongo.js:6`, env gap of the run command, not runner/code defects);
  6 representative files re-run focused passed **18/18**. The corrected sweep (venue +
  peer fixtures, 4 workers, 60 s test timeout) completed **5,033 tests — 5,005 pass /
  1 fail / 4 cancelled / 23 skipped** (~28.7 min wall under concurrent DRI-3 CPU
  contention). The single failure was `venueServings.mongo.test.js`
  `v2_portions_keep_legacy_uniqueness_and_owned_identity` timing out at 60 s
  (`60,250 ms`) under that contention — re-run focused it passes **5/5
  (27 s at a 120 s budget)**. Net classification: **zero assertion failures** and no
  failures outside the old loopback/EPERM infra-cause families; the remaining exposure
  is contention-sensitivity of deadline/timeout-driven tests at 4-worker concurrency on
  a busy machine. Logs:
  `/private/var/folders/…/T/opencode/dri4-broad-suite.log` (invalid baseline) and
  `dri4-broad-suite2.log` (corrected baseline).
- **Acceptance gap unchanged:** no physical POS terminal is available to agent runs;
  the hardware QA path remains `seed-pos-staff.js` against a live `MONGODB_URI`.
  Production activation and live-data migrations remain out of scope.

## Authoritative coverage

The suite already covers per-unit sale-path mechanics (`posTenderRouting`,
`posTipRounding`, `posLinkedSalesOrderPricing`, session guards, wrong-tenant 404
patterns, `venuePOSLive` canonical-checkout walk). This fixture adds the
end-to-end exact-retail-variant walk the suite checked only per-unit: picker labels →
session open → cash simulation → dual-row deduction → refusal set → drawer totals.
