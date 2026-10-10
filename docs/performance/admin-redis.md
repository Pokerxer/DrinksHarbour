# Admin report caching

Admin pages use Redis through the backend API, with authentication and existing permissions checked on every request. No Redis credentials or client library belong in the admin browser app.

## Covered reads

| Report | API routes |
| --- | --- |
| Ecommerce dashboard | `/api/analytics/dashboard` |
| Website analytics | `/api/analytics/web-report` and the ten original analytics reads |
| Purchasing analytics | `/api/purchase-orders/analytics/summary`, `/analytics/by-vendor` |
| Inventory valuation | `/api/inventory/valuation` |
| Accounting | `/api/accounting/dashboard`, `/reports/trial-balance`, `/reports/profit-loss`, `/reports/balance-sheet` |
| POS reports | `/api/pos/reports/summary`, `/reports/daily` |

Check route mounts in `server/server.js` when consuming these endpoints. Website analytics now requests one combined report; an older backend returning 404 falls back to the ten original calls. Authentication and server errors do not trigger fallback requests.

## Configuration and freshness

- Requires the backend's existing `REDIS_URL`; defaults on when Redis is configured. Set `REDIS_ADMIN_REPORT_CACHE=false` to disable these report caches independently.
- Set `REDIS_NAMESPACE` separately per environment. Existing Redis configuration also isolates default namespaces by deployment environment.
- Only successful HTTP 200 JSON reports of at most 100KB are stored, for 30 seconds. Partial responses, failures, cookie-setting responses and GET requests with bodies bypass caching.
- Keys include trusted tenant, authenticated user, current role/permissions, report, query filters, and calendar day. Tenant-owned routes require a trusted tenant. Existing route guards execute before cache reads.
- Successful authenticated JSON POST/PUT/PATCH/DELETE responses invalidate that user's tenant and platform aggregate reports before sending the response. Tenant-less writes invalidate all generations. Public tracking, background jobs, webhooks, non-JSON responses and unavailable invalidation rely on the 30-second expiry.
- Version checks in Redis prevent a slow report fill from publishing an outdated generation after a write. Concurrent equivalent misses share work within each API instance; warm reports are shared across instances.
- Append `refresh=true` to bypass a warm report explicitly. The ecommerce dashboard service exposes `refresh` alongside its existing period parameters.
- HTTP responses remain `private, no-store`; neither browser nor CDN becomes a store for these reports. Editable records, checkout, stock operations and POS sessions continue using live handlers.
- Report cache failures fall back to live handlers. The separate existing Redis-backed rate limiter can still reject requests during a Redis outage; this change does not alter that policy.

## Verification

Unit and HTTP tests cover isolation, fresh reads, invalidation, fill races, corruption, oversize responses, outages and preservation of controller errors. Admin service tests cover the combined analytics request and compatibility fallback.

`cd server && node scripts/performance-load/admin-report-cache-check.js` uses disposable localhost MongoDB and Redis fixtures without reading `.env`, then removes its database and Redis keys. On 2026-10-10, 5,000 orders and ten iterations gave mean dashboard handler time 39.15ms directly versus 1.24ms from warm Redis. It also verified cross-instance reuse, tenant separation and invalidation. This measures local report execution, not deployed page load time or hosted Redis latency.

See `docs/superpowers/specs/RESUME-admin-redis-speed.md` for session checks and outstanding limitations. No deployment was performed.
