# Shared server performance

The server serves many tenants from one central Product catalogue. Scope every
operational query by tenant. Do not cache API-key authorization, revocation,
subscription status, cart prices or checkout stock. Keep API HTTP responses
`private, no-store` because authentication and CORS vary per request.

Identical catalogue requests may share only work currently in progress, using
validated tenant/filter/page keys. Remove entries on success and failure so the
next request observes new stock, publication and price changes. Cap the number
of retained in-flight keys; overflow executes normally without storing entries.

Use additive named compound indexes for public tenant offers and their Size
variants. Run `cd server && node scripts/ensure-performance-indexes.js` in an
approved rollout environment. This creates only those named indexes; it never
runs syncIndexes or drops an existing index. Index construction is deliberately
separate from API startup/cold starts. Measure explain executionStats after rollout.

Mongo pool defaults are deliberately small for the existing Atlas connection
budget. Increasing pools across serverless containers can worsen outages; size
pools against cluster capacity and container count. Multiple long-running API
replicas must not each run all cron jobs: use one scheduled worker/deployment.
The global IP limiter is process-local; distributed enforcement needs a shared
store before horizontal scaling. API-key limits are database-backed.

Production request logging is off; NODE_ENV=development enables diagnostics.
No response cache TTL is introduced. Real latency/capacity and Redis adoption
require traffic measurements and an explicit deployment design.

## Evidence from 2026-10-08

Isolated local MongoDB tests (synthetic fixtures, not production traffic):

- 100 concurrent identical catalogue reads in one API process: one aggregate;
  subsequent request: another aggregate with an updated price.
- 100 concurrent key authentications: exactly 60 accepted and 40 denied.
- Tenant read on 2,000 offers: 2,000 documents examined before index rollout,
  10 afterward, returning the same 10 matching offers. Size read also examines
  only 10 matching documents after rollout, without a forced hint.
- API-key authorization round trips: two reads plus one write, previously two
  reads plus two writes. No authorization result is cached.

These establish less database work, not production latency or maximum tenant
capacity. Sharing is per process/container; different containers still issue
independent reads. Join/name-sort and deep offset pagination still need database
work; the new indexes do not eliminate those costs.

Index definitions intentionally live in `server/config/performanceIndexes.js`
and are installed by the rollout script, not by model autoIndex on a cold start.
Future index reconciliation must preserve these three named indexes. Schema
fields and API response formats are unchanged.

Mongoose 9 requires `updatePipeline: true` for pipeline updates; implementation
verified against the installed version and real MongoDB. See the
[Mongoose 9 migration reference](https://mongoosejs.com/docs/migrating_to_9.html).

## Before/after HTTP load test

Completed 2026-10-08 through the full local API, including authentication and
compression. At 50 concurrent clients, mean catalogue response time fell
82.2% for one busy tenant (794.1 → 141.4 ms) and 46.3% across 50 tenants
(1,043.4 → 560.6 ms). Corresponding completed-request throughput rose 470.1%
and 89.1%. Single-client gains averaged only 11.0% and 0.6%, with regressions
in some paired rounds. Read the ranges; there is no single server-wide speedup.

21,600 measured requests plus 3,600 warmups returned matching successful
responses. The improved test database included the new indexes. Multiple
synthetic keys kept the unchanged 60/minute limit from capping the experiment.
These are warm local catalogue results, not production capacity or checkout
measurements. See [full report](load-test-2026-10-08.md),
[raw runs](load-test-runs-2026-10-08.md) and [method](load-test-method.md).
