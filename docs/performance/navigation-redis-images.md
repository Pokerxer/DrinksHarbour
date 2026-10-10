# Navigation Redis and image delivery — 2026-10-10

Category/subcategory navigation queries records live, then reads approximate
approved-product counts from Redis. Cache retention is 60 seconds. Publication
changes remove navigation rows immediately; count labels may lag up to one minute.
Product listings, selling prices, available stock and checkout still query their
existing authoritative sources. No full page/API response cache is added.

Cache is active when the backend has REDIS_URL, unless
REDIS_NAVIGATION_COUNTS_CACHE=false. Environment namespace/key hashing and bounded
connection handling use server/config/redis.js. One key per category/subcategory
resource, at most 100KB each; expired keys disappear automatically. Concurrent
misses share a fill within an instance. Redis read/write/corruption failures use
one batched product aggregation, replacing the former per-row count queries.
An outage still follows the existing global rate-limiter policy; this cache does
not bypass authentication, tenant isolation or request limits. The previous
REDIS_PUBLIC_METADATA_CACHE stays disabled because its benchmark was slower.

Images use components/UI/OptimizedImage.tsx. Public, unsigned versioned Cloudinary
raster uploads get final f_auto,q_auto,c_limit,w_* transformations and responsive
srcsets directly from Cloudinary. Earlier crops/overlays and asset version remain.
Signed/animated/vector/query-authenticated URLs and other providers retain the
original Next loader. Card sizes reflect grids; list thumbnails request 96/128px.
No originals, GIFs, Cloudinary settings or paid resources are changed.

Local benchmark: 3,000 temporary fixture products/30 categories, 30 sequential
reads. Old per-category query path averaged 49.74ms; Redis warm count reads
averaged 1.26ms. Matching counts, cross-instance cache reuse and 60-second TTL
verified. Cache removal caused a fresh aggregation. Fixture DB and exact temporary
Redis key were deleted. This measures navigation counts locally, not total page
latency or production throughput. Reproduce with
`node server/scripts/performance-load/navigation-cache-check.js`; it uses only
loopback MongoDB/Redis and a new temporary fixture DB, never a provider URL/.env.

References: [Next Image](https://nextjs.org/docs/app/api-reference/components/image)
and [Cloudinary optimization](https://cloudinary.com/documentation/image_optimization).
Deployment remains separate; these changes have not been deployed.

Real public shop image check: original JPEG transferred 62,582 bytes; the same
versioned asset resized to 384px with auto format/quality transferred 14,396 bytes
(AVIF), about 77% less. Both requests returned HTTP 200. Transfers discarded the
body; no remote image was saved. This is one image sample, not a page-wide result.

Verification: 76 storefront tests and 3,647 backend tests passed (five backend
skips); scoped lint has no errors and three existing ProductCard hook warnings.
Full platform type-check remains blocked by the same 19 existing diagnostics
recorded in docs/superpowers/specs/shop-banner-filter-type-errors.md.
