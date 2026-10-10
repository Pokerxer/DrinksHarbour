# Redis performance integration

2026-10-08: Redis support added after user authorization. REDIS_URL enables
shared global/mail/user-auth IP limits; REDIS_NAMESPACE isolates environments.
REDIS_PUBLIC_METADATA_CACHE=true optionally enables public Product/Banner metadata
caching with live tenant eligibility/scheduling/revision probes. Prices/stock,
checkout, permissions and API-key authentication + 60/min Mongo limiter stay live.
Metadata caching stays off by default: paired local testing did not show a
consistent improvement over the already optimized server.

See docs/performance/redis.md for setup and failure policy, and
redis-load-test-2026-10-08.md for all 18 final workloads (10,800 measured + 1,800
warm HTTP 200 requests, equivalent payload hashes). Cache keys include tenant,
resource ID and Mongo updatedAt revision, TTL five minutes. Direct collection
writers must advance updatedAt. No response caching. No provider provisioning,
live environment changes, deployment, commit or push performed.

Tests/handoff: docs/superpowers/specs/RESUME-redis-performance.md.

Final full backend suite: 3463 passed, 0 failed, 5 skipped (85.1s). Eight focused
unit tests plus real Redis/Mongo and HTTP outage checks passed. Final mean latency
baseline/shared/cache: hot 143.3/143.6/158.4ms; mixed 458.2/544.7/591.8ms at 50
clients. Metadata caching was 10.6%/29.2% slower in these local runs, so it is opt-in.

Configuration follow-up 2026-10-08: local Redis working, explicit namespace and
false cache flag saved; .env.example documents Redis. Backend Vercel project is
pokerxers-projects/drinks-harbour-u6md (root server, Express). Production/preview
namespaces and false cache flags saved. Cloud REDIS_URL previously localhost:6379;
removed only production/preview targets (development preserved). Hosted Redis is
still pending user choice; no production Redis activation or deployment. Full env
pull was rejected; narrower Redis-only API lookup worked. Eight tests and local
connection/counter/expiry checks pass. See docs/performance/redis.md latest section.

Upstash chosen by user. Free service provisioning prepared: name
 drinksharbour-redis-production, iad1 (verified backend function region), eviction
false, autoUpgrade false, prodPack false, no-connect/no-env-pull before verification.
Vercel CLI refused to finish until human accepts Upstash marketplace terms at
https://vercel.com/pokerxers-projects/~/integrations/accept-terms/upstash?source=cli
(opened in Codex). Status action_required/integration_terms_acceptance_required;
no resource exists yet. Next: user accepts, retry exact command recorded in RESUME,
verify service, then connect production. Do not claim Upstash active.

Upstash setup completed 2026-10-08 after user consent. Free resource
store_8O5JVBCJkX69q7dV (drinksharbour-redis-production), installation
icfg_bS93vlFdSssIIXt2QAdFphcR, iad1, eviction=false, autoUpgrade=false,
prodPack=false, verified billing plan free. Connected only backend production;
encrypted integration-managed TLS REDIS_URL set, metadata caching still false.
Preview is unconnected; local/development Redis unchanged. Live tests with actual
app deadlines passed PING, 30 atomic shared increments, expiry and temporary
SET/GET/TTL checks; check keys cleaned up. Eight Redis tests passed. No code deployment
or production-runtime activation claimed. Settings apply on next backend deployment.
See docs/superpowers/specs/RESUME-upstash-setup.md for resource and next-step detail.
