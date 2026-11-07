# Beverage-only platform marketplace gate (DRI-5, DRI-9)

2026-11-05 board constraint (user-direct, surfaced via DRI-4): the `/platform`
marketplace surface is **beverage-kind only**. Retail-kind stock
(Fashion/Electronics/Beauty/Home + the `hospitality_` family) sells through
tenant store surfaces and never appears on platform marketplace surfaces, even
approved + published.

## Where the gate lives

- Single source: `server/constants/catalogKind.js` → `marketplaceWhereClause()`
  (`{ $or: [{ catalogKind: { $exists: false } }, { catalogKind: 'beverage' }] }`).
  Legacy documents (absent `catalogKind`) count as beverage.
- DRI-9 (2026-11-05): the public product-DETAIL endpoint
  (`GET /api/products/slug/:slug`) is gated by SURFACE, not by clause:
  `blocksMarketplaceBuyOffers(product)` + `DETAIL_SURFACES` in
  `catalogKind.js`. Controller `getProductBySlug` derives the surface from the
  platform middleware's `x-is-tenant-site: true` header (tenant-site) vs
  absent = main marketplace; `productService.getProductBySlug(slug,
  { surface })` throws the "no active seller" NotFoundError for retail-kind
  products on the marketplace surface. Client transports that never forward
  the header (browser refetches, quickview, compare, chatbot) therefore get
  the marketplace gate by default — correct.
- `retailWhereClause()` in the same file is the TENANT STORE clause (legacy +
  beverage + retail) — do not confuse the two; tenant storefronts need retail
  sellability, the marketplace must not have it.
- Applied in `product.service.js` at the retail-channel branch of
  `searchProducts` plus trending/featured/new-arrivals/bestsellers/slugs+facet
  counts/related/search-suggestions, in `chatbot.service.js` shopping
  surfaces (~934, ~1901), and in the controller-level
  `getProductFilterOptions` aggregation (`product.controller.js` ~1404 —
  caught by the behavior suite still using `retailWhereClause()`, which let a
  retail-only brand advertise on the market filter rail). See the line map in
  `docs/reports/dri5-beverage-marketplace-gate-2026-11-05.md`.

## Detail-surface client wiring (DRI-9)

- `client/apps/platform/src/app/product/[slug]/page.tsx` SSeR fetch forwards
  `buildTenantHeaders()` (the middleware-injected `x-tenant-slug` +
  `x-is-tenant-site`) and passes `isTenantSite` to `ProductClient`, whose
  client refetch forwards the same flag whenever the server request had it.
- `ModalQuickview.tsx` and `CompareContext.tsx` add the flag when the visitor
  is on a tenant storefront (quickview via `useTenant()`; compare via
  `useTenant()` with an `isTenantHost()` hostname fallback because
  CompareProvider sits outside the layout's tenant-aware `TenantProvider` —
  `isTenantHost` in `context/TenantContext.tsx` mirrors middleware.ts's
  subdomain rule).
- `ChatbotWidget` is deliberately NOT forwarded the flag: its discovery feed
  is marketplace-scoped server-side and the chatbot must not become a retail
  sales surface.
- Known anti-forgery note: `x-is-tenant-site: true` reaching the backend
  directly (CORS-allowed) opts a caller INTO tenant-store content. That is
  what the header grants anywhere else; tenant data stays JWT-scoped. Admin
  surfaces use product-ID endpoints, untouched.

## Adding a new public surface

Any new platform-facing query (a new strip, a new public filter, a chatbot
feed that surfaces Products) must carry `catalogKind.marketplaceWhereClause()`.
When the base query already owns an `$or` (text/regex legs), join the clause
through `$and` — spreading `$or` over an existing `$or` clobbers it. The
suggestions code in `product.service.js` is the worked example.

- `getNewArrivals` matches `publishedAt` inside its window; the sales-driven
  strips (`trending`, `bestsellers`) have no fallback when the only ranked
  product is gated away — seed `publishedAt` + sales rows for the beverage
  products (retail leading the count so the gate's rank-then-drop is visible)
  or the "beverage present" arm of the assertion is vacuous.
- `$size($setIntersection(['$tags', …]))` and friends crash ("argument to
  $size must be an array") on documents missing optional array fields
  (`tags`/`flavors` have no schema default). Coalesce inside the aggregation:
  `$ifNull: ['$tags'/'$flavors', []]` — the `related` mixed-strategy pipeline
  needed exactly this (was a pre-existing 500 on legacy docs, caught by the
  behavior suite).
- Paperclip-scoped `TMPDIR` can be pruned mid-suite → spurious
  `ENOENT mkdtemp` failures (e.g. `merchantRecoveryRestore`); re-run those
  standalone with a valid `TMPDIR` before chasing a phantom regression.

## Verification artifacts

- `server/__tests__/platformBeverageGate.mongo.test.js` — behavior
  suite over the disposable `venuePhase0` replica (DRI-4 conventions): drives
  the real product + store routers through `routeAuthHarness` and pins BOTH
  directions (beverage strip presence AND retail absence; tenant `store`
  channel still sells the retail listing; regression guard on the product
  shape). DRI-9 adds the detail-surface pins: retail slug 404 on the
  marketplace surface, sellable detail with `x-is-tenant-site: true`,
  beverage detail unaffected on both arms, `catalogKindForType`-derived
  legacy retail docs gated (positive control on the tenant-site arm first),
  and `getProductById` still returning the retail product. 19 tests total.
  Run with
  `DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_platgate?replicaSet=venuePhase0'`.
- `server/__tests__/catalogKind.test.js` — unit pins for the clause shapes,
  `searchProducts` channel wiring, chatbot clause choice, and the documented
  header semantics.
- DRI-4's till acceptance re-passed after the change (1/1) — POS/tenant stock
  flows untouched.

## Fixture gotchas (learned in this task, reused for future suites)

- The fixture connects with `autoIndex: false`; `$text` legs need the compound
  text index built explicitly in the seed.
- The public listing filters `inStock` by default; seeded Sizes MUST carry
  `stock`/`reservedStock` or every listing silently drops out.
- Keep raw ObjectIds in insertion fixtures: `{ _id: oid().toString() }`
  stored into a related doc (e.g. `SubProduct.product: '<string>'`) never
  matches the ObjectId `_id` in `$lookup`/`$eq` joins. String vs ObjectId in
  `$expr` comparisons is a silent unlinking bug.
- `connectVenueMongo` drops the owned DB per test, so avoid memoizing an
  alive-connection seed across tests with a resolved promise; seed lazily
  (see the memoization on marker count in the gate test).
- The `:29127` mongod is a temp-dir instance shared with other runs and the
  host can be under load (writes 2–4 s each): expect several minutes for
  suites that re-seed per test. A stalled-looking run is often just slow
  writes — check for a growing `.log` before assuming a hang.
