# Atlas connection headroom — audit, per-container budget, warm-container runbook

Status: audit performed 2026-11-09 against `server/config/db.js` (authoritative
budget math), the runtime tree, and the `server/scripts` corpus. Cluster tier
per Atlas docs: **Flex clusters have a maximum of 500 connections**
(https://www.mongodb.com/docs/atlas/reference/flex-limitations.md) — the same
ceiling as M0. Upgrading M0 → Flex therefore does **not** raise the connection
budget; the per-container math below holds for either tier. Confirm the
cluster's actual tier in the Atlas UI before acting on the runbook.

---

## 1. Who owns connections (audit)

Every MongoDB connection is owned by one of the owners below. Connection limits
are enforced per cluster/node by Atlas; all owners draw from the same 500.

| # | Owner | Where | Connections per process | Notes |
|---|-------|-------|-------------------------|-------|
| 1 | **Server API on Vercel** (runtime) | `server/server.js` + `server/config/db.js` — single global cached MongoClient (`global.mongoose`), one per warm container | Pool **up to 5** (`MONGO_MAX_POOL_SIZE=5`) to the primary + **~6 monitoring** (SDAM/RTT, 3 replica-set nodes × ~2) → **≤11**, decaying to **~6** when idle | The only runtime client. Verified: zero `createConnection`/`new MongoClient`/second pools in `middleware/`, `routes/`, `services/`, `models/`, `utils/`, `config/`, `jobs/`. Pool size capped, idle sockets reaped after 60 s (`maxIdleTimeMS`), `minPoolSize: 0` so an idle container never pins a socket |
| 2 | **Local long-running API** (operator machine) | Same `config/db.js` | Same as #1 (same constants) | Fine as long as only one watcher runs; do not start two backends (memory note: do not start a second backend on an occupied port — the rule is also a connection rule) |
| 3 | **Operator scripts** (`server/scripts/`, 154 files referencing `MONGODB_URI`) | One-off node processes run from the dev machine directly against the production cluster | **Unbounded by default** — plain `mongoose.connect` and 14 `createConnection(uri)` scripts inherit the driver default `maxPoolSize: 100`; only 9 scripts set `maxPoolSize` explicitly | Biggest transient contributor. During an incident window, two or three of these running in parallel is functionally a rogue deployment of 100-socket pools |
| 4 | **Root probe scripts** (`server/probe-*.js`, 4 files) | Transient read-only probes kept after the 2026-11-08 speed work | Driver default (100) unless edited | Delete after use, or add `maxPoolSize: 5`; not counted in any budget until then |
| 5 | **Operator tooling** | mongosh, Compass tabs, Atlas UI data explorer, migration wizards | A few per open pane | Real but untracked; close panes when not in use |
| 6 | **Atlas reserved connections** | Atlas internal services | Small number, not tunable | Effective budget for user workload is **below** 500; do not plan to 100% |
| 7 | Everything else — client `platform`/`admin` apps, cron (`/api` endpoints hit via the same server), payment/tax providers, Redis-less caches | No direct MongoDB use | 0 | Client apps verified: no mongoose/mongodb imports |

**Runtime in-process extras:** cron jobs registered in `server.js` share the one
cached connection; `utils/db-startup.js` and `utils/db-retry.js` retry the same
cached connection rather than opening new ones; transactions
(`customerAccount.service`) ride the default pool. Nothing else opens sockets.

---

## 2. Per-container budget (verified)

### Arithmetic (per warm container of owner #1)

```
peak per container  = maxPoolSize (5)  + monitoring (~6)  ≈ 11
idle per container  = 0 pool (reaped after 60 s) + ~6     ≈ 6
```

Headroom against the 500 ceiling:

| Sustained shape | Per-container cost | Containers before the ceiling |
|---|---|---|
| Fully busy (pool saturated) | 11 | **~45** |
| Idle warm (floor) | 6 | **~83** (matches the "~80 warm containers" note in `db.js`) |

Two limiting facts to keep in mind:

- Atlas reserves a small number of connections per cluster for its own
  services — plan against ~450-470, never 500.
- Flex (and M0) also cap **throughput** at 500 ops/sec with a sub-second
  per-connection cooldown; many idling connections are cheaper on Flex than
  many busy ones. The budget has *two* axes: sockets and ops.

### What backs the numbers

- `server/config/db.js` — settings and M0/Flex budget comment (authoritative).
  Verified effective: `maxPoolSize: 5` (`MONGO_MAX_POOL_SIZE`), `minPoolSize: 0`
  (`MONGO_MIN_POOL_SIZE`), `maxIdleTimeMS: 60000`
  (`MONGO_MAX_IDLE_TIME_MS`), `waitQueueTimeoutMS` 10 s on Vercel / 30 s local
  (`MONGO_WAIT_QUEUE_TIMEOUT_MS`), heartbeat 5 s, `appName:
  'drinksharbour-api'`.
- `__tests__/dbConnectionOptions.test.js`, `dbConnectionCache.test.js`,
  `db-retry.test.js` — **19/19 pass** (2026-11-09, node 26.13.0). They pin: the
  Vercel/local selection windows, env-overrides beating both defaults, the
  cache-reconnect and cache-clear-on-failure behaviour, and that pooled
  concurrent requests cannot wedge a request for 300 s anymore.
- Atlas Flex limitations page (linked above) for the 500-connection ceiling and
  the ops/sec cooldown.

### Config change checklist (if the ceiling is ever re-verified / changed)

1. Confirm tier in the Atlas UI (M0/Flex/M10+); if M10+, note **per node**
   limits (1 500/node) and that monitoring/retry math stays the same per
   container.
2. Update the budget comment in `server/config/db.js` — it is the single
   authority the team reads.
3. Re-run the three test files above; note the date here.

---

## 3. Warm-container runbook (Atlas M0/Flex era)

### 3.1 Symptoms of nearing the 500-connection wall

- Burst of `MongoServerSelectionError: ... connection(s) become unavailable`
  / `tlsv1 alert internal error` on otherwise-healthy routes, recovering after
  minutes (connections drain once warm containers idle out).
- `/ready` intermittently failing while app logs stay quiet.
- Unhandled `503` + `Retry-After` cluster on search/trending-style endpoints —
  that is the bounded wait-queue doing its job, *not* the wall itself
  (`waitQueueTimeoutMS` fires before a request zombifies for 300 s).

### 3.2 Detect (before it happens)

1. **Connections alert (primary).** Atlas Flex exposes exactly one useful
   signal here: the **Connections** metric and a **Connections** alert
   condition (Flex also supports Logical Size / Network / Opscounter alerts —
   Opscounter is the one to grow for the ops/sec axis). In the Atlas project:
   Alerts → Add Alert condition → **Connections** (project cadence):
   - warn when `connections` **≥ 350** (~70% of 500),
   - page when `connections` **≥ 450** (~90%).
2. Watch the Connections chart (Flex Metrics) after any deploy, load spike, or
   operator script session. Peak-or-rising-plus-flat is the dangerous shape;
   decays to ~6/container when traffic drops and idle reaping works.
3. Vercel side: warm-container count ≈ concurrent *server-project* requests
   since each request-class spawns its own containers. Traffic bursts to
   SSR-heavy storefront routes are the usual warm-capacity driver.

### 3.3 Respond, fastest lever first (in order)

1. **Stop the scripts (0-30 s, no redeploy).** Kill every one-off operator
   process (`server/scripts/*`, `probe-*.js`) and close Compass/mongosh/Atlas
   panes. Scripts default to 100-socket pools; this is usually enough to drop
   100-300 connections instantly.
2. **Flush warm containers (1-2 min).** Redeploy the server project on Vercel
   (Deployments → Redeploy). Old containers drain; new ones start cold. The
   connection count should fall to a few tens within ~1 minute. This is the
   standard warm-container reset and loses nothing but cold-start latency.
3. **If you cannot redeploy / it recurs within hours** — shrink the per-window
   budget by env override **without code changes**: set
   `MONGO_MAX_POOL_SIZE=3` (and keep `MONGO_MAX_IDLE_TIME_MS=60000`) for the
   server project and redeploy. Headroom per container drops from 11 to 9 when
   busy; throughput per container also drops, so do it *only* for the duration
   of the pressure and revert to 5 afterwards.
4. **If sustained real concurrency exceeds ~45 busy containers** — this
   architecture is at its limit; tier up, M10 (1500/node), and only then consider
   raising `MONGO_MAX_POOL_SIZE` (e.g. 10) once the bigger ceiling exists.

### 3.4 Prevent

- **Script hygiene (owner #3):** every script that connects to the production
  cluster should pass `{ maxPoolSize: 5 }` (or `?maxPoolSize=5` in the URI) and
  close in a `finally` (`await mongoose.disconnect()` / `conn.close()`). Run at
  most 1-2 concurrently.
- **One backend at a time** on the local machine against prod — the second
  watcher doubles the pool load for no benefit.
- Keep `appName: 'drinksharbour-api'`: on M10+ you will see it in connection
  lists; today it is free and future-proof.
- Do not assume Flex helps here: a tier change from M0 → Flex frees CPU, not
  connections.

### 3.5 Flex-specific operational facts to remember

- No `$currentOp`, no Performance Advisor, no Real-Time Performance Panel, no
  log downloads — when an outage happens, DB-side introspection is **not**
  available; app logs and the Connections/Opscounter metrics are the only
  signals.
- `allowDiskUse` unsupported → big aggregations doing an in-memory sort must
  stay under 32 MB (the search `$facet` pipelines are the ones to watch).
- Aggregation pipelines limited to 50 stages.

### Verification record

Record each real exercise here (date, what you did, result):
- 2026-11-09 — audit + budget verified against `config/db.js`; tests 19/19 green;
  runbook written. No production traffic or Atlas configuration touched.
