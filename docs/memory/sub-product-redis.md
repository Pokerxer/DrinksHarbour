# SubProduct Redis — 2026-10-10

User explicitly requested Redis after the first SubProduct optimization. Implemented bounded caches for list summary counts and nested central-product Brand/Category/SubCategory/Tag/Flavor projections. Full SubProduct/Size, prices, stock, Product pricing overrides and Tenant revenue settings remain live. Records are authorized before metadata population. Exact filtered total remains live; summaries may be up to30 seconds old.

`server/services/subProductPageCache.js` reuses the existing generation-safe cache. REDIS_URL enables; REDIS_SUBPRODUCT_PAGE_CACHE=false disables independently. Global successful authenticated JSON write invalidation remains active when report caching is disabled, because both features share revision keys. Public/background writes rely onTTL. Refresh flag is passed from controller and list manual refresh/detail toolbar reload.

Local disposable real Mongo/Redis fixture verified warm lookup reuse, live price/stock changes, isolation and invalidation. Ten50-row list iterations:10.68ms explicit fresh versus6.16ms warm. No hosted/deployed performance guarantee; initial cold connections add overhead. Independent flag allows rollout measurement/reversal. Keep the unrelated REDIS_PUBLIC_METADATA_CACHE disabled (older lightweight cache benchmark was slower).

Operating notes: `docs/performance/sub-product-redis.md`. Resume/test results: `docs/superpowers/specs/RESUME-sub-product-redis.md`. Existing5,000-row client filtering limitation persists. No commit/push/deploy requested.

Final verification:backend3,673 passed/5 skipped;118 admin sub-product/refresh tests passed; scoped lint0 errors. Benchmark cleans up its own Redis namespace via SCAN and its disposable DB. Full admin type-check baseline remains outside this change; no production performance/build claim.
