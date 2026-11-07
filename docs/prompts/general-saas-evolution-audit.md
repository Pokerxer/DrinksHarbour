---
title: General SaaS evolution while preserving DrinksHarbour
date: 2026-11-02
status: ready-for-audit-only
---

# Copy the prompt below into the engineering chat

You are the principal software architect and senior full-stack engineer for
DrinksHarbour. Work in `/Users/mac/Documents/drinksharbour`.

Assess how the existing beverage-focused ERM can evolve into a general-purpose,
multi-tenant business management SaaS, potentially under a separate brand, while
preserving DrinksHarbour's beverage marketplace and existing tenant operations.
This is an evolution of a substantial application, not a greenfield rebuild.

## 1. Assignment and authority

Begin with a source-backed audit and proposed migration design only. You may
create task-owned Markdown documents and diagrams. Do not implement the migration,
change application configuration, create indexes, backfill data, activate flags,
commit, push, deploy, or perform real payment/provider/customer actions.

The longer-term direction includes general retail, supermarkets, fashion,
electronics, beauty/cosmetics, general merchandise and beverage businesses.
Services and digital goods are design requirements to assess, not assumed
capabilities or mandatory first-release deliverables. Recommend a bounded initial
industry and pilot cohort based on dependencies and business risk.

Treat the application as operationally critical. Source inspection does not prove
which working-tree changes are deployed. Preserve existing users, identifiers,
inventory, financial history, integrations, subscriptions and normal daily sales.

This prompt authorizes analysis of changes to current product ownership rules;
it does not approve those changes. Identify conflicts with AGENTS.md and record
the exact rule amendments needed before implementation. Do not silently change
project instructions to make a proposed architecture permissible.

Use one agent, applying specialist skills sequentially. Do not spawn subagents or
build orchestration frameworks unless I explicitly request delegation later.

## 2. Read the current evidence before designing

Read `CLAUDE.md`, `AGENTS.md`, applicable nearest README/rules files and relevant
installed skills. Announce skills used; unavailable skills are not capabilities
you may claim. Repository rules override incompatible generic skill examples.

Start with these existing records, following their continuation links:

- `docs/audits/specification-v3/README.md` and `strategy.md`.
- `docs/superpowers/specs/RESUME-global-platform-phases.md`.
- `docs/superpowers/specs/RESUME-independent-storefront-api.md`.
- `docs/superpowers/specs/RESUME-phase-a-transaction-safety.md`.
- `docs/superpowers/specs/RESUME-phase-d-recovery-acceptance.md`.
- `docs/superpowers/specs/RESUME-product-nonbeverage-detail-and-save.md`.
- `docs/memory/selling-price-markup.md`.
- `docs/memory/standalone-without-upstash.md`.
- `docs/operations/README.md` and linked release/recovery/backup procedures.
- Relevant `docs/saas/`, `docs/memory/` and later RESUME documents.

Older audit findings may have been fixed locally. Verify current source and tests
before reporting them as open. Distinguish implemented, tested locally, externally
gated, proposed and unknown. Cite repository paths and line numbers for findings.
Use [Certain] for inspected evidence, [Likely] for supported inference, [Guessing]
for unresolved assumptions. Never describe local test evidence as deployed proof.

Inspect the working tree before writing; preserve unrelated modified, untracked
and staged files. Do not blanket-stage, reset or clean the repository.

## 3. Existing structure to preserve

Verify this baseline against the checkout; do not introduce a replacement stack:

| Location | Current responsibility |
|---|---|
| `server/` | Express 5/CommonJS API, Mongoose/MongoDB, controllers, services, jobs and tests |
| `client/apps/admin/` | Next.js App Router; shared super-admin and tenant operations dashboard |
| `client/apps/platform/` | Separate Next.js App Router marketplace and tenant storefront application |
| `client/apps/mobile/` | Expo/React Native customer application |
| `client/packages/` | Existing UI, commerce, fonts and configuration packages |
| `packages/sales-money/` | Shared financial calculation code; inspect its actual consumers |
| `server/scripts/`, `scripts/` | Existing operational, migration and quality tools |
| `docs/` | Architecture, business policy, task plans, evidence and handoffs |

Read manifests and lockfiles for exact versions and commands. The frontend apps
currently use different Next.js versions; do not force a framework consolidation.
Reuse existing state management and UI conventions instead of prescribing Redux
or Zustand globally. Do not convert the backend to TypeScript, NestJS, Prisma or
microservices as a side effect of generalization.

Wyn City's independent website is an external API consumer. Inspect
`server/services/storefront/README.md`; do not build another Wyn website here.
Physical super-admin/tenant app separation and custom-domain lifecycle are
separate proposals, not prerequisites to impose without evidence.

## 4. Audit the ownership model before proposing a universal product

Current architectural contract:

- Tenant is the subscribed business; Vendor is an external procurement supplier.
- Product is the shared canonical catalogue identity, not a tenant-owned record.
- SubProduct is the tenant-owned operational listing linked to Product.
- Size is a separate tenant-scoped selling/stock variant model; do not replace it
  with an embedded generic variants array without tracing every consumer.
- Tenant owns revenue policy. SubProduct/Size own operational prices and stock
  fields under current rules. Inspect the actual field names and ownership.
- Warehouse, WarehouseStock, WarehouseBatch, reservations and movements already
  implement location/batch responsibilities. Keep location semantics extensible.

Inspect `server/models/{Product,SubProduct,Size,Tenant,Category,SubCategory,Brand,
Warehouse,WarehouseStock,WarehouseBatch}.js` and their services/routes/tests.
Existing type constants and admin forms already support some non-beverage goods.
An enum value or hidden beverage section does not establish full industry support.

The proposed SaaS must let a retailer manage private goods without marketplace
approval, while marketplace publication remains optional and independently gated.
The existing tenant product-creation path can create a pending central Product
alongside an operational SubProduct; inspect where review actually blocks work.

Compare at least these ownership approaches:

1. Extend the current Product/SubProduct/Size relationship with explicit private
   catalogue scope, controlled canonical linking and separate publication policy.
2. Add a tenant-private catalogue identity and an explicit mapping to a canonical
   marketplace Product when the business opts in.

Recommend one with evidence. Neither is approved by this prompt. Explain read and
write authority, privacy, identifiers, uniqueness/index scopes, matching and
deduplication, moderation, references, API compatibility and migration cost.
Do not merge private goods across tenants based on names or barcodes alone.
Do not expose private metadata through public search, AI enrichment or exports.

Model catalogue identity, tenant assortment, sellable variants, prices, inventory
and marketplace publication as separate responsibilities. Do not flatten them
into a `UniversalProduct { tenantId, price, stock, variants }` replacement.
Define typed, versioned attribute validation and searchable/indexed attributes;
an unrestricted `Record<string, unknown>` is not a complete data model.

## 5. Reuse existing commerce, finance and security boundaries

Trace the actual dependency paths through POS sessions, manual Sales/SalesOrder,
PurchaseOrder receiving/returns, inventory transfers/adjustments, accounting,
invoices, credit notes, customer returns, taxes, pricelists and promotions.
Include staff/location permissions and existing offline POS behavior. Preserve
tested offline behavior; do not invent offline payment guarantees.

Also inspect these existing capabilities before proposing equivalents:

- `StorefrontChannel`, `SalesChannel`, online stock reservations and storefront
  account/channel snapshots; tenant website API keys and customer identities.
- `MerchantOrder`/`MerchantOrderSet`, `server/services/merchantFulfillment/`,
  customer shipments, delivery providers, refund/recovery and settlement readiness.
- `server/services/marketPolicy/`, country/market configuration and enrollment.
- `server/config/erm-plans.js`, `server/middleware/plan.middleware.js`,
  entitlements, ERM billing, subscription events and reconciliation.

Do not create a second inventory engine, ledger, checkout, billing system or
merchant identity. Do not dual-decrement aggregate and location stock. Identify
authoritative writers and legacy adapters before proposing cutovers.

Preserve these safeguards:

- Tenant authority comes from authenticated server context through existing
  `getTenantId(req)` and authorization helpers. Client tenant IDs or hostnames do
  not authorize staff access. Retain separately authorized platform-admin scope.
- Every tenant-owned query/mutation includes tenant scope, plus applicable
  customer/location/role restrictions. Public DTOs exclude costs and supplier PII;
  merchant views exclude sibling merchants' records and private financial data.
- Keep refresh rotation, revocation, account lockout, effective permissions, MFA
  and audit behavior. Verify source instead of repeating stale placeholder notes.
- Preserve original order/line/channel/account/currency/unit/cost/share snapshots,
  payment trust, idempotency, exact reservations and accounting reconciliation.
- Feature rollback stops new work safely; it must not erase accepted obligations,
  uncertain payments, refund reservations or movement history.

## 6. Commercial and runtime invariants

Retain the approved `markup`, `commission` and `selling_price_markup` models.
For selling-price markup: nullable override inherits the current Tenant percentage;
zero is explicit; only platform review edits/resets overrides. Tenant payout stays
retail; discounts cannot push checkout below payout. Historical snapshots stay
fixed. See the authoritative memory/design for exact rounding and channel rules.

Audit channel-specific allocation. General SaaS/direct sales should not acquire a
marketplace charge merely because a tenant participates in DrinksHarbour. Do not
silently change legacy markup/commission channel agreements; propose explicit,
versioned terms and migration where existing behavior differs from the target.
Do not infer the commercial channel from `source: web`, the current hostname or
client-declared fee exemption.

Paystack is the approved NG ERM subscription integration. Source also contains
other/legacy payment paths and gated provider work. Inventory these honestly;
their presence is not approval to remove them or introduce a new provider.
Preserve original payment-account ownership and provider-verification rules.
Do not turn business-plan commission bands or proposed SaaS prices into hardcoded
commercial changes. Version future country/currency/tax/plan terms explicitly.

The runtime must work without Upstash/Redis. Do not restore hosted cache/shared
limit dependencies. Preserve authoritative MongoDB reads, process-local API limits
and Mongo-backed account/API-key protections. Document per-process limitations.

## 7. Proposed target and staged scope

Design logical boundaries inside the existing applications first:

- Shared business management: catalogue, inventory, procurement, POS, sales,
  accounting, staff, reporting, subscriptions and APIs.
- Industry configuration: validated attributes, units, variant rules and optional
  batch/expiry/serial/bundle/restriction capabilities.
- Optional marketplace participation: eligibility, canonical linking, publication,
  channel pricing, fulfillment, delivery and settlement under reviewed terms.
- Brand presentation: general SaaS identity versus DrinksHarbour marketplace.

Industry choice, plan entitlement, user permission, location scope and marketplace
eligibility are distinct checks. Hiding a UI section cannot enforce a capability.
Multi-industry businesses may require more than one industry profile; assess this.

Cover private categories/brands, imports, barcode scopes, size/color/model variants,
unit/pack conversions and returns. Identify gaps in serial tracking and bundles
instead of assuming they exist. Design non-stocked service/digital lifecycles
without fake stock, expiry or fulfillment, and recommend when to implement them.

Keep beverage ABV/alcohol/volume/origin/flavor metadata and restricted-product
controls intact. Do not force those fields onto clothing or services. Review
server-side restriction enforcement and existing identity/BVN handling without
viewing real identity records. Legal conclusions need qualified review; research
current primary sources only when making jurisdiction/provider-specific claims.

Onboarding must distinguish business registration, industry configuration, billing
and optional marketplace enrollment. Existing tenants must not repeat onboarding
or lose capabilities because a new default is introduced. Rebranding must assess
domains, auth/cookies, email, mobile links, API clients, receipts and legal identity;
it does not authorize renaming collections, IDs or deployed endpoints.

## 8. Deliverables and verification

First propose a small file tree, then write into existing documentation locations:

- `docs/audits/general-saas-evolution/README.md`: executive findings, evidence
  index, implemented/proposed/gated matrix and current architecture diagram.
- `architecture.md`: dependency/data ownership maps, target options and selected
  recommendation, trust/panel boundaries and required instruction amendments.
- `migration.md`: compatibility, ID/reference preservation, index preparation,
  rehearsal, reconciliation, pilot/flags, cutover, rollback and recovery.
- `backlog.md`: dependency-ordered packages, acceptance criteria, tests, risk,
  complexity ranges, unresolved decisions and safest first implementation slice.
- Relevant `docs/superpowers/specs/RESUME-*.md` and `docs/memory/` handoff entries.

Keep files focused; split when needed. Reuse earlier audits by linking evidence
and recording the current delta. Do not duplicate their entire history.

For this audit, validate cited paths, current source findings, internal links and
whitespace. Inspect test coverage and commands; run safe targeted tests where they
resolve a finding. Do not load private dotenv files or let tests use production
connections. Record tests not run and skipped external checks explicitly.

For later approved implementation, require failing behavioral tests before fixes
and relevant regression/security/migration checks after them. Backend baseline is
`cd server && node --test '__tests__/*.test.js'`; verify current manifests because
the older blanket warning that `npm test` is broken is stale in this checkout.
Use actual admin/platform/mobile scripts for touched apps. Use a disposable local
Mongo replica set for transaction/race/migration checks. Cover cross-tenant denial,
private-product leaks, direct versus marketplace fees, final-unit races, replayed
payments/stock effects, old orders, subscriptions and retained beverage workflows.
Compare known failures to a recorded baseline; do not weaken checks to claim green.

The original twelve-week schedule is a hypothesis, not an approved roadmap or
delivery guarantee. Estimate only after mapping dependencies. Reconcile this
initiative with existing global phases and unresolved launch gates; do not reset
their phase names or pretend their local work has not happened.

## 9. First execution and stopping condition

Complete the audit/design deliverables and report the highest risks, recommended
ownership option, conflicts needing a business decision, verification limits and
smallest safe first implementation package. Work autonomously on independent
analysis while recording unresolved commercial/legal decisions as gates.

Stop after presenting this concrete review package. Request approval for the
specific proposed implementation slice, not blanket permission for a migration.
Audit approval is not production deployment, data migration or provider activation
approval. Do not execute later phases from this prompt automatically.
