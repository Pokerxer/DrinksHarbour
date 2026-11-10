---
title: Atlas TLS-alert blips now answer 503 — in-flight rescue on crawler-hot catalog reads
date: 2026-11-10
status: fix shipped (per-route rescue + global 503 mapping), affected suites green
---

# Atlas `tlsv1 alert internal error` → consistent 503 semantics

## What the 2026-11-10 19:2x log burst showed

- Dozens of `/api/brands/slug/*`, `/api/products/slug/*`, `/api/products/search`
  requests failing within ~1 second, **some with `Status: 500`** (`MongoNetworkError:
  tlsv1 alert internal error`, SSL alert 80) and the rest as the already-handled
  `Database temporarily unavailable` (503 from the `/api` connectDB gate).
- Origin-less traffic in alphabetical slug order (incl. junk slugs `blabla` and a
  raw ObjectId slug): AI/crawler bursts walking the brand catalogue, each head
  request served by a fresh λ that opens a new Mongo connection set.

## Root cause (unchanged from DRI-40, verified still deployed)

Atlas **rejects new TLS handshakes at the cluster connection ceiling** with
"TLS internal error" (alert 80). Pool tuning (`minPoolSize 0`, `maxIdleTimeMS
60s`, `heartbeats 5s`) from docs/memory/atlas-flex-connection-headroom.md is in
the deployed bundle (confirmed via `heartbeatFrequencyMS: 5000` in the logged
TopologyDescription). When a crawler burst hands each slug to a *cold* λ, many
containers dial simultaneously and the transient reappears. That is capacity,
not code — see the DRI-40 runbook (alert at ≥350 connections, warm-container
runbook, tier upgrades do not raise the 500-socket ceiling on M0/Flex).

## The remaining defect was semantic, and that part IS code

`withDbRetry` (utils/db-retry.js) existed since the earlier outage but was wired
only into ERM controllers (`salesOrder`, `arAp`, `batch`). The public catalog
routes the crawlers hit — `GET /api/brands/slug/:slug`,
`GET /api/products/slug/:slug`, `GET /api/products/search`,
`GET /api/products/search?brand=…` (admin/picker variant) — had NO rescue, so a
monitor that died between the gate check and the query surfaced a **bare 500**
from the global handler while the identical event at gate time answered 503 +
`Retry-After: 5`.

## Fix (two halves, both test-covered)

1. **`server/utils/dbErrorHttp.js` (new)** — single source of truth for the 503
   response shape shared with the connect gate
   (`DB_UNAVAILABLE_STATUS/RETRY_AFTER/MESSAGE` + `transientDbFailure(err,
   statusCode)`, which returns null for anything that is not a pre-execution
   transient and refuses to remap sub-5xx statuses).
2. **Global error handler (server.js) + connect gate** — both consume the
   constants; transient connectivity errors arriving at the handler now answer
   503 + `Retry-After: 5` + "Database temporarily unavailable. Please retry."
   instead of an opaque 500. Message remains masked from callers that already
   saw it via the gate.
3. **Rescue wired on the crawler-hot reads** — `brand.controller.getBrandBySlug`,
   `product.controller.getProductBySlug`, `searchProducts`,
   `searchProductsPublic` now wrap their service calls with `withDbRetry`
   (one 250 ms retry; unchanged in-memory dup-key/validation stays 500).

## Tests

- `__tests__/dbErrorHttp.test.js` — mapping shape + refusals (dup key, 4xx,
  non-errors).
- `__tests__/transientRescue.http.test.js` — mini express harness, one
  `MongoNetworkError` then success → 200 with exactly 2 service attempts for
  all four reads; duplicate-key **never** retried.
- With fixture URI set: platformBeverageGate.mongo + product/brand + db suites
  **209/209 pass** (2026-11-10). Full-suite runs MUST set
  `DRINKSHARBOUR_VENUE_TEST_MONGO_URI` per docs/memory/dri43-test-suite-triage.md.

## Not bugs (log noise, deliberately untouched)

- `Origin: No origin` — SSR fetches from the platform app plus bots; the logger
  line is informational.
- `/api/users/me` → "no token provided" — expected 401 for guest traffic.
- Junk slugs (`blabla`, the ObjectId one) — DB data quality for the `brands`
  collection; each still costs one query per crawl until cleaned.
