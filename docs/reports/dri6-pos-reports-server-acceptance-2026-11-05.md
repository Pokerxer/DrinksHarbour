# DRI-10 — POS reports: server variant-identity parity + six-tenant report fixture (DRI-6 extension)

**Date:** 2026-11-05 · **Issue:** DRI-10 (parent DRI-6, ancestor DRI-2) · **Mode:** local, synthetic-only — no commit, no push, no deploy, no production action, no real tenant data.
**Agent:** DrinksHarbour Backend Engineer (run 070fb110) · workspace concurrently held by the DRI-6 parent run (486c6829).

## What was delivered

Per the DRI-6 board extension (CEO decision on record in `docs/memory/pos-retail-accommodation.md`,
"Report/analytics extension" — *shared report views generalize, no per-industry report forks*):

### Deliverable 1 — server label-source parity (`server/services/posReportOrder.service.js`)

The report mapper's per-line `variant` used to fall back to bare `item._variant || item.size?.displayName || ''`,
dropping colour/option identity when `_variant` was absent. It now composes the industry-aware label
**`displayName · colorName · optionName` joined with ` · `** — the same `.filter(Boolean).join(' · ')`
semantics as the till's client util (`client/apps/admin/src/utils/size-variant-label.ts`) — via two new
shared exports:

- `sizeVariantLabel(size)` — the composed label from a populated Size row;
- `orderLineVariant(item)` — `item._variant || sizeVariantLabel(item.size) || ''`, the single
  "what is this line's variant" authority shared with Deliverable 2 (one formula, imported everywhere —
  the pattern this mapper was created for after the per-endpoint copies drifted).

**Byte-parity guarantee held:** for colours-less legacy rows the composition drops the empty terms and
emits byte-for-byte the pre-change string (`posReportVariantParity.test.js` pins this with an oracle
replicating the old formula). **Deliberate one-term divergence, documented:** the client's head term is
`displayName ?? size`; the server head is `displayName` only, because substituting the Size `size` code
would change the emitted string for colour-less legacy sizes without a `displayName` — exactly what the
byte-parity requirement forbids. Every seeded real-world shape (a displayName present) composes
identically to the client.

**Coordination with the Variant Engineer (DRI-1):** their untracked files
`server/utils/retailVariantIdentity.js` + `server/__tests__/retailVariantIdentity.test.js` were **not
edited or forked**. That util exports *identity-key* helpers (`variantIdentity`, `variantOptionKey`,
`variantColorFields`, `variantImageFields`) — case/trim normalization for uniqueness — but **no display
label composer**, so it did not fit the display-label gap; DRI-10 composes its own label in the report
mapper and leaves their files byte-intact (re-run: `retailVariantIdentity.test.js` still **4 pass / 0 fail**).

### Deliverable 2 — session-report breakdown keeps variant identity (`server/controllers/pos.report.controller.js`)

`buildProductBreakdown` (Z-report `productBreakdown`, daily and range `topProducts`) keyed by product id
only, collapsing two colour variants of one product into one row. It now:

- keys by `product||variant` (populated-doc-safe `product._id ?? product`);
- emits the human label in the order-surface pattern **`name · variant`**, composed through the same
  `orderLineVariant` authority — colourless/no-variant rows render the bare name (no dangling ` · `);
- falls back to the **populated product name** for labels: discovered during this work that `_name`,
  `_variant` and `_sku` snapshots written at `pos.controller.js` L2184–2186 are **strict-stripped by the
  undeclared `orderItemSchema`** (`models/Order.js` — `strict: true`), so persisted receipts never carry
  them and every breakdown label previously rendered `Unknown`. The report queries now populate
  `items.product` (`name`) and `items.size` (`displayName colorName optionName`) so legacy rows still
  compose identity from the Size row.
- `buildProductBreakdown` is exported for unit pinning (`posReportVariantParity.test.js`).

The generated compose fallback makes report identity deterministic for **all** persisted receipts — see
Finding below for the follow-up on snapshot persistence.

### Deliverable 3 — six-tenant report fixture

New opt-in Mongo acceptance fixture (extends the DRI-7 pattern; DRI-4/DRI-7 files untouched):

- `server/__tests__/posReportsRetailTypes.mongo.test.js` — five retail types (Fashion, Electronics,
  Beauty & Skincare, Home & Living, General Retail, same type-flavoured colour variants as DRI-7) plus
  **one legacy beverage tenant** (colourless `displayName` row + a DRI-4-style raw Size with no
  displayName at all), each walked seed → session open → cash sale → report reads:
  - `GET /api/pos/orders` (order list through `posReportOrder.service`),
  - `GET /api/pos/orders/analysis` (the server-exposed analysis payload),
  - `GET /api/pos/reports/session/:id` (Z-report breakdown through `pos.report.controller`),
  - `GET /api/pos/reports/daily`, `GET /api/pos/reports/summary` (range `topProducts`),
  asserting (a) retail variant identity present and matching the till label semantics; (b) legacy
  beverage line variant byte-identical to the pre-change shape (including the raw `''` control); (c)
  breakdown separate rows per variant (retail) / one row per no-variant legacy product; (d) tenant
  isolation on every report read — own-tenant rows exactly, foreign Z-report session 404 (30 ordered
  pairs).

## Commands and results (exact)

```bash
# Deliverable unit pins (pure, no Mongo)
cd server && node --test __tests__/posReportVariantParity.test.js
# → tests 10 / pass 10 / fail 0

# Focused regression sweep (existing suites for the touched surfaces, UNCHANGED files stay green)
cd server && node --test __tests__/posReportOrderMapping.test.js __tests__/posAnalysis.test.js \
  __tests__/posReportVariantParity.test.js __tests__/posHoldRecallRoundTrip.test.js \
  __tests__/posSessionTotals.test.js __tests__/posReturnTotals.test.js \
  __tests__/posSessionHistoryTotals.test.js __tests__/adminReportCache.test.js \
  __tests__/posTipRounding.test.js __tests__/posTax.test.js __tests__/posLegacyClose.test.js \
  __tests__/posAnalysisNet.test.js __tests__/posDashboard.test.js
# → tests 94 / pass 94 / fail 0

# DRI-1 variant-identity util — untouched, still green
cd server && node --test __tests__/retailVariantIdentity.test.js
# → tests 4 / pass 4 / fail 0

# DRI-10 six-tenant report fixture + DRI-4 + DRI-7 evidence fixtures (opt-in Mongo)
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/posTillAcceptance.mongo.test.js __tests__/posRetailTypesAcceptance.mongo.test.js \
       __tests__/posReportsRetailTypes.mongo.test.js __tests__/posReportVariantParity.test.js
# → tests 13 / pass 13 / fail 0 / skipped 0
#   (DRI-4 1/0, DRI-7 1/0, DRI-10 1/0, parity unit 10/0)

# Full server suite (mongo suites auto-skip without the URI env):
cd server && node --test '__tests__/*.test.js'
# → tests 5025 / pass 4678 / fail 86 / skipped 261
```

The 86 full-suite failures were **audited against this change**: zero failing tests relate to POS
reports/sessions/orders/variants (`not ok` titles filtered for `pos|report|session|order|variant|Z-report|productBreakdown`
match only unrelated in-flight surfaces of the concurrently-held workspace — venue deposits/animations,
marketplace retail-kind gating (DRI-3/DRI-5 concurrent work), cost-registry mechanisms). None of the
failing files import the files DRI-10 touched. All focused suites above are green.

## Disposable-fixture IDs (per run; DB is PID-suffixed and dropped in `after`)

| Tenant (businessType) | tenantId | sessionId | receiptId |
|---|---|---|---|
| Fashion Retail | `6aecf28626c9895b37f513fc` | `6aecf28926c9895b37f514be` | `6aecf28b26c9895b37f514c3` |
| Electronics Retail | `6aecf28826c9895b37f51406` | `6aecf28c26c9895b37f514c4` | `6aecf28c26c9895b37f514c9` |
| Beauty & Skincare | `6aecf28826c9895b37f51410` | `6aecf28d26c9895b37f514ca` | `6aecf28d26c9895b37f514cf` |
| Home & Living | `6aecf28826c9895b37f5141a` | `6aecf28e26c9895b37f514d0` | `6aecf28e26c9895b37f514d5` |
| General Retail | `6aecf28826c9895b37f51424` | `6aecf28e26c9895b37f514d6` | `6aecf28e26c9895b37f514db` |
| Legacy Beverage | `6aecf28826c9895b37f5142e` | `6aecf28f26c9895b37f514dc` | `6aecf28f26c9895b37f514e1` |

## DRI_EVIDENCE (fixture output, 7 lines)

```
DRI_EVIDENCE {"issue":"DRI-10","phase":"report_variant_identity","businessType":"fashion","environment":"isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecf28626c9895b37f513fc","sessionId":"6aecf28926c9895b37f514be","receiptId":"6aecf28b26c9895b37f514c3","orderListVariants":["One-size gown — Emerald · Emerald · Emerald gown","One-size gown — Ivory · Ivory · Ivory gown"],"analysisVariants":["One-size gown — Emerald · Emerald · Emerald gown","One-size gown — Ivory · Ivory · Ivory gown"],"breakdownRows":[{"name":"Skyline Ankara Gown · One-size gown — Emerald · Emerald · Emerald gown","qty":2,"net":2000},{"name":"Skyline Ankara Gown · One-size gown — Ivory · Ivory · Ivory gown","qty":1,"net":1000}]}
DRI_EVIDENCE {"issue":"DRI-10","phase":"report_variant_identity","businessType":"electronics","environment":"isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecf28826c9895b37f51406","sessionId":"6aecf28c26c9895b37f514c4","receiptId":"6aecf28c26c9895b37f514c9","orderListVariants":["Portable speaker — Graphite · Graphite · Graphite speaker","Portable speaker — Sand · Sand · Sand speaker"],"analysisVariants":["Portable speaker — Graphite · Graphite · Graphite speaker","Portable speaker — Sand · Sand · Sand speaker"],"breakdownRows":[{"name":"Nova Bluetooth Speaker · Portable speaker — Graphite · Graphite · Graphite speaker","qty":2,"net":2000},{"name":"Nova Bluetooth Speaker · Portable speaker — Sand · Sand · Sand speaker","qty":1,"net":1000}]}
DRI_EVIDENCE {"issue":"DRI-10","phase":"report_variant_identity","businessType":"beauty","environment":"isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecf28826c9895b37f51410","sessionId":"6aecf28d26c9895b37f514ca","receiptId":"6aecf28d26c9895b37f514cf","orderListVariants":["Oil blend — Rose · Rose · Rose blend","Oil blend — Unscented · Unscented · Unscented blend"],"analysisVariants":["Oil blend — Rose · Rose · Rose blend","Oil blend — Unscented · Unscented · Unscented blend"],"breakdownRows":[{"name":"Glow Shea Body Oil · Oil blend — Rose · Rose · Rose blend","qty":2,"net":2000},{"name":"Glow Shea Body Oil · Oil blend — Unscented · Unscented · Unscented blend","qty":1,"net":1000}]}
DRI_EVIDENCE {"issue":"DRI-10","phase":"report_variant_identity","businessType":"home","environment":"isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecf28826c9895b37f5141a","sessionId":"6aecf28e26c9895b37f514d0","receiptId":"6aecf28e26c9895b37f514d5","orderListVariants":["Kettle glaze — Sage · Sage · Sage glaze","Kettle glaze — Terracotta · Terracotta · Terracotta glaze"],"analysisVariants":["Kettle glaze — Sage · Sage · Sage glaze","Kettle glaze — Terracotta · Terracotta · Terracotta glaze"],"breakdownRows":[{"name":"Hearth Ceramic Kettle · Kettle glaze — Sage · Sage · Sage glaze","qty":2,"net":2000},{"name":"Hearth Ceramic Kettle · Kettle glaze — Terracotta · Terracotta · Terracotta glaze","qty":1,"net":1000}]}
DRI_EVIDENCE {"issue":"DRI-10","phase":"report_variant_identity","businessType":"general","environment":"isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecf28826c9895b37f51424","sessionId":"6aecf28e26c9895b37f514d6","receiptId":"6aecf28e26c9895b37f514db","orderListVariants":["Hamper wrap — Red ribbon · Red ribbon · Red-ribbon hamper","Hamper wrap — Gold ribbon · Gold ribbon · Gold-ribbon hamper"],"analysisVariants":["Hamper wrap — Red ribbon · Red ribbon · Red-ribbon hamper","Hamper wrap — Gold ribbon · Gold ribbon · Gold-ribbon hamper"],"breakdownRows":[{"name":"Harbour Gift Hamper · Hamper wrap — Red ribbon · Red ribbon · Red-ribbon hamper","qty":2,"net":2000},{"name":"Harbour Gift Hamper · Hamper wrap — Gold ribbon · Gold ribbon · Gold-ribbon hamper","qty":1,"net":1000}]}
DRI_EVIDENCE {"issue":"DRI-10","phase":"report_variant_identity","businessType":"legacy","environment":"isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecf28826c9895b37f5142e","sessionId":"6aecf28f26c9895b37f514dc","receiptId":"6aecf28f26c9895b37f514e1","orderListVariants":["DRI-10 Lager 330ml",""],"analysisVariants":["DRI-10 Lager 330ml",""],"breakdownRows":[{"name":"DRI-10 Lager · DRI-10 Lager 330ml","qty":2,"net":2000},{"name":"Bottle","qty":1,"net":1000}]}
DRI_EVIDENCE {"issue":"DRI-10","phase":"report_tenant_isolation","environment":"isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","tenantsChecked":6,"pairsChecked":30,"result":"every report read (/orders, /orders/analysis, /reports/session/:foreign → 404, /reports/daily, /reports/summary) returns exactly the caller-tenant rows"}
```

Reading of the evidence: for every retail type the order-list, analysis and Z-report breakdown carry the
full composed identity (e.g. Fashion: `One-size gown — Emerald · Emerald · Emerald gown` vs `— Ivory`),
matching the till semantics; the legacy tenant emits exactly `DRI-10 Lager 330ml` and the raw-control
empty string `''` (byte-identical to the pre-change formula), one breakdown row per no-variant legacy
product with **no dangling** ` · `. Isolation phase: 6 tenants × 5 peers = **30 pairs** — foreign session
Z-report 404, and /orders, /orders/analysis, /reports/daily, /reports/summary return exactly the
caller-tenant rows.

## Finding (out-of-scope, flagged for follow-up)

`orderItemSchema` (`server/models/Order.js`, `strict: true`) does not declare `_name` / `_variant` / `_sku`,
so **every persisted POS receipt loses the till's cart snapshots** — the identity in reports now comes
from the composed Size fallback (which is why this fallback is load-bearing). The same strict-strip class
of bug was already documented for held/replayed carts in `posHoldRecallRoundTrip.test.js`. Recommended
follow-up (parent DRI-6, coordinate with the Variant Engineer): declare `_variant` (with `_name`/`_sku`)
on `orderItemSchema` so receipts keep the frozen till label at sale time; the compose fallback stays as
the legacy-order path. Deliberately NOT changed here — declaring the fields would change persisted order
shapes beyond this issue's "do not change existing passing order shapes" rule.

## Acceptance checklist

- [x] Deliverable 1 — server label-source parity, byte-parity oracle green, `retailVariantIdentity` util consumed-by-coordination only (not fit; not edited).
- [x] Deliverable 2 — breakdown rows keyed+labelled by `name · variant`, legacy rows render exactly as before (no dangling ` · `).
- [x] Deliverable 3 — six-tenant report fixture green with exact commands, pass counts and disposable-fixture IDs; DRI-4 + DRI-7 fixtures unchanged and green.
- [x] Report doc written with DRI_EVIDENCE lines (this file).
- [x] No commit / push / deploy / production action.
