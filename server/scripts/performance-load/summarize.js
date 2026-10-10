'use strict';
const fs = require('node:fs');
const path = require('node:path');
const input = JSON.parse(fs.readFileSync('/tmp/drinksharbour-load-complete.json', 'utf8'));
const { metadata, runs } = input;
if (runs.length !== 36 || runs.some(row => row.count !== 600 || row.statuses['200'] !== 600 || Object.keys(row.statuses).length !== 1)) {
  throw new Error('Incomplete or invalid benchmark; cannot publish comparison');
}
const output = path.resolve(__dirname, '../../../docs/performance');
const f = value => value.toFixed(1);
const median = values => values.sort((a, b) => a - b)[1];
function group(scenario, concurrency, variant) {
  const rows = runs.filter(row => row.scenario === scenario && row.concurrency === concurrency && row.variant === variant);
  if (rows.length !== 3 || new Set(rows.map(row => row.round)).size !== 3) throw new Error('Missing paired round');
  return { rows, mean: rows.reduce((sum, row) => sum + row.meanMs, 0) / 3,
    p95: median(rows.map(row => row.p95Ms)), rps: 1800000 / rows.reduce((sum, row) => sum + row.elapsedMs, 0),
    aggregates: rows.reduce((sum, row) => sum + (row.databaseCommands.aggregate || 0), 0),
    updates: rows.reduce((sum, row) => sum + (row.databaseCommands.update || 0), 0) };
}
const summary = [], ranges = [];
for (const scenario of ['hot', 'mixed']) for (const concurrency of [1, 10, 50]) {
  const before = group(scenario, concurrency, 'before'), after = group(scenario, concurrency, 'after');
  const paired = before.rows.map(row => {
    const counterpart = after.rows.find(value => value.round === row.round);
    return (row.meanMs - counterpart.meanMs) / row.meanMs * 100;
  });
  ranges.push(`| ${scenario} | ${concurrency} | ${f(Math.min(...paired))}% to ${f(Math.max(...paired))}% | ${before.aggregates} → ${after.aggregates} | ${before.updates} → ${after.updates} |`);
  summary.push(`| ${scenario === 'hot' ? 'One busy tenant' : 'Across 50 tenants'} | ${concurrency} | ${f(before.mean)} → ${f(after.mean)} | ${f((before.mean - after.mean) / before.mean * 100)}% | ${f(before.p95)} → ${f(after.p95)} | ${f(before.rps)} → ${f(after.rps)} | ${f((after.rps - before.rps) / before.rps * 100)}% |`);
}
let report = `# Before/after server load test — 2026-10-08

Measured local synthetic HTTP catalogue traffic through the full Express server,
including production security/CORS/compression middleware, database-backed API
key authentication, tenant/plan checks and the unchanged IP and key rate limits.
Both variants return identical validated catalogue payloads. No production data
or live credentials were used.

## Results

Mean latency is pooled across three equal-sized runs (1,800 requests per row per
variant). p95 is the median of the three run p95 values. Throughput is total
requests / total measured elapsed time, a closed-loop completed-request rate.
The arrow means before → after; positive reduction means shorter response time.

| Workload | Concurrent clients | Mean latency (ms) | Latency reduction | p95 latency (ms) | Throughput (req/s) | Throughput increase |
|---|---:|---:|---:|---:|---:|---:|
${summary.join('\n')}

All **21,600 measured requests** and **3,600 warmup requests** returned HTTP 200.
Every response was checked for tenant ownership, 20 products, expected catalogue
total, valid prices and variant counts; normalized response hashes match between
variants and rounds. No response cache, auth bypass or rate-limit disablement.

## Repeatability and database work

Ranges below are per-paired-round mean latency reductions. A negative value is
an observed regression and is retained. Command totals cover 1,800 measured
requests per version. These ranges are not statistical confidence intervals.

| Workload | Clients | Paired-round latency reductions | Catalogue aggregates | Rate-limit updates |
|---|---:|---:|---:|---:|
${ranges.join('\n')}

## Method

- One dedicated local MongoDB ${metadata.mongoVersion || '8.2.4'} instance, separate identical before/after
  databases. 100 tenants reference one central catalogue of 200 Products;
  20,000 SubProducts and 40,000 Sizes. 35,000 synthetic keys prevent key reuse
  from exceeding the real 60/minute limit. Fixture databases removed afterward.
- Both databases have the same existing model indexes. After adds only
  tenant_public_catalog, product_public_offers and tenant_catalog_sizes.
- Full API loaded from current checkout with three frozen service/logger
  snapshots. Before reverses only the previous performance changes, retaining
  the previously uncommitted tenant storefront work. Git HEAD is not the baseline.
- MongoDB connection pool fixed at 5, one API worker at a time. Full server app
  exports are used with VERCEL=1 to prevent cron/startServer from running.
  Requests use gzip and HTTP keep-alive; client and API are separate processes.
- Per-workload 100 warmups, then 600 measured requests, concurrency 1/10/50;
  three paired rounds in before/after, after/before, before/after order.
- Hot workload: tenant 0, page 1. Mixed: round-robin 50 tenants and five pages.
  Controlled forwarded client IPs simulate separate website callers and stay
  under the unchanged per-IP limit. Per-key guards run against real MongoDB.
- Each worker's logs are redirected to a local file. Before retains request
  logging; after disables it in production. Log collector costs are not tested.

## Environment and limits

${metadata.cpu}, ${metadata.cpuCount} logical CPUs, ${f(metadata.totalMemoryGB)} GB RAM,
${metadata.platform}/${metadata.architecture}, Node ${metadata.node}, Mongoose 9.1.5.
Shared local machine; no claim of controlled production hardware or cloud latency.
Warm HTTP catalogue reads only. Cold starts, real network hops, payment checkout,
POS/accounting mutations, background jobs and multiple API replicas were not
load-tested. The 60/minute per-key limit still caps what one normal website
key can send; the throughput numbers use multiple valid keys to measure server
processing capacity without that policy becoming the bottleneck. This provides
workload-specific latency and throughput comparisons,
not a single overall server percentage, a saturation curve or maximum tenant count.
Index construction and startup are excluded from measured request times. Three
rounds show repeatability but do not establish a statistical confidence interval.

Reproduce: see [benchmark runner](../../server/scripts/performance-load/README.md).
Raw runs/source hashes: [run record](load-test-runs-2026-10-08.md).
`;
fs.writeFileSync(path.join(output, 'load-test-2026-10-08.md'), report);
const rows = runs.map(row => `| ${row.round} | ${row.variant} | ${row.scenario} | ${row.concurrency} | ${f(row.meanMs)} | ${f(row.p50Ms)} | ${f(row.p95Ms)} | ${f(row.p99Ms)} | ${f(row.rps)} | ${row.databaseCommands.aggregate || 0} | ${row.databaseCommands.find || 0} | ${row.databaseCommands.update || 0} | ${row.avgBytes.toFixed(0)} | ${row.avgWireBytes.toFixed(0)} |`);
fs.writeFileSync(path.join(output, 'load-test-runs-2026-10-08.md'), `# Raw before/after load runs — 2026-10-08

600 successful requests per row; zero unexpected statuses or response mismatches.
600 / elapsed seconds determines throughput; percentiles use nearest-rank sorted latency.

| Round | Version | Scenario | Clients | Mean ms | p50 ms | p95 ms | p99 ms | Req/s | Aggregates | Finds | Updates | Body bytes/req | Wire bytes/req |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

## Frozen source SHA-256

\`\`\`yaml
${Object.entries(metadata.snapshots).map(([name, hash]) => `${name}: ${hash}`).join('\n')}
\`\`\`

The before catalogue and key implementations are reconstructed from the source
present immediately before the optimization, not Git HEAD. Both snapshots use
shared live dependencies from this checkout. Sources are stored under
server/scripts/performance-load/snapshots/{before,after}. API source was not
modified or deployed by this load-test session.
`);
console.log(summary.join('\n'));
