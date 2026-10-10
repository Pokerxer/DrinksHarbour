# Redis setup and safety

Set `REDIS_URL` on the backend to your provider's TLS `rediss://` connection URL.
Set `REDIS_NAMESPACE` to a unique project/environment name; production and preview
must not share a namespace. Keep Redis close to the backend/MongoDB region.
Never expose the URL to browser code or put credentials in version control.
This implementation uses the official Node Redis client over TCP/TLS, not an
HTTP-only Redis provider endpoint. No Redis resource was provisioned or deployed.

With no REDIS_URL the existing MongoDB catalogue and local IP limits remain.
Metadata caching is disabled by default. Set `REDIS_PUBLIC_METADATA_CACHE=true`
only after benchmarking it in the deployed environment; correctness-preserving
revision checks can cost more than the reads they save. With caching enabled,
catalogue reads still query live tenant SubProducts and
Product eligibility, filters, sorting and revisions. Heavy public product details
(descriptions, images, flavour notes) are read from Redis only for the live revision.
Price, stock, discounts, size variants, cart, checkout and auth stay in MongoDB.
Banners likewise query live tenant ownership, visibility, schedule and revision.
Old metadata entries expire after five minutes; changed revisions are immediately
unusable. Pending products remain limited to the submitting tenant.

Mongoose Product/Banner writes advance updatedAt automatically. Any direct/raw
collection writer must advance updatedAt whenever public metadata changes. Legacy
records without updatedAt bypass caching. Concurrent changes during cache fill
cause a fresh authoritative query. Existing API `private, no-store` headers remain.

Global API, mail and user authentication IP limiters now share atomic Redis
counters across instances. Limits/windows are unchanged. API-key authentication
and its already-shared MongoDB 60/minute limiter remain unchanged. Other specialised
endpoint limiters still use their existing stores. Configured Redis outage fails
closed for shared limits (503); metadata cache failures fall back to MongoDB.
Connection and command deadlines are 500ms, offline queuing/reconnect replay are
disabled, failed connections have a five-second cooldown, queue length is bounded.
Use a dedicated Redis database with a **noeviction** policy for these counters:
evicting counters under memory pressure weakens limits. Size memory for five-minute
metadata retention and monitor memory/errors; separate databases/providers are an
option if metadata eviction is needed later.

Verification scripts use only local ports 27919 (MongoDB) and 27920 (Redis), and the
fixture database `drinks_redis_test`. Start these isolated services, then run
`node server/scripts/performance-load/redis-verification.js` followed by
`node server/scripts/performance-load/redis-run.js`. These never read a production
MongoDB URI or provider URL. Verification seeds/drops only the named local fixture
DB. Runner compares current optimized code with Redis disabled/enabled, alternating
three paired rounds, 100 tenants/200 central products/20K offers/40K variants,
600 measured + 100 warm requests at 50 clients, hot/mixed tenant reads.
Three variants: Redis disabled, shared limits only (default), metadata cache enabled.
Do not run alongside the full regression suite when comparing timings.

Final verification: full backend suite **3463 passed, 0 failed, 5 skipped**;
eight focused Redis unit tests passed. Real local Redis/Mongo checks cover shared
atomic counters and expiry, response equivalence, tenant isolation, fresh stock and
prices, product metadata edits/unpublishing, banner edits and schedule expiry.
A separate actual HTTP outage check confirms 503 from configured shared limits
and bounded database fallback from metadata caching. A whole Redis outage rejects
requests at the global limiter; the cache fallback alone does not bypass that gate.
CodeRabbit CLI was unavailable; changed code paths were reviewed locally.

[Final load comparison and per-run metrics](redis-load-test-2026-10-08.md): metadata
caching averaged **10.6% slower** for hot reads and **29.2% slower** for mixed reads.
These timings support leaving caching off; they do not establish a production gain.

## Configuration follow-up — 2026-10-08

Local development is configured and verified: existing Redis at loopback port 6379,
Homebrew-managed and running with noeviction; namespace drinksharbour:development,
metadata caching false. Connection, shared counters and expiring reads/writes passed
using temporary verification keys which were deleted. Eight Redis unit tests pass.
The existing local Redis service was retained, not restarted or cleared.

Authenticated Vercel backend: pokerxers-projects/drinks-harbour-u6md,
backend.drinksharbour.com, Express/root server. Saved configuration:

| Environment | Namespace | Metadata cache | Hosted connection |
|---|---|---|---|
| Production | drinksharbour:production | false | Pending |
| Preview | drinksharbour:preview | false | Pending |
| Local development | drinksharbour:development | false | Verified local Redis |

The existing cloud REDIS_URL was localhost:6379, not a hosted service. Its production
and preview targets were removed; development target remains. No hosted Redis
resource is connected to this backend and no Upstash installation exists in the
account. Production shared Redis remains inactive until a hosted URL is supplied or
a provider is selected/provisioned. No provider terms accepted, charges incurred,
resource provisioned or code deployed. Changes apply to future deployments.

An attempt to download the full production environment was rejected by automatic
approval review because unrelated secrets were outside Redis configuration scope.
A supported Redis-only API lookup succeeded instead; no full production environment
was downloaded. Connection values were never printed or put in repository docs.

## Upstash selected — provider consent pending

Upstash setup is prepared for a free database named drinksharbour-redis-production
in iad1, matching the backend's verified Vercel function region. Eviction and
automatic upgrades are disabled in the provisioning request. The Vercel CLI
returned `integration_terms_acceptance_required`: the user must accept provider
marketplace terms in the browser before creation can finish. No database was created
or connected. [Consent page](https://vercel.com/pokerxers-projects/~/integrations/accept-terms/upstash?source=cli).
Next-step handoff: docs/superpowers/specs/RESUME-upstash-setup.md.

## Upstash configured and verified — 2026-10-08

Provider consent completed by user. Created drinksharbour-redis-production on the
free plan in iad1 and connected it **only to backend production**. Actual resource
metadata confirms eviction=false, autoUpgrade=false and prodPack=false. Hosted
REDIS_URL is integration-managed, encrypted and TLS (rediss://). Metadata caching
remains false. Preview and local development are not connected to this database.

Live checks using the app's 500ms connection/command deadlines passed: PING, 30
atomic increments shared between two store instances, counter expiry/reset and
short-lived SET/GET/TTL. Temporary check keys removed and client disconnected.
Eight Redis regression tests passed (0 failures). Secret-only lookup files were
kept private and deleted; no full production environment pull was used.

[Upstash resource dashboard](https://vercel.com/d/dashboard/integrations/upstash/icfg_bS93vlFdSssIIXt2QAdFphcR/resources/store_8O5JVBCJkX69q7dV).
No backend code deployment was performed; saved connection settings apply on the
next backend deployment containing the integration. Earlier pending-consent status
above is superseded. Free quota is currently 256MB/500K commands/month; auto-upgrades
are off, so monitor usage before relying on this tier for all tenant traffic.
Shared limits fail closed on quota exhaustion or Redis outage. A paid upgrade needs
separate billing authorization. No production speed/capacity gain was claimed.
