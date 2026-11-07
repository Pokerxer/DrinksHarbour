# POS till acceptance fixture (DRI-4)

`server/__tests__/posTillAcceptance.mongo.test.js` is the end-to-end POS/till
acceptance walk for the exact-retail-variant scope (two sellable variants of the same
size with distinct colours, plus a plain legacy-beverage control). It boots the real
POS HTTP router over a disposable `venuePhase0` replica database and walks:
`GET /products` picker labels → `POST /sessions/open` → `POST /orders` (cash
simulation) → warehouse-scoped stock deduction → wrong-tenant / tampered Size ID
refusals → oversell refusal → drawer session totals.

Key facts for future work:

- Run it only with
  `DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0'`;
  CI provides the same URI via the mongo:7.0 `venuePhase0` container (as for all
  `venue-*` Mongo tests).
- The picker hard-filters warehouse-scoped products whose subproduct has an EMPTY
  `sizes` list, even when a `defaultSize + WarehouseStock` row exists (legacy raw
  shape from `helpers/venueMongo.beverage()`). A legacy control that must sell from
  the picker needs `SubProduct.sizes` populated (one plain size, no colour fields).
- Rejected sale paths throw inside the items loop and are surfaced as 409 with rows
  untouched: foreign product → `Product is unavailable for this POS.`; foreign or
  random size ID → `Size does not belong to this product.`; oversell →
  `Insufficient unreserved stock for this sale.` Evidence snapshot: see
  `docs/reports/dri4-pos-till-acceptance-2026-11-05.md`.
- No physical POS terminal ran in that acceptance; the physical-till step remains an
  explicit gap until someone with hardware runs the same flow (seed helper:
  `server/scripts/seed-pos-staff.js` against a live `MONGODB_URI`).
- 2026-11-05 board scope constraint (user-direct): the `/platform` route (main
  marketplace surface) is **beverage-only**; POS/till and stock acceptance for the
  new retail types must not change beverage marketplace eligibility there, and retail
  stock flows stay on the tenant/ERM side. DRI-4's acceptance scope conforms (POS
  stock deduction is tenant-warehouse-scoped; no catalogue/marketplace code touched).
  CONTINUOUS WATCH (2026-11-05): the public retail channel originally
  (`catalogChannel: 'retail'` → `retailWhereClause()`) admitted `KINDS.retail`
  onto the central public surfaces. RESOLVED by DRI-5 the same day: every
  platform listing surface now applies the separate beverage-only
  `marketplaceWhereClause()` (`catalogKind.js`), while tenant-store surfaces keep
  `retailWhereClause()` retail sellability. Evidence:
  `docs/reports/dri5-beverage-marketplace-gate-2026-11-05.md`; behavior suite
  `server/__tests__/platformBeverageGate.mongo.test.js` (13/13) + till
  acceptance re-run 1/1. See `docs/memory/beverage-marketplace-gate.md` for the
  rule that any NEW marketplace-facing surface must carry the marketplace clause.
- 2026-11-05 board environment change: the runner hosts disposable loopback Mongo
  fixtures, so the acceptance now runs from agent runs directly (ChatGPT quota
  irrelevant). Re-executed on the runner: 1 pass, 0 fail, plus the sales-reservation
  battery (`salesReservations.mongo` + `salesReservation{Transaction,Projection,
  Quantities}`) with
  `DRINKSHARBOUR_SALES_RESERVATION_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_sales_reservation_test_<suffix>?replicaSet=venuePhase0'`
  → 6/6 pass. Fixture IDs reseed per run; outcomes are the stable contract. The
  persistent `venuePhase0` mongod lives at `/private/var/folders/…/T/opencode/
  mongo29127` and a disposable `peerTest` replica on :27029 was stood up and initiated
  for broad sweeps (peer suite does not self-initiate its replica; `venueMongo.js`
  does for `venuePhase0`).
- DRI-7 (2026-11-05): the pattern was extended to ALL FIVE retail business types in
  `server/__tests__/posRetailTypesAcceptance.mongo.test.js` (Fashion, Electronics,
  Beauty & Skincare, Home & Living, General Retail; Product.type per
  `constants/generalProductTypes.js` retailTypes). Per type: picker labels → session
  open → cash sale → per-row shipped movement `balanceAfter` → oversell refusal →
  drawer totals; plus a 20-pair cross-type isolation sweep (read + sell + foreign
  Size refusals, zero stock movements). **1 pass / 0 fail**; DRI-4's fixture re-run
  unchanged 1/0. Report: `docs/reports/dri6-pos-retail-types-acceptance-2026-11-05.md`
  (filename per issue spec, work belongs to DRI-7). This is empirical proof of the
  DRI-6 type-agnostic POS contract; the fixture adds no gating. The two-line loyalty
  copy change in `pos-loyalty.tsx` was SKIPPED per the concurrent-edit rule (in-flight
  edit from run 4b9254dd); it remains with the parent owner.
