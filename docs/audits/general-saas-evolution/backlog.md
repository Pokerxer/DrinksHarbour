---
title: General SaaS evolution — ordered backlog
date: 2026-11-02
status: pending-business-approval
---

# Backlog: dependency-ordered packages

Packages are ordered by dependency, sized in complexity ranges (S ≤2 engine-day,
M = up to ~1 eng-week, L = multi-week / cross-app), each with acceptance
criteria and risk. **Nothing here is committed work.** The approved path is a
slice-by-slice review — the prompt requires approval of a specific first slice,
not blanket migration approval.

Dependency graph overview:

```
P0 Decision bundle ──┬──> P1 Private scope MVP (flag-gated) ──> Denial/leak test suite
                     └──> P1 Identifier-scope policy record
P1 MVP ──> P2 Publication-policy decoupling + public read-filter hardening
        └──> P2 Industry attribute registry (grocery) ──> P2 Onboarding split
P1 MVP ──> P3 Canonical-linking/matching tooling
P3 ──> P4 (by dependency) Service/digital · private taxonomy · bundles/serials
P4 ──> P5 Brand/rebranding assessments
```

## P0 — Business decision bundle (analysis, no code)

Objective: resolve the pre-code decisions that the audit shows are *already
decided de-facto in surprising ways* and must not drift further.

1. **Link-by-name behavior** (README F1): keep cross-tenant name matching only
   for canonical moderated identity, or restrict matching to own-tenant +
   canonical-approved candidates only. Current behavior silently merges;
   leaving it unchanged while adding a private scope reproduces the leak.
2. **Identifier scope** (README F8): `Product.slug`/`Product.barcode` global
   vs scoped; SubProduct.sku treatment.
3. **Governance wording** in architecture.md §7 approved/amended verbatim (or
   alternatives recorded).
4. **Initial industry + pilot cohort** risk-position: recommend general
   retail/grocery-convenience with the existing Monin/ckay-adjacent cohort as
   the least-adapter-risk pilot; record rejection rationale for
   fashion/electronics-first (variant-matrix / serial-tracking gaps — README
   matrix).
5. Confirm that the SaaS revenue plan does not change per industry for the
   pilot (ERM tiers stay).

Complexity: S. Risk: high if skipped — all later packages embed aspects of
these decisions.

## P1 — Private catalogue scope MVP (smallest safe first implementation slice)

**Status 2026-11-02: implemented locally, verified, then reviewed by subagents
(2 code reviewers + 1 docs auditor) and corrected the same day — the review's
P0 (a malformed flag-on link-by-ID query shape that mongod would reject) is
fixed and pinned by tests; the contract indexes were restructured to one home
per index; slug uniqueness was found silently dead and re-armed. Not committed,
no production flag/data/index change.** The operator script is
`server/scripts/ensure-catalogue-uniqueness.js` (read-only report by default —
now covers Product slugs as well; `--apply-uniqueness` is an operator action on
a reviewed database and only creates the subproducts `(tenant, product)`
unique; `--retire-global-size-sku` retires the legacy global sizes SKU index).

What landed (all flag-gated `GENERAL_CATALOG_SCOPE_ENABLED`, default off):

1. `server/constants/catalogScope.js` — scope constants, `enabled()`,
   unconditional `canonicalReadMatch()` (legacy rows always match).
2. `server/models/Product.js` — additive `publicationScope`/`owningTenant`,
   validation guard (private rows can never be published/approved; canonical
   rows cannot carry an owning tenant), scope index (non-unique).
3. `server/models/SubProduct.js` + `server/config/catalogueIndexes.js` +
   `server/scripts/ensure-catalogue-uniqueness.js` — the `(tenant, product)`
   uniqueness contract declared operator-side (deliberately NOT autoIndex:
   duplicate reconciliation must run first on each database).
   **Contract refinement (user decision 2026-11-02): SKU uniqueness lives on
   the SIZE document and is per tenant** — `Size {tenant, sku}` unique-partial
   (mirroring the existing per-tenant barcode index), and the legacy GLOBAL
   `sizes.sku_1` index is retired by `--retire-global-size-sku` only after the
   per-tenant index exists (create-then-drop ordering). The Size model no
   longer declares `unique:true` on the sku field (that would make autoIndex
   rebuild the cross-tenant constraint on every server start); a source-level
   guard in `__tests__/catalogScope.test.js` keeps it out. Proven on the
   replica: same Size SKU refused within a tenant, ALLOWED across tenants,
   empty SKU unconstrained.
4. `server/services/subproduct.service.js` — link-by-name never adopts another
   tenant's pending/private identity (candidate families: canonical-approved,
   own tenant-private, own submissions); link-by-ID gains the own-tenant-
   private case; wasted all-tenant debug scan removed; `submittingTenant`
   provenance recorded on tenant-created central rows.
5. Public-surface leak filters (unconditional): product search base query,
   sellable-product match (`/product/[slug]`), `buildProductQuery`, and
   `marketCatalog.offerStages`.
6. Approval/promotion: super-admin approve (product.service and the
   admin update paths) promotes tenant-private → canonical atomically with the
   approve action; `PRODUCT_APPROVE` audit log records the promotion.

Acceptance tests (all passing): `__tests__/catalogScope.test.js` (model guard),
`__tests__/subproductCatalogueLink.test.js` (link authority + flag behavior),
`__tests__/catalogueUniqueness.mongo.test.js` (real replica: duplicate refused,
race yields exactly one success, cross-tenant same-product allowed — runs only
with a task-owned `DRINKSHARBOUR_CATALOGUE_TEST_MONGO_URI` fixture), and
`__tests__/adminTierBoundary.test.js` test 5, whose source-scan guard evolved
from "statusFilter mentions super_admin" to the full new authority contract
(wide branch super_admin-only; tenant branch = approved canonical + own
tenant-private + flag-gated; flag-off keeps approved-only).

Original design notes below for the remaining (unbuilt) scope.

Scope (backend-concentrated, flag-gated `GENERAL_CATALOG_SCOPE_ENABLED`,
default off):

1. Product schema: add `publicationScope` + `owningTenant` (additive,
   null-safe default, as with `catalogKind` precedent) + validation hooks
   matching existing patterns (config like `catalogKind.js` — reuse the
   existing `isRetailCatalogKind`-style helper functions instead of new ad-hoc
   conditionals).
2. Guard replacement: remove cross-tenant link-by-name merge; replace with
   own-tenant + canonical-approved candidates (P0 decisions) — keeping happy
   path tests already written for the tenant create flow green (subproduct
   service path has suite coverage today).
3. Concurrency-safety prerequisite: index `SubProduct {tenant, product}`
   unique prepped via procedure; test the race RED→GREEN.
4. TDD-required behavior regression: public surfaces filter `tenant_private`;
   POS/tenant surfaces unaffected. Add failing tests first, per the
   failing-behavioral-tests-before-fixes convention (see migration.md §3).
5. Clear-and-deterministic audit events for super-admin private→canonical
   promotion.

Acceptance criteria (each a test):

- Cross-tenant denial: tenant A cannot read/update tenant B's private
  SubProduct/Product (GET/PUT/DELETE) → 404-not-403 semantics preserved.
- Private-product leak: public search/suggestion/report/AI/exports/occasions
  return zero matches for `tenant_private` entries.
- Direct-vs-marketplace fee: `selling_price_markup` and `markup`/`commission`
  allocations unaffected; POS-direct still zero marketplace surcharge.
- Final-unit race at scope change: the existing storefront race suite
  (29128-style direct store) passes unchanged (no new reservation authority).
- Replayed payments/stock effects: Phase A/D focused scripts unchanged
  (receipts/dedup consumption identity unaffected by scope field, verified via
  `orderAccess` projections regression).
- Old orders unaffected: order label/snapshot lookups unchanged; a private +
  an approved SubProduct for the same Product coexist for two tenants.
- Subscriptions + retained beverage workflows: entitlements and market policy
  regression suites green unchanged.

Complexity: M backend (`server/models/Product.js`, `subproduct.service.js` +
test files and the market/catalog filter paths), plus minimal admin read-only
viewing (no new industry UI). Risk: moderate — touches only additive behavior;
highest regression risk is on private filtering omission (leak) which is why
the denials are tests, not comments.

Channels not blocked: nothing in POS/Sales/Invoice/Billing is path-modified;
`packages/sales-money` untouched.

## P2 — Publication-policy decoupling + hardcoded-product-path audit

- Replace any direct `status: 'approved'` reads in tenant-operational paths
  with the scope helper (grep-first inventory, then codify to an explicit
  helper — removes accidental future re-tightening). Complexity: S–M. Risk:
  low if inventory-first.
- Ensure `isPublished` remains only marketplace underneath; confirm no other
  consumers (reports, supplier checks) query it expecting operational
  semantics rather than publication semantics.
- Move publication eligibility under market policy as today (canonical
  only), and decide whether tenant-website publication uses `marketIngress`
  category scoping for the pilot scope (dependency: P0 decision 4).

## P2 — Industry attribute registry v0 + grocery cohort attributes

- `server/config/industry-attributes/v1/grocery.js` + validation.js-style
  schema contract, applied at API boundary and admin UI field rendering.
- Register attributes for grocery pilot from the risk list (storage temp,
  allergens, shelf life, nutrition, brandCountry).
- Deliberate 'beverage' profile stays typology-first (no migration for
  beverage data — no attribute insertion for beverage).

Complexity: M (server+admin+platform minimally). Risk: moderate — validation
gaps become data debt; mitigated by keeping beverage paths untouched.

## P2 — Onboarding split: registration / industry configuration / billing / optional marketplace enrollment

- Independent: business registration first (existing flow), then industry
  profile selection (new, additive), then billing (existing Paystack), then —
  optional — marketplace enrollment (existing marketPolicy UI). No repeat
  onboarding for existing tenants (they default to the beverage profile with
  no required action for them; existing capabilities preserved).
- Complexity: M–L (UI in admin/platform + conditional validation).
  Risk: low-moderate; must be tested with three other starting states:
  brand-new beverage business, brand-new grocery business, existing beverage
  converting (add-on profile).

## P3 — Canonical linking/matching tooling

When the pilot's P0 decisions are in place: tenant-facing "link to central
identity" search restricted to own-tenant + canonical-approved; optional
platform-side moderator workflow to propose a merge after human review.
Complexity: M–L. Risk: moderate — only enabled for pilot scope once the
matching policy is approved; updates never silently merge.

## P3 — Variant / size/color/model matrix assessment (only when an industry such as fashion/apparel/multi-variant goods enters the pilot)

- Package-first: adapt from the existing per-SKU Size model into a matrix only
  if the P0 decision set and pilot cohort say so.
- Complexity: L when exercised. The audit deliberately does not assume
  size/color/model dimensions beyond groceries. Serial tracking and kit/bundle
  component inventory do not exist yet in a verified engine — the bundleDeals
  array on SubProduct is a marketing bundle, NOT a component-stock system (risk
  area F14). Reservation authority already centralizes on
  WarehouseStock/WarehouseBatch and their movements; a bundle component system
  would need its *own* derivation contract and cannot share the aggregate
  decrement. Keep one stock writer, no dual decrement.

## P4 — Service/digital lifecycles (design deferred; do not implement now)

- Non-stocked SubProduct: no stock fields obligation; fulfillment route
  `manual_close`/`digital_grant` only; no WarehouseStock rows; no
  batch/expiry attributes consumed; refund semantics designed with the credit
  note engine (`creditNote.service.js` exists) rather than inventory returns.
- Recommendation (per prompt §7): begin when (a) the pilot cohort demands it,
  or (b) Phase E gift/food workstream needs the same primitives — sharing the
  workstream rather than inventing two lifecycles. Complexity: L total;
  first slice S if a single `digital` fulfillment record is a read-only
  flag-driven handoff.
- Explicit non-goal: no fake stock, no expiries, no fulfillment steps faked
  (per prompt).

## P4/P5 — Rebranding / brand-presentation (assessment-only)

- Separate SaaS identity vs DrinksHarbour presentation: assess domains,
  auth/cookie scopes, email templates, mobile deep links/deeplink manifest,
  API clients (Wyn City), receipt templates, legal identity, and index/SEO
  transfer risk, before any brand move is approved.
- Complexity: L analysis. **Cannot be done silently**; collection/endpoint
  renames are forbidden by prompt §7 (stability rule).

## Registry of unresolved decisions (gates)

| # | Decision | Owner recommendation | Blocker for |
|---|---|---|---|
| D1 | Link-by-name merge policy | Restrict to own-tenant + canonical-approved [Likely] | P1 MVP |
| D2 | Identifier scoping (slug/barcode/sku) | Slug stays global; barcode scoped-decision deferred to first pilot cohort | P1 MVP |
| D3 | AGENTS.md/CLAUDE.md wording amendments | Proposed verbatim in architecture.md §7 | P1 MVP |
| D4 | Initial industry + cohort | Grocery/retail pilot cohort; reject fashion/electronics-first | P2 onward |
| D5 | Whether private goods may use platform categories/brands (global) or need private taxonomy | Stays global for MVP; private taxonomy P3. **Verified enabler (2026-11-02): supply-category mapping is now registry-owned** (`server/config/marketCategories.js`, delegate `marketIngress.categoryFor`, behavior pinned) — registering a future vertical is config + policy/economics decisions, not an engine fork. | P1–P3 |
| D6 | Service/digital timing | Recommend Phase E/pilot-cohort-driven | P4 |
| D7 | SaaS brand proposition / separate brand name | Business decision; analysis in P5 | P5 |
| D8 | Country/legal/BVN/NAFDAC requirements for non-beverage goods | Needs qualified legal review before expansion; not assessed here | P2+ |

## Risk register (project-level)

| Risk | Mitigation |
|---|---|
| Working tree vs deployed drift (project-wide) | Audit does not modify; approved slice uses fresh baseline re-baseline command before assuming green |
| Cross-tenant leak via future AI/exports/occasions | Denial tests in P1 + grep-first policy in P2; embeddings stay server-side `select:false` |
| Revenue-policy drift accidentally from services | Contract isolated to Tenant/SubProduct/Size as today; channels-tested allocation suites remain the gate |
| Race exhaustion of sku uniqueness or slug | slug uniqueness was found silently DEAD (duplicate schema key — fixed 2026-11-02, now required+unique re-armed; pre-check via the report script's slug section before environments build it); migration (`SubProduct(tenant,product)` unique) is the operator-protected invariant; sku global unique already |
| Offline POS behavior regressions from scope field | not touched by MVP; regression suites after field addition |
| Storefront-channel `categoryFor` getting 'beverage' fallback for pilot scope | P2 decision; release-scoping isolated until enrolled |
