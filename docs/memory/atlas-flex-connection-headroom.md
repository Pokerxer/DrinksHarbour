---
title: Atlas Flex connection headroom — audit, budget, warm-container runbook
date: 2026-11-09
status: docs delivered (DRI-40), no code changes beyond comments
---

# Atlas Flex connection headroom (DRI-40)

Deliverable: [docs/operations/atlas-connection-headroom.md](../operations/atlas-connection-headroom.md)
(indexed from docs/operations/README.md). It contains the connection-ownership
audit, the verified per-container budget arithmetic, and the warm-container
runbook (detect/alert/respond/prevent), plus a Flex-specific facts box
(no `$currentOp`, no Performance Advisor, `allowDiskUse` off, 32 MB sort,
50-stage pipelines, 500 ops/sec cooldown).

Key findings, verified:

- **Flex does not raise the connection ceiling**: Atlas Flex clusters cap at
  500 connections — identical to M0
  (https://www.mongodb.com/docs/atlas/reference/flex-limitations.md). Upgrading
  M0 → Flex frees CPU/ops, not sockets. The M0-vs-Flex distinction is now
  corrected in the authoritative budget comment in `server/config/db.js`
  (comment-only edit; no behaviour change).
- **Runtime ownership is clean**: the server API (`server.js` + `config/db.js`
  global cache) is the ONLY runtime MongoDB client. Grep-verified zero
  `createConnection`/`new MongoClient`/second pools in middleware, routes,
  services, models, utils, config, jobs; client apps never touch Mongo.
- **Per-container budget**: up to 5 pool sockets + ~6 monitoring = ~11 busy
  per container, decaying to ~6 idle (minPoolSize 0 + maxIdleTimeMS 60s). Safe
  headroom ≈ 45 fully-busy or ≈ 83 idle-warm containers against 500, so the
  `db.js` "~80 warm containers" note is consistent.
- **Risk class = operator scripts**, not runtime code: 154 `server/scripts`
  files reference `MONGODB_URI`; 14 use `createConnection` and the rest use
  default driver pools — i.e. `maxPoolSize: 100` unless overridden (only 9
  scripts set it). Runbook rule: prod scripts must set `maxPoolSize: 5` and
  close in `finally`; run 1-2 at a time.
- Monitoring: Atlas Flex offers only Connections/LogicalSize/Network/Opscounter
  metrics and alerts → the runbook wires Connections alerts at ≥350 warn,
  ≥450 page; baseline assumption: Atlas reserves a few connections, plan to
  ~450, never 500.

Verification: `node --test dbConnectionOptions dbConnectionCache db-retry`
19/19 pass (2026-11-09, node 26.13.0, run pre- and post-comment-edit).
No Atlas config, traffic or data touched. Live-verify the actual tier in the
Atlas UI before acting on the runbook (tier confirmation is the one item this
session could not do remotely).
