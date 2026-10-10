# Before/after HTTP load test — 2026-10-08

## Structure

- `server/scripts/performance-load/`: small benchmark-only HTTP worker, fixture
  builder, load client and runner. Saved source snapshots make comparison repeatable.
- `docs/performance/load-test-2026-10-08.md`: results, method and limitations.
- `docs/performance/load-test-runs-2026-10-08.md`: human-readable raw run metrics.

## Comparison contract

Use identical deterministic synthetic fixtures in separate local benchmark
databases, one database runtime, one API process at a time, fixed
Mongo pool size 5. Never use MONGODB_URI or live tenant keys. Reconstruct the
pre-optimization source by reversing only this session's catalogue sharing,
variant grouping, API-key atomic update and request logger changes; do not use
Git HEAD because tenant storefront work was already uncommitted before them.
Save both source snapshots and hashes. The before database retains prior schema
indexes, the after database adds only the three performance indexes.

Send actual HTTP GET catalogue requests through real API-key authentication.
Populate 100 tenants referencing the same 200 central products, one offer and two size
variants per tenant/product. Select one tenant or distribute calls across 50
of them. Use a distinct valid key per request, in both variants, to stay inside
60/minute per-key enforcement without disabling limits. Compare warm steady
state, excluding connection/server startup and fixture/index construction.

Measure latency p50/p95/p99, mean latency, requests/second, status codes, response
size, database command counts and response correctness. Use 1, 10 and 50
concurrent clients, warm each scenario, repeat three paired rounds with
alternating before/after order. Consume and validate every response. Keep
catalogue responses identical; any unexpected status or mismatch invalidates
that run. Retain slow/unfavorable results; report no single server-wide percentage.

Percentage lower latency = (before - after) / before * 100.
Percentage greater throughput = (after - before) / before * 100.
These describe this local synthetic workload only; they do not establish
production speed, cold-start performance, write-heavy checkout throughput,
distributed scaling or maximum tenant capacity. Logger and other middleware
scope must be recorded explicitly.
