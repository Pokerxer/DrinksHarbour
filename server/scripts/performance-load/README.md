# Isolated before/after HTTP benchmark

Run from server: `node scripts/performance-load/run.js`.
Requires a local standalone mongod on port 27919. It never reads MONGODB_URI.
Only `drinks_load_test_before` and `drinks_load_test_after` on that local port
are populated/dropped. Use a dedicated temporary mongod dbpath. HTTP servers
bind loopback ephemeral ports. Processes never enable cron or send payments.

Snapshots freeze the three touched source modules. The before snapshots reverse
only the prior performance changes, retaining the uncommitted storefront work.
Worker compiles these benchmark snapshots with their original module locations
so their real model/service dependencies resolve correctly. All other code uses
the current checkout. Both variants load the full server app with VERCEL=1 and
NODE_ENV=production; startup is excluded, database pool remains 5. Synthetic
forwarded client IPs keep legitimate distributed traffic below the unchanged
100/15-minute IP limit; unique per-request keys keep the real 60/min key limit.

Fixtures: 200 shared central Products, 100 tenant stores, 20,000 offers and
40,000 size variants, realistic descriptions/images/prices, both public and
unpublished/inactive offers. Existing schema indexes are built in both databases;
only after receives the three new indexes. Never use these synthetic keys live.

Scenarios: catalogue GETs for one hot tenant and across 50 tenants, concurrency
1/10/50, 600 measured requests each, 100 warmups, three paired rounds alternating
variant order. One server worker runs at a time; HTTP load client is a separate
process. Every response must be 200 and tenant-correct, with matching before/
after hashes. Reads are warm; replicas, cold starts and payment paths aren't
benchmarked. Logs go to a local file in both variants.

Human-readable run CSV is an output artifact, not agent memory. Method, source
hashes, run metrics and results live under docs/performance. Do not handpick fast
runs or combine all endpoints into a claimed server-wide improvement.

After the runner finishes, run `node scripts/performance-load/summarize.js` to
write the result report and raw run record under docs/performance. The summarizer
refuses incomplete runs, unexpected statuses and missing paired rounds.
Temporary intermediate measurements use /tmp JSON; permanent results and
project memory use human-readable Markdown.
