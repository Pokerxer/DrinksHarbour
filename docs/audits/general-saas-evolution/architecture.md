---
title: General SaaS evolution — architecture ownership design
date: 2026-11-02
status: recommendation-for-review-not-approved
---

# Architecture: ownership, boundaries and authority

Scope of this file: model the responsibilities the general SaaS needs from the
existing Product/SubProduct/Size/Tenant/Warehouse stack, compare the two
candidate ownership approaches with source evidence, recommend one, and record
the trust boundaries and instruction amendments that must be approved before
implementation. Read [README.md](README.md) for evidence/citations context.

Parent documents: [specification-v3 strategy](../specification-v3/strategy.md)
(`architecture.md`, §1 "Retain Tenant/Product/SubProduct/Size/Warehouse"), the
[prompt-refinement review](../general-saas-prompt-review-2026-11-02.md), and the
selling-price-markup agreement (`docs/memory/selling-price-markup.md`).

## 1. Separate the responsibilities — target vocabulary

Responsibility map (current model → target responsibility):

| Responsibility | Current home | Target ownership (unchanged unless marked) |
|---|---|---|
| Catalogue identity (name, type, taxonomy, media, canonical facts) | `Product` (platform-global, tenantless except provenance) | **Split**: `publicationScope` decides whether one Product is a *canonical marketplace identity* or a *tenant-private identity*. Same collection; field is additive and null-safe. |
| Tenant assortment (which goods a tenant offers) | `SubProduct` (tenant-owned; `product` ref) | Stays. Never flattened. |
| Sellable variants | `Size` (tenant-owned variant with price/cost/stock fields) | Stays. Size venues (`venueServing`), unit types, weight/count semantics already generalize beyond beverages. |
| Operational prices & stock | SubProduct/Size numeric fields (AGENTS.md ownership rule) | Stays entirely; no change to who owns what. |
| Location inventory | `Warehouse`→`WarehouseStock`→`WarehouseBatch`, movements, reservations | Stays; evolve batch/expiry/serial/bundle capability only when a customer need is demonstrated. |
| Marketplace publication policy | `Product.status` (`pending`/`approved`), `isPublished`; `marketPublication` + market policy services (flag-gated) | Becomes explicitly *optional promotion of a canonical identity to marketplace surfaces*; tenant operations must never depend on it. |
| Revenue policy | `Tenant.revenueModel` + `SubProduct/Size` overrides | Stays per AGENTS.md; do not add a marketplace charge to direct ERM sales. Direct-channel zero-surcharge behavior under `selling_price_markup` is the standing contract (`docs/memory/selling-price-markup.md:37-41`). |
| Industry configuration | **Missing** (only `businessCapabilities` retail/hospitality and venue settings exist) | New **industry profiles** with validated attribute sets — see §6. |

The invariant that must survive: **no `UniversalProduct { tenantId, price,
stock, variants }` table**. SubProduct/Size already carry assortment and
operational data; merging them into a universal row would put a fork into every
consumer of these models (POS, sales, orders, pricelists, coupons/promotions,
accounting, storefront channel, market policy, chatbot/occasions — the two
model families are read across most of `server/services/` and
`server/controllers/`) and break the tested order-refund/accounting authority
boundaries (`merchantFulfillment`, `orderAccess`, POS session money model).

## 2. The two ownership options, audited

### Option 1 — extend the current Product/SubProduct/Size relationship with explicit private catalogue scope.

Mechanics: add a schema field to Product, e.g.
`publicationScope: { enum: ['canonical', 'tenant_private'], default: 'canonical' }`
plus `owningTenant` (only set for tenant_private, `index` scope:
`{ publicationScope: 1, owningTenant: 1 }`, sparse unique on `canonical`
rows). Everything else stays.

Pros, with evidence:
- **Existing behavior already treats pending Products this way**: a tenant's
  created pending Product is invisible publicly and yet the SubProduct sells in
  POS (`pos.controller.js:1532-1541`), notifies, invoices, and appears in ERM
  reporting (`server/services/subproduct.service.js:690` currently sets
  `status: 'pending'` on the central row). This means formalizing "private until
  promoted" is aligned with what's actually running, not an architectural
  exception bolted on.
- **Consumer blast radius is explicitly filtered to public paths only.**
  Operations flows that read tenant catalogue (POS `getPOSProducts`,
  pricelists, coupons/promotions applyTo, sales) never join on central approval
  status, verified at `pos.controller.js:1537-1541`. Only marketplace surfaces
  need the added predicate (public catalogue/search, SEO, occasions, chatbot,
  storefront channel).
- **Identifier keeping.** `Product.slug`, `Product.barcode`, `SubProduct.sku`
  can stay globally unique — privacy comes from read authority, not from
  separate ID spaces. Reusing the per-tenant barcode precedent at Size level
  (`Size.js:811-817` partial-filter unique) is available if a scoped decision
  is taken. **As of 2026-11-02 the Size-SKU decision is taken and implemented
  (per-tenant `tenant_sku_unique`, legacy global `sku_1` retired only by the
  operator script); reviewing found `Product.slug` uniqueness was silently
  DEAD (duplicate schema key) and re-armed it — slug/barcode scope remains
  open decision D2.**
- **Migration cost is minimal**: absent field means legacy documents remain
  canonical (default enum value), so no backfill is required for correctness —
  the first deployment can rely on schema-default behavior exactly like
  `catalogKind` did (`Product.js:252-259` documents this pattern: "existing
  beverage documents gain the default on next save and read as legacy").

Cons / what must be prepared:
- Link-by-name must stop merging into another tenant's identity (README F1) —
  replace with matching restricted to (a) the tenant's own catalogue scope and
  (b) canonical approved supply only, otherwise staying tenant-private; never
  silently adopt by name alone (a reviewed, moderated suggestion flow may
  still propose canonical candidates).
- Tenants that link by ID need a new permitted case: *link to one's own
  tenant_private product* (ownership check, not approval check). README F4's
  contradictory rules collapse into this.
- Moderation semantics: super-admin approve/reject must apply to the
  *canonical promotion queue* of tenant_private rows and to `canonical`
  provenance changes. Marketplace rejection of privately sourced goods must
  never delete or hide them from their owner (matches today's behavior, where
  a rejected/paused central Product stays merely `pending` and never becomes
  `deleted`; the distinction must be recorded as a rule, not just left as
  emergent behavior).
- Barcode and slug collisions across tenants: current `Product.barcode`
  sparse-unique stays global until screening decides otherwise; if two tenants
  colliding on a barcode for *different* private goods is normal (supermarket
  producer GTINs are not tenant-relative), the scoped decision must be made
  during design, not after. This is the main genuinely unresolved business
  choice under Option 1. (Backlog gates on it.)

### Option 2 — tenant-private catalogue identity plus explicit mapping

A new document family (e.g. `TenantCatalogueItem` per tenant, private fields
allowed) plus an explicit link table `CanonMap { tenantItem, product? }`
mapping to a canonical marketplace Product when the business opts in.

Pros:
- physics of privacy: default-deny reads; nothing public until a verified
  mapping exists; tenant deletion becomes clean (private rows die with the
  tenant); industry-specific metadata has natural home inside the private row.
- matching/dedup: mapping is explicit-opt-in and reviewable, rather than
  inferred.

Cons, with evidence (this is why it is not the recommendation):
- **Every label-bearing consumer must branch across two id spaces.** Today the
  denormalised label refs are all over the tested commerce surfaces: POS combos
  populate `choiceLines.items.subProduct.product` (`pos.routes.js:224-233`) and
  rely on direct `product` refs; pricelist/coupon/promotion applyTo arrays of
  `products`/`categories`/`brands` are used per tenant
  (`Tenant.js:623-694`); orders store line-level denormalised items that read
  Product labels (`order`/`sales` lines consume `Product.name` from these
  refs). Adding `TenantCatalogueItem` means every one of these paths gains a
  "is this the platform Product or a private identity?" fork, or a universal
  mapping service both POS/Sales/storefront must go through — the same review
  cost as a swap of the base tables.
- **Existing tenant-sourced pending rows have no private identity;** 87 pending
  central products were recorded at `RESUME-product-nonbeverage-detail-and-save.md:117`
  (current count unverified). Under Option 2 they would have to be migrated to
  `TenantCatalogueItem` or reconciled to canonical rows — an inventory run
  would be required before design.
- **Duplicate matching/dedup policy would be rebuilt anyway**, spending the
  same design effort that Option 1 must spend on link-by-name/identifier
  scopes — but couched in a new mapping layer with its own tests.
- **Taxonomy fragmentation**: `Tenant.js:623-694` couples coupons/promotions to
  canonical `Category`/`Brand` ids; private identities excluded from these
  need separate scoped labels until a parallel taxonomy exists (contradicts the
  audit's vendor/categorization precedence).

### Recommendation: **Option 1** (with the exact preparation list)

Adopt Option 1 as the design basis, with these bindings as mandatory before any
code:

1. Replace link-by-name (README F1) with tenant-owned-scope-capable matching;
   no cross-tenant silent adoption.
2. Prepare missing composite unique indexes first, by the reviewed index
   procedure (never autoIndex), before enabling any concurrent-creation flow
   the new scope might invite (README F2 + migration.md §2).
3. Decide identifier scope policy (README F8) explicitly: keep `Product.slug`
   global unique; decide `Product.barcode` global-unique vs scoped when first
   private goods arrive.
4. Public read paths, AI enrichment, exports, and occasions/chatbot must filter
   `publicationScope: 'canonical'` and never expose `tenant_private` metadata
   by inclusion (write-tested denial first per TDD protocol on the approved
   slice).
5. Industry attribute validation arrives as stated in §6 — never as
   unrestricted `Record<string, unknown>`.

## 3. Read/write authority map (target)

| Authority | Read | Write |
|---|---|---|
| Tenant staff (own tenant, scoped by JWT) | own SubProduct/Size/stock/Sales/POS/tenant_private Products incl. pending ones; canonical Products for linking candidates | own tenant-scoped writes only; tenant_private create/update; **never** `isPublished`/`platformMarkupOverridePct`/`sellingPriceMarkupOverridePct` (platform-review-only, as today) |
| Marketplace consumer (platform client, public) | `canonical` Products with approved+published only; aggregated tenant availability via existing projections; never tenant_private; never cost/PII (existing DTO filters unchanged) | none (cart/checkout then server derives tenant) |
| Storefront channel key (Wyn) | scoped published offers only, its own location/holds; never private or unenrolled offers (`marketPublication` denies) | other channels unchanged |
| Platform super-admin | everything, audited (`AuditLog` unchanged) | approve/reject canonical promotion, review/private overrides, marketplace enrollment/policy; must not invent cross-tenant merges |

Preserved hard rules from the isolation workstreams: every tenant-owned
query/mutation retains `tenant` scope (`tenantFilter`/`strictTenantFilter`).
Read privacy: AI enrichment must never be fed one tenant's tenant_private
content for another tenant's result — anywhere AI generation runs, the input
corpus is canonical-only (mirror of the existing rule that private metadata
stays out of public search/AI/export surfaces).

Just as today, the public catalogue returns tenant prices with the platform
share computed server-side and never exposes cost prices or supplier PII
(existing DTO rules apply to tenant_private rows exactly as to public ones);
embedding data (`Product.embedding`, `select:false`) never leaves the server.

## 4. Trust and panel boundaries

Mirrors the tenant-isolation skill's three-panel model:

- **Tenant admin panel** (`client/apps/admin` shared app, tenant-authenticated
  routes) sees own catalogue, own Sales/POS/own inventory; the shared app is
  a *deployment* concern, not a *authority* concern — the super-admin/tenant
  app split remains a separate proposal, not a prerequisite to this design
  (matches strategy.md §1 "enforce permissions in the API regardless of panel
  layout").
- **Platform admin** (`/super-admin` duties in the same app today) has
  review/enrollment/hosting duties that must stay audited per
  `AuditLog` rules — approval of tenant_private to canonical is exactly the
  case to exercise (audit event names e.g. `PRODUCT_PRIVATE_COMMIT`,
  `PRODUCT_PRIVATE_REJECT_DELETE_SOURCE`).
- **End-user storefront** (platform + mobile + Wyn website) sees only
  canonical+published; 404 semantics (not 403) on foreign/not-published
  references, matching `assertTenantOwnership` in `tenantContext.js:84-93`.
- The four checks on any capability grant — industry profile entitlement, user
  permission/role, location scope, marketplace enrollment — are independent
  gates, each evaluated server-side. UI hiding is not enforcement anywhere in
  this design.

## 5. Multi-industry businesses

A single tenant may span beverage retail + bar service, or beverage + mixed
retail (supermarket with bar). Options: (a) one tenant with
multiple industry profiles (no other structural changes; entitlement check per
profile maps to `checkCapability`, existing per-role location scoping), (b)
separate tenants per vertical. Design recommendation [Likely]: (a), because
locations, staff, accounting, and subscription/billing state already collapse
to one Tenant and duplicating them would split history. Additional industry
profile is a modeled relationship, not a plan lock (plans' capability sets
still apply). Not implemented in this audit; a single default profile
("beverage") with additive profiles for General Retail/Grocery Service
stakeholders is the first slice target.

## 6. Typed attribute validation and searchable attributes

Design:

```jsonc
// server/config/industry-attributes/v1/grocery.js (proposed shape)
module.exports = {
  industry: 'grocery',
  version: 1,
  attributes: [
    { key: 'storageTemp',   type: 'string',  enum: ['ambient','chilled','frozen'], required: false, searchable: true },
    { key: 'shelfLifeDays', type: 'integer', min: 1, required: false, searchable: false },
    { key: 'allergens',     type: 'array',   itemType: 'string', enumRegistry: 'allergens', searchable: true },
    { key: 'brandCountry',  type: 'string',  required: false, searchable: false },
  ],
};
```

- Schema contract happens at the API boundary (validation.js style already
  used by `marketPolicy` and `catalogKind`); DB paths stay explicit fields
  (accessibility, index/statistics).
- Optional first-class attributes for attributes consumed in operations are
  allowed (see existing precedent — batch/expiry flags,
  `isExpiryRequired`, `size unitType`); fixes selectivity for `search`.
- Unrestricted `Record<string, unknown>` is explicitly rejected as design.

## 7. Required instruction amendments (exact wording; not applied)

Proposed amendments to `AGENTS.md` — must be approved by the user before any
implementation touches the code. Wording; numbering preserved in AGENTS.md.

### Amend "Core Concepts → Tenant is the subscribed business" bullet

- Replace "Tenant is the subscribed beverage business" and "wants to sell a
  beverage" wording with "...business (an industry profile applied — beverage
  legacy default…)". No change to markup/commission/override rules (those
  sentences stay intact).

### Amend "Core Concepts — Products live in a single centralized catalogue…"

From: "This is a central catalog... Tenants do not own Products directly."

To (proposed):

> "Products are catalogue identities in a single collection. A Product is
> either a canonical marketplace identity (visible on drinksharbour surfaces
> per super-admin review and marketplace policy) or a tenant-private identity
> scoped to its owner and never exposed cross-tenant or on public surfaces.
> Tenants own their SubProduct operations always; they own tenant-private
> Product identities for their own store; canonical Product records remain
> platform-managed."

From the "Tenant & Product Workflow" bullet:

> "**No match found** → Tenant may create a tenant-private Product identity
> immediately sellable in their store while its marketplace publication
> remains gated: but is always 'pending' for marketplace surfaces, requires
> explicit super-admin approval to be promoted to a canonical identity… Approve
> has no effect on the tenant's own operational access to their pending
> product in POS, website, Sales or inventory flows."

Key addition: **rewrite the "Match found" step** — matching may only link
within a tenant's own recorded catalog or to canonical approved central
identities; never cross-tenant by name/barcode (this codifies the F1 rule).

### Amend "Key Rules — Never Violate These" list

- Fifth rule ("central Product catalog is the single source of truth —
  no duplicates, ever") gains a clause: "single source of truth *per scope*;
  tenant-private identities are the tenant's own scope; the marketplace
  never consults tenant-private records for cross-seller matching."
- Sixth rule ("New Products created by tenants are always pending approval
  until a super-admin publishes them") becomes two sentences: "…pending for
  marketplace publication; operational sellability in tenant-owned channels
  (POS, tenant website, Sales, inventory) is independent of that pending
  status."
- New final bullet: "Beverage-specific fields and restricted-product controls
  are never dropped or hidden when other industry profiles are added."

### Amend "Beverage-Specific Domain Fields — Every Product and SubProduct
must support"

To: "Every Product and SubProduct **of beverage industry profile** must
support…; other industries use the attribute registry for scope-specific
fields, while beverage fields stay non-required for them (mirror of
Product.js:824-857 clear-on-non-beverage behavior)."

### AGENTS.md Technology table — no change required

No central change; the mandates on runtime/cache (standalone), stack, and
deployment stay as they are, superceding any skill genericism.

### Test-baseline note (AGENTS.md §8 + CLAUDE.md session protocol)

- Both files currently record that "`npm test` on the server is broken; use
  `cd server && node --test '__tests__/*.test.js'`". In this checkout the
  blanket warning is stale: `server/package.json:10` declares `"test"` as
  exactly that baseline command, so both forms run the same suite (verified
  today with `planCapabilities.test.js`, 24/24). Proposed future amendment:
  state the equivalence instead of describing either form as broken
  (documentation-only change; not applied here).

These are **writings awaiting approval**; under the rule that no instructions
were silently changed, none of them has been applied in this session.

## 8. Commerce and finance invariants carried forward

- Retain `markup`, `commission`, `selling_price_markup` unchanged;
  `sellingPriceMarkupOverridePct` nullable-inherits with explicit-zero
  semantics; platform review only (memory boundary, not this file's rewrite
  subject). Historical order/rate/shares snapshots stay fixed.
  `posRevenue`/`salesPricing` keep direct-zero-surcharge allocations.
- Channel-specific allocation audit requirement (general SaaS/direct sale
  ERM-fee exclusion) is already encoded and tested for `selling_price_markup`
  direct channels; legacy markup/commission tenant agreements stay untouched.
  New approaches must not treat `source: web` or hostname as channel type; the
  channel authority remains server-owned (`StorefrontChannel`,
  `SalesChannelSnapshot` guards existing in `server/models/`).
- Paystack is the approved NG ERM subscription integration. Other paths
  (legacy Stripe refunds, Korapay charges, stored value) exist and are
  inventoried in README F12 — no removal proposed; no provider swap.
- Runtime without Redis: unchanged (`docs/memory/standalone-without-upstash.md`
  boundary holds; limits per process; document the operational limitation).

## 9. Public selling surfaces — the same engines, two presentation choices

User decision recorded 2026-11-02 (direction note, not a launch commitment):
"The same way Product and SubProduct work with drinks, it will work with other
businesses. A general ecommerce displaying tenants' products, or separate
ecommerce systems for the different categories of businesses, are both
possible."

What this means in the target architecture:

- **One catalogue mechanics, every industry.** Product (canonical identity) +
  SubProduct (tenant listing) + Size (sellable variants) are category-neutral.
  No per-industry catalogue/table/engine replacements. The P1 private-catalogue
  scope (`catalogScope`) is already category-neutral, so a future apparel or
  electronics or beauty tenant reuses the identical ownership/privacy model.
- **The choice of public surface is a presentation/policy layer**, not a new
  commerce stack:
  | Option | Mechanism (already exists) |
  |---|---|
  | General ecommerce (all tenants' canonical offers on one surface) | Platform public catalogue aggregates `canonical`+published offers across tenants (`buildProductQuery`/`marketCatalog`, eligibility-scoped by market policy) |
  | Separate ecommerce systems per category | Same engines filtered by supply category — `MarketCategoryPolicy`/`MarketEnrollment` scope by category + channel, `marketCatalog.offerStages` assembles per-demand-category pipelines. A vertical surface (e.g. fashion-only site) binds its own storefront-channel key / category scope and reads the same API. |
- **Enabler shipped 2026-11-02:** the type→category mapping moved from
  hard-coded `marketIngress` switches into `server/config/marketCategories.js`
  (`beverage` remains the fallback; behavior pinned by
  `__tests__/marketFoundation.test.js`). Adding a vertical later is a config
  addition **plus explicit policy/economics decisions** — registering the type
  list alone does NOT create eligibility, channel agreements or moderation
  (backlog D5).
- Category registration checklist for a future vertical (from backlog D5 +
  market policy docs): registry type list → `MarketCategoryPolicy` scoping
  decision → enrollment flow → channel/fee terms → validation agreement.

## 10. What this design does NOT include

- No Vercel wildcard-domain routing, no panel split, no custom-domain
  lifecycle (continuous separate proposals), consistent with strategy.md §1.
- No vector/AI architecture beyond the boundary that tenant_private content
  stays out of any public embedding/search/suggested surface.
- No legal/jurisdiction claims: multi-country/BVN/NAFDAC/KYC handling stays as-is;
  any cross-industry variant would need qualified legal review.
