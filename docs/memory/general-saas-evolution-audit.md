---
name: General SaaS evolution audit
description: General-SaaS audit + P1 private catalogue scope implemented locally 2026-11-02 (flag off, uncommitted).
type: project
---

**Status (2026-11-02):** The general SaaS evolution originated as an audit-only
prompt (`docs/prompts/general-saas-evolution-audit.md`, written by
`docs/audits/general-saas-prompt-review-2026-11-02.md`). Deliverables live at
`docs/audits/general-saas-evolution/{README,architecture,migration,backlog}.md`
with handoff `docs/superpowers/specs/RESUME-general-saas-evolution-audit.md`.
The same day, the user asked to solve the highest risks and implement the
P1 slice; the slice is implemented locally (see the implementation checkpoint
section of that RESUME file) and remains uncommitted with zero production
flag/data/index actions.

Key positions (verify before reuse):

- Landmark rule now enforced in code: link-by-name/link-by-ID never adopt
  another tenant's catalogue identity; tenants create `tenant_private`
  central identities behind `GENERAL_CATALOG_SCOPE_ENABLED` (default off,
  legacy pending-canonical behavior when off); public surfaces filter
  `publicationScope !== 'tenant_private'` unconditionally; super-admin approve
  = canonical promotion with audited `PRODUCT_APPROVE` scope change.
- The (tenant, product) uniqueness contract is operator-applied:
  `server/scripts/ensure-catalogue-uniqueness.js` (checked duplicates first;
  `--apply-uniqueness` refuses with duplicates). It is intentionally not a
  schema-declared autoIndex build. Proven by
  `server/__tests__/catalogueUniqueness.mongo.test.js` (opt-in
  `DRINKSHARBOUR_CATALOGUE_TEST_MONGO_URI` on a 29130 replica set).
  **User-confirmed refinement: SKU uniqueness lives on the Size document, PER
  TENANT** (`sizes {tenant, sku}` unique-partial, legacy global `sku_1`
  retired by `--retire-global-size-sku` only after the per-tenant index
  exists). Producer SKU strings may repeat across tenants. SubProduct.sku
  remains globally unique (relaxation is an open D2 gate).
- **Public selling surfaces (user direction 2026-11-02):** the Product/
  SubProduct/Size engines are category-neutral; a general ecommerce over all
  tenants' canonical offers and per-category vertical e-commerce are both
  presentation choices (platform catalogue aggregation vs category/channel-
  scoped market policy). Supply-category mapping is registry-owned:
  `server/config/marketCategories.js` (beverage fallback; behavior pinned by
  `__tests__/marketFoundation.test.js`). Architecture §9 has the mapped
  mechanism table.
- **Subagent review round (2026-11-02, user-authorized):** P0 fixed — the
  flag-on link-by-ID branch built `{ status: { $or: [...] } }`, invalid at
  mongod; criteria are now flat per branch and pinned by tests. Contract
  build authority is one home per index (`CATALOGUE_CONTRACT_INDEXES` =
  operator-applied subproducts contract only; Size SKU + Product scope lookup
  are schema-declared). A pre-existing `Product.slug` duplicate schema key was
  found silently discarding unique/required — removed, uniqueness re-armed
  (report script checks slugs). `marketCatalog` derives eligibility and
  `$switch` branches from the registry; `ValidationError` preserved so
  category errors stay HTTP 400. See RESUME checkpoint "Review round".
- **Page-design round (2026-11-02, user-directed professional agents):** two
  disjoint front-end agents implemented the pages for the slice in
  `client/apps/admin` — super-admin side (shared `PublicationScopeTag` +
  `getApproveCopy`, bulk-bar "Approve & publish to marketplace" copy,
  edit-header tag) and tenant side (`sub-product/catalogue-scope.ts` helpers,
  subordinate "Private identity" chips, picker copy "Sellable now ·
  marketplace review pending"). Root then added the server DTO support the
  agents flagged: admin product list selects scope + populated
  `owningTenant {name slug}`; sub-product list/create/detail/update
  populates include `publicationScope` (+ central status where missing);
  catalogue-search `PUBLIC_FIELDS` carries the scope label only (owningTenant
  never leaves server). Admin union vitest 49 files/277 tests pass; tsc has
  exactly one PRE-EXISTING error in
  `merchant-orders/settlement-statement-panel.tsx` (other workstream); lint
  stays at the 243-warning baseline; **admin production build exit 0**. See
  RESUME checkpoint "Page-design round" for the open platform-owner
  decisions (pending-submissions queue page, creation-copy flag echo,
  visibility facet).
- **Implementation round 2 (2026-11-02, same day — the four decisions):**
  1) super-admin "Pending submissions" queue page (pending-queue/ components,
     nav gate with `route-roles.ts` super_admin-only entry, service contract
     to admin/pending + approve/reject endpoints, promotion-aware copy);
  2) create-confirmation toast is flag-aware ("created and sellable in your
     store right away — DrinksHarbour reviews marketplace publication"; byte-
     frozen legacy wording otherwise); pre-submit copy deliberately untouched
     (the rendered notice already says it);
  3) "Visibility (Scope)" facet in the admin product list (client-side; helper
     `scope-filter.ts`; default All/legacy-identical);
  4) the merchant Statement typecheck error was resolved by the peer
     workstream — final admin `tsc --noEmit` = **0 errors**.
  Root added the missed authority fix the agents flagged: `GET
  /api/products/admin/pending` now forces `submittingTenant` from the JWT
  (`getTenantId`) for every non-platform role (was: any tenant could browse
  all tenants' pending list via `?tenant=`) and escapes the search regex —
  `__tests__/productPendingAccess.test.js` (RED→GREEN). Final checks:
  admin union vitest **107 files / 523 tests**; lint **243 warnings / 0
  errors**; route suites 30/30; admin production build (root-run result in
  RESUME). Uncommitted; nothing deployed.
- **Industry-expansion round (2026-11-02, user-directed ecommerce agents):**
  37 vertical types (prefix rule electronics_/fashion_/beauty_/home_) in the
  additive registry; market supply category `retail` via prefix mapping
  (beverage fallback untouched; flag-on fail-closed until policy exists);
  `catalogKindForType` pivot used by both creation services; Size schema
  gained apparel/shoes/storage size enums + optional `colorName`/`colorHexCode`
  (second variant dimension lives on Size; SubProduct deliberately
  untouched); marketplace taxonomy registry (4 vertical Categories, 33
  SubCategories, stable slugs) with operator seed script
  `scripts/seed-marketplace-taxonomy.js` (preview default; `--apply`
  idempotent; never auto-run); admin forms: 37 types across 4 groups in
  product + sub-product dropdowns, size pickers with the new groups +
  optional color inputs (zod/transformer wired), origin-country dictionary
  (64 curated sourcing countries) via datalist keeping free text. All
  additive; legacy/flag-off identical. Verified: server suites 100/100
  (incl. productTypeRegistry + sizeVariantsIndustries with corrected
  prefixed-canon guards), admin tsc 0 errors / vitest 77 files 514 pass,
  lint baseline, admin production build exit 0. Uncommitted; no production
  action. Follow-ups: furniture-capacity considerations, serials stay P4,
  and category policy/enrollment per vertical BEFORE any vertical
  marketplace is activated.

- **Industry-scoping round (2026-11-02, same day):** businesses SEE ONLY
  THEIR industries-attached categories (plus legacy/global categories with
  no industry). Canon: `constants/industries.js` (7 industries; derived
  from businessType; explicit Tenant.industries wins; null = legacy all);
  Tenant.businessType ADDITIVE + Fashion Retail/Electronics Retail/Beauty &
  Skincare/Home & Living/General Retail + Tenant.industries; Category/
  SubCategory additive `industry` (absent = legacy/global — existing
  capabilities never lost); category/subcategory list endpoints filtered
  for tenant callers (JWT authority only) + meta echo; product writes
  reject out-of-profile categories; `GET /api/erm/status` additive
  industries; taxonomy registry carries industries; seed script
  `--backfill-industry` operator step. FLAG
  `INDUSTRY_TAXONOMY_SCOPE_ENABLED` default OFF = everything identical
  until flipped for real tenants. Admin: tenant edit businessType + new
  options + Industries editor; category mgmt industry field/facet; type
  pickers filtered via client mirror util. Root also fixed the
  `businessTypeValues` client enum missing `Nightclub / Club`. Verified:
  server 204 pass/2 skip (route guards, tenant, taxonomy suites); admin tsc
  0 errors / vitest 80 files 541 pass; lint baseline; admin build exit 0.
- **Industry-scoping follow-ups (same day, root)**: the four review flags
  were worked directly — the Industries editor is now ALWAYS visible in edit
  mode (profile creation no longer requires picking a business type first;
  create-surface condition unchanged), the `Nightclub / Club` validator fix
  is regression-pinned, the applied-scope `meta.industries` echo is consumed
  non-breakingly (`getCategoriesWithMeta`/`getSubCategoriesWithMeta` in
  `category.service` — plain-array call sites untouched; both
  product-identification surfaces render the applied-scope footnote,
  e.g. "Fashion scope"; `industriesMetaLabel` added to the mirror), and this
  agreement is recorded (mirrors: `src/utils/industries.ts` paired with
  `server/constants/industries.js`, asserted live at test time). See RESUME
  "Industry-scoping follow-ups".
- **Hospitality round (2026-11-02, "restaurants, lounges, clubs"):** these
  businesses were already accommodated (businessType; venue serving v2;
  restaurant-mode POS; prepared kinds) — the round added the missing catalog
  vocabulary: 14 types (foodservice_produce/meat/seafood/dairy/bakery/
  staples/frozen/condiment/disposables/cleaning → KINDS.ingredient;
  hospitality_shisha_kit/shisha_flavour/charcoal/cigar → KINDS.retail);
  supply category `hospitality` by prefix (beverage fallback untouched;
  fail-closed); `AGE_RESTRICTED_TYPES = [vape, shisha_kit, shisha_flavour,
  cigar]` — creation services require age verification for these (charcoal
  explicitly excluded; legacy behavior identical); size guidance uses ONLY
  pre-existing canonical Size strings (zero new Size/SubProduct enums — the
  venue serving machinery covers these businesses); taxonomy registry grew
  to 5 verticals / 45 SubCategories (Food Service & Venue). The stale
  catalogKind pins were evolved (retail kind added to VALUES/RETAIL_KINDS/
  retailWhereClause; venue exclusions asserted). Verified server suites
  91/91 pass; product/size-family regression 282/284 with the 2 being the
  known venueProduction fixture artifact (green WITH fixture 2/2).
- **POS round (2026-11-02, "edit the Point-of-sale pages"):** POS fetches
  categories with the tenant token attached (`posApi.getCategories(token?)`)
  so the server's industry filter + meta echo reaches the till; `POSSize`
  gained optional `colorName`/`colorHexCode` surfaced server-side in the POS
  projections and rendered client-side via `pos-size-color.tsx` (swatch dot
  + color name on the till's size chips) with cart lines "m · Amber";
  verified admin tsc 0 errors / POS suites 39 files 379 tests / server POS
  suites 294 pass / build exit 0. See RESUME "POS round".
- **Design-polish round (2026-11-03, user-directed designers, three
  disjoint agents + root):** UX polish of ALL newly added functions using
  the ui-ux-pro-max rule set (contrast/focus/aria/touch/hierarchy/copy).
  Real bugs fixed: failed-reject modal closed losing the typed reason
  (now stays open with in-dialog role=alert server error);
  `pos-order-analysis` categories fetch was the lone un-gated effect in
  the file (now token-gated); the till's sell-modal size rows showed no
  color data for same-size-different-color variants (wrong-item risk —
  now dot+name); discounted-add dropped colorName (now `variantLabel`).
  UX upgrades: row-shaped skeletons, empty-state CTA, focus trap +
  persistent helpers + aria-live error in the reject modal, grouped and
  searchable type pickers (`product-type-options.tsx`, search matches
  group), computed chip contrasts (violet 6.48:1 / amber 4.84:1),
  size-form color inputs with real hex validation state, humanized copy
  (no canonical/tenant_private jargon in reviewer UI), luminance-adaptive
  swatch edge + per-hex memo cache on the till, 44px chips, aria
  (pressed/expanded/labels), tabular-nums, profile-aware count lines.
  Root: gallery-test alt fix → lint back to ≤243 baseline (242 now).
  Verified: tsc 0 errors; 129 files/841 tests pass; 242 warnings/0 errors;
  admin build exit 0. Uncommitted; no production action.
- Recommendation remains **Option 1** (scoped extension of
  Product/SubProduct/Size). Highest remaining decisions: D1–D8 in backlog.md
  (amendment wording in architecture.md §7 — NOT applied to AGENTS.md).
- ~~`marketIngress.categoryFor` still defaults unknown categories to
  `beverage` — general retail enrollment scoping is P2+.~~ **Superseded
  2026-11-02**: category mapping is registry-owned (prefix rule → `retail`
  for the four verticals; beverage fallback retained); vertical enrollment
  policy remains a per-category platform decision before any vertical
  marketplace activates.
- Verification note: `server/package.json:10` test script equals the
  documented baseline (`node --test '__tests__/*.test.js'`); the older blanket
  warning that "`npm test` is broken" is stale in this checkout (planCapabilities
  config-only test verified; see architecture.md §7 test-baseline note).

- **Vertical taxonomy DB seed (2026-11-03, operator agents):** the five
  verticals (Electronics/Fashion/Beauty/Home-living (adopted legacy
  slug)/Food Service & Venue) plus 44 new subcategories now EXIST IN THE
  PLATFORM DB: categories 57→61, subcategories 869→913; adopted
  home-living + kitchen-and-dining backfilled `industry: home`; both
  idempotency proofs clean; legacy beverage data byte-identical. First
  operator round blocked on a real script defect (parent-planning before
  insert → fresh apply impossible) and the home-living registry/DB
  disagreement — both fixed (planning counts planned parents as linkable;
  registry adopts home-living). Types are code (51 vertical values in the
  Product enum) — they need deployment, not seeding. Industry-scope flag
  still OFF until tenant profiles are decided. See the RESUME "Vertical
  taxonomy DB seed" section.
- **Per-business taxonomy model (2026-11-03, user-corrected):** each
  business owns its own types + categories + subcategories (registry
  restructured to per-vertical trees: 42 categories / 130 subs across 5
  verticals); bundled seed UNDONE via `seed-marketplace-taxonomy.js
  --rollback` (50 ops; DB restored 61→57 / 913→869; adopted industry tags
  unset); ELECTRONICS seeded per-business (`--only=electronics`: 9
  categories + 29 subs, all `industry: electronics`; DB now 66/898);
  idempotency + cross-vertical leak checks verified; wine taxonomy
  byte-identical. Workflow per business: approve vocabulary → seed
  `--only=<vertical>` → verify → next (fashion proposed next).
  `INDUSTRY_TAXONOMY_SCOPE_ENABLED` still OFF. Types live in code (51
  vertical values) and need deployment, not seeding.
- **Fashion vertical seeded (2026-11-03, one-by-one round):** 8 categories
  + 33 subs (`industry: fashion`); DB 74/931. Slug scheme: duplicate-named
  subs across categories get category-prefixed slugs
  (womens-trousers-and-jeans…) — global unique index contract; partial-apply
  strays cleaned via the rollback's renamed-stray rule. Next: beauty → home
  → food-service (user gates each).
- **Fashion sizes (2026-11-03):** sizing systems scoped per business — the
  SERVER is the sizing authority: new `GET /api/products/size-guidance?type=`
  mirrors getSizesForType (fashion: apparel letters + numeric US us-0..18 +
  waist w28..40 + inseam l30..36 + kids ages + shoe codes; beverage keeps
  bottle families; custom/variable always offered); Size enum + constants +
  pickers in lock-step; the size form fetches guidance per resolved product
  type and filters the optgroups (null = full legacy list fallback).
  Verified: tsc 0 errors; 643-test sweep 642 pass (1 pre-existing so-print
  PDF flake, unrelated); lint 242/0; build exit 0.
- **Electronics sizes (2026-11-03):** same server-authority pattern —
  SCREEN_INCH/RAM/BATTERY groups (+storage-4tb) in constants + Size enum +
  size-guidance endpoint + admin picker groups; getSizesForType per device
  family (laptop storage+ram+screen; tv=screen; power=battery; gaming
  storage+ram; phone/camera storage). Suites green (server 108/108-family;
  admin 645→644 pass + tsc 0 + lint 242/0 + build exit 0).
- **Fashion seeded (2026-11-03, one-by-one round):** 8 categories + 33 subs
  (`industry: fashion`); DB 74/931. Slug scheme: duplicate-named subs across
  categories get category-prefixed slugs (womens-trousers-and-jeans…) —
  global unique index contract; partial-apply strays cleaned via the
  rollback's renamed-stray rule. Next: beauty → home → food-service (user
  gates each).

- **Beauty seeded (2026-11-03).** Five categories and 16 subcategories,
  all verified with `industry: beauty` and correct parent links. DB totals
  79 categories and 947 subcategories. Repeat apply created zero.
  Industry scope stays off. Before activation, reconcile the seed's
  `active` rollback marker with the admin pickers' `published` filter.

- **Home preflight (2026-11-03).** Preview planned 8 categories and 24
  subcategories. Apply is pending resolution of the mismatch between the
  documented legacy adoption and the registry's new top-level Kitchen &
  Dining category. DB remains at 79 categories and 947 subcategories.

- **Home seeded (2026-11-03).** Added eight categories and 24 subcategories
  with verified parent links. Totals 87/971, repeat apply zero. The updated
  handoff allows the Kitchen & Dining slug in both collections. The legacy
  Home family was byte-identical. Industry scope stays off. Publication and
  per-type set guidance are tracked in the rollout ledger.

- **Home assortment expanded (2026-11-03).** Added Lighting and Garden &
  Outdoor types and categories, plus nine subcategories across four
  categories. Home has ten types, ten categories and 33 subcategories.
  Kitchen, cookware, bedding and storage now suggest existing set sizes.

- **Home gaps filled (2026-11-03).** Added Bath type with existing set
  guidance, one category and 16 subcategories. Seed repeated with zero
  inserts, database totals 90/996. Protected catalog pickers accept
  staged seed rows and the inline editor includes Home product types.
  Deploy the server routes before or with the admin app.

- **Beauty and Electronics expanded (2026-11-03).** Beauty now has 7
  categories / 26 subcategories. Electronics has 9 / 39 and three new
  types. Both seeds repeated with zero inserts. Global counts 92/1,016.
  Portable screen and Beauty pack guidance are wired through the now
  reachable size-guidance route. Staged publication remains in place.

- **Food Service & Venue seeded (2026-11-03).** Added 12 categories and
  39 subcategories (10/34 procurement and 2/5 hospitality). Totals
  104/1,055, repeat apply zero. Legacy Cigars was preserved. Inline type
  selection and procurement size guidance are wired, and menu service
  rejects classified stock masquerading as a prepared item.

- **Food Service and Hospitality gaps filled (2026-11-03).** Added five
  categories, 27 subcategories and ten types across commercial supplies
  and venue retail. Food Service & Venue now has 17 categories and 66
  subcategories. Corrected seven staged hospitality industry tags,
  preserved legacy records, and verified repeat apply zero. DB totals
  109/1,082. Default lounge and club profiles include procurement.

- **Business listing filters (2026-11-03).** Admin /products and
  /sub-products now expose shared retail/hospitality type choices.
  Product cards avoid alcohol labels for general merchandise, and
  non-alcoholic filtering is beverage-specific. Saved filter keys remain
  compatible. See rollout ledger for verification.

### Business-specific catalog presentation (2026-11-03)
Admin listings and ID details now share `business-catalog/` and
`utils/catalog-business.ts`. Listings filter by an explicit business view;
details derive business from Product.type and show relevant recorded facts and
Size options. Unknown types stay general. Missing allergens are not interpreted
as allergen-free. Existing tenant pricing/actions remain authoritative.
/subproducts aliases redirect to /sub-products. 70 focused tests passed; live
listing business switch verified; live beverage detail also verified. Full server
suite: 4,399 passed, 248 failed, 259 skipped; includes local-port permission failures. See latest RESUME section for results.
Final admin typecheck passed. Browser /subproducts alias and loaded Sub-Products
business selector verified (Beauty filtering returned zero matching records).
Fixed loading-only placement discovered during browser verification.

### Legacy beverage compatibility (2026-11-03)
119 original Product beverage values now live in server/constants/legacyBeverageTypes.js
and an admin mirror with parity tests. The former partial registry could clear
valid lager/champagne/whisky/espresso beverage fields during model validation.
Classification now preserves them; legacy options are accepted by admin forms
and POST validation and available in both listing filters and inline creation.
Family size guidance and missing category assignments are repaired. Detail
variants display recorded ml/g, pack count and venue sale unit. 56 server + 82
admin tests passed, TypeScript passed, live Beverage listing verified (1,663
matches). No database repair was attempted; already-cleared facts need evidence
before restoration. See latest RESUME section and legacy compatibility plan.

### Beverages business ownership (2026-11-04)
Legacy beverage types now resolve to industry beverage, labelled Beverages.
Admin mirrors all server BEVERAGE_TYPES; unrelated tenant profiles no longer get
beverage type options. Configured DB updated: 51 reviewed beverage/supply
categories + 825 child subcategories assigned beverage, no ID/reference changes.
Repeat preview zero. Audit/preimages:
`docs/superpowers/specs/beverages-business-applied-2026-11-04.md`.
Category/subcategory writes now persist business ownership; new beverage
categories default beverage and subcategories inherit parent business. Category
endpoint visibility remains controlled by the existing industry scope flag,
which was not toggled. 80 server + 44 admin tests, TypeScript passed. Code local,
DB backfill applied. See latest RESUME section for exact scope and rollback.

### Business-aware subproduct AI and SEO (2026-11-04)
Detail route has reviewable content/SEO drafts using the existing authenticated
/gemini/generate-subproduct-content endpoint, now mode content|seo. Seven business
briefs use recorded product/variant facts. Service checks JWT tenant ownership
before generation, rejects mismatched parents/private foreign products, and
allowlists model output. Existing editor content generation remains compatible.
Tenant SEO fields now persist on SubProduct; main marketplace SEO still reads
central Product metadata. Saved description overrides display on detail pages.
Model is existing Anthropic Haiku adapter, attribution returned to UI. 27 server
+ 30 admin tests and TypeScript passed. Browser unavailable (local app off); no
live model call or DB content write. See latest RESUME section for exact limits.

### Central Product detail AI/SEO (2026-11-04)
/products/[id] now uses shared business-catalog/business-generation-panel in
product mode for platform admins. Central content = shortDescription/description;
SEO uses existing Product meta fields. Explicit save goes through Product PUT
and reloads detail. Generation endpoint target=product requires platform role
and saved productId; listing default stays compatible. 19 server + 13 UI tests
and admin typecheck passed. No live AI call or deployment. See latest RESUME.

2026-11-04 correction: user intended ORIGINAL full-product AI generation.
Removed the added central Product detail panel and extended both existing
full-product actions with researched per-business specifications, existing form
review/save and detail display. See original-product-generator.md for the
contract, supported fields and verification limitations.

- **Pending approvals render fix (2026-11-04)**. The route must import the
  named `PendingQueueView` export from the queue index. The queue suite now
  renders the route itself for the tenant-private and legacy row test.
