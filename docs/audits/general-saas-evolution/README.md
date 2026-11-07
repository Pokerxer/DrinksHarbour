---
title: General SaaS evolution — source-backed audit
date: 2026-11-02
status: ready-for-audit-deliverables-production-not-authorized
scope: general-saas-evolution-audit-only
---

# General SaaS evolution audit

Assess how the beverage-focused ERM can evolve into a general-purpose,
multi-tenant business-management SaaS while preserving the DrinksHarbour
marketplace, existing tenants and daily operations. This is an audit and design
package only. **No migration, configuration, index, backfill, flag, commit, push,
deploy, or payment/provider/customer action was performed or is authorized by
these documents.** Implementation requires a separately approved slice.

Source policy: baseline is the current working tree on branch
`feat/plan-entitlements-billing` (heavily modified, uncommitted, plus untracked
files), inspected 2026-11-02. Working-tree state was read first and every file
touched by other work was preserved. Source inspection does not prove which
changes are deployed; nothing here is production evidence.

Confidence marks: **[Certain]** = directly inspected source or test evidence;
**[Likely]** = supported inference; **[Guessing]** = unresolved assumption.
Findings carry repository paths and line numbers. Local test evidence is never
described as deployed proof.

Companion documents (all in this folder):

- [architecture.md](architecture.md) — ownership options, recommendation,
  dependency/data-ownership maps, trust/panel boundaries, required instruction
  amendments.
- [migration.md](migration.md) — compatibility, index preparation, rehearsal,
  reconciliation, rollback and recovery design.
- [backlog.md](backlog.md) — dependency-ordered packages, acceptance criteria,
  and the smallest safe first implementation slice.

**Scope update (same day, 2026-11-02):** the audit produced these design
documents only; afterwards the user approved the first slice, which was
implemented locally the same day and then reviewed with subagents and
corrected (see the matrix below and the
[RESUME handoff](../../superpowers/specs/RESUME-general-saas-evolution-audit.md)
implementation checkpoints). No production flag/data/index action followed, and
nothing here is a commit or deploy claim.

## Executive findings

| # | Priority | Finding | Evidence |
|---|---|---|---|
| F1 | P0 | ~~Is~~ Was: the tenant "create new product" path silently **merged catalogue identities across tenants by case-insensitive name alone**. **Remediated 2026-11-02 in this working tree**: the candidate query only admits canonical approved supply, the tenant's own tenant-private identities, and the tenant's own submissions — another tenant's pending/private row with the same name can no longer be adopted. | [Certain] was `server/services/subproduct.service.js:598-638`; now the link-by-name guard is `:613-635` (comment 613-625, candidates 626-635) |
| F2 | P0 | There is **no database-level uniqueness** for `(tenant, product)` on SubProduct: all composite `subProductSchema.index(...)` declarations are commented out. The dedup check is now a session-aware `findOne` (the wasteful all-tenant debug dump was removed 2026-11-02); the DB-level contract is operator-applied (`scripts/ensure-catalogue-uniqueness.js`) and proven on a disposable replica — **no index has been applied on any real database**. | [Certain] `server/models/SubProduct.js:727-743`; dedup check now `server/services/subproduct.service.js:743-766`; contract in `server/config/catalogueIndexes.js`; proof `__tests__/catalogueUniqueness.mongo.test.js` |
| F3 | P0 | Central Product review **does not block tenant operations**. POS catalogue gates on `tenant` + `visibleInPOS` + status nin `{discontinued, hidden, archived}` — the central Product's `pending` status is never consulted. A tenant SubProduct is sellable while its central Product awaits approval. Super-admin approval gates public publication only. | [Certain] `server/controllers/pos.controller.js:1532-1541`; `server/services/product.service.js:752` |
| F4 | P1 | ~~Was~~: tenants could link only `approved` central Products by ID while the link-by-name path accepted `pending`. **Collapsed and fixed 2026-11-02** into one rule set: super-admin picks approved/pending; scope-on tenants pick approved canonical OR own tenant-private (flat top-level `$or` — a first nested `status:{$or}` shape was caught by review and fixed before any flag-on use); scope-off keeps legacy approved-only. | [Certain] was `server/services/subproduct.service.js:476-479` vs `:607-610`; now the unified block is `:476-497` and the link-by-name candidates are `:613-635` |
| F5 | P1 | Onboarding/eligibility already strictly separates industry exposure from operations, but **category classification had no non-gift/non-food categories** — everything else mapped to `beverage` for marketplace enrollment scoping. **Enabler shipped 2026-11-02**: the type→category map is now a validated registry (`server/config/marketCategories.js`; `marketCatalog` derives eligibility categories + `$switch` branches from it), so a future vertical is config + policy decisions, not a code fork (gates stay in backlog D5). | [Certain] was `server/services/marketIngress.js:12-17`; now the delegate is `:16-17` with fallback at `server/config/marketCategories.js:23` |
| F6 | P1 | Online publication policy is already **a separate, independently gated responsibility** (`marketPublication.assertListingChange` is a no-op unless `MARKET_FOUNDATIONS_ENABLED=true`), so the proposed "publication optional and independently gated" target is *formalization of existing structure*, not a rewrite. | [Certain] `server/services/marketPublication.js:4-25`; `server/services/marketContext.js:5` |
| F7 | P1 | Non-beverage goods are supported at type level (type enums, pre-validation clears beverage-only paths, Size supports weight/count/count-pack unit types, admin forms fixed for glassware/gift/bar tools), but **all product attribution surfaces (Category, SubCategory, Brand) are platform-global** — no tenant-private categories/brands exist. | [Certain] `server/models/Product.js:252-259` (catalogKind), `:824-882` (non-beverage normalization); `server/models/Size.js:184-196` (unit types); grep of `server/models/{Category,SubCategory,Brand}.js` shows no owning-tenant field; `docs/superpowers/specs/RESUME-product-nonbeverage-detail-and-save.md` |
| F8 | P1 | Unique identifiers have **global scope today**: `Product.barcode` is unique across the platform, `SubProduct.sku` globally unique, and **`Product.slug` uniqueness turned out to be silently DEAD** — a later duplicate `slug: String` schema key discarded the first block's unique/required (introspection-verified before the 2026-11-02 fix removed the duplicate key). **Size SKU uniqueness is now PER TENANT by user decision (2026-11-02)**: `{tenant, sku}` unique-partial mirroring the existing per-tenant barcode (`Size.js:811-817`), and the per-tenant Size SKU decision was taken with the (tenant, product) SubProduct contract kept. SubProduct.sku relaxation stays an open D2 gate. | [Certain] `server/models/Product.js:42-56`; `SubProduct.js:46-52`; `Size.js:811-817`; `server/config/catalogueIndexes.js` |
| F9 | P2 | Revenue policy is exactly where AGENTS.md says: all three models (`markup`, `commission`, `selling_price_markup`) plus pack rates on Tenant; overrides (`sellingPriceMarkupOverridePct`, `commissionPriceOverride`, `platformMarkupOverridePct`, pack overrides, all nullable-defaults) on SubProduct and Size. POS pricing resolves these with platform overrides. Agreements are encoded, not hardened into a versioned terms object. | [Certain] `server/models/Tenant.js:145-188`; `SubProduct.js:72-77`; `Size.js:267-281`; `server/routes/pos.routes.js:211-222` |
| F10 | P2 | Location/batch inventory is tenant-scoped and reusable for general retail out of the box: unique `(tenant, warehouse, subProduct, size)` stock, per-batch quantity/cost/quarantine/FEFO, expiry sweeps, valuation modes, and optional batch tracking. | [Certain] `server/models/Warehouse.js:48`; `WarehouseStock.js:69-72`; `WarehouseBatch.js:22-49` (cost/expiry/quarantine), `:41-49` (indexes) |
| F11 | P1 | There is **no industry dimension anywhere** in tenancy or plans: `Tenant.businessCapabilities` is only `["retail","hospitality"]`; ERM plans gate ordinal limits + capability sets, with no category/industry check. Hiding UI is not, and never was, the capability boundary — server gates use entitlements/roles. Industry as a native dimension is new surface, not a rename. | [Certain] `server/models/Tenant.js:12`; `server/config/erm-plans.js:72-172`; `server/middleware/plan.middleware.js` (291 lines, entitlements only) |
| F12 | P2 | Payment paths inventory: platform Paystack (subscriptions, marketplace), merchant-account Paystack (storefront channel, namespace `STOREFRONT_PAYSTACK_<ACCOUNT>_SECRET_KEY`), legacy Stripe refund path (Phase A), Korapay charge path, wallet/gift stored value, and POS offline behavior. All present; **none is mutated by this audit**; presence is not approval to remove or extend any default provider. | [Certain] `server/services/storefront/README.md:15-23`; `docs/superpowers/specs/RESUME-phase-a-transaction-safety.md:24-29`; `docs/memory/checkout-payments-korapay-cod.md`; `server/__tests__/korapay.charge.test.js` |
| F13 | P2 | Runtime stays exactly per the standalone agreement: `server/config/redis.js` is a compatibility shim with no client/flag; limiters are process-local; Mongo is authoritative. Documented limitation: limits are per process, not shared across instances. | [Certain] `docs/memory/standalone-without-upstash.md:11-23` |
| F14 | P1 | The AGENTS.md contract "no duplicate products across the platform / tenants do not own Products" describes the current shopping-marketplace behavior, and is in **conflict both with general-SaaS private goods and with F1's silent merging** (which is itself a de-facto duplicate-suppression policy violating tenant privacy). Both must be resolved by explicit rule amendment before implementation. | [Certain] `AGENTS.md` (Core Concepts, Workflow, Key Rules); F1; `docs/audits/general-saas-prompt-review-2026-11-02.md` |

Highest risks in one line each: cross-tenant catalogue merge (F1) is live
behavior, not hypothetical; identifier scopes (F8) must be decided before any
private-goods field lands; missing composite unique index (F2) must be prepared
with the reviewed index procedure already used for market collections, never via
autoIndex.

## What is preserved as-is (verified this session)

- Stack: Express 5/CommonJS (`express ^5.2.1`), Mongoose/MongoDB (`^9.1.5`,
  Node `>=22 <23`), 216 models / 88 controllers under `server/` (counted
  2026-11-02; the dirty tree changes hourly); admin Next
  `15.5.28`; platform Next `16.4.2` (different majors — **not consolidated**);
  Expo mobile app; `client/packages/*`; `packages/sales-money` (vendored module,
  **no package.json**; consumed via path imports from `salesPricing.service.js`,
  `salesOrder.service.js` and the admin sales UI). [Certain]
- Tenant authority: `getTenantId(req)` reads JWT `req.user.tenant` first;
  `x-tenant-slug`/`?tenant=` only for super-admin/admin; ownership assertion
  returns 404-style failures to avoid enumeration. [Certain]
  `server/utils/tenantContext.js:23-47, 84-93`
- Transaction-safety systems documented in
  [RESUME-phase-a-transaction-safety.md](../../superpowers/specs/RESUME-phase-a-transaction-safety.md)
  (receipts, purpose-bound stored value, private order projections) are
  implemented locally and verified; hosted certification remains an external
  gate. [Certain]
- Merchant fulfillment, refunds with original-source authority, whole-parent
  status/refund denial for tenant staff, quantity V2 ranges, local dispatch,
  carrier candidates (default-off) — implemented locally; maintain the
  invariant that money never restocks goods and uncertain outcomes stay
  reserved. [Certain]
  [RESUME-global-platform-phases.md](../../superpowers/specs/RESUME-global-platform-phases.md)
- Plans: tiered price ladder + capability set pinned to the comparison table by
  `server/__tests__/planCapabilities.test.js` (rerun this session: 24/24 pass).
  The old blanket warning that `npm test` "is broken" is stale in this checkout
  — `server/package.json:10` now points to the documented baseline command.
  [Certain]

## Current architecture (as inspected)

```
 external Wyn City website (separate repo, /api/integrations/v1 key client)
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  server/  Express 5 CommonJS + Mongoose (MongoDB)                │
│                                                                  │
│  Auth: JWT protect → getTenantId (JWT authority) → roles/        │
│        entitlements → route guards; refresh rotation/revocation; │
│        audit log; MFA foundation; local rate limits              │
│                                                                  │
│  Catalogue:  Product (canonical, tenantless*)                    │
│    * submittingTenant/provenance only                            │
│        ▲ tenant-created rows arrive status:'pending', no scope   │
│                │                                                 │
│  Ownership: SubProduct (tenant-owned listing, sku global)        │
│                │                                                 │
│  Variants:   Size (tenant-owned, per-tenant barcode + SKU        │
│              unique-partial; sku per tenant per the 2026-11-02   │
│              user decision; legacy global sku_1 retired via      │
│              scripts/ensure-catalogue-uniqueness.js)             │
│                │                                                 │
│  Locations:  Warehouse → WarehouseStock → WarehouseBatch         │
│              (tenant-scoped, batch/FEFO/quarantine)              │
│                │                                                 │
│  Money/Commerce: POS sessions, Sales/SalesOrder, PurchaseOrder,  │
│  accounting/invoices/credit notes, taxes, pricelists/promotions, │
│  packages/sales-money                                            │
│  Revenue policy: Tenant.revenueModel + SubProduct/Size overrides │
│    (price snapshot at checkout; direct = zero marketplace fee)   │
│                                                                  │
│  Online publication: pending/approved + isPublished              │
│  Market policy (flagged): enrollments/category policies/ingress  │
│  Storefront channel: StorefrontChannel + merchant Paystack       │
│  Marketplace fulfillment (flagged): MerchantOrder* / refunds     │
│  Subscriptions (Paystack): erm-plans + entitlements service      │
└──────────────────────────────────────────────────────────────────┘
        │                                   │
┌───────▼──────────┐  ┌─────────────────────▼──────────────────┐
│ client/apps/     │  │ client/apps/platform  Next 16 (public  │
│ admin Next 15    │  │ marketplace + tenant subdomains)       │
│ super-admin +    │  │                                        │
│ shared tenant    │  │ client/apps/mobile (Expo)              │
│ operations UI    │  │                                        │
└──────────────────┘  └────────────────────────────────────────┘
```

## Implemented / tested-locally / externally-gated / proposed / unknown

| Capability | State | Evidence |
|---|---|---|
| Transaction safety V3-01/02/03 | Implemented locally, verified suites 2026-10-23/28; hosted provider certification not done | `RESUME-phase-a-transaction-safety.md`; `RESUME-phase-d-recovery-acceptance.md` |
| Country/market foundations (B) | Implemented behind `MARKET_FOUNDATIONS_ENABLED`, production flags unchanged | `RESUME-global-platform-phases.md`; `server/services/marketContext.js:5` |
| Wyn City separate-website API (C) | Implemented locally, opt-in; activation requires review/cutover/hosted certification | `server/services/storefront/README.md`; `RESUME-independent-storefront-api.md` |
| Merchant fulfillment/refunds/recovery (D) | Partial; exit gate open (shipping/tax/Kora/wallet/gift refunds, payout, zero-only policy) | `RESUME-phase-d-recovery-acceptance.md` |
| Selling-price markup | Implemented + verified 2026-10-31; channel behavior tested; uncommitted at the time | `docs/memory/selling-price-markup.md` |
| Non-beverage products, forms detail | Implemented for glassware/gift/bar-tool save + AI typing; 87 pending central products still need publish step | `RESUME-product-nonbeverage-detail-and-save.md` |
| Standalone (no Redis) runtime | Implemented (per `docs/memory/standalone-without-upstash.md`; that implementation was deployed by an earlier record we have not re-verified) — catalogue latency unresolved; current working tree's deployed state is unknown (row below) | `docs/memory/standalone-without-upstash.md` |
| Private tenant catalogue scope / general-SaaS views | **P1 slice implemented locally 2026-11-02, then reviewed by subagents and corrected the same day**. Uncommitted; no flag/data/index production action. | [RESUME handoff](../../superpowers/specs/RESUME-general-saas-evolution-audit.md); `server/constants/catalogScope.js` |
| Industry attribute registry | Proposed | [architecture.md](architecture.md) |
| Service/digital goods | Proposed as design requirement; gating decision recommended later | [architecture.md](architecture.md) |
| Deployed state of the working tree | **Unknown** — source inspection cannot establish what is running in production; earlier verified deployments are historical | This file |
| Serial tracking / bundle component systems | Unknown/absent — audit found gift/bundle type constants and `bundleDeals` arrays on SubProduct, but no verified serial/lot component inventory engine | [Guessing] to be decided during design of bundles |

## Reconciliation with existing phases

The twelve-week schedule idea in earlier planning is a hypothesis, not a
roadmap. Work must integrate with the standing phases A–H in
[strategy.md](../specification-v3/strategy.md) and
[RESUME-global-platform-phases.md](../../superpowers/specs/RESUME-global-platform-phases.md);
their names, gates and open items are unchanged. General-SaaS work is a *new
workstream*: it must not reset phase labels and must not be presented as
"Phase E" or a replacement of "gifts/restaurant" scope. It should map to:
- Phase B (market categories) for the marketplace publication policy of
  non-beverage/industry categories.
- Phase F (international ERM) — the industry attribute registry and versioned
  terms work live naturally there.
- Phase H (additional revenue streams) for cross-industry ERM adoption; direct
  POS/sales/value is already core and does not wait on B–D.

## Tests run and not run

| Check | Status |
|---|---|
| `cd server && node --test __tests__/planCapabilities.test.js` | **Run 2026-11-02, 24/24 pass** (config-only; proves the documented baseline command works) |
| Focused regressions (subProduct*/subproduct*/product*/planCapabilities/findDuplicateProducts/marketPolicyDecision/marketPublication.mongo; later sweep incl. size*/chatbotSizes) | **Run 2026-11-02: pass, 0 fail** (1 unrelated opt-in skip in the audit-day run) |
| Real-replica uniqueness suite `catalogueUniqueness.mongo.test.js` | **Run on a task-owned replica (29130, set `catUniqueness`): 6/6** — duplicate refused, race yields exactly one success, cross-tenant same-product allowed, same Size SKU refused within a tenant, Size SKU allowed ACROSS tenants, empty SKU unconstrained |
| Opt-in Mongo DB groups (29127 pre-existing venue fixture) | **Run 2026-11-02** — marketEnrollment 5/5, venueAdvances 3/3, market publication/ingress/mounts 12/12; market groups re-verified 17/17 after the marketCategories registry refactor; PID-suffixed own DB only |
| Full backend `cd server && node --test '__tests__/*.test.js'` | **Run three times 2026-11-02; final run: 4,810 tests — 4,485 pass / 67 fail / 258 skip**. Every failure is in one of six dedicated-fixture families (market HTTP-mongo; Phase-D mechanism queues/readiness/registry; venue deposits, capacity, costing, payer balances, production) — confirmed by re-running representative groups WITH their fixtures (marketEnrollment 5/5, venueAdvances 3/3, venueProduction 2/2, market publication/ingress/mounts 12/12 and 17/17 after the registry refactor). The one non-fixture failure of the day was the pre-slice `adminTierBoundary.test.js` guard, evolved and green → the failing set contains **zero catalogue-scope regressions** |
| Frontend typechecks/lint/full builds, platform/admin | **Not run** (no frontend change in the slice) |
| Production endpoint checks / deployed-environment probes | **Not attempted** |

Next implementation package must re-baseline with the documented command and
compare against the recorded baselines rather than presenting green to a prior
baseline.

## What this audit does NOT do

- Does not propose repositioning AGENTS.md/CLAUDE.md silently. Exact required
  amendments are listed with wording ready for review in
  [architecture.md](architecture.md) — they must be approved before code.
- Does not preselect an industry for a pilot without business sign-off (a
  bounded recommendation and its risk rationale are in backlog.md).
- Does not decide pricing, commission bands, country/legal claims, rebranding
  domain moves, or provider replacement/approval.
- The audit itself performed no mutation (analysis documents only). The
  separately approved same-day implementation slice added application code
  (`server/constants/catalogScope.js`, `server/config/catalogueIndexes.js`,
  `server/config/marketCategories.js`, `server/scripts/ensure-catalogue-uniqueness.js`,
  model/service/test/controller changes) — uncommitted, no
  production flag/data/index action. Nothing here is a deploy or commit claim.
