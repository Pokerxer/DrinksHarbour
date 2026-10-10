# Redis load comparison — 2026-10-08

Local warm HTTP test of the current optimized server. 100 tenants, 200 central
products, 20K offers, 40K variants, 35K API keys; MongoDB pool 5, Redis 8.6.1
and MongoDB 8.2.4 on the same machine. Three alternating paired rounds, 50 clients,
600 measured + 100 warm requests per workload. 18 workloads, 10,800 measured
and 1,800 warm requests; every response HTTP 200 and payload hashes equivalent.

Redis was tested in two modes: shared limits only (default when REDIS_URL is set),
and shared limits plus public metadata caching. Metadata caching keeps live MongoDB
eligibility/revision/price/stock reads. No production or cold-start claim.

| Workload | Optimized baseline mean ms | Shared limits mean ms | Metadata cache mean ms |
|---|---:|---:|---:|
| hot | 143.3 | 143.6 | 158.4 |
| mixed | 458.2 | 544.7 | 591.8 |

Metadata caching did not demonstrate a consistent speed gain and stays **disabled
by default**. Shared limits provide cross-instance enforcement rather than a speed
optimization. Timing varied substantially between rounds; this is an exploratory
local measurement, not a production capacity estimate. The production benefit needs
a deployed-region comparison with real data and cache-hit instrumentation.

| Round | Mode | Workload | Mean ms | p95 ms | Requests/sec | Mongo aggregate/find/update |
|---|---|---|---:|---:|---:|---|
| 1 | baseline | hot | 144.7 | 189.4 | 341.1 | 12/1212/600 |
| 1 | baseline | mixed | 447.5 | 522.3 | 108.9 | 600/1800/600 |
| 1 | shared | hot | 141.8 | 171.8 | 348.5 | 12/1212/600 |
| 1 | shared | mixed | 498.0 | 700.1 | 97.8 | 600/1800/600 |
| 1 | metadata | hot | 138.2 | 158.8 | 357.9 | 12/1212/600 |
| 1 | metadata | mixed | 489.8 | 578.4 | 99.3 | 600/1950/600 |
| 2 | metadata | hot | 152.7 | 171.6 | 324.3 | 12/1212/600 |
| 2 | metadata | mixed | 462.8 | 548.7 | 105.2 | 600/1800/600 |
| 2 | shared | hot | 150.1 | 175.7 | 329.6 | 12/1212/600 |
| 2 | shared | mixed | 459.2 | 521.8 | 105.9 | 600/1800/600 |
| 2 | baseline | hot | 144.8 | 159.3 | 342.2 | 12/1212/600 |
| 2 | baseline | mixed | 462.8 | 543.9 | 105.3 | 600/1800/600 |
| 3 | baseline | hot | 140.3 | 154.6 | 353.0 | 12/1212/600 |
| 3 | baseline | mixed | 464.3 | 555.8 | 104.9 | 600/1800/600 |
| 3 | shared | hot | 138.8 | 160.0 | 356.5 | 12/1212/600 |
| 3 | shared | mixed | 677.1 | 1730.9 | 72.0 | 600/1800/600 |
| 3 | metadata | hot | 184.3 | 208.0 | 268.9 | 12/1212/600 |
| 3 | metadata | mixed | 823.0 | 1353.8 | 59.4 | 600/1800/600 |

The initial lookup-pipeline projection strategy was slower (14,400 measured HTTP
200 responses), so it was replaced with trimming after the equality lookup to retain
MongoDB lookup optimization. The table above reports the revised strategy.

Raw results: `/tmp/drinksharbour-redis-load.json`; initial strategy results:
`/tmp/drinksharbour-redis-initial-strategy.json`. Durable per-run metrics appear
above; temporary files need not survive the session. Reproduce using the scripts
and isolated service instructions in [redis.md](redis.md).

No live environment was configured and no paid Redis service was provisioned.
