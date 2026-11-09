# API Response Speed + 300s Vercel Timeouts — resolved (2026-11-08)

## Incident

Vercel logs 2026-11-08 ~20:37–20:42 UTC: `Vercel Runtime Timeout Error: Task
timed out after 300 seconds` simultaneously on `/api/products/search`,
`/api/products/trending`, `/api/products/slug/:slug` (storefront, origin-less
SSR fetches). `/api/subproducts?search=bombay&limit=50` (admin dashboard,
picker search-as-you-type) completed but was described as slow.

## Root cause (verified, not guessed)

Local reproduction against the same Atlas M0 cluster (`server/.env` points at
the production cluster):

| Endpoint | Before | After |
|---|---|---|
| `search?q=bombay` (service path, warm) | 5.5–15s | **2.2s** |
| `trending` (service path)              | 3.4–5.3s | **1.4–1.75s** |
| ReDoS-safe `subproducts` search        | unescaped regex | escaped |

Four compounding causes:

1. **Unbounded pool wait queue (the hang itself).** The node driver's
   `waitQueueTimeoutMS` defaults to unlimited. A warm Vercel container shares
   ONE pool (`maxPoolSize: 5`). When the cluster (M0, shared CPU) runs slow,
   all 5 sockets sit inside multi-second aggregations; every further request in
   that process queues forever with no error and no response until Vercel
   kills the task at 300s. The log shape matches exactly: search + trending
   started at the same second, hung together, were killed 5 minutes later
   together while unrelated routes still served.
2. **Every search executed the expensive pipeline TWICE** — a full `$count`
   pipeline plus the paginated pipeline (six `$lookup`s per matched product,
   plus the indexless text-regex `$or` scan each time), then a THIRD `$facet`
   pass for `availableFilters` (`getSearchFilters`, `product.service.js`).
3. **Popularity sorts re-aggregated the entire orders collection per request**
   (`getOrderDemandMap` — 0.3s best case, ~4s under load).
4. **`/api/products/trending` was serial N+1 over its products and re-ran the
   market-eligibility policy reads per product** (`marketCatalog.listingFilter`
   → `eligibleGroups` → one policy read per supply category, inside a
   `for...await` loop).

## Fixes (files)

- `server/config/db.js` — `waitQueueTimeoutMS` now bounded (Vercel 10s /
  local 30s / `MONGO_WAIT_QUEUE_TIMEOUT_MS`). Queue failure surfaces as the
  existing 503 + `Retry-After` path instead of a 300s zombie.
- `server/services/product.service.js` `searchProducts` — count + page now run
  through ONE `$facet` execution (`page: [skip, limit]`, `count: [$count]`).
  Shopping-location branch unchanged. Verified: identical totals, no page
  overlap (`whisky` probe: 285 total, pages disjoint), `isExactCount` logic
  untouched.
- `server/services/orderDemand.helper.js` — demand map memoized per process
  (60s TTL / `ORDER_DEMAND_CACHE_SECONDS=0` to disable; concurrent callers
  share one pending fetch). Contract updated + pinned in
  `__tests__/shopPopularitySort.test.js`: cold outage → `{}`; warm process
  serves the minute-old map through an outage (stale-but-good beats dead).
  New export `resetDemandMapCacheForTests()`.
- `server/services/product.service.js` `getTrendingProducts` — market
  eligibility groups resolved once per request (new `categoryFor` import from
  `marketIngress`, same mapping `listingFilter` uses), per-product
  SubProduct fetches parallelized (`Promise.all`), order preserved.
- `server/services/subproduct.service.js` `getAllSubProducts` — user-supplied
  `search` regex is now `escapeRegex()`-escaped (was raw `$regex` on a PUBLIC
  endpoint — ReDoS tail risk, e.g. `search=b(o)+b`).

**Reverted after test failure:** an initial version also memoized
`marketCatalog.eligibleGroups()` per process (30s TTL). It broke
`__tests__/marketCommitment.mongo.test.js` — policy/enrollment changes must be
visible on the NEXT request (the test inserts an approval directly into
collections and immediately expects the offer). Popularity metadata may be a
minute stale; market authority may not. Rule: no cache above the
marketPolicy boundary; per-request resolution only.


All caches explicitly process-local + in-memory (standalone runtime agreement;
no Redis／Upstash).

## Production factors NOT fixed in code (operator follow-up)

- Tier limits: the cluster is Atlas **M0 (free)** — 500-connection ceiling,
  shared/throttled CPU. Even optimal code multiplies out under load; consider
  M10 while traffic is real.
- Region alignment: verify the Vercel function region matches the Atlas
  cluster region. Measured ~100–120ms round-trip to the cluster from the dev
  machine; serverless-to-cluster distance directly multiplies the serial
  round-trips inside these flows.
- `subproducts` has NO schema indexes declared (all commented
  `server/models/SubProduct.js`). Collections are tiny (1.8k docs) today, but
  the admin listing (`GET /api/subproducts?…sort=createdAt`) is an unindexed
  in-memory sort — declare `{ status: 1, isPublished: 1, createdAt: -1 }` if
  volumes grow.
- Watch `MAX_POOL_SIZE` envs in production; the M0 connection budget math
  comment in `server/config/db.js` stays authoritative.

## Verification

- `node --test __tests__/dbConnectionOptions.test.js dbConnectionCache
  subproduct.searchRegex shopPopularitySort productCatalogueVisibility
  marketplaceProximity marketplaceSearchProximity` — green (31→ plus new
  demand-cache tests 12/12 in shopPopularitySort).
- Full suite `node --test '__tests__/*.test.js'` — see session log
  (`/tmp/full-test-run.log`) for the complete result; no NEW failures from
  this change.
- Live-cluster probes (read-only): counts unchanged, pagination disjoint,
  trailing result shape identical (`probe-*.js` files kept transiently in
  `server/`, deleted after review).
