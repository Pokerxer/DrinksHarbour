# Admin Redis report speed — 2026-10-10

User requested Redis speed improvements for `client/apps/admin`. Report caching lives in the backend, after existing auth/tenant/permission/plan guards; admin website analytics now uses one bundled request instead of ten. Ecommerce dashboard query construction accepts an explicit refresh flag.

Implemented `server/services/adminReportCache.js`, `server/middleware/adminReportCache.js`, explicit report route integrations and authenticated JSON write invalidation in `server/server.js`. Cache TTL30 seconds, maximum100KB, principal+tenant+query keys, opaque revision invalidation with Lua fill checks, bounded in-flight miss sharing, live-handler fallback. Never move this ahead of authorization or cache operational/editable endpoints indiscriminately.

Backend configuration uses existing REDIS_URL and namespace. REDIS_ADMIN_REPORT_CACHE=false disables the new report cache. Do not enable REDIS_PUBLIC_METADATA_CACHE: prior provider measurements showed that separate lightweight metadata cache was slower.

Local real Mongo/Redis benchmark: 5,000 orders, ten iterations, 39.15ms direct versus1.24ms warm report; tenant isolation, second-instance reuse and invalidation verified. Script only uses disposable localhost fixtures and cleans up. No production timing or deployment claim.

Full operating instructions: `docs/performance/admin-redis.md`. Verification results and remaining baseline issues: `docs/superpowers/specs/RESUME-admin-redis-speed.md`. Preserve the large pre-existing dirty checkout; no commit or push requested.

Verification: backend3,667 passed/5 skipped, new cache+analytics targeted21 passed; admin service18 passed and lint clean. Admin full suite2,671 passed with one inventory sort test timeout (also timed out with2 workers; all4 tests in that file passed separately). Admin type check390 diagnostics outside the changed service files. Do not claim a clean full admin build or suite.
