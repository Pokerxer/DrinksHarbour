---
title: General SaaS evolution — migration design
date: 2026-11-02
status: design-only-no-database-actions-taken
---

# Migration: compatibility, indexes, rehearsal, rollback

Design for a future **approved** implementation only. This session performed no
database operation, no index creation, no backfill, no flag change, and no
deployment. Everything below follows the standing conventions recorded in
[RESUME-global-platform-phases.md](../../superpowers/specs/RESUME-global-platform-phases.md)
(task-owned disposable Mongo replica sets; never the application URI), the
[market policy index discipline](../../../server/services/marketPolicy/README.md)
(explicit `ensureIndexes()`; 503 on missing indexes; index failure halts
activation), and the
[standalone runtime agreement](../../../docs/memory/standalone-without-upstash.md)
(no Redis reconnection; process-local limits; authoritative Mongo reads).

## 1. Compatibility / contract preservation

| Contract | Requirement |
|---|---|
| Existing IDs | Product, SubProduct, Size, Tenant, Warehouse ObjectIds never change. A tenant-private scope field is additive; no row is recollected. Historical orders deduct against snapshots stored at checkout — no retrospective repricing (selling-price-markup memory). |
| API compatibility | Public catalogue endpoints keep returning exactly canonical+published (currently `approved`/`isPublished` [Certain] `product.service.js:752`). External Wyn consumer (`/api/integrations/v1`) relies on this — must stay stable; this migration adds no route removals. Scope fields never appear in public DTOs (fail-closed filter check). |
| Order/financial history | Old orders keep original channel/allocation snapshots. No retrospective repricing or statistical correction of accepted orders. Channel history: no new fee/charge ever added to an accepted order; new channel economics are versioned forward (future-dated terms, per current `MarketCategoryPolicy` / `MarketEnrollment` pattern [Certain] `marketPolicy/README.md`). |
| ERM entitlements | Plans/tier changes are versioned forward; no automatic entitlement changes from industry work unless explicitly priced later. Existing `MARKET_FOUNDATION`-gate patterns (env flag default-off, e.g. `GENERAL_CATALOG_SCOPE_ENABLED`) mirror `marketContext.enabled()`. |
| Feature rollback | A rollback must **stop new private-scope creation** (flag off) but must not erase accepted private rows (they simply stop being reachable through flag-gated paths — they were never public), must keep accepted orders in place, and must not reverse fulfilled/cancelled state; reserved stock, uncertain payments and movement history survive intact — the same rule as the `MERCHANT_FULFILLMENT_ENABLED` rollback semantics. |

## 2. Index preparation (the only real DB preparation in scope)

The shared contract + operator tooling now exist in this checkout (one home per
index, per the 2026-11-02 subagent review):

- `server/config/catalogueIndexes.js` — the contract list contains ONLY the
  operator-applied index: `subproducts {tenant, product}` unique. The
  `products {publicationScope, owningTenant}` lookup and the
  **`sizes {tenant, sku}` unique-partial** are SCHEMA-declared (explicit names
  matching the config entries) and auto-built like every other schema index.
  **User decision 2026-11-02: SKU uniqueness lives on the SIZE document and is
  PER TENANT** (like `Size.barcode`); producer SKU strings may repeat across
  tenants. The legacy cross-tenant global `sizes.sku_1` is retired explicitly.
- `server/scripts/ensure-catalogue-uniqueness.js` — read-only duplicate report
  by default (mirrors each index's exact semantics: `(tenant, product)` groups
  null/missing keys like the unique index does; Size SKU matches only non-empty
  strings; Product slug duplicates are reported too — slug uniqueness was
  re-armed by removing a duplicate schema key); `--apply-uniqueness` creates
  the operator contract and refuses while duplicates exist;
  `--retire-global-size-sku` drops the legacy global SKU index only after the
  per-tenant unique exists (detection is by key, the drop uses the detected
  actual name). Operator actions on a reviewed database; nothing here ran
  against real data in this session.
- `server/__tests__/catalogueUniqueness.mongo.test.js` — opt-in real-replica
  proof: duplicate refused / race yields one success / cross-tenant
  same-product allowed / same Size SKU refused within a tenant / same Size SKU
  ALLOWED across tenants / empty SKU unconstrained.

For any future database, prepare (in order):

A. `SubProduct { tenant: 1, product: 1 }` unique (currently missing; README
   finding F2). Must be applied via the reviewed index procedure, not autoIndex:
   same discipline as `marketPolicy` (explicit script, reviewed target, 503 if
   missing). Because the enforcement gap means real duplicate pairs may already
   exist, duplicate-space reconciliation must run first; the index must only be
   applied once zero duplicates or reviewed resolutions remain.

B. `Product { publicationScope: 1, owningTenant: 1 }` index (non-unique).
C. **`Size { tenant: 1, sku: 1 }` unique-partial** (user decision 2026-11-02).
   SKU uniqueness lives on the Size document and is per tenant, exactly like
   the Size barcode contract (producer SKU strings may repeat across tenants).
   Create the per-tenant partial unique FIRST, then retire the legacy global
   `sizes.sku_1` with `--retire-global-size-sku` — that ordering never leaves
   a moment without SKU enforcement (proven on the disposable replica; the
   refuse-before-apply ordering is in the script).
D. Index A (subproducts) is deliberately NOT schema-declared — autoIndex must
   never build it on an unreconciled database. B (`publication_scope_tenant`)
   and C (`tenant_sku_unique`) ARE schema-declared with explicit names
   matching this config, so databases with server-start autoIndex build them
   themselves; `--retire-global-size-sku` accepts either source. No new index
   on SubProduct.sku (globally unique from the field definition) and none on
   Product.slug's unique constraint — which was found DEAD (duplicate schema
   key, fixed 2026-11-02) and re-armed: run the report's slug check before any
   environment where the auto-built unique index will build. Relaxing
   SubProduct.sku to per-tenant scope is deliberately NOT part of this slice —
   recorded as open identifier-scope gate D2.

## 3. Rehearsal — the only acceptable validation harness

Per repo discipline (global-phases notices; never the application MONGO URI):

- Start a disposable mongod **replica set** on a task-owned port (pattern used
  by prior sessions: ports like 29127/29128/29129 coming from
  `docs/superpowers/specs/global-phases-verification-2026-10-26.md` and
  adjacent files; each run owns exactly its PID + dbpath and validates that
  ownership before shutdown). This transaction-capable requirement is
  confirmed by Mongoose sessions-in-use across `marketPolicy`,
  `merchantFulfillment` and `storefront` tests.
- Concurrent-creation race checks (README F2): two concurrently running
  createSubProduct calls must see exactly one success after index `_A`;
  observed RED before the index, GREEN after the index, so that the
  requirement is behavior-proven, not assumed.
- Cross-tenant leak denial: public catalogue/suggestion/report flows assert
  zero exposure of `publicationScope: 'tenant_private'` docs (query-shape
  equal check + projection equivalent of `_id` matching against scope).
- Reconciliation counts: at pilot cohort scope only, run the same
  counts-before/counts-after check that `marketPolicy` uses (`ensureIndexes()`
  ledger + counts) — this is the whole point; index additive, count-neutral.

## 4. Traffic/pilot

Suggested *pilot cohort* shape (deferred decision — business sign-off needed):

1. **One industry, one existing tenant-adjacent cohort**: the general
   grocery/mixed-retail cohort is pre-adapted in this codebase, with beverage-
   applicable taxonomy (ckay / Monin / tea/coffee) already exercised in
   production data traces (RESUME specs `wyncity-*` and `monin-database-*`
   files; catalog taxonomies already represent food/snack/coffee categories).
   Prerequisites therefore shrink; faster piloting than fashion (color/size
   matrix) which requires the variant-model registry, or electronics (serials).
2. All pilot cohorts must either be existing tenants with history (no repeat
   onboarding, no capability loss) or truly greenfield businesses; the
   onboarding implications for both kinds are analyzed in
   [architecture.md §5/§7](architecture.md).
3. Rollout mechanism (proposed, not active): additive `GENERAL_CATALOG_SCOPE_ENABLED`
   — separate from `MARKET_FOUNDATIONS_ENABLED` on purpose, so that neither
   enables the other in operators' eyes, and a general SaaS tenant + ERM
   rollout can proceed independently of marketplace policy date machinery.

## 5. Cutover procedure (what the approved implementation must follow)

1. Working tree rules-of-hand: no blanket stage, no reset, no clean of the
   working tree until after the deployed/release boundary is re-established
   (the current branch is `feat/plan-entitlements-billing`, heavily dirty and
   uncommitted, so release discipline cannot be inferred from these files).
2. Land the `publicationScope`/`owningTenant` fields + validation + flag
   behind default-off, plus tests (behavioral RED first). Schema change is
   additive; no default rewrites.
3. Create indexes A/B only after flag-aware deployment is in place in a
   reviewed environment only. Never run indexes inside the Express app
   request path (already hard-coded: `marketPolicy` uses the reviewed.operator
   script-only pattern).
4. Validate: run the required backend baseline
   `cd server && node --test '__tests__/*.test.js'`; compare suite count to
   the last-recorded baseline (737 test files as of 2026-11-02, baseline
   4,475 pass / 61 fixture-artifact failures / 251 opt-in skips; per-initiative
   snapshot comparison, not green claim).
5. Rehearsed reconciliation — before leaving a pilot: counts of
   SubProduct/Size per tenant and cross-checked WarehouseStock sums before vs
   after (the field itself is count-neutral). If the counts differ, halt and
   roll back per step 6.
6. Rollback plan (in order, tested in rehearsal):
   - Flip `GENERAL_CATALOG_SCOPE_ENABLED=false` → blocks new private-scope
     (existing private rows remain but lose enrollment/publication pathways;
     they were never public, so nothing is owed to customers for them).
   - Do NOT drop the indexes. Index A enforces the general catalogue
     concurrency invariant and stays permanently once applied; index B is a
     cheap, harmless lookup. The flag, not an index, is the rollback lever.
   - Do NOT touch revenue records; direct-channel zero-surcharge semantics
     from the selling-price-markup memory operate independently of this
     migration.
7. Recovery: rollback does not erase accepted obligations — same rules as
   merchant fulfillment's rollback semantics in the
   [merchantFulfillment README](../../../server/services/merchantFulfillment/README.md).

## 6. What does NOT migrate

- No enumeration change to Product.type needed for the first slice
  (`generalProductTypes` already adds unit/weight size kinds; the industry
  attribute registry is its own package; taxonomy `Category`/`Brand` stay
  platform-global until a later slice decides private taxonomy — Option 1 in
  architecture.md §2 and decision D5 in backlog.md).
- No payment provider migrations, no new Paystack/Korapay/Stripe accounts, and
  no production use of `deliveryProviders/external/` (default off) is
  introduced by this design.
- No reservations/batch/bundle/subscription model changes are required for a
  grocery slice; those are separately assessed (backlog.md P3/P4), not
  first-release deliverables.
- No hosting/region changes; the standalone (no Redis) runtime agreement
  stands — process-local limits and Mongo-authoritative reads stay.

## 7. Test commands (recorded for the approved slice; not run here)

```bash
# Backend baseline (must pass fresh after any change; record diff vs baseline)
cd server && node --test '__tests__/*.test.js'

# Focused scopes for the migration's own behavioral verification
cd server && node --test '__tests__/subproduct*.test.js' \
     '__tests__/marketPublication*.test.js' '__tests__/planCapabilities.test.js'

# Disposable replica sets are started per run, per
# RESUME-global-platform-phases.md protocols; never reuse a live/production URI.

# Frontend (only the touched app; audit touched none)
client/apps/admin:  npm run build (plus its documented type-check)
client/apps/platform: npm run build
```

No test was executed for the migration in this session except the config-only
`planCapabilities.test.js` (24/24 pass, recorded in README "Tests run and not
run"). Everything else is design promise, not evidence.
