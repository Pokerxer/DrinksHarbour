# Search response latency — diagnosis & fixes (2026-11-09)

Operator session authorized by the user (worked in OpenCode). Deliverables:

- Root cause isolated with a probe: **one Mongo roundtrip to the production
  Atlas cluster ≈ 140ms warm** (10-sample findOne: 136,151,141,144,147,145,138,
  131,135,147). Every search endpoint used to pay that cost MULTIPLE times
  sequentially per request (populates, counts, aggregate passes).
- Measured before/after (local API, real cloud data):
  - `/api/products/search?matchMode=smart`: **3.65s → 0.62–0.76s**.
    Change: `server/services/catalogue-search.service.js` — the three
    sequential post-aggregate `Product.populate` passes became server-side
    `$lookup` (+`$unwind` `preserveNullAndEmptyArrays`) stages inside the same
    aggregation, preserving the exact `{ _id, name }` object shape.
  - `/api/products/admin/list` (super-admin list, needs auth): **8 sequential
    roundtrips (4 populates + find + count + 2 aggregate passes) collapsed to
    TWO parallel ones**. `server/services/product.service.js`
    `getAdminProductList` now runs one pipeline with identity `$lookup`s and a
    stats sub-pipeline (subProductCount/variantCount/min-max price via a
    single `subproducts`-lookup carrying a `sizes` sub-lookup).
    Field-presence parity asserted by
    `__tests__/adminProductListSizePrices.mongo.test.js` (green, needs the
    venue local replica + `DRINKSHARBOUR_VENUE_TEST_MONGO_URI`): price quotes
    prefer size rows, fall back to listing `baseSellingPrice`, and
    `priceMax` exists only when min<max (single-point quotes omit it — the
    old shape). An earlier draft set `priceMax: null` for single-point rows;
    the test caught it and the fix deletes the null (`undefined`) so the
    documented shape (docs/memory/toolbar-size-price.md) is byte-stable.
  - Test suites after the refactor: 41 pass + the mongo IT = 48 checked, 0 fail
    (`catalogueSmartSearch`, `productListPricing`, `brandSearch`,
    `catalogueSearchAuth.http`, `catalogKind`, `catalogScope`,
    `catalogUniqueness.mongo`, `chatbot.catalog`,
    `adminProductListSizePrices.mongo`).
- Still slow (NOT touched this session, needs its own pass):
  `/api/products?search=…` (storefront `searchProducts`): ~2.4–3s per call.
  It is a different, much heavier service (filter resolution taxonomy,
  8-branch `$facet` with per-branch `$lookup`s, demand map, per-location
  pricing enrich) at `searchProducts`; its cost is inside ONE pipeline plus a
  facet that computes over the whole match set. Candidate next steps: facet
  gating (compute facets from a `$limit`d candidate set), moving enrich out
  of the main path, and denormalized card fields.
- Environment notes:
  - ONNX semantic search is OFF by definition (`ENABLE_SEMANTIC_SEARCH`
    unset) — documented exclusion, no effect from it.
  - The local search latency numbers include ~140ms/query Atlas RTT from this
    machine; production functions sit in iad1 near the Atlas cluster, so the
    deployed absolute numbers differ but the ROUNDTRIP-COUNT reduction is the
    real win (latency multiplies by network RTT).
  → Region co-location (Vercel function vs Atlas region) is worth checking in
    the Vercel console if production `/api/ping` stays slow.
