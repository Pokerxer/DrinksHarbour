---
name: Shared server performance
description: Concurrent tenant catalogue reads, atomic key limits and additive index rollout
type: project
---

Implemented locally 2026-10-08; uncommitted. Tenant REST catalogue list/detail
share only in-flight read work, capped at 256 keys per process. Validated keys
include tenant and effective filters/pagination. Never cache settled prices,
stock, failures, API-key revocation or tenant subscription status. Cart/checkout
stay outside sharing. Variant grouping is linear; empty pages skip Size queries.

API-key auth uses two reads and one atomic update, rechecking scope, revocation
and expiry. Database-backed 60/minute enforcement survives concurrency, resets
on rollover and refuses delayed old-minute calls. Uses Mongoose 9
`updatePipeline: true`. Verbose request logging is development-only.

Three non-unique additive indexes are defined in
`server/config/performanceIndexes.js`: tenant_public_catalog,
product_public_offers, tenant_catalog_sizes. Explicit rollout:
`cd server && node scripts/ensure-performance-indexes.js`.
No automatic cold-start builds or dropping indexes. No live rollout performed.
Future syncIndexes on SubProduct/Size must preserve these explicit indexes.

Real local tests: 100 identical reads issue one aggregation; next read observes
updated price. 100 auth attempts admit exactly 60. Query scans drop from 2,000
to 10 documents in the synthetic tenant fixture; existing index preserved.
Do not quote these as production latency/capacity measurements.

Guide: `docs/performance/server.md`.
Handoff: `docs/superpowers/specs/RESUME-server-performance.md`.

Verification: targeted unit checks 16/16; real performance Mongo suite 6/6;
existing transactional checkout integration suite 8/8. Final full suite:
3,446 passed, 2 failed, 5 skipped. Both failures are in mfaVerifiedToken.test.js
(login verified token and dh_mfa cookie); missing mock for the existing User
identity lookup. Isolated MFA run reproduces them; no MFA files changed here.
The earlier ERM 401/403 failure passed its isolated and final reruns.

Before/after load test completed 2026-10-08: 36 workloads, 3 paired rounds,
concurrency 1/10/50, full local server with production middleware and real key
auth. 100 synthetic tenants, 200 shared Products, 20K offers, 40K variants.
At concurrency 50, pooled mean latency reductions: hot tenant 82.2%
(794.1 → 141.4 ms), 50-tenant mix 46.3% (1,043.4 → 560.6 ms). Throughput
increases: 470.1% and 89.1%. Serial gains only 11.0% / 0.6%, and some
low-concurrency pairs regressed. Report full ranges; never call these one
server-wide or live production percentage. 21,600 measured + 3,600 warmups
all 200, identical response hashes. Indexes installed only in isolated test DB;
per-key 60/min still enforced using distinct fixture keys. Databases deleted.

Report: docs/performance/load-test-2026-10-08.md. Runner and frozen before/after
snapshots: server/scripts/performance-load/. Before was reconstructed by
reversing only the prior optimization; Git HEAD lacks the uncommitted REST work.
No application source, live data, deployment or production index changes in
this benchmark session.

Latest full backend check after load measurement: 3,454 passed, 0 failed,
5 skipped. Earlier MFA failures did not recur. Script syntax and whitespace
checks passed. Dedicated local benchmark mongod shut down after DB cleanup.
