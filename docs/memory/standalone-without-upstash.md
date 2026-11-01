---
name: Standalone runtime without Upstash
description: User-required Redis disconnection, local limits and live MongoDB reads, 2026-10-31.
type: project
---

The user explicitly requested disconnecting the application from Upstash on
2026-10-31. This supersedes every earlier fail-closed Redis/restore-quota instruction.
Do not reconnect Redis automatically or introduce a replacement hosted cache.

Runtime: server/config/redis.js is now a compatibility boundary with no Redis
client import, network connection or activation flag. enabled/metadataEnabled are
always false; leftover REDIS_URL and cache flags cannot reactivate it. Optional
navigation, report, listing-reference and metadata caches use authoritative loaders.
Cache helper factories retain dependency injection for historical unit tests.

API/mail/login/register/reset/refresh/MFA limiters now use express-rate-limit's
local memory store at the existing thresholds. Limits are per server process,
reset on restart and are not shared across Vercel instances. Account lockout and
Mongo-backed API-key limits remain unchanged. MongoDB is still required.
Redis is development-only for historical benchmark scripts; their hosted Redis
measurements no longer describe the application runtime. Do not use the retired
benchmark scripts as runtime checks or reenable Redis to make them pass.

Hosted: disconnected resource store_8O5JVBCJkX69q7dV only from drinks-harbour-u6md.
Vercel confirmed disconnected=true. Database/integration was not deleted and
billing was not changed. Provider-managed production connection variables were
removed by disconnect; leftover Redis namespace/cache flags and development URL
were removed separately using encrypted metadata only. Local server/.env Redis
settings were removed without exposing their values. No new credential lookup.

Activation: rebuild the exact deployment already serving backend.drinksharbour.com
with the cleaned environment, without uploading unrelated workspace changes.
Original dpl_6DoWLka9LdusjQ8KbUKT6CagBish; replacement
https://drinks-harbour-u6md-6c189skqi-pokerxers-projects.vercel.app.
Local source permanently disabling Redis remains uncommitted and must be included
in the next normal reviewed release; this environment-only activation uses the
previous deployed application source and its existing no-REDIS_URL path.

Checks: 53 focused cache/auth/limiter checks pass. Full backend: 4,466 passed,
60 failed, 222 skipped, 100.37s. Confirm and record failure causes and deployment
health in docs/superpowers/specs/RESUME-standalone-without-upstash.md.

Deployment completed: dpl_Eaw5LokhwctgybTzxdVJWERRxkvv is READY in production,
with backend.drinksharbour.com alias. Encrypted metadata confirms no remaining
Redis/Upstash connection variables. All 60 full-suite failures match the prior
run and are due to missing dedicated venue MongoDB fixtures. Syntax/whitespace
checks pass. Live public endpoint results are recorded in the resume spec.

Live checks after activation: health/brands/blog return 200; unauthenticated
users/me and POS notifications return expected 401 instead of shared-service 503.
Catalogue products probe timed out at 25s and warmed retry at 45s. Catalogue latency
is unresolved; do not characterize all production endpoints as healthy. Provider
disconnection itself is complete and active. No provider data was deleted.

Reviewed commit follow-up (2 November 2026): the independent standalone changes
are selected for local Git history. Broader dependency/native upgrades are excluded.
Fresh isolated backend suite: 4,023 passed, 0 failed, 16 skipped. This commit does
not perform a deployment or provider change. See docs/audits/commit-readiness-2026-11-02.md.
