# POS accommodation for the five retail business types — CEO decision

Decision date: 2026-11-05 · Decided by: DrinksHarbour CEO (agent 62937a32) · Issue: DRI-6 (parent DRI-2)

> BOARD CORRECTION (2026-11-06, supersedes the narrower scope): accommodation is
> for **ALL the businesses**, read as the seven-industry frame in
> `server/constants/industries.js` — beverage, hospitality, food-service,
> electronics, fashion, beauty, home (14 mapped business types including
> Bar/Lounge, Nightclub/Club, Restaurant, Hotel) plus unprofiled/Other legacy
> tenants. Everywhere below that lists only the five retail types, read the
> seven-industry frame; fixture patterns should include at least one beverage,
> one hospitality/food-service, one retail business type, and an unprofiled
> legacy control per surface.

## Decision

**Point of Sale is a business-type-agnostic ERM surface.** The five newly added retail
business types (Fashion Retail, Electronics Retail, Beauty & Skincare, Home & Living,
General Retail) are accommodated at POS by keeping the till neutral — no beverage gating,
no per-type POS forks, no industry-scoped POS catalogue:

1. **No beverage gating in POS.** The POS catalogue (`getPOSProducts`) filters only on
   `{ tenant, visibleInPOS, active status }`. No `alcoholic`/`abv`/`beverageType`
   predicate exists there, and none is added. A retail tenant's till shows exactly its
   own SubProducts.
2. **No industry scoping inside POS.** `INDUSTRY_TAXONOMY_SCOPE_ENABLED` (default off)
   scopes ERM category lists and product-category writes only; the POS sale flow stays
   out of its scope. POS is tenant-private, so there is no beverage-marketplace blending
   risk to guard against there.
3. **Plan caps stay type-agnostic.** `server/config/erm-plans.js` SKU/staff/shop caps and
   the `pos`/`pos_multi` capability set apply uniformly to all business types. No
   per-type pricing or entitlement is introduced (no commercial change).
4. **Beverage-specific rules remain beverage-vertical concerns.** Runtime age
   verification on alcoholic items is a beverage-compliance gap tracked on the beverage
   side; it is not blended into retail-till work. Retail tills sell no age-restricted
   categories by definition.
5. **Cosmetic copy neutrality.** Beverages-flavoured example strings in shared POS
   surfaces (e.g. loyalty discount placeholders "20% off all spirits") get neutralized to
   retail-neutral examples; no behaviour change.

## Rationale

- The product brief restricts the **beverage-only `/platform` marketplace surface**
  (`drinksharbour.com`) from blending non-beverage listings/taxonomy/eligibility.
  POS lives in the tenant ERM (admin/subdomain surface), outside that restriction —
  accommodating the five types in POS therefore does **not** need a board decision.
- Tenant/Seller eligibility ("ERM SaaS" stream) mandates that subscription entitlements
  (POS among them) stay independent of marketplace seller eligibility.

## Verification basis (current evidence)

- `server/__tests__/posTillAcceptance.mongo.test.js` — DRI-4 acceptance
  (`docs/reports/dri4-pos-till-acceptance-2026-11-05.md`): real-HTTP + real-Mongo till
  walk with exact retail colour variants (same-size/different-colour), legacy beverage
  control row, stock-deduction table, wrong-tenant/foreign-Size refusals, oversell
  refusal, drawer totals. **1 pass / 0 fail.**
- `server/constants/industries.js` + `server/__tests__/industryScope.test.js` — five
  types map to industry profiles; POS colour swatches render via
  `client/apps/admin/src/app/shared/point-of-sale/components/pos-size-color.tsx`
  (sizes without colour data render unchanged).
- `docs/reports/dri5-beverage-marketplace-gate-2026-11-05.md` — beverage gate on the
  marketplace; re-verified the retail till flow is unaffected.

## Delegated follow-up

Tracked on the DRI-6 child task assigned to the DrinksHarbour Backend Engineer:

- [x] **Done (DRI-7, 2026-11-05):** extended the DRI-4 fixture pattern to **one tenant
  per business type** (all five retail types) — each walked picker → session open →
  cash simulation → stock deduction → refusal set → drawer totals, with type-appropriate
  variants, plus a 20-pair cross-type isolation sweep. New fixture
  `server/__tests__/posRetailTypesAcceptance.mongo.test.js` **1 pass / 0 fail**; DRI-4
  fixture re-run unchanged 1/0. Report:
  `docs/reports/dri6-pos-retail-types-acceptance-2026-11-05.md`. No commit/deploy.
- [x] **Neutralize the beverage-flavoured placeholder strings in
  `client/apps/admin/src/app/shared/point-of-sale/pos-loyalty.tsx` — DONE (DRI-11, 2026-11-06):**
  `"e.g. 20% off all spirits this weekend"` → `"e.g. 20% off all sandals this weekend"`,
  `"e.g. On all spirits and cocktails"` → `"e.g. On all kitchenware and tableware"`, plus the same-class
  help-card string `Buy 3 cocktails…` → `Buy 3 t-shirts…` (~L4750, extra find). Focused vitest + full-admin
  `tsc --noEmit` pass on the file (0 errors in touched files). Report:
  `docs/reports/dri6-pos-reports-frontend-acceptance-2026-11-05.md`.
- No commit/deploy/production actions; coordinate with the concurrent DRI-3
  (frontend acceptance) run via commits only.

## Report/analytics extension — 2026-11-05 (board scope extension)

Board extended DRI-6 scope: the POS reporting and analytics surfaces must accommodate
the five retail types too (order-analysis, sales-details, session-report, `/pos/orders`,
`/pos/sessions`, nav items, and the client-side PDF/Excel/CSV exports).

**Decision (CEO): shared report views generalize — no per-industry report forks.**

Evidence basis (`client/apps/admin/src/app/shared/point-of-sale/`):

- Report surfaces render the server-provided per-line `variant` string verbatim
  (`pos-order-analysis.tsx` L552/L4983 group `name · variant`; `pos-session-report.tsx`
  L384–386; `pos-orders.tsx` L491; `sales-details/lib/flatten-orders.ts` L46; exports in
  `sales-details/export/{csv,excel}.ts` re-emit it unchanged). Grouping dimensions in
  `analysis/measures.ts` and `sales-details/lib/group-rows.ts` are product/variant/
  cashier/payment/warehouse/date only — no beverage-only columns found.
- The till's industry-aware label (`variantLabel(size)` → cart `_variant` snapshot at
  `pos.controller.js` L2185) already flows through `posReportOrder.service.js` L24
  (`item._variant || item.size?.displayName || ''`) for NEW sales.
- Two real gaps, both fixable at shared sources without forks:
  1. **Server fallback parity** — when `_variant` is absent (legacy/foreign-sourced
     orders), `posReportOrder.service.js` composition uses only `size?.displayName`,
     dropping colour/option identity. Must compose the same industry-aware label as the
     till (align with the in-flight `server/utils/retailVariantIdentity.js` from DRI-1 —
     consume, do not fork or edit its files; coordinate with the Variant Engineer).
  2. **Session-report product breakdown drops variant** — `buildProductBreakdown`
     (`server/controllers/pos.report.controller.js` L20–37) keys by product only, so
     two colour variants of one product collapse in the Z/daily/range report. Include
     variant in key/label.
- Exports stay client-side; they inherit the corrected variant string — assert the
  variant column survives PDF/Excel/CSV export for retail rows (existing unit tests in
  `sales-details/export/*.test.ts` are the pattern).

- [x] **Done (DRI-10, 2026-11-05):** server label-source alignment + six-tenant (5 retail +
  legacy beverage) report fixture evidence — `posReportOrder.service.js` composes the
  industry-aware label on the `_variant`-absent fallback (`sizeVariantLabel`/`orderLineVariant`,
  byte-parity oracle for colour-less legacy rows); `buildProductBreakdown` keys+labels
  `name · variant` per row; the shared `reportOrderQuery` populate now carries
  `displayName colorName optionName costPrice`. New fixture
  `server/__tests__/posReportsRetailTypes.mongo.test.js` **1 pass / 0 fail** (six tenants,
  30-pair report-isolation sweep); DRI-4/DRI-7 fixtures re-run unchanged 1/0 each;
  unit pins `__tests__/posReportVariantParity.test.js` 10/0; DRI-1
  `retailVariantIdentity` util coordinated-not-edited. Report:
  `docs/reports/dri6-pos-reports-server-acceptance-2026-11-05.md`. Notable finding: `_name`/
  `_variant`/`_sku` are strict-stripped by `orderItemSchema`, so persisted receipts always relied
  on the Size compose — declaring the snapshot fields is a flagged follow-up. No commit/deploy.

**Beverage defaults regression-guarded:** sizes without colour/option render exactly
as before — the DRI-4 legacy-beverage control row stays the byte-precise regression
check. No new grouping dimensions per industry; no business-type branching in report
code.

Delegated: backend label-source alignment + six-tenant (5 retail + legacy beverage)
report fixture evidence → Backend Engineer; shared/report-surface adoption + export
identity asserts (+ the skipped loyalty placeholder neutralization) → Frontend
Engineer, sequenced behind DRI-3 (their active acceptance run owns the same shared
files) and coordinated with the backend report task.

**Frontend share delivered 2026-11-06 (DRI-11, Frontend Engineer)** — sequenced clear
of DRI-3 (final commit `ca3ca591`); DRI-3's uncommitted shared-file edits preserved:
1. **Surface audit — all shared report surfaces audit-only, zero forks:** order-analysis
   (group key `name · variant` ~L552/~L4983, drill-down ~L1377), session-report
   (~L384), pos/orders (~L491), nav items, and sales-details
   (`flatten-orders` L46 → `group-rows` ~L17) all render/group the server
   `orderLineVariant` string verbatim; no beverage-only column or ml/bottle
   assumption exists on any of them. No label composer forked — the server string
   stays every surface's single source.
2. **Export identity pinned by tests:** new `excel.test.ts` (cell getters exported
   for testability — the only behavioural-neutral export-file edit) + focused csv and
   flatten→group cases for a two-variant retail product (Fashion Emerald/Amber seed
   shape) and a no-variant legacy beverage row (byte-shape-pinned `""` / `—` / `''`).
   Focused admin vitest 50/0; full-admin tsc 0 errors in touched files.
3. **Loyalty placeholders neutralized** (see the DRI-7 bullet above — 3 strings).
4. **Fixture evidence re-run on this issue:** DRI-4/DRI-7/DRI-10 Mongo fixtures +
   parity unit 13/0; unit pins 14/0. Report:
   `docs/reports/dri6-pos-reports-frontend-acceptance-2026-11-05.md`.

## /sales module extension — 2026-11-05 (board scope extension)

Board added the `/sales` module ((hydrogen)/sales pages, shared/sales components,
(print)/sales print views) to DRI-6 scope for the five retail types.

**Decision (CEO): the shared implementation generalizes — same verdict as POS reports.**
The shared server label formatter `sizeVariantLabel` (`utils/size-variant-label.ts`) is
already THE label source for both the till and the sales/admin-purchasing pickers
(`product-line-search.tsx` L75/L221–243; `purchases-product-line-search.tsx`; purchases/
transfers/pricelist pickers) — no per-industry labels or forks to add. Size identity is
preserved end-to-end by existing design: `SalesOrder` lines carry `size: ObjectId(ref
Size)` + client-snapshotted line `name`; fulfillment/return mutations re-resolve the
line's `subProduct + size` into InventoryMovements (`salesFulfill.service.js`,
`salesOrder.controller.js` returnSalesOrder) and the `Sales` ledger carries a required
`size` ref. No beverage-only columns exist on any /sales surface (abv is an optional
catalogue field only). Legacy beverage sales behavior stays untouched: snapshots and
movement shapes unchanged.

**Defects to fix (delegate, no forks):**
1. `client/apps/admin/src/app/shared/sales/sales-scan-drawer.tsx` (~L310–311) composes
   `size.displayName ?? size.size` directly, bypassing the shared formatter — scan
   path label disagreements with the picker path for colour/option variants. Align to
   `sizeVariantLabel`.
2. Sales analytics product dimension takes `item.name` only (`sales-analytics-helpers`
   ~L233) — same rule as POS order-analysis: include variant identity so two variants
   of one product don't collapse. Client-side change; generic, benefits all industries.
3. No test coverage for `product-line-search` pickSize retail labels — mirror
   `purchases/retail-variant-line-search.test.tsx`.
4. Server-trusted line `name` snapshot (server never re-derives; `salesOrder.service.js`
   `mapLine`) — DECIDED: keep snapshot semantics (historical order lines stay fixed at
   entry-time label, matching the historical-snapshot policy used for payouts/orders).
   Print/quote views keep using the stored name; no server re-composition.

**Existing suites to extend, not duplicate:** `server/utils/retailVariantIdentity.js`
+ test (catalogue-only today), `poReceive.helpers` (purchasing sizeId resolution),
`warehouseTransferTotals`; none touch SalesOrder yet — DRI-12 adds the sales-module
fixture in the DRI-10 pattern. Heavy in-flight edits exist in sales surfaces (Sales.js,
SalesOrder.js, salesOrder.service, pricing/channels files, untracked sales-channels
suite) — backend must audit-only against those files where another run is mid-edit and
coordinate via commits.

## /sales/analytics extension — 2026-11-06 (board scope extension #3)

Board added the four analyses (Revenue over time; Salespersons; Products; Customers) to
DRI-6 scope for the five retail types + legacy beverage.

**Decision (CEO): no per-industry analytic widgets — the shared engine generalizes.**

Evidence (`client/apps/admin/src/app/shared/sales/sales-analytics/*` + server
`salesOrder.service.js`):

- All four analyses are computed client-side from the full tenant-scoped SalesOrder
  ledger (`SALES_ENGINE`, `sales-analytics-helpers.ts`); grouping dimensions are
  generic (time bucket, product/category/brand via shared POS category maps, customer
  snapshot, salesperson). No volume/ml/abv logic in helpers/widgets; taxonomy fallbacks
  are industry-neutral ('Uncategorized'/'No Brand').
- Server grouped list path (`getGroupedOrders`) supports `salesperson` + `customer`
  extractors; every aggregation is tenant-scoped (controller asserts `tenant` after
  filter merge; `buildFilterQuery` refuses `tenant` overrides). No server `product`
  extractor exists — intentionally not added: the client engine owns product grouping
  and (per DRI-13) gains variant awareness; the server extractor stays order-level.
- Salesperson attribution: stamped authoritatively from `req.user` in
  `createSalesOrderDoc` (payload overrides discarded — `salesSalesperson.test.js`);
  quotation conversion is in-place (no double-count); fulfillment re-stamps
  attribution (existing guarded behavior, unchanged).

**Recorded boundaries (no behavior change in this package):**
1. **Till-channel boundary:** direct POS till receipts are `Order` docs (source `pos`),
   not SalesOrders — they belong to POS-side analytics (session report / order-analysis,
   DRI-10) and are intentionally out of /sales analytics. Retail types get correct till
   analytics there; no SalesOrder fork for the till.
2. **Marketplace attribution:** marketplace-routed orders carry no salesperson
   (`marketplaceSalesOrderBridge` stores no assignment) → 'None'/'Unassigned'; money is
   the payout/wholesale leg. Accepted data-quality label; if the board later wants
   attribution, that is a separate policy decision.
3. **Known generic inconsistency (not a five-type gap):** the Revenue widget sums raw
   `o.total` while the chart engine aggregates line-level totals converted via
   exchange rates. NGN-only today, no impact; flagged for the future multi-currency
   phase (strategy §5 currency settings), not changed here.
4. Quotation handling unchanged: default revenue includes quotations unless filtered
   (`type_order`); legacy `convertedFrom/convertedTo` doc-pairs pre-dating the in-place
   conversion could double-count — DRI-12's fixture notes (not mutates) any such rows.

## /purchases extension — 2026-11-06 (board scope extension #4)
Board added the `/purchases` module (PO create/edit/rx/receipt/returns/agreements/
pricelists/bills/validate/transfers/analytics/UOM/exchange-rates/print) to DRI-6 scope.

**Decision (CEO): shared generalizes — no per-industry purchasing gates or UOM sets.**

Verified already (existing evidence, extended by survey): admin purchasing pickers use
the shared `sizeVariantLabel` util with industry-aware labels (DRI-2 runs);
`poReceive.helpers` fails loudly when a sizeId cannot resolve, throws on
sizeId-vs-PO-line mismatch, and the sibling-untouched partial-receipt invariant is
proven at the stock-service boundary (`poReceive.helpers.test.js`: a receipt cannot
redirect an ordered variant to its same-size sibling; partial receipt posts only the
ordered Size ID). Server models preserve exact Size identity everywhere: `VendorReturn`
items (`subProductId + sizeId + sizeName`, return quantities matched on subProductId +
sizeId), `VendorBill` (composite `subProductId::sizeId` key, size snapshot),
`StockTransfer` (`sizeId` ref + packSize snapshot), `WarehouseStock`/`WarehouseMovement`
(`{tenant, warehouse, subProduct, size}` keys). UOM conversion is a tenant-scoped
generic model (fixed enum incl. legacy volume units); pack rates are per-product
`unitsPerPack`, not UOM-derived. Analytics/validate views are size-string driven with
no beverage-category or unit assumption; exchange rates are pure-currency objects.

**Defects to fix (delegate, at shared sources, no forks):**
1. **Pack-noun default:** `PACK_NOUNS`/`packNounOf` falls back to 'bottle', and
   `so-print.ts:177` hardcodes 'bottle' — wrong unit noun on prints for retail rows
   without a packaging string. DECISION: keep the legacy 'bottle' fallback for rows
   that lack packaging text so beverage print behavior is byte-identical; retail rows
   get an explicit industry-neutral packaging/noun default **at line entry** (picker
   default noun, e.g. 'units'/'pieces'); print keeps consuming the stored packaging.
   No industry branching in print code.
2. **Label consistency:** purchase return-create (`purchases-return-create.tsx`
   ~L916–931), receive preview chips (`purchases-receive.tsx` ~L382–391) and bill
   print (`bill-print.ts:12`, `"(size)"` bracket style) compose labels from raw
   stored `sizeName` instead of the shared formatter, so colour/option identity can
   drop on those surfaces for retail variants. Align rendering to the shared
   util/server label while preserving byte-identical output for legacy rows (stored
   snapshots stay authoritative; identity fields stay from server).
3. UOM stays generic (no per-industry enum); the converter default Cases→Units is
   beverage-legacy but harmless and unchanged.

**Verification (delegated DRI-14 → Backend Engineer):** disposable six-tenant fixture
(5 retail + legacy beverage): PO create → partial receive of one exact variant (sibling
balances unchanged) → return → bill, exercising Size IDs, industry-aware labels
end-to-end, bill money/pack snapshots unchanged, exchange-rate flow untouched, and
legacy beverage rows byte-identical throughout. Note: most purchases surfaces carry
in-flight uncommitted edits from another run — audit-only for mid-edit files,
coordinate via commits.

### /purchases/analytics defect fix — 2026-11-06 (board scope extension #5)

Board identified a concrete defect: `getPurchaseAnalyticsByVendor`
(`server/controllers/purchaseOrder.controller.js`) groups `sizeBreakdown` by
`item.sizeName` and `productBreakdown` by `item.subProductName` — for retail
industries, distinct colour variants ("M · Emerald" vs "M · Ivory") collapse into one
"Size" bucket with mixed money/qty. Fix per decision: group by the **exact Size ID**
(established `poReceive.helpers` pattern), with fallback to the stored size string only
for legacy rows lacking an ID; label via the shared `size-variant-label` parity; add
the Size identity fields (`colorName`/`colorHexCode`/`optionName`) to breakdown rows.
The summary breakdown (pack totals/status/approvals/vendor) is variant-agnostic — no
change.

**CEO decisions on the two open questions:**
1. **Cosmetic (swatches):** text labels suffice for vendor purchase analytics. The fix
   carries the identity fields on rows so the client can render per-option colour
   swatches later without another server change; no swatch work in this package.
2. **Bill/receipt cross-views:** not needed for by-vendor analytics in this package.
   The flagged `VendorBill.matchingDetails` defect (validateBill's
   `subProductId::sizeId` composite-key breakdown/is never persisted — Mongoose casts
   drop the absent subpaths; confirmed by DRI-14's audit) is a REAL persistence defect
   but a separate, unauthorized scope: recorded as an open engineering follow-up
   pending board authorization; NOT fixed here, fixture only proves composite keys
   against the payloads matching composes from.

**Verification:** extend `server/__tests__/purchasesRetailTypes.mongo.test.js` (DRI-14
fixture) with Emerald/Ivory separate-bucket assertions with correct amounts; legacy
beverage row byte-identical under the ID fallback; one fixture run + existing focus
suites green. Delegate: Backend Engineer (DRI-5), coordinate before touching shared
purchasing files with active runs. Local/synthetic only; no commit/deploy/production.

**DRI-14 delivered 2026-11-06 (Backend Engineer, evidence in
`docs/reports/dri6-purchases-module-acceptance-2026-11-06.md`):**
1. **Pack-noun default DONE** — `'bottle'` fallback kept byte-for-byte; `PACK_NOUNS`
   gains `'unit'`/`'piece'` as consumers only; new pure `defaultPackagingForLine(size)`
   (retail variant identity `colour/option` present → `'pieces'` for unitType
   `'piece'`, else `'units'`; beverage rows → `undefined`) is applied at line entry in
   `purchases-create.tsx` (wizard picker), `purchases-product-line-search.tsx` and
   `purchases-scan-selection.ts`. No print branch. `so-print.ts:177` stays audit-only
   (sourcing from stored SO `uom` would rewrite legacy bytes like `'Cartons'`→
   `'carton'` — flagged).
2. **Label consistency DONE** — `lineSizeLabel`/`populatedSizeIdentity` added to the
   shared util (snapshot authoritative; compose via `sizeVariantLabel` only when the
   populated Size carries colour/option); `purchases-receive.tsx` chips,
   `purchases-return-create.tsx` cells + `refIdOf` payload guard, `bill-print.ts` now
   use it; `getPurchaseOrder`/`getPurchaseOrders`/`getVendorBill` populate the four
   identity fields (data provision, no server label re-composition). The vendorBill
   "(size)" bracket strings stay audit-only (server-composed strings).
3. **Six-tenant fixture DONE** — `server/__tests__/purchasesRetailTypes.mongo.test.js`
   (DRI-10 pattern, opt-in Mongo): exact-size PO lines → partial receive → validate
   (single received movement, sibling WarehouseStock JSON-byte-unchanged) → completing
   receipt → vendor return (over-return rejected, counters once) → bill from receipts
   (composite `subProductId::sizeId` keys, snapshots, money = receipt-driven counters,
   USD tenant preserves original figures) → print payloads. Tenant isolation on every
   foreign ref. Focused suites green (51 server; 290 FE vitest; DRI-7/DRI-10 fixtures
   re-verified).
4. **Audit finding:** `VendorBill.matchingDetails` schema lacks
   `itemComparisons`/`sizeBreakdown` subpaths, so validateBill's composite-key
   breakdown never persists (Mongoose cast drops it) — follow-up on parent DRI-6.
   `purchases-edit.tsx` untouched mid-edit; its new-line entry should adopt
   `defaultPackagingForLine` in a coordinated pass.

## DRI-15 `/purchases/analytics` defect fix — 2026-11-06 (delivered, Backend Engineer)

Delivered per the CEO decisions above (evidence
`docs/reports/dri6-purchases-analytics-defect-acceptance-2026-11-06.md`):
1. **By-vendor grouping DONE** — `getPurchaseAnalyticsByVendor` (that endpoint only)
   now keys `sizeBreakdown` on the exact `items.sizeId` and `productBreakdown` on the
   exact `item.subProductId` (`vendorReturn.quantities`/`poReceive.helpers` String-id
   semantics), with the stored snapshot string as fallback ONLY for legacy rows
   lacking an id. The analytics query populates `items.sizeId` with the four identity
   fields (DRI-14 detail/list availability mirrored); rows with variant identity label
   via the shared `sizeVariantLabel` compositor (POS-reporting service copy) and carry
   `colorName`/`colorHexCode`/`optionName` for later client swatches; rows without
   identity (all legacy rows) keep the pre-fix shape byte-for-byte.
   `getPurchaseAnalyticsSummary` untouched (variant-agnostic; asserted). No cache
   key/shape changes beyond the fix; `cacheReport` + tenant gate intact.
2. **Fixture DONE** — `purchasesRetailTypes.mongo.test.js` gains
   `purchases_analytics_by_vendor_buckets_by_exact_ids_legacy_fallback_byte_parity`:
   Emerald+Ivory same-size `'M'` snapshots → three separate size buckets with correct
   money/labels/identity fields; twin same-name SubProduct → two product rows; legacy
   sizeless row byte-identical; tenant gate clean; summary asserted unchanged. Full
   fixture file 2/2; focus suites (poReceive.helpers, vendorReturn.counters,
   retailVariantIdentity, warehouseTransferTotals, purchaseAnalyticsLedger) 53/53.
   Note: the fixture seeds `Size.displayName` pre-composed (DRI-14 seeding choice), so
   composed labels there double over it exactly as DRI-14's print/chips parity does —
   production `displayName` is plain and composes once.
3. **Still open (note-only):** the `VendorBill.matchingDetails` persistence defect
   from DRI-14's audit remains a separate unauthorized follow-up pending board
   authorization; client swatch rendering of the new row fields is a later FE pass.

## DRI-3 buyer-side acceptance — 2026-11-06 (CEO verdict: APPROVED, issue done)

The five-new-business-type buyer/browser acceptance (DRI-3) closed APPROVED on
2026-11-06. Verified against the engineer's recorded evidence + repo artifacts
(not re-run in review): journeys A 49/49 (admin listing create, all five
verticals, real Save → POST /api/subproducts), B 15/15 (same-size variant pair
→ two cart lines → wallet checkout → tampered-ID rejections), C 8/8 including
**C5** — the beverage-only `/platform` boundary stays intact after DRI-9: main
marketplace does not surface a buy path for retail-kind product detail (404 on
the marketplace surface, 200 with `x-is-tenant-site: true`), positive controls
prove approved beverages still sell on the main marketplace and retail still
sells on tenant storefront surfaces. Artifacts: commits `a990ecb2`, `be205b26`,
`817a4d24`, `ca3ca591`; acceptance evidence document (rev 2) on the issue;
`docs/memory/dri3-browser-acceptance.md` (fixture restart trap documented).

Consequences recorded in the tracker: DRI-11 (`in_progress`, POS report
surfaces frontend) and DRI-13 (`/sales` frontend, blocked only on DRI-11)
unblocked by this closure. **Operational caveat for all five verticals going
forward:** cart-line identity stays on the RAW `size` code with the
`selectedSizeLabel`/`selectedColor` display split pinned (`be205b26`,
`cart.helpers.test`); do not put human labels into `selectedSize`/`cartItemId`.
Backend review of those additive display-only cart fields remains a standing
follow-up under DRI-6.

## DRI-12 stale-blocker cleanup — 2026-11-06

DRI-12 (`/sales` server Size-ID/label verification, Backend Engineer) sat in
`blocked` with an EMPTY blocker set — same stale disposition pattern as DRI-9
was during DRI-3. CEO cleared it to `in_progress` per board directive so the
backend /sales verification runs alongside DRI-11/DRI-13. No scope change
(`/sales/analytics` extension #3 stands). Standing rule: blockers must have a
non-empty `blockedByIssueIds` or a named unblock owner; bare prose `blocked`
strands the assignee.

## /warehouses extension — 2026-11-06 (board scope extension #6)

Board added the `/warehouses` module (list, [id] detail, analysis, product inventory;
warehouse-analysis pivot/helpers, stock-drill-drawer, selected-transfers-report,
subproduct-warehouse-breakdown, location analysis) with a probable same-family variant
collapse. **Verified in repo before fixing:** the defect is real —
`warehouse-analysis-helpers.ts` L285 buckets the entire Size dimension by
`r.sizeName || '—'`; `stock-drill-drawer.tsx` L126 sorts by `sizeName` and L324 renders
it verbatim; `selected-transfers-report.ts` L73/L78 composes from raw `sizeName`/`sku`.
`StockRow` carries no `sizeId`/colour identity client-side. Server stock rows ARE keyed
by SubProduct + Size IDs (DRI-7 evidence) — the identity exists server-side; the
warehouse payloads just don't expose it.

**Fix (delegated, no forks):** plumb the full variant identity (exact Size ID for
bucket keys, shared `size-variant-label` for display, distinct buckets per Size row)
across warehouse analysis, drill drawer, location-analysis transfer report and
subproduct breakdown. The verified transfer labels (DRI-7/DRI-14 evidence) stay
untouched. `selected-transfers-report` L73 already keys by `sizeId || sizeName` —
align its label part (L78) with the shared identity; PO/transfer flows unchanged.

**CEO decisions on the board's two open questions:**
1. **Colour dimension:** NO new colour-dimension toggle — rows stay distinct by exact
   Size ID (identity separate from presentation); the size dimension simply stops
   collapsing siblings because its key becomes the Size ID. Presentation is the shared
   full label. A dedicated colour filter can be a later client addition if evidence
   shows demand; not now.
2. **Low-stock thresholds:** stay uniform (shared defaults). No industry-profile input —
   industry-tuned reorder thresholds belong to the inventory demand-planning phase
   (Prophet/ARIMA/XGBoost per strategy §5), not a five-type accommodation gate.

**Verification:** extend the six-tenant retail fixture pattern (DRI-10/DRI-14/DRI-12
style): Emerald vs Ivory rows stay DISTINCT buckets in warehouse analysis and show full
labels in the drill drawer; legacy beverage behavior byte-identical. Server plumbing →
Backend Engineer; pivot/drawer surfaces → Frontend Engineer; coordinated around active
runs. Local/synthetic only; no commit/deploy/production.

**Server plumbing (DRI-16, 2026-11-06) — DONE on the server side.** Every
warehouse-surface payload now carries the exact `sizeId` plus the Size identity fields
(`colorName`/`colorHexCode`/`optionName` beside the existing `sizeName` snapshot):
`warehouse.service.js` `getAllStock` (→ warehouse-analysis / product-inventory StockRow /
stock-drill-drawer), `getWarehouseStock` (→ /:id/stock drill), `getStockByWarehouse`
(→ the `subproduct-warehouse-breakdown` provider `/api/subproducts/:id/stock-by-warehouse`), and
`stockTransfer.controller.js` `getStockTransfer` for the selected-transfers-report data
path (`stockTransferService.get(id)` in `selected-transfers-export.tsx`) via the new
`attachTransferSizeIdentity` helper. Emission is conditional (DRI-14
emit-only-with-identity precedent): identity-less legacy beverage rows keep their exact
pre-change key set (fixture-asserted). **Wire contract for the frontend task:** transfer
item `sizeId` deliberately stays a 24-char string (NOT an `items.sizeId` populate — that
would flip the wire shape and break stock-transfer-detail line keys and invoice-return
size matching); identity arrives as sibling item keys. Fixture
`server/__tests__/warehouseRetailTypes.mongo.test.js` (DRI-10/DRI-14 pattern, six
tenants) proves: distinct rows per exact sizeId (no Emerald/Ivory conflation), correct
per-variant balances, per-warehouse drill identification, legacy byte-parity, tenant
isolation on every projection; evidence
`DRI_EVIDENCE_DRI16_WAREHOUSES_SERVER_VARIANT_IDENTITY`, report
`docs/reports/dri6-warehouses-server-acceptance-2026-11-06.md`, full spec
`docs/superpowers/specs/RESUME-dri16-warehouses-variant-identity.md`. Frontend pivot/
drawer plumbing remains with the Frontend Engineer. No commit/deploy (issue forbids);
`warehouse.service.js` in the shared tree also holds pre-existing uncommitted concurrent
DRI-6 work (venue configuration guards, deleteWarehouse soft-delete) — preserved.

## DRI-17 `/warehouses` variant plumbing frontend — 2026-11-06 (delivered, Frontend Engineer)

Evidence: `docs/reports/dri6-warehouses-frontend-acceptance-2026-11-06.md`. Identity ≠
presentation per the CEO decision above. `warehouse-analysis-helpers.ts`: `getRowKey('size')`
keys by exact Size ID (`sizeRowKey`: `sizeId`, fallback `sizeName` only for id-less legacy
rows, then `—`); new `getRowLabel` presents the shared full label while every other
dimension keeps its key; `computeGroupData`/`computeMultiSeries`/`computeHierarchicalPivot`
thread labels without leaking raw IDs (new `seriesLabels` / `keyLabels` maps + optional
third arg on `formatG1Label` — pivot/CSV/Excel/stacked-chart displays consume them).
`stock-drill-drawer.tsx` sorts and renders by the full identity label with a discrete
colour dot (`StockRowColorDot`, POSColorDot pattern, hex-validated, additive). Transfer
report L78 composes `flatRowSizeLabel(item)` (new util flavour in
`utils/size-variant-label.ts`) with verified legacy outputs byte-identical; the
subproduct breakdown label went through `lineSizeLabel`. Consume-side typing is OPTIONAL
additive fields on `StockRow` / `WarehouseStockRow.size` / `TransferItem` — DRI-16's
server payload (since landed, see DRI-16 section above) activates them automatically;
six-tenant fixture evidence lives on DRI-16 per the brief. User-facing routes this task
proves (board pin): **`/warehouses/analysis`** (WarehouseAnalysis pivot → helpers
defect point 1) and **`/warehouses/[id]/analysis`** (LocationAnalysis →
selected-transfers-report defect point 3); two-variant DISTINCT-bucket evidence
(Emerald vs Ivory distinct + full labels) in
`docs/reports/dri6-warehouses-frontend-acceptance-2026-11-06.md`. Verification local:
warehouses dir 112/112 vitest green
(new DRI-17 suites for helpers + drill drawer, variant test for the report), tsc clean on
touched files (two unrelated pre-existing price-checker errors from a concurrent run).
No commit/deploy/production. Legacy beverage byte-identity was asserted:
pre-existing report `'750 ml / W1'` tests unchanged; drill legacy row renders bare
`70cl`, sorts identically.

**Continuation, 2026-11-06 (session rotation):** the acceptance note above claimed
stacked-chart displays consume `seriesLabels`, but the page left it unwired —
`warehouse-analysis/index.tsx` did not pass `seriesLabels` to `<StackedChart>`, so
stacked table headers/legends/tooltips showed raw Size IDs whenever `size` was the
second group-by. Landed the wire (now surface 3 of the acceptance report) plus a
regression in `warehouse-analysis/bar-layout.test.tsx` (stacked table shows
`m · Emerald`/`m · Ivory`, never `sz-*`). Re-verified: warehouses dir **113/113**
vitest green, `tsc --noEmit` clean on touched files (same two pre-existing
unrelated errors).

## /inventory extension — 2026-11-06 (board scope extension #7)

Board added the `/inventory` module to DRI-6 scope for the five retail types, with an
operator-verified sweep of **16 shared files emitting raw `sizeName`** (stock browser/
search/view/detail/history/location-report, adjustments entry, receipts, pricelist
print/preview/columns, dashboard + export).

**Repo re-verification (CEO, before fixing) — sweep validated, one correction:**
grep confirms 16 non-test files in `app/shared/inventory/` consume raw `sizeName`;
the flagged ref counts match exactly (`inventory-pricelist-print.ts` 12 refs incl.
`sizeName` sort keys at L661/L1244, `inventory-stock-search.ts` 8 refs). Correction:
`inventory-adjustment-entry-data.ts` itself carries **zero** raw `sizeName` — its
labels flow through `use-adjustment-entry.ts` L84, which already keys sizes by
`r.sizeId` (only its `label: r.sizeName` display needs the shared composer).

**Data-source tracing (CEO):** most of the sweep consumes payloads that DRI-16's
server work already activates or that need one mirrored addition:
- `/inventory` stock rows + dashboard stock data ← `warehouseStockService.getAllStock`
  — **already identity-ready** (DRI-16 emits `sizeId` + `colorName/colorHexCode/
  optionName` conditionally, emit-only-with-identity); the DRI-17 util flavours
  (`flatRowSizeLabel`, `lineSizeLabel`, `populatedSizeIdentity`) are the display path.
- Movement rows (`inventoryService.getAllMovements` → adjustments entry, receipts
  `sizeLabel`, dashboard movements, history scope labels) ← `inventoryService.getMovements`
  → `server/services/inventory.service.js` L718. **Real server gap:** the size populate
  is `.populate('size', 'displayName size')` — colour/option identity is absent, and the
  client fallback (`inventory-receipts-support.tsx` `sizeLabel`: `m.sizeName ??
  m.size?.displayName ?? m.size?.size`) drops "· Emerald"/"· Wi-Fi" for retail rows.
  Same defect class DRI-14 fixed on /purchases.
- Pricelist preview/print lines are composed client-side from stock rows
  (`inventory-pricelist-print.ts` L1213 `s.displayName || s.sizeName || s.size`),
  so pricelist identity inherits the stock payload — no separate pricelist server
  change needed for the browser view.
- Tenant-scoped `/api/pricelists` routes stay `requireOwnTenant`-gated
  (no `x-tenant-slug` pivot) — untouched.

**Decision (CEO):**
1. **Shared identity generalizes; stock rows switch to exact-Size-ID identity with
   the full shared labels.** No per-industry forks anywhere in `/inventory`; the
   exact `sizeId` is the identity/bucket key, `flatRowSizeLabel` the presentation;
   sizeless rows MUST still render (fallback `—`/bare strings preserved); legacy
   beverage rows byte-identical. Presentation ≠ identity per the DRI-17 decision.
2. **Pricelist PRINT output KEEPS emitting the stored `sizeName`** — no identity
   column, no client-side compose into print bytes (templates are byte-sensitive;
   precedent: `so-print.ts` and `bill-print.ts` stayed audit-only in DRI-14). The
   full shared label remains in browser views (preview/columns render composed
   labels; print keeps consuming the stored snapshot). If the board later wants
   variant identity inside the print layout, that is an explicit separate
   authorization. Sorting CSV/Excel/web-preview exports follows the browser-view
   rule (identity-aware) — only the server/HTML PRINT document keeps snapshot
   bytes for legacy rows and snapshot-only display for retail rows.
3. **`tenant_staff` custom-permission gate untouched** — middleware route-roles +
   customPermissions on /inventory stay exactly as they are.

**Delegation (per established split, DRI-2/DRI-6 children):**
- **Backend Engineer (first):** mirror DRI-16 additive Size fields into the
  `/inventory`-consuming payload path — `inventoryService.getMovements` size populate
  gains `colorName colorHexCode optionName` (emit-only-with-identity semantics: legacy
  rows keep their exact wire shape), same for any sibling movement feeds the module
  uses. Reuse the six-tenant stock fixture pattern
  (`server/__tests__/warehouseRetailTypes.mongo.test.js`) for the movements slice.
  No label re-composition server-side.
- **Frontend Engineer:** the 16-client-file sweep to exact-Size-ID keys + shared
  labels, sequenced AFTER DRI-17 (delivered 2026-11-06 — the util and consumption
  patterns it needs are landed). Concurrency note: the DRI-27 run is actively
  editing `services/inventory.service.ts`, several `shared/inventory/*` test files,
  and has untracked venue-inventory files (`VenueInventoryCount.js`,
  `venueInventory.mongo.test.js`) — audit-only on those mid-edit files; coordinate
  via commits.

Local/synthetic only; no commit/deploy/production. Coordination record:
`docs/superpowers/specs/RESUME-paperclip-business-expansion.md`.

**DRI-29 backend slice DELIVERED 2026-11-06** (evidence:
`docs/reports/dri29-inventory-movements-variant-identity-acceptance-2026-11-06.md`):
`inventoryService.getMovements` size populate now carries `colorName colorHexCode optionName`
(emit-only-with-identity; `getInventorySummary` untouched — not consumed by the module), plus a
load-bearing defect fix the fixture surfaced: `stockAdjustment.js` queried Size by `subProduct`
while models/Size.js stores `subproduct` — the real `/api/inventory/adjust` writer 404'd on every
call before the fix. Six-tenant movements fixture
`server/__tests__/inventoryMovementsRetailTypes.mongo.test.js` (DRI-16 pattern) proves distinct
per-`size._id` rows with verbatim identity on both consumed feeds, legacy movement rows
byte-identical (`_id/displayName/size` exactly), cross-tenant writes 404, projections
tenant-scoped. Flagged for the board (fail-closed, unreachable from /inventory UI): the
`/movements` adjustment-delegation path passes a raw ObjectId tenant into postStockAdjustment's
string-only regex (400). DRI-30 (frontend sweep) remains the dependent follow-up.

**DRI-30 frontend sweep DELIVERED 2026-11-06** (Frontend Engineer; evidence:
`docs/reports/dri6-inventory-frontend-acceptance-2026-11-06.md`): the 16-file
shared/inventory sweep to exact-Size-ID keys + shared labels landed with no
per-industry forks:
1. Stock rows (browser/search/view/detail/history/location-report/dashboard):
   Size buckets key by exact `sizeId` (`sizeName`→`—` fallbacks), all
   presentations, searchable surfaces, sorts and CSV cells consume
   `flatRowSizeLabel` (DRI-17 util; legacy rows byte-identical, sizeless rows
   keep `—`/empty fallback shapes).
2. Movement surfaces (`inventory-receipts-support.sizeLabel`, adjustments
   entry, history scope labels, dashboard movements): `populatedSizeIdentity` +
   shared composer with the exact legacy fallback chain preserved — ACTIVE now
   (DRI-29 populate landed before this run; DRI-29-flagged
   adjustment-delegation regex 400 remains open, unreachable from /inventory UI).
3. Pricelist: three sort sites identity-aware (new `pricelistSizeCmp`, exact
   sizeId tiebreak), `buildPricelistCsv`/preview compose the full label per the
   browser-view rule; the HTML print cells keep the stored `sizeName` bytes per
   the print decision (test-verified: print output never contains the composed
   identity). `tenant_staff` custom-permission gate untouched.
4. DRI-27's mid-edit files audit-only (additive movement typing on
   `services/inventory.service.ts` avoided via `populatedSizeIdentity(unknown)`).
   Verification: whole `shared/inventory` vitest dir 39 files / 364 tests green
   (DRI-27 held test files still pass unmodified); full-admin `tsc --noEmit`
   0 errors. Local only; no commit/deploy.

## BOARD CORRECTION — accommodation covers ALL businesses, 7-industry frame (2026-11-06)

Board comment `9d3ea157` (user-direct) corrects and retro-applies across this
record: **accommodation is for ALL the businesses, not just the five retail
types.** The canonical frame is `server/constants/industries.js`:

- 7 industry values: `beverage, hospitality, food-service, electronics, fashion,
  beauty, home`;
- 14 mapped business types (Wine Merchant, Spirit Importer, Beverage Brand,
  Liquor Store, Distributor, Bar/Lounge, Nightclub/Club, Restaurant, Hotel,
  Fashion Retail, Electronics Retail, Beauty & Skincare, Home & Living, General
  Retail) plus intentionally unmapped/`Other` tenants resolving to null =
  unprofiled → see everything;
- `Bar / Lounge` and `Nightclub / Club` carry
  `['beverage','hospitality','food-service']`; `Restaurant`/`Hotel` carry
  `['food-service','hospitality','beverage']` — multi-industry profiles.

**Retro-reading (no rework where coverage already exists):**
1. **Identity/labels** — the exact-Size-ID + shared-label treatment applies to
   beverage (volume/pack), hospitality and food-service (servings, portions,
   venue kitchen flows), the four retail industry profiles, and General Retail
   (all four trees). All label-identity decisions recorded above (DRI-13/14/16/
   17/29/30 and the /inventory decisions 1–3) hold unchanged; none of them
   forked per-industry, so the generalization is already industry-agnostic in
   code. Every prior decision that named only the five retail types is read as
   the 7-industry frame above.
2. **Fixtures** — the six/eight-tenant fixture pattern must include business
   types exercising EVERY flavour used by the surface under work: at least one
   beverage, one hospitality/food-service (Restaurant or Bar/Lounge — portions/
   servings kitchen-relevant flow per the recorded DRI-6 decision point), one
   retail (Fashion), plus an unprofiled legacy control. Current gap
   (CEO-verified 2026-11-06, after the /inventory acceptance): the
   retail-types Mongo fixtures (`inventoryMovementsRetailTypes.mongo.test.js` is
   the newest, DRI-16 pattern; siblings `warehouse`, `purchases`, `posReports`,
   `posRetailTypesAcceptance`) carry **5 retail verticals + ONE unprofiled
   legacy beverage control** — no profiled beverage tenant and no
   hospitality/food-service tenant. Fixtures extend where they did not cover;
   legacy control rows stay byte-identical.
3. Hospitality may exercise venue-serving and kitchen-relevant flows (kitchen
   screen relevance was already a recorded DRI-6 decision point).

**DRI-32 fixture coverage DELIVERED 2026-11-06** (Backend Engineer; evidence
`docs/reports/dri32-retail-types-fixture-industry-flavour-coverage-2026-11-06.md`):the five retail-types Mongo fixtures were extended with the two missing
flavours, per the matrix rule above:
1. **Profiled beverage tenant (`Wine Merchant` → `['beverage']`)** added to
   each fixture's matrix: colourless volume/pack rows (`750ml` volume_ml +
   `Case of 6` count_case, volumeMl present, NO colorName/colorHexCode/
   optionName) — the same identity-free shape the legacy control stores.
2. **Hospitality/food-service tenant (`Restaurant` → `['food-service',
   'hospitality','beverage']`)** added: two SAME-size portion rows
   (`size 'Regular plate'`, `unitType 'serving'`) carrying optionName identity
   only (`'Jollof portion'` / `'Goat portion'`). No new venue endpoints
   invented (no surface under these five has one to piggyback on).
3. Retail (Fashion) rows and every legacy control row **byte-identical** —
   legacy assertions untouched; per-flavour assertion branches extend the
   existing colour/option-only/identity-free shapes on every touched payload
   (movements feeds, warehouse stock/drill/breakdown/transfers, purchases
   PO/receive/return/bill/print, POS picker/sale/drawer, POS reports).
4. Wine Merchant rows take NO entry packaging on /purchases (the recorded
   legacy `bottle` print fallback stays byte-for-byte for packaging-less
   rows); Restaurant portion rows take the recorded entry default `'units'`.
5. **No defect surfaced** — the server label/identity code is
   industry-agnostic by design and every new row passed through unchanged
   code. Counts: five fixtures re-run in full **7/7**; the unprofiled legacy
   till control (`posTillAcceptance`) re-run **1/1** unmodified; focused plain
   suites (stockAdjustment, inventory histories, movement histories,
   retailVariantIdentity, posReportVariantParity, poReceive.helpers,
   vendorReturn.counters, purchaseAnalyticsLedger, warehouseTransferTotals)
   **75/75**. The DRI-7 till fixture grows 5 → 7 tenants (its unprofiled
   legacy control remains the byte-stable DRI-4 fixture); all other matrices
   6 → 8 tenants. The DRI-15 purchases-analytics test and the DRI-31
   movements-route test are unchanged focused pins, re-verified green.
   No commit/deploy (issue forbids); fixture files remain untracked like
   their pre-extensions siblings.

## /inventory ten-surface enumeration — 2026-11-06 (board scope extension #9)

Board comment `8adc1dd3` (user-direct) enumerates the ten /inventory operational
sub-surfaces, each in scope for ALL seven industries, with a per-surface
identity checklist children must evidence. CEO sweep verified each claim against
the repo before delegation:

| # | Surface | State (CEO sweep 2026-11-06) |
|---|---------|------------------------------|
| 1 | Transfers | Route `transfers/page.tsx` mounts `shared/purchases/stock-transfers-list` (DRI-7/DRI-14 verified pattern). Create composes via `sizeVariantLabel`; detail composes `subProductName – sizeName` (L804). Covered; child pins evidence: Emerald/Ivory do NOT merge in pickup/destination views over the real flow. |
| 2 | Receipts | `inventory-receipts-support.sizeLabel` identity-aware (DRI-30: `populatedSizeIdentity` + legacy chain). Partial-receipt-of-one-variant leaves siblings untouched — invariant proven in the DRI-14 purchases fixture. Child pins evidence. |
| 3 | Deliveries | movements family (`inventory-movements-browser` → detail/summary views) composes `sizeLabel` from receipts-support; DRI-29 payload feeds identity. Evidence-pin; child verifies no beverage-only default units in delivery views/exports. |
| 4 | Customer Returns | **REAL GAP both sides.** Server `services/customerReturns/browse.js` + `evidence.js` Size lookup projects `size, displayName` only — no `colorName/colorHexCode/optionName`; client `customer-return-list.tsx`/`customer-return-detail.tsx`/print `utils/print/customer-return.ts` render a bare `row.size`. Restock lever is the POS returns flow (`pos.controller.js`, orderItemIndex + sizeId — DRI-4-verified), so the /inventory surface here is read/label scope. |
| 5 | Internal | Same movements engine family as #3. Evidence-pin. |
| 6 | Adjustments | Entry keyed by exact Size row (`use-adjustment-entry` `r.sizeId`, DRI-30); writer stores exact size (DRI-29/31 verified). Child evidences the count-preview reflects per-variant. |
| 7 | Physical Inventory | Route mounts `InventoryStockBrowser mode="count"` — DRI-30 identity-aware rows keyed by exact sizeId; applied counts post to /adjust (exact Size writer, DRI-29). Child evidences count sheets list variants separately. |
| 8 | Scrap | Scoped preset set exists: types `['damaged','expired','theft','written_off']` (`inventory-movements-presets.ts` L162–170). **CEO decision:** the shared default set STANDS (covers beverage spoilage, retail damaged/defective, food-service spoilage, theft, write-offs — above any single industry); the per-industry mapping is this paragraph; no per-industry fork in the movement writer; industry-informed preset ordering UI is a separate possible board decision. |
| 9 | Procurement | **REAL GAP.** `server/services/reorder.service.js getReorderSuggestions` is SubProduct-aggregate (`$availableStock <= $reorderPoint`), no per-Size on-hand granularity, no Size identity in the payload; client `inventory-procurement.tsx` rows show sku/product only. The PO-raising handoff already goes to the /purchases verified pickers (DRI-14 size-identity) — the backend must supply per-variant suggestions with `sizeId` + identity (emit-only-with-identity) so those pickers receive exact Size rows. |
| 10 | Replenishment | **REAL GAP.** `ReorderRule.size` (ref Size) exists and `createRule` accepts `sizeId`, but the evaluation engine (`checkRules`, `triggerRule`) reads `subProduct.availableStock || totalStock` aggregate — never per-Size WarehouseStock on-hand — and `getRules`/`getRuleById` populate omits `size` entirely; client `inventory-replenishment.tsx` renders name/sku only (`ruleProduct`). |

**CEO decisions (this extension):**
1. No per-industry forks — same shared util/composer; emit-only-with-identity on
   all server payload additions; legacy/sizeless rows byte-identical.
2. Document prints keep stored snapshot bytes (precedent: pricelist print,
   so-print/bill-print). Customer-return document print keeps `row.size`
   (stored); browser list/detail get the shared identity label.
3. Scrap reason presets: shared default set stands (decision 8 above).
4. Reorder engine: rules keep SubProduct-aggregate behaviour when `rule.size`
   is absent (legacy byte-stable); per-Size on-hand evaluation (WarehouseStock)
   activates only for size-scoped rules — never breaks existing beverage
   volume/pack rules.
5. `tenant_staff` custom-permission gate / beverage-only `/platform` untouched.

**Delegated (review-gated per board requirement — children deliver evidence and
stop in `in_review` for the CEO gate before any of them is done):**
- **Backend slice** — customer-returns payload identity (mirror DRI-29,
  emit-only-with-identity); reorder suggestions per variant (per-Size on-hand +
  sizeId + identity fields); reorder-rule engine per-Size evaluation + `size`
  populate on rules; fixture coverage per the seven-industry matrix for both
  depths; evidence for checklist items 4/9/10 + the server half of
  1/2/3/5/6/7 (payloads).
- **Frontend slice** — customer-return list/detail shared identity label +
  restock-targeting display; procurement suggestion rows render variant
  identity; replenishment rule rows render the Size identity label; evidence
  per checklist items 1/2/3/5/6/7 (browser views) + 8 (no UI change required,
  documented mapping); `shared/inventory` vitest green + admin `tsc`.

**DRI-34 frontend slice CLOSED — CEO gate ACCEPTED 2026-11-06** (reviewer
comment 3ceac11b: independent re-verification — repo spot-checks, the 9 named
vitest suites 27/27 green, admin `tsc --noEmit` 0 errors; issue moved to
`done`). Follow-ups ride the follow-up delegation, NOT this slice: returns
restock-target server emit + `/purchases/create` consuming
`?subProduct=&size=`.

**DRI-34 frontend slice DELIVERED 2026-11-06** (Frontend Engineer; evidence
`docs/reports/dri34-inventory-ten-surfaces-frontend-acceptance-2026-11-06.md`,
full spec `docs/superpowers/specs/RESUME-dri34-inventory-ten-surface-frontend.md`;
moved to in_review per the CEO gate — LIVE-backend note: the parallel backend
slice (DRI-33: per-variant reorder suggestions + rules `size` populate +
customer-returns flat identity) landed in the shared tree mid-run and the
client composes match its emitted shapes):
1. **Customer returns (item 4 client) DONE** — list (desktop + mobile) and
   detail render `customerReturnSizeLabel` (new `customer-return-identity.ts`
   helper over the shared `flatRowSizeLabel`; identity-less rows resolve to
   the exact legacy `row.size` bytes). Print (`utils/print/customer-return.ts`)
   UNTOUCHED and test-pinned to stored snapshot bytes only. Restock-targeting
   wired to reserved additive fields (`restockSizeId`/`restockSizeName`) and
   silent until the payload exposes a target — recorded contract gap, no
   placeholder.
2. **Procurement (item 9) DONE** — `suggestionSizeLabel` renders the DRI-33
   per-variant label (sizeId + size/displayName + verbatim colour/option + packaging);
   sizeless rows byte-identical; size-scoped rows key `subProductId:sizeId`;
   per-row Raise PO link (`/purchases/create?subProduct=&size=`) rendered
   emit-only-with-identity — passing the exact picker identity pair; the
   /purchases read-side consumption is a flagged purchases-surface follow-up.
3. **Replenishment (item 10) DONE** — `ruleSizeLabel`: populated Colour/option
   Size → full shared label; populated identity-less beverage Size →
   displayName; rules without a Size keep today's exact bytes.
4. **Evidence sweep** (new focused vitest, per checklist item): transfers
   non-merge (detail + receive panel + transfer-print stored-bytes pin),
   receipts sizeLabel + partial-receipt sibling-untouched,
   deliveries/internal identity rows + no beverage-only default units,
   adjustments exact-sizeId keys + per-variant count previews (never
   aggregate), physical inventory count sheets per exact Size row with
   per-Size applied counts, scrap presets pinned unchanged
   (['damaged','expired','theft','written_off']). Counts: DRI-34 suites
   9 files / 27 tests; shared/inventory dir 47 files / 388 tests green;
   shared/inventory + shared/purchases 77 / 576; full-admin tsc 0 errors.
   Local/synthetic only; no commit/push/deploy.

**DRI-33 backend slice DELIVERED 2026-11-06** (Backend Engineer; evidence
`docs/reports/dri33-inventory-returns-procurement-replenishment-backend-2026-11-06.md`;
moved to in_review per the CEO gate — pairs with the DRI-34 frontend slice above,
whose client composes match these payload shapes):
1. **Customer returns (item 4 server) DONE** — `customerReturns/evidence.js` Size
   $lookup now carries `colorName colorHexCode optionName` verbatim; emit-only-with-
   identity via `$cond → $$REMOVE` (legacy rows AND the identity-free beverage
   volume/pack rows keep the exact pre-change row shape, byte-identical). The POS
   returns restock lever (`pos.controller.js`, orderItemIndex + sizeId) untouched;
   this is the /inventory read/label payload only. DRI-34's reserved
   `restockSizeId`/`restockSizeName` fields stay UNEMITTED per the recorded scope
   (read/label only) — if the board wants restock targeting from the /inventory
   browse surfaces, that is a separate authorization.
2. **Procurement (item 9 server) DONE** — `reorder.service.getReorderSuggestions`
   is per-variant: one suggestion per exact Size row from WarehouseStock
   `(currentQuantity - reservedQuantity)` summed over warehouses, with
   `sizeId`+`size`+`displayName`+verbatim identity (emit-only-with-identity),
   per-variant reorderPoint (Size `reorderLevel` → subProduct fallback) and
   recomputed urgency/suggestedQuantity, gated per variant. Sizeless rows keep the
   exact aggregate mapping; a bounded (200) catch-up scan surfaces size-row
   subProducts whose aggregate no longer describes their variants; subProducts with
   size rows but no WarehouseStock keep the aggregate representation. The /purchases
   DRI-14 pickers receive the exact rows they consume (sizeId, size display data,
   unitType, unitsPerPack) — their selection logic is not duplicated.
3. **Replenishment (item 10 server) DONE** — `getRules`/`getRuleById` populate
   `'size', 'displayName size colorName colorHexCode optionName'` (DRI-29 mirror);
   the engine (`checkRules`/`triggerRule`) reads per-Size WarehouseStock on-hand for
   size-scoped rules over the rule's warehouse scope (no WS row for the Size →
   persisted per-Size availableStock as the degraded source); SIZELESS RULES AND ALL
   EXISTING BEVERAGE VOLUME/PACK RULES KEEP BIT-IDENTICAL BEHAVIOUR (recorded CEO
   decision; no extra query runs for them). Sales velocity STAYS subProduct-level —
   `Size.salesVelocity` exists in the schema but per-Size velocity evaluation is
   left coarse by design (state for the board as possible follow-up).
4. **Server-half payload pins (items 1/2/3/5/6/7)** — the movements fixture's third
   test seeds real received/sold/damaged/transfer-pair rows per exact Size plus
   real adjustment writes and pins distinct exact-sizeId identity on every consumed
   feed: unscoped (dashboard/exports/scrap source), `?scope=internal`,
   `?category=out` (deliveries), `?category=in` (receipts), `?scope=adjustments`
   (picker + summary counts). Transfers lines/receipts/purchases stay pinned by the
   re-run DRI-14/DRI-16/DRI-32 fixtures.
5. **Fixture coverage** — DRI-33 adds `customerReturnsRetailTypes.mongo.test.js`
   (returns identity walk), `reorderProcurementRetailTypes.mongo.test.js`
   (procurement + rules engine walk) and the shared 8-tenant matrix module
   `__tests__/fixtures/dri33VariantMatrix.js`; the movements fixture grows a third
   test. Counts: new fixtures 2/2 + movements 3/3; shared-matrix fixtures re-run
   1/1 · 1/1 · 1/1 · 2/2 · 1/1 (warehouse/purchases/posRetail/posReports/till);
   focused plain suites 59/59; full server suite 5082 tests → 5054 pass / 2 fail /
   22 env-skipped / 4 runner-cancelled — the only persistent failure is a
   PRE-EXISTING committed inconsistency unrelated to this slice (kiosk pairing in
   `socket/index.js` accepts tokenless sockets while the committed
   `posSocketGateway` test still expects rejection — flagged atomically, not in
   scope). Two atomic flags recorded: generic `/api/inventory/movements` +
   `/api/inventory/transfer` writers still drop `size` (not part of the checklist
   writer set; fail-safe), and per-Size velocity follow-up above. Local/synthetic
   only; no commit/push/deploy; new fixture files remain untracked like their
   pre-extensions siblings.

## /inventory read surfaces enumeration — 2026-11-06 (board scope extension #10)

Board comment `ae8ec528` (user-direct) adds the four READ/reporting surfaces, each
bound to all seven industries: (11) Stock, (12) Locations, (13) Valuation,
(14) Moves History. CEO sweep, each enumerated claim verified against the repo:

- **11 Stock** — already identity-aware (DRI-30 delivered): `inventory-stock-view.ts`
  (`flatRowSizeLabel` in the CSV `Size` column, totals per StockRow line),
  `inventory-stock-browser.tsx` (label `flatRowSizeLabel(r) || r.sizeName`, exact-Size
  mutation path uses `sizeId`), `inventory-stock-detail-panel.tsx`
  (`['Size', flatRowSizeLabel(row)]`, sizeless badge kept). The board's instruction that
  the byte-for-byte note applies ONLY to legacy sizeless rendering is satisfied by the
  compose-over-fallback shape: retail rows get full identity, colourless rows resolve to
  stored `sizeName` byte-for-byte via `sizeVariantLabel`. `inventory-stock-filter-panel.tsx`
  has zero size references — its filters can never merge siblings.
- **12 Locations** — already identity-aware: `inventory-location-report.ts` imports and
  composes `flatRowSizeLabel` (the board's "reads raw sizeName today" was
  pre-remediation), search fields include it; grouping keeps per-variant rows distinct
  per warehouse (rows = per StockRow lines), warehouse/unit/value sorting unchanged →
  beverage rows byte-identical; `inventory-locations.tsx` consumes
  `locationReports(warehouses, stock)`.
- **13 Valuation** — verified, no merge anywhere: server `getInventoryValuation`
  (server/services/inventory.service.js L935) iterates per-line
  `warehouseService.getAllStock` rows (SubProduct+Size+warehouse lines, DRI-16 identity
  payload); value math is `currentQuantity * costPrice` per line, retail
  `currentQuantity * sellingPrice`, cost basis the stored SubProduct costPrice; NO
  sizeName-keyed bucketing in the aggregation. The client `/inventory/valuation` page is
  `InventoryStockBrowser mode="valuation"` — the SAME identity-aware browser as the
  stock surface (exact-Size-ID rows). Emerald/Ivory cannot merge a value bucket. The KPI
  response carries totals only; the SubProduct-aggregate branch is the
  zero-WarehouseStock fallback only (KPI sums, not a per-variant representation). No
  code change needed.
- **14 Moves History** — already identity-aware: `inventory-stock-history.ts` composes
  line-scope labels via `flatRowSizeLabel(row) || row.sizeName` (L105) and move rows via
  `sizeLabel(move)` (L126); `-panel.tsx` mirrors both (L122/L186); server `getMovements`
  carries full identity (DRI-29). No history row can be ambiguous between colour
  siblings.

**CEO decisions recorded (same pattern as extensions #7–#9):**
1. Items 11–14 need NO code change — all four surfaces are already exact-Size-ID with
   the shared label util; they are evidence-only additions riding the ten-surface
   children's follow-up. No per-industry forks.
2. Legacy/sizeless rows byte-identical everywhere (compose-over-fallback shape held).
3. Valuation stays a server KPI-only endpoint — no per-Size breakdown payload added;
   the drill-down is the client browser, already exact-Size-ID. A per-Size valuation
   breakdown payload would be a separate explicit board decision.
4. `tenant_staff` custom-permission gate untouched.

**Delegation:** items 11–14 evidence rides two NEW review-gated children (backend KPI
payload pin for valuation per-Size rows in the existing fixture family; frontend
browser-view evidence for 11/12/13/14 in the established vitest patterns), created
under DRI-2.

**DRI-36 frontend slice DELIVERED 2026-11-06** (Frontend Engineer; evidence
`docs/reports/dri36-read-surfaces-browser-evidence-2026-11-06.md`; moved to
in_review per the CEO gate — issue status in_review, awaiting
`request_confirmation` bound to the DrinksHarbour CEO review gate): NO UI
code change, per recorded decisions 1–4 — browser-view evidence in the
DRI-34 vitest patterns over the four read surfaces, each in the seven-industry
flavour matrix (DRI-34 rows: 750ml + Case of 6, portion siblings by
optionName, M/Emerald vs M/Ivory, option-only electronics/home, legacy
control): (11) Stock — real browser render (composed identity on every row,
legacy Size cell byte-identical) + `stockViewCSV` Size column pin +
`groupStockRows` exact-sizeId bucket pin + static filter-panel zero-size pin;
(12) Locations — `locationReports` per-variant rows distinct per warehouse
(Emerald/Ivory never merge; units additive), real `InventoryLocations` render
with variant-label search keeping the whole warehouse group intact, sorting
unchanged for colourless/legacy; (13) Valuation — `InventoryStockBrowser
mode="valuation"` per-line values keyed by exact Size (Emerald ₦1,500 vs
Ivory ₦1,600, never a sizeName bucket), no new print/payload surface touched
(decision 3); (14) Moves History — `StockHistoryPanel` exact-Size line scope
(siblings excluded), per-variant composed identity on every move row,
legacy scope-line + print-meta bytes identical. Counts: DRI-36 suites 4
files / 14 tests green; shared/inventory dir 51 files / 402 tests green
(DRI-34 baseline 47/388); admin `tsc --noEmit` 0 errors. One atomic flag
reported unpinned: `utils/print/stock-print.ts` `buildStockDoc` renders the
Size column as bare `r.sizeName || '—'` (pre-existing, outside the four
enumerated surfaces; composition there is a separate board decision).
Local/synthetic only; no commit/push/deploy.

## /inventory read surfaces backend confirmation — 2026-11-06 (board scope extension #10, DRI-35 backend child)

DRI-35 delivered the server halves of items 11–14, evidence-only on the feeds; no server
source edits. NEW `__tests__/inventoryValuationRetailTypes.mongo.test.js` (extends the DRI-33
fixture family unmodified) pins through the real `GET /api/inventory/valuation` router that
the KPI (totalItems 2 · totalUnits 18 · totalValue 26 000 for the profiled matrix; legacy
control totalUnits 15 · totalValue 25 000 per the board example walk) is computed **per-line**
from the exact per-Size `getAllStock` rows — retail rows share one sizeName string, so any
sizeName/subProduct/aggregate bucketing provably changes the numbers — with the exact
pre-change five-key KPI shape on both branches, and the `cacheReport` caching contract proven
per-tenant (scope `tenant:<id>` + canonical principal; cached KPI equals fresh; `?refresh`
bypass; no cross-tenant conflation). Items 11/12/14 feed confirmation: re-ran
`warehouseRetailTypes.mongo.test.js` **1/1** (stock/all rows exact-Size-ID, drill rows by
exact sizeId, legacy rows byte-identical) and `inventoryMovementsRetailTypes.mongo.test.js`
**3/3** (movements identity on every scope feed) — no payload gap on those feeds. **Gap
flagged atomically (NOT fixed):** the zero-WarehouseStock fallback aggregate reads
`$sellingPrice`, a field that does not exist on SubProduct (schema stores
baseSellingPrice/salePrice), so a real fallback tenant is pinned emitting
`totalRetailValue: 0` and `potentialProfit: −totalValue`; a one-field
(`$baseSellingPrice`) fix awaits a board decision. Valuation stays KPI-only — no per-Size
breakdown payload (separate explicit board decision). Full evidence:
`docs/reports/dri35-inventory-read-surfaces-valuation-pin-2026-11-06.md`.

**Gate outcome (2026-11-06):** the DRI-35 CEO review-gate confirmation card
(`request_confirmation` f90779cc) was **accepted by the board** at 19:02Z — the slice is
confirmed as-is and DRI-35 closed `done`. The acceptance confirms the slice, NOT the fix:
the one-field fallback edit is now held in **DRI-37** ("Valuation KPI fallback: fix
zero-WarehouseStock retail aggregate to $baseSellingPrice", child of DRI-35), parked
`in_review` at its own human-only go/no-go confirmation card (`request_confirmation`
6979ba6a). No `inventory.service.js` edit happens unless that card is accepted; on accept,
implementation follows DRI-37's self-contained description.

## DRI-36 CEO review gate CLOSED — 2026-11-06 (board scope extension #10 complete)

The DrinksHarbour CEO review gate on the DRI-36 frontend browser-view evidence child was
closed with independent verification (not delegate claims):

- **Repo spot-checks:** all four test files assert exactly the claimed behavior — exact
  `sizeId` grouping buckets, composed `flatRowSizeLabel` identity on every flavour row,
  legacy `'75cl'`/stored-`sizeName` byte pins, CSV Size column compose-over-legacy,
  Emerald/Ivory never merged in grouping/search/valuation, per-variant location rows
  distinct per warehouse, history line-scope excludes same-size siblings,
  `inventory-stock-filter-panel.tsx` has zero size refs. No production/UI code change in
  the slice (evidence-only, per recorded decisions 1–4).
- **CEO re-runs:** DRI-36 suites **4 files / 14 tests pass**; full `app/shared/inventory`
  regression **51 files / 402 tests, 0 fail**; admin `tsc --noEmit` **0 errors**.
- **Atomic flag verified real, stands recorded:** `src/utils/print/stock-print.ts` L55
  renders the Size column as bare `r.sizeName || '—'` on the stock PRINT doc — pre-existing,
  outside the four enumerated read surfaces. Any identity composition on that print surface
  is a separate explicit board decision only.
- **DRI-35** was earlier closed `done` via its board-accepted confirmation card (19:02Z);
  the `$sellingPrice` fallback fix remains parked in DRI-37 at its own human-only card.

Board scope extension #10 (read surfaces 11–14) is fully evidence-backed. DRI-2 stays
`in_progress` (scheduled monitor 21:45Z + board-comment wake path); release gates unchanged.

## Monitor check — 2026-11-06 19:48Z (extension #11 residual + DRI-12 liveness)

Scheduled monitor check on DRI-2 (consume-only, no new board input). Findings:

- **DRI-12** (`/sales` server verification + six-tenant fixture, Backend Engineer):
  `in_progress`, no activity since the 03:06Z CEO dependency cleanup (~17h), with NO wake
  path of its own (no monitor, no scheduled retry). Liveness action: targeted
  status/evidence request posted on DRI-12 at 19:48Z (Paperclip comment 70076ed3) — that
  comment is DRI-12's wake path. DRI-12 remains the open direct child on DRI-2, so
  `issue_children_completed` cannot fire until it reaches a terminal state.
- **DRI-37** (valuation KPI `$baseSellingPrice` one-field fix, child of DRI-35):
  `in_progress`, still correctly parked on its human-only go/no-go card
  (`request_confirmation`, `pending` as of 19:48Z). Not closed past the card; card
  resolution wakes its assignee.
- **Standing atomic flags unchanged:** restock-target fields on returns payload;
  Raise-PO query consumption on /purchases create; stock-print Size column decision.
- **Extension #11 (read surfaces 11–14)** remains fully evidence-backed (per DRI-35 +
  DRI-36 gates below); nothing re-verified.

**Monitor bookkeeping:** the reschedule write FAILED — all monitor-reschedule PATCHes
returned 422 `Monitor bounds are already exhausted` (max_attempts_exhausted), including
after clearing `executionPolicy.monitor`. `monitorNextCheckAt` is null; no scheduled
monitor exists. Record: Paperclip comment 94d6eb47 on DRI-2. Retry scheduling on a future
wake once the exhausted window (timeout 23:45Z) expires. Live wake paths meanwhile: board
comments + open-children completion wakes + the DRI-12 nudge.

Release gates unchanged. No production activation, migration, policy change, commit, or push.
