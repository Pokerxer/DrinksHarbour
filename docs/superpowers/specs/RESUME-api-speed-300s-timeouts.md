# Response speed + 300s Vercel timeouts — RESUME

2026-11-08 — Complete and code-verified. User: "fix this error and make the
response faster" with Vercel 300s timeouts on /api/products/search,
/api/products/trending, /api/products/slug/* plus slow /api/subproducts admin
search. See docs/memory/api-response-speed-300s-timeouts.md for the full
investigation, numbers, and the operator follow-up items (Atlas M0 tier,
Vercel↔Atlas region alignment, SubProduct schema indexes).

## State

All fixes are working-tree changes (uncommitted at session end), five server
files + one test file:

- server/config/db.js — waitQueueTimeoutMS bound (pool-starvation hang).
- server/services/product.service.js — searchProducts single-pass
  ($facet: page+count); getTrendingProducts eligibility hoist + parallel
  per-product fetches (marketIngress.categoryFor import added).
- server/services/orderDemand.helper.js — demand map 60s process cache +
  resetDemandMapCacheForTests().
- server/services/subproduct.service.js — escapeRegex on the public
  /api/subproducts search (ReDoS).
- server/__tests__/shopPopularitySort.test.js — cache semantics pinned.
- server/scripts/api-perf-probe.js — read-only perf/consistency probe
  (run from server/). WARNING: .env points at the PRODUCTION cluster.

Tried and REVERTED: a 30s process memo over marketCatalog.eligibleGroups.
It failed __tests__/marketCommitment.mongo.test.js because market policy
changes must be visible on the next request (the suite inserts approvals
directly into collections). No cache above the marketPolicy boundary:
per-request resolution only. The trending hoist (one eligibleGroups call per
request instead of one per product) was kept — that is where the win was.

## What a next session must know

1. The hang shape is pool-starvation: all 5 pool sockets busy → unbounded
   waitQueue → Vercel kills at 300s. If timeouts EVER return with this fix
   deployed, prefer raising M0/Atlas tier or verifying the Vercel function
   region before touching code again.
2. `searchProducts` semantic guard: shoppingLocation branch deliberately still
   counts `[]` and ranks all candidates in JS — do not "simplify" that path
   into the $facet arm without marketplaceProximity tests.
3. The trending order may differ between two calls when Sales has no rows in
   the window (random $sample fallback) — pre-existing behavior, not a
   pagination bug.
4. Tests requiring the venue Mongo need a disposable local replica set on
   :29127; `DRINKSHARBOUR_VENUE_TEST_MONGO_URI` env shape asserted in
   __tests__/helpers/venueMongo.js. Without it, ~86 .mongo suite files fail
   with the SAME URI assertion — an environmental precondition, not code.

## Verification

Focused suites green: dbConnectionOptions, dbConnectionCache,
subproduct.searchRegex, shopPopularitySort (12/12), productCatalogueVisibility,
marketplaceProximity, marketplaceSearchProximity, platformBeverageGate.mongo
(19/19 with local ReplicaSet; includes the changed searchProducts path).
Isolation re-runs green after revert: marketCommitment.mongo (4/4),
venueReviewCorrections.mongo (2/2), merchantRecoveryRestore.mongo (1/1).
Run-1 (/tmp/full-test-run.log, no local mongod): 5,076 tests, 86 failures —
ALL the same venue-URI precondition, none code.
Run-2 (/tmp/full-test-run2.log, with local mongod, memo still in): 5,116
tests, 3 failures — 2 were the memo (fixed by revert), the other file-timeouts
under simultaneous local-mongod load, all green in isolation.
Run-3 (/tmp/full-test-run3.log, final): 5,117 tests, 5,085 pass, 1 failure —
venueSettlementAdapter 120s timeout while the local mongod/machine was
suspended; GREEN in isolation (1/1) with all changes active.
Live-cluster HTTP: /search 11–15s → ~1.3s warm; /trending 3.4–5.3s → ~3.85s
HTTP (~1.4s service-path, parallel now).
