# DRI-5 — beverage-only /platform marketplace gate (2026-11-05)

Enforcement of the board's user-direct constraint (2026-11-05 07:52Z, surfaced
through DRI-4 and AGENTS.md 'Main Site Behavior'): the `/platform` route —
public `/api/products`, every public strip, sitemap slugs/facet counts and the
chatbot shopping surfaces — is **beverage-kind only**. Non-beverage retail
kinds (Fashion, Electronics, Beauty, Home & Living, General Retail, and the
`hospitality_` family) remain sellable through tenant store surfaces and never
appear on the platform marketplace, even when approved + published.

## What changed

1. **`server/constants/catalogKind.js`** — new `marketplaceWhereClause()`
   (beverage-only: legacy docs with absent `catalogKind` + `catalogKind
   === 'beverage'`). `retailWhereClause()` is untouched (it is the TENANT
   STORE clause; both share the legacy-absence arm). Header comments now
   state the enforced split: platform marketplace beverage-only; retail-kind
   stock sells via tenant stores.
2. **`server/services/product.service.js`** — every platform-facing surface
   now applies `marketplaceWhereClause()`:
   - `searchProducts({ catalogChannel: 'retail' })` (public `/api/products`
     listing; ~line 4101). `catalogChannel: 'store'` deliberately keeps
     `retailWhereClause()` (tenant storefront sellability, DRI-4).
   - trending (`~6054`, `~6072`), featured (`~9097`, `~9185`, `~9196`),
     new-arrivals (`~9303`), bestsellers (`~9797`), sellable slugs + facet
     counts (`~11050`, `~11078`), related (`~11523`), search suggestions
     (`~12876`, joined through `$and` around the regex leg's own `$or`).
   - **Robustness fix found while pinning `related` (2026-11-05 later pass):**
     the mixed-strategy similarity `$size($setIntersection(['$tags', …]))`
     crashed with HTTP 500 ("The argument to $size must be an array, but was
     of type: null") for any Product document missing the optional
     `tags`/`flavors` arrays (no schema default — collection-level
     inserts/legacy docs can lack them). Both similarity legs now coalesce
     via `$ifNull`, matching the repo's own convention elsewhere (e.g.
     `~13115`). The behavior suite drives this endpoint per-test now.
3. **`server/services/chatbot.service.js`** (`~934`, `~1901`) — chatbot shopping
   discovery/feeds carry the beverage-only clause.
4. **`server/controllers/product.controller.js`** — two spots:
   - `getProductFilterOptions` (`~1404`) matched the same clause — this was a
     REAL leak the behavior test caught: the facet rail still used
     `retailWhereClause()`, so a retail-only brand ("Gate Retail Threads")
     advertised itself on the marketplace with an empty (gated) grid behind
     it. Switched to `marketplaceWhereClause()`.
   - `getRelatedProducts`-adjacent controller surfaces unaffected.

Untouched by design: `isRetailCatalogKind`, `isVenueServiceProduct`, POS/till
and tenant-stock flows (DRI-4 verification stands), `catalogKindForType`
mapping (retail types keep mapping to `KINDS.retail`).

## Verification (synthetic fixture, 2026-11-05)

All data is synthetic; no live tenant data, no migrations, no deploys.
Mongo runs are over the disposable `venuePhase0` replica-set fixture (:29127,
owned PID-suffixed DB dropped in each test's `after`), same convention as
DRI-4's POS acceptance (`docs/reports/dri4-pos-till-acceptance-2026-11-05.md`).

| Suite | Result |
|---|---|
| `node --test __tests__/catalogKind.test.js` (unit pins: clause shapes, channel wiring, chatbot clause choice, header semantics) | **11 pass / 0 fail** |
| `DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_platgate?replicaSet=venuePhase0' node --test __tests__/platformBeverageGate.mongo.test.js` | **13 pass / 0 fail** (final: 13/13 green in ~47 s after the fixture ObjectIds fix — see the fixture lesson below) |
| Full repo suite: `DRINKSHARBOUR_VENUE_TEST_MONGO_URI=… node --test '__tests__/*.test.js'` | **5039 tests: 5009 pass**, 24 skipped, and **1 environment-caused fail** — `merchantRecoveryRestore.mongo.test.js` ENOENT'd `mkdtemp` because the session's Paperclip-scoped `TMPDIR` had been pruned mid-run; it **passes standalone** (1/1) with a valid `TMPDIR`. Unrelated to this task's surfaces (merchant recovery restore). Same run showed replica-under-load timeouts on `venueFireConsumption`/`venueReviewCorrections`/`venueSettlementAdapter`; each **passes standalone** (e.g. settlement adapter 1/1 in 13.5 s). |
| `DRINKSHARBOUR_VENUE_TEST_MONGO_URI=… node --test __tests__/posTillAcceptance.mongo.test.js` (DRI-4 regression: retail till flow unaffected) | **1 pass / 0 fail** (~58 s) |
| `node --test __tests__/chatbot.catalog.test.js __tests__/chatbot.service.test.js` | 17 pass / 0 fail |
| `node --test __tests__/searchOutOfStock.test.js __tests__/productListPricing.test.js` | 8 pass / 0 fail |

### What the behavior suite pins (both directions)

The fixture seeds one approved + published Tenant with three published,
stocked, genuinely-purchased listings (real SubProduct + Size with stock + a
fulfilled Sales row each; the retail item has the MOST units — 50 vs 3 — so an
empty strip would be a false pass):

- legacy beverage (absent `catalogKind`) — `gate-lager`
- explicit `beverage` — `gate-merlot`
- `retail` — `gate-tee` (type `fashion_top`, brand "Gate Retail Threads")

`server/__tests__/platformBeverageGate.mongo.test.js` then drives the real
routers via `__tests__/helpers/routeAuthHarness.js`:

- Anonymous market tests require **presence of both beverages AND absence of
  `gate-tee`** on: `GET /api/products`, `/search`, `featured`, `new-arrivals`,
  `trending`, `bestsellers`, `suggestions` ("Tee" must blank, "Lager" still
  suggests), `/:id/related`, `slugs` + brand facets, `filter-options`.
- Tenant-side tests require `gate-tee` to STAY sellable: direct
  `searchProducts({ catalogChannel: 'store', tenantId })` and
  `GET /api/stores/gate-tenant` both list it, and the regression guard asserts
  its approved/published/retail shape on the Product document itself.

## Surfaced boundaries (require no code change here)

- **`hospitality_` family (shisha kits, molasses, charcoal, cigars):** they
  share `KINDS.retail` (retail-kind prefix rule, 2026-11-02), so this gate
  keeps them OFF the platform marketplace, exactly like other retail stock.
  They remain sellable on tenant store surfaces and, where venue-eligible,
  through venue menus (`isVenueServiceProduct` — hospitality_ retail items are
  NOT venue-serviceable by design, unchanged). If the board ever wants
  lounge/club stock playable on the platform marketplace, that is a new kind
  or an explicit clause exception — not a relaxation of this task.
- **Tenant-created products:** central-catalog approval flow is unchanged;
  the gate is an eligibility clause on read surfaces, not a creation rule.

## Fixture lesson (recorded for future Mongo suites)

`makeProduct` initially returned `{ _id: _id.toString() }`; with
`SubProduct.product` stored as a STRING, every `$lookup`/`$eq` join against
the Product's ObjectId `$_id` silently matched nothing (empty strips). Keep
raw ObjectIds in fixtures whenever a document field participates in
`$lookup`/`$expr` comparisons — the schema cast on `collection.insertOne` is
deliberately bypassed. Recorded in `docs/memory/beverage-marketplace-gate.md`.

Three more strip-shaped gotchas found the same way (fixtures must satisfy the
strip's own data expectations, or the strip is empty and an "absent retail"
assertion false-passes):

- `getNewArrivals` matches `publishedAt` within the window — seed
  `publishedAt` on Products or that strip is empty regardless of the gate.
- `getTrendingProducts`/`getBestsellers` are SALES-driven; if only the retail
  product has sales, gating it legitimately empties the strip. Seed sales for
  the beverages too, with the retail product deliberately leading the count
  (50 vs 3 units) so "retail absent AND beverages present" pins rank-then-drop.
- The `/related` controller wraps the service result twice:
  `data.products.products` is the row list (`{ products, pagination, meta }`
  inside `{ data }`).
