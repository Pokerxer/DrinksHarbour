# DRI-15 — `/purchases/analytics`: exact-Size-ID by-vendor grouping fix (Emerald vs Ivory conflation)

_DRI-6 board scope extension #5 · Backend Engineer · 2026-11-06 · DRI_EVIDENCE below._

## Scope (CEO decisions on record — `docs/memory/pos-retail-accommodation.md`, "/purchases/analytics defect fix — 2026-11-06")

- Fix the REAL defect (not test-cover only): `getPurchaseAnalyticsByVendor` grouped
  `sizeBreakdown` by the stored `item.sizeName` string and `productBreakdown` by
  `item.subProductName`, conflating same-size colour variants ("M · Emerald" vs
  "M · Ivory" — distinct Size rows with distinct stock/money).
- Labels via shared `size-variant-label` parity; text labels suffice (no swatch work).
  Identity fields ride on rows so swatches can come later without another server change.
- No bill/receipt cross-views in this package.
- Legacy beverage rows byte-identical fallback.
- `getPurchaseAnalyticsSummary` is variant-agnostic — explicitly NO change.
- Local/synthetic only; no commit/deploy/production.

## Fix (`server/controllers/purchaseOrder.controller.js` — `getPurchaseAnalyticsByVendor` only)

1. **Bucket keys are exact ids** — `sizeBreakdown` keys on `String(items.sizeId)`,
   `productBreakdown` keys on `String(item.subProductId)`, per the established
   `vendorReturn.quantities.js` / `poReceive.helpers` matching semantics
   (exact `subProductId`+`sizeId` identity, PO-line validation precedent). Legacy rows
   lacking an id fall back to the stored snapshot string (`item.sizeName || 'Default'`,
   `item.subProductName || 'Unknown'`) — byte-identical to the pre-fix grouping.
2. **Labels via shared parity** — the analytics query now populates
   `items.sizeId` (`size displayName colorName colorHexCode optionName`, the DRI-14
   identity-field availability mirrored) and sizes-with-variant-identity
   (colour/option present) label through the same `sizeVariantLabel` compositor
   POS reporting already uses (`server/services/posReportOrder.service.js` — semantics
   of the client util `client/apps/admin/src/utils/size-variant-label.ts` /
   `lineSizeLabel`); every other row keeps its stored snapshot label exactly as before.
3. **Identity fields on rows** — rows whose populated Size carries variant identity
   gain `colorName` / `colorHexCode` / `optionName` so client swatch rendering can be
   added later WITHOUT another server change. Conditional spreads only: rows without
   identity (all legacy rows) keep the pre-fix shape `{ sizeName, quantity, amount }`
   byte-identically (`productBreakdown` rows keep `{ productName, quantity, amount }`).
   No cache key changes; `cacheReport` wrapping and the tenant gate untouched.
   `getPurchaseAnalyticsSummary` untouched (asserted in the fixture).

## Verification (real routers + real models on disposable replica-set Mongo :29127)

`server/__tests__/purchasesRetailTypes.mongo.test.js` extended with
`purchases_analytics_by_vendor_buckets_by_exact_ids_legacy_fallback_byte_parity`
(same disposable-Mongo pattern as DRI-14's E2E test, separate db):

- **Fashion tenant**: one PO, three lines — Emerald Size (qty 2, packPrice 200) and
  Ivory Size (qty 3, packPrice 150) on the same SubProduct, plus a TWIN SubProduct
  with the same display name (qty 4, packPrice 50); all three lines store the identical
  snapshot `sizeName: 'M'` (the defect shape). By-vendor response returns THREE
  separate `sizeBreakdown` buckets (pre-fix: one bucket, 9 units / 400 mixed) with
  correct money/quantity and the composed labels; identity fields on the colour rows;
  the identity-free twin row falls back to the snapshot label AND byte-identical shape.
  `productBreakdown` returns TWO rows at the identical `subProductName` (pre-fix: one
  merged row of 9 units) — main SubProduct aggregates its two colour variants
  (5 units / 350), twin keeps its own (4 units / 50).
- **Legacy control**: sizeless row (sizeName matching no Seed → no id resolvable) is
  byte-identical `{ sizeName, quantity, amount }` (key/label/shape); the legacy row
  WITH a Size id but no colour identity keeps the snapshot label/shape too;
  `productBreakdown` aggregates unchanged.
- **Tenant gate**: each tenant's response contains only its own vendor; no
  foreign-tenant bucket label (verified both directions of the seam).
- **Summary endpoint unchanged** (asserted): same stored-snapshot grouping shapes as
  pre-fix (board's explicit no-change scope).
- **Suites**: full fixture file 2/2 pass (DRI-14 E2E + new analytics test, 8
  DRI_EVIDENCE lines total); focus suites `poReceive.helpers`, `vendorReturn.counters`,
  `retailVariantIdentity`, `warehouseTransferTotals`, `purchaseAnalyticsLedger`
  (nav/list analytics) → 53/53; neighbors `vendorReturn.quantities`,
  `analytics.routes`, `purchaseOrder.creator`, `restockPurchasePrefill` → 12/12.

Note on composed labels in the evidence: the fixture deliberately seeds
`Size.displayName` as the already-composed variant label (DRI-14 seeding choice), so
the analytics row label composes over that stored displayName exactly the way DRI-14's
bill-print/receive-chips parity already composes over the same rows. Production
`Size.displayName` is a plain client-supplied label (or falls back to `size`), so
production rows compose once (`Medium · Emerald · Emerald gown`).

## Checks (2026-11-06)

```
# Focused new analytics test + full DRI-14 fixture file (real routers/models):
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/purchasesRetailTypes.mongo.test.js
# → tests 2 / pass 2 / fail 0

# Focus + neighbor suites:
cd server && node --test __tests__/poReceive.helpers.test.js __tests__/vendorReturn.counters.test.js \
  __tests__/retailVariantIdentity.test.js __tests__/warehouseTransferTotals.test.js __tests__/purchaseAnalyticsLedger.test.js
# → tests 53 / pass 53 / fail 0
cd server && node --test __tests__/vendorReturn.quantities.test.js __tests__/analytics.routes.test.js \
  __tests__/purchaseOrder.creator.test.js __tests__/restockPurchasePrefill.test.js
# → tests 12 / pass 12 / fail 0
```

## DRI_EVIDENCE

```
DRI_EVIDENCE {"issue":"DRI-15","phase":"purchases_analytics_variant_buckets","environment":"isolated purchases analytics fixture: real purchaseOrder router + real models on disposable replica-set Mongo (:29127)","tenantIdA":"6aed4ebb7c7bab0f13bfa174","tenantIdB":"6aed4ebf7c7bab0f13bfa198","sizeBucketKeys":"exact Size id with legacy sizeName fallback","fashionSizeRows":[{"sizeName":"Signature gown — Emerald · Emerald · Emerald gown · Emerald · Emerald gown","quantity":2,"amount":200,"colorName":"Emerald"},{"sizeName":"Signature gown — Ivory · Ivory · Ivory gown · Ivory · Ivory gown","quantity":3,"amount":150,"colorName":"Ivory"},{"sizeName":"M","quantity":4,"amount":50,"colorName":null}],"fashionProductRows":[{"productName":"Skyline Ankara Gown","quantity":5,"amount":350},{"productName":"Skyline Ankara Gown","quantity":4,"amount":50}],"legacySizeRows":[{"sizeName":"Legacy Lager 750ml","quantity":2,"amount":500},{"sizeName":"Beer Bottle 750","quantity":6,"amount":300}],"summaryUnchanged":[{"sizeName":"M","totalQuantity":9,"totalAmount":400,"orderCount":3}],"tenantGate":{"foreignVendorVisible":false,"foreignBucketsLeaked":0}}
```

Reading of the evidence: the two same-size colour Size rows (Emerald qty 2 / 200 and
Ivory qty 3 / 150 under the identical stored snapshot `'M'`) land in separate buckets
with their own money and the composed identity labels; the twin SubProduct with the
same display name keeps its own size and product buckets; both legacy rows are
byte-identical to the pre-fix rows (`{ sizeName, quantity, amount }`, no identity
keys); the summary endpoint's grouping is untouched; no foreign-tenant bucket or
vendor leaked.

## Out of scope (note-only, per the recorded decision)

- **`VendorBill.matchingDetails` persistence defect stays OPEN**: `vendorBill.controller.js`
  `validateBill` composes a `subProductId::sizeId` composite-key
  matching breakdown (itemComparisons / sizeBreakdown) that is never persisted —
  Mongoose casts drop the absent subpaths at assignment (confirmed by DRI-14's audit,
  see `docs/reports/dri6-purchases-module-acceptance-2026-11-06.md`). Real persistence
  defect but a separate, unauthorized scope — pending board authorization; NOT touched
  here (the fixture only proves composite keys against the payloads matching composes from).
- Client swatch rendering of the new `colorName`/`colorHexCode`/`optionName` row
  fields (data provision only in this package; CEO decision: text labels suffice now).
