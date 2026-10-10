# Redis on admin SubProduct pages

The authenticated `/sub-products` list and detail/edit pages use server-side Redis for expensive reusable lookups. Each request still loads its authorized SubProducts, central Product data, Sizes, Tenant pricing settings and any warehouse stock overlay from MongoDB.

## Cached data

- List summary counts: active, low-stock and out-of-stock, keyed by the trusted tenant. Platform-wide summaries have a separate scope. The exact filtered total remains live.
- Central catalog labels used in product population: Brand, Category, SubCategory, Tag and Flavor. Each key includes the reference kind, server-selected projection and sorted exact reference IDs. Different products referencing the same labels share the cache; no tenant operational data is stored in these label entries.
- Existing generation-safe report cache provides a30-second TTL,100KB response ceiling, miss sharing, corrupt-entry fallback and Redis failure fallback. Oversized reference groups are served live and not stored.

Redis does not store full editable SubProducts, Size stock/prices, Product pricing overrides, vendor contact data, or Tenant revenue settings for this feature. Auth and record ownership run on every request before cached labels are used.

## Configuration and freshness

- Backend `REDIS_URL` enables the feature; `REDIS_SUBPRODUCT_PAGE_CACHE=false` disables it independently from report caching. Redis stays outside browser code.
- Existing authenticated successful JSON write invalidation changes tenant/platform revisions before responding. This now remains active when `REDIS_ADMIN_REPORT_CACHE=false` and SubProduct page caching is enabled. A tenant write invalidates its summaries and shared platform labels; tenant-less writes invalidate all generations.
- Public/background/webhook/non-JSON writes rely on30-second expiry. An old in-flight lookup cannot republish the previous generation after invalidation.
- `refresh=true` bypasses cached summaries and labels. List manual refresh and detail reload after toolbar changes send this flag. Stock/pricing read live even without the flag.
- Responses retain the API's private/no-store browser policy. The separate Redis-backed rate limiter retains its existing outage policy; live cache fallback cannot override an earlier rate-limit rejection.

## Verification and limitations

`cd server && node scripts/performance-load/sub-product-read-check.js` uses unique, disposable localhost MongoDB and Redis fixtures; no `.env`, production data or shared flush. It checks warm reference/count reuse, ownership, live price/stock changes and invalidation, then cleans up its own keys/database.

On2026-10-10,500 fixture records and ten list iterations (50 rows/page) averaged10.68ms with explicit fresh reads versus6.16ms with warm Redis. This includes the live record/population work; it is not a deployed browser measurement or a guarantee for hosted Redis latency. Initial cold connection/load is slower. Use the independent flag if measurements in your deployment do not improve.

Client filtering still loads up to5,000 records. Full server-side advanced filter/group/export parity is needed to eliminate that large-catalog scaling limit. See `docs/superpowers/specs/RESUME-sub-product-redis.md` for session verification and `docs/memory/sub-product-redis.md` for cold-session handoff.
