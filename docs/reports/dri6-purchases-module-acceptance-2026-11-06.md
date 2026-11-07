# DRI-14 — /purchases module: pack-noun defaults, label consistency, six-tenant fixture (DRI-6 extension #4)

**Date:** 2026-11-06 · **Issue:** DRI-14 (parent DRI-6, ancestor DRI-2) · **Mode:** local, synthetic-only — no commit, no push, no deploy, no production action, no real tenant data.
**Agent:** DrinksHarbour Backend Engineer · workspace concurrently held by the DRI-6 parent run (f93fe236).

## What was delivered

Per the board extension (CEO decision on record in `docs/memory/pos-retail-accommodation.md`,
"/purchases extension — 2026-11-06" — *shared purchasing generalizes: no per-industry gates, no
per-industry UOM sets*), the last three /purchases defects were closed at their shared sources.

### Deliverable 1 — pack-noun default at line entry (no print branch)

`packNounOf()` kept its legacy `'bottle'` contract byte-for-byte (rows that lack packaging text still
fall back to `'bottle'`, so beverage print bytes are unchanged). What changed is the wire: **new retail
POs now carry an explicit industry-neutral packaging string at line entry**, which all existing prints
already consume via `packNounOf(item.packaging)` — no industry branch anywhere in print code.

- `client/apps/admin/src/app/shared/purchases/types.ts`
  - `PACK_NOUNS` gains `'unit'`/`'piece'` **only as consumers** of the neutral strings (the fallback
    stays `'bottle'`); `packNounOf('units') → 'unit'`, `packNounOf('pieces') → 'piece'`.
  - New pure helper `defaultPackagingForLine(size)` — the single entry-time rule: a Size row carrying
    retail variant identity (colour/option data, which every beverage Size row never carries per
    `server/models/Size.js` "absent on legacy rows and every beverage size") gets `'pieces'` when its
    `unitType` is `'piece'`, else `'units'`; every other row returns `undefined` and stays byte-identical
    to the legacy behavior. No industry name appears anywhere in the rule.
- Entry sites wired (2–3 line edits each; all mid-edit files got the minimum churn):
  - `shared/purchases/purchases-create.tsx` — the create-wizard picker (`ProductSearch`) maps
    variant fields through `mapProducts`, passes `packaging` down the `onSelect` channel, stores it on
    `LineItem.packaging`, and the save payload already spreads it (persisted as
    `items[].packaging`, `server/models/PurchaseOrder.js` L209).
  - `shared/purchases/purchases-product-line-search.tsx` (scan-drawer's manual pick) and
    `shared/purchases/purchases-scan-selection.ts` (`PurchaseLineOverride`/`PurchaseLineDraft` +
    `scanRowToPurchaseLine`) — scanned/manual retail lines get the same default.
- **Audit-only (no change, per instruction):** `utils/print/so-print.ts:177` still hardcodes `'bottle'`.
  The hardcoded noun cannot be sourced from stored packaging without changing legacy bytes: SO lines
  store `uom` as **plural upper-case packaging words** (`'Cases'`, `'Cartons'` — `server/models/SalesOrder.js`
  L25), and sourcing from those would rewrite legacy rows ('Cartons' → 'carton'). SO entries are not part
  of this issue's picker/create path; flagged for the next purchases/sales pass instead.

### Deliverable 2 — label consistency (return-create · receive preview · bill print)

Three surfaces composed labels from the raw stored `sizeName`, dropping colour/option identity for
retail variants whose `sizeName` snapshot was server-enriched as the raw size code. All three now
compose through the shared client formatter with the **stored snapshot staying authoritative** — no data
changed, no server label strings re-composed (snapshot policy):

- New shared helpers in `utils/size-variant-label.ts` (untracked file created by earlier DRI runs, now
  extended, not forked):
  - `populatedSizeIdentity(sizeRef)` — narrows a possibly-populated Size ref to identity fields;
  - `lineSizeLabel(line, size?)` — compose `sizeVariantLabel(size)` **only when the Size identity carries
    variant data** (colour/option); otherwise return `line.sizeName` byte-for-byte. Legacy beverage rows
    (no colour/option) therefore render byte-identical before/after.
- Server populates extended by four identity fields each (`displayName colorName optionName` — data
  provision, not label composition):
  - `server/controllers/purchaseOrder.controller.js` — `getPurchaseOrder` (`items.sizeId`, already a
    populated object) and `getPurchaseOrders` (list payloads for the receive-preview chips);
  - `server/controllers/vendorBill.controller.js` — `getVendorBill` now populates `items.sizeId` with an
    explicit `model: 'Size'` (bill line `sizeId` carries no ref), so `buildBillInvoice` can compose.
- Surfaces aligned (each renders the composed label when identity exists, snapshot otherwise):
  - `shared/purchases/purchases-receive.tsx` — preview chips (~L382);
  - `shared/purchases/purchases-return-create.tsx` — product cell `· {label}` + size column (~L916–931);
    its create payload also normalizes `sizeId` through the existing `refIdOf` guard (populated-object
    round-trip hazard, same rule purchases-edit applies);
  - `utils/print/bill-print.ts:12` — the ` – ` row suffix composes via the helper.
- **Audit-only (no change, per instruction):** the "(size)" bracket string in
  `vendorBill.controller.js` L415 `getItemDisplayName` (+ the validation/size-breakdown messages at
  L502/562) — these are server-composed display strings, which the snapshot policy forbids re-composing.
  Flagged in Findings.

### Deliverable 3 — six-tenant purchases fixture

New opt-in Mongo fixture `server/__tests__/purchasesRetailTypes.mongo.test.js` (DRI-10/DRI-12 pattern;
DRI-4/DRI-7/DRI-10/DRI-12 fixtures NOT modified): five retail types **+ one legacy beverage control**,
walked over the real HTTP path (`purchaseOrder.routes` / `vendorReturn.routes` / `vendorBill.routes`
behind `protect` + `attachTenant` + `requireOwnTenant` + the `purchase_orders` plan gate):

1. **PO create** — every line with the exact `sizeId`, composed `sizeName`, byte-exact `subProductName`
   and the entry-time `packaging` (`'pieces'` fashion / `'units'` elsewhere / absent on the legacy wire).
2. **Partial receive** of one variant only → status `partially_received` (the completing/receipt is the
   explicitly optional second step, exercised after the invariant).
3. **Validate** (posting step) — `WarehouseMovement`/`adjustStock` posted **only for that exact size**
   (exactly one `received` movement, quantity/balances asserted; the unified `InventoryMovement`
   mirror too), and **the sibling variant's raw `WarehouseStock` document is JSON-byte-unchanged**. A
   second receipt then completes the PO (`received` → `validated`) and posts the remaining deltas
   (A: 2 then 3; B: 5) — no double-posting thanks to `postedQty`.
4. **Vendor return of part of the received qty** — draft item carries `subProductId + sizeId`; on
   confirm `validatePurchaseReturn` matches quantities on `subProductId + sizeId`, stock leaves for the
   exact size (`return_out`), PO counters sync once (`receivedQty`/`postedQty` −1, `returnedQty` +1,
   `poCountersAdjusted`), and **an over-return is rejected** (400, "Cannot return more than the matching
   received purchase stock") with stock/counters untouched.
5. **Bill from receipts** (received policy) — bill items carry `subProductId::sizeId` composite identity
   (per-line, no cross-variant collision; every variant appears), `sizeId/sizeName/subProductName`
   snapshots byte-exact, money = the counter-authoritative received qty − the confirmed return at line
   unit cost, tax-free, in the PO's **original currency** (the electronics tenant is seeded with a USD PO
   + a USD→NGN 1500 `ExchangeRate`; the bill keeps USD figures — the exchange-rate path is untouched and
   never converts).
6. **Print payloads** — `GET /purchase-orders/:id` (`buildPOInvoice` input) carries
   `subProductName/sizeName/packaging` snapshots; retail rows print the neutral noun the new default
   produced; legacy rows print exactly as before (`packaging` absent → `'bottle'` fallback, label with
   no variant separator).
7. **Tenant isolation at every stage** — foreign catalog PO create 400; foreign PO read/receipt/status/
   create-bill 404; foreign bill read/validate 404; a return draft referencing a foreign PO is refused at
   confirm (400 "Purchase order not found in this tenant") and tenant B's stock stays byte-equal.
8. **Legacy beverage control byte-identity** — labels, packaging absence, movement shapes and bill money
   all asserted against pre-change oracles (label = the composed legacy string, no ` · ` separator).

## Commands and results (exact)

```bash
# Focused server suites required by the issue (all pure, no Mongo)
cd server && node --test __tests__/poReceive.helpers.test.js __tests__/vendorReturn.counters.test.js \
  __tests__/retailVariantIdentity.test.js __tests__/warehouseTransferTotals.test.js
# → tests 51 / pass 51 / fail 0

# DRI-14 six-tenant purchases fixture (opt-in Mongo)
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/purchasesRetailTypes.mongo.test.js
# → tests 1 / pass 1 / fail 0  (7 DRI_EVIDENCE lines: 6 end-to-end + 1 isolation)

# Prior purchases-side retail fixtures stay green (DRI-7 + DRI-10 — not modified)
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/posRetailTypesAcceptance.mongo.test.js __tests__/posReportsRetailTypes.mongo.test.js
# → tests 2 / pass 2 / fail 0

# Focused vitest over the touched FE files + their neighborhoods
cd client/apps/admin && ./node_modules/.bin/vitest run src/app/shared/purchases \
  src/utils/print src/utils/size-variant-label.test.ts
# → 47 files / 290 tests / 0 failed  (29 purchases files: 185 tests; 18 print+label files: 105 tests)

# Type check (admin app)
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit
# → the ONLY 2 errors are in the untracked foreign test file
#   src/components/price-checker/use-compare-backup.test.ts (missing './compare-rows', implicit any)
#   — in-flight mid-edit work of the concurrently-held workspace, pre-existing, NOT touched here.
#   No error arises from any file this issue touched.
```

## Coordination with the concurrent DRI-6 run (f93fe236)

Every purchases surface it holds mid-edit (`purchases-create/edit/receive/returns/scan-drawer/
product-line-search/scan-selection/types.ts`, pricelists, agreements, `vendorBill.service.ts`,
`purchaseOrder.controller.js`) received only the minimal 2–5-line edits the deliverables could not avoid
(`handleProductSelect`/`onSelect` arity, one mapProducts pass-through, one populate select, the chips
label, one payload normalization). No commit was made — per the issue's "no commit" gate the changes
sit in the shared working tree; the DRI-6 run's next commit will carry them (all focused tests above
were run against the merged tree state).

## Findings (flagged, out of scope here)

1. **Bill matching breakdown does not persist.** `validateBill` builds `matchingDetails.itemComparisons`
   + `sizeBreakdown` (composite `subProductId::sizeId` keys), but `server/models/VendorBill.js`
   `matchingDetails` declares only the scalar subpaths (`priceMatch/quantityMatch/receivedMatch/poTotal/
   billTotal/receivedTotal/variance/varianceReason`), so Mongoose cast drops both breakdowns at
   assignment — nothing with `::` ever reaches the stored bill/UI. The fixture therefore proves the
   composite-key behavior against the exact bill/PO payloads the matching composes keys from, and the
   persisted flags (`matchingStatus/matchingNotes/receivedMatch`). Recommended follow-up (parent DRI-6):
   declare `itemComparisons`/`sizeBreakdown` on the `matchingDetails` schema so the 3-way matching view
   renders offline.
2. **vendorBill "(size)" bracket strings** (`getItemDisplayName` L415 and the validation/sizeKey messages
   L502/562) still compose server-side display strings from raw `sizeName` — snapshot policy says leave;
   if the storeone surface ever needs the identity, prefer the client composition path used here.
3. **`so-print.ts:177`** audit consumed — see Deliverable 1; needs a sales-side line-entry packaging
   decision (never a print-side fork).
4. `purchases-edit.tsx` was intentionally NOT touched: editing existing POs must not re-default packaging
   onto legacy lines; new-line entry on the edit page should adopt `defaultPackagingForLine` in a
   coordinated pass with the DRI-6 run (it owns that file mid-edit).

## Disposable-fixture IDs (per run; DB is PID-suffixed and dropped in `after`)

The full per-tenant rows are in the `DRI_EVIDENCE` lines below (tenantId / poId / returnId /
rejectedReturnId / billId per businessType).

## DRI_EVIDENCE (fixture output, 7 lines, verbatim from the passing run)

```
DRI_EVIDENCE {"issue":"DRI-14","phase":"purchases_module_end_to_end","businessType":"fashion","environment":"isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)","tenantId":"6aed3fb8d8078afbe7910eac","poId":"6aed3fbcd8078afbe7910f78","returnId":"6aed3fbdd8078afbe7910f9c","rejectedReturnId":"6aed3fbed8078afbe7910fb2","billId":"6aed3fbed8078afbe7910fc3","poLines":[{"sizeId":"6aed3fbad8078afbe7910eb4","sizeName":"One-size gown — Emerald · Emerald · Emerald gown","packaging":"pieces"},{"sizeId":"6aed3fbad8078afbe7910eb5","sizeName":"One-size gown — Ivory · Ivory · Ivory gown","packaging":"pieces"}],"receipt":{"receivedQty":2,"siblingByteUnchanged":true},"returnOutcome":{"confirmedQty":1,"overReturnRejected":true,"poReturnedQty":1,"stockAfter":4},"bill":{"currency":"NGN","itemKeys":["6aed3fbad8078afbe7910eb3::6aed3fbad8078afbe7910eb4","6aed3fbad8078afbe7910eb3::6aed3fbad8078afbe7910eb5"],"quantity":4,"subtotal":900,"total":900},"printSnapshots":[{"sizeName":"One-size gown — Emerald · Emerald · Emerald gown","packaging":"pieces"},{"sizeName":"One-size gown — Ivory · Ivory · Ivory gown","packaging":"pieces"}]}
DRI_EVIDENCE {"issue":"DRI-14","phase":"purchases_module_end_to_end","businessType":"electronics","environment":"isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)","tenantId":"6aed3fbad8078afbe7910eb8","poId":"6aed3fbed8078afbe7910fd9","returnId":"6aed3fbfd8078afbe7910ffd","rejectedReturnId":"6aed3fbfd8078afbe7911013","billId":"6aed3fbfd8078afbe7911024","poLines":[{"sizeId":"6aed3fbad8078afbe7910ec0","sizeName":"Portable speaker — Graphite speaker · Graphite speaker","packaging":"units"},{"sizeId":"6aed3fbad8078afbe7910ec1","sizeName":"Portable speaker — Sand speaker · Sand speaker","packaging":"units"}],"receipt":{"receivedQty":2,"siblingByteUnchanged":true},"returnOutcome":{"confirmedQty":1,"overReturnRejected":true,"poReturnedQty":1,"stockAfter":4},"bill":{"currency":"USD","itemKeys":["6aed3fbad8078afbe7910ebf::6aed3fbad8078afbe7910ec0","6aed3fbad8078afbe7910ebf::6aed3fbad8078afbe7910ec1"],"quantity":4,"subtotal":180,"total":180},"printSnapshots":[{"sizeName":"Portable speaker — Graphite speaker · Graphite speaker","packaging":"units"},{"sizeName":"Portable speaker — Sand speaker · Sand speaker","packaging":"units"}]}
DRI_EVIDENCE {"issue":"DRI-14","phase":"purchases_module_end_to_end","businessType":"beauty","environment":"isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)","tenantId":"6aed3fbad8078afbe7910ec4","poId":"6aed3fc0d8078afbe791103a","returnId":"6aed3fc0d8078afbe791105e","rejectedReturnId":"6aed3fc0d8078afbe7911074","billId":"6aed3fc0d8078afbe7911085","poLines":[{"sizeId":"6aed3fbad8078afbe7910ecc","sizeName":"Oil blend — Rose blend · Rose blend","packaging":"units"},{"sizeId":"6aed3fbad8078afbe7910ecd","sizeName":"Oil blend — Unscented blend · Unscented blend","packaging":"units"}],"receipt":{"receivedQty":2,"siblingByteUnchanged":true},"returnOutcome":{"confirmedQty":1,"overReturnRejected":true,"poReturnedQty":1,"stockAfter":4},"bill":{"currency":"NGN","itemKeys":["6aed3fbad8078afbe7910ecb::6aed3fbad8078afbe7910ecc","6aed3fbad8078afbe7910ecb::6aed3fbad8078afbe7910ecd"],"quantity":4,"subtotal":900,"total":900},"printSnapshots":[{"sizeName":"Oil blend — Rose blend · Rose blend","packaging":"units"},{"sizeName":"Oil blend — Unscented blend · Unscented blend","packaging":"units"}]}
DRI_EVIDENCE {"issue":"DRI-14","phase":"purchases_module_end_to_end","businessType":"home","environment":"isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)","tenantId":"6aed3fbbd8078afbe7910ed0","poId":"6aed3fc1d8078afbe791109b","returnId":"6aed3fc1d8078afbe79110bf","rejectedReturnId":"6aed3fc1d8078afbe79110d5","billId":"6aed3fc1d8078afbe79110e6","poLines":[{"sizeId":"6aed3fbbd8078afbe7910ed8","sizeName":"Kettle glaze — Sage glaze · Sage glaze","packaging":"units"},{"sizeId":"6aed3fbbd8078afbe7910ed9","sizeName":"Kettle glaze — Terracotta glaze · Terracotta glaze","packaging":"units"}],"receipt":{"receivedQty":2,"siblingByteUnchanged":true},"returnOutcome":{"confirmedQty":1,"overReturnRejected":true,"poReturnedQty":1,"stockAfter":4},"bill":{"currency":"NGN","itemKeys":["6aed3fbbd8078afbe7910ed7::6aed3fbbd8078afbe7910ed8","6aed3fbbd8078afbe7910ed7::6aed3fbbd8078afbe7910ed9"],"quantity":4,"subtotal":900,"total":900},"printSnapshots":[{"sizeName":"Kettle glaze — Sage glaze · Sage glaze","packaging":"units"},{"sizeName":"Kettle glaze — Terracotta glaze · Terracotta glaze","packaging":"units"}]}
DRI_EVIDENCE {"issue":"DRI-14","phase":"purchases_module_end_to_end","businessType":"general","environment":"isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)","tenantId":"6aed3fbbd8078afbe7910edc","poId":"6aed3fc2d8078afbe79110fc","returnId":"6aed3fc2d8078afbe7911120","rejectedReturnId":"6aed3fc2d8078afbe7911136","billId":"6aed3fc3d8078afbe7911147","poLines":[{"sizeId":"6aed3fbbd8078afbe7910ee4","sizeName":"Hamper wrap — Red-ribbon hamper · Red-ribbon hamper","packaging":"units"},{"sizeId":"6aed3fbbd8078afbe7910ee5","sizeName":"Hamper wrap — Gold-ribbon hamper · Gold-ribbon hamper","packaging":"units"}],"receipt":{"receivedQty":2,"siblingByteUnchanged":true},"returnOutcome":{"confirmedQty":1,"overReturnRejected":true,"poReturnedQty":1,"stockAfter":4},"bill":{"currency":"NGN","itemKeys":["6aed3fbbd8078afbe7910ee3::6aed3fbbd8078afbe7910ee4","6aed3fbbd8078afbe7910ee3::6aed3fbbd8078afbe7910ee5"],"quantity":4,"subtotal":900,"total":900},"printSnapshots":[{"sizeName":"Hamper wrap — Red-ribbon hamper · Red-ribbon hamper","packaging":"units"},{"sizeName":"Hamper wrap — Gold-ribbon hamper · Gold-ribbon hamper","packaging":"units"}]}
DRI_EVIDENCE {"issue":"DRI-14","phase":"purchases_module_end_to_end","businessType":"legacy","environment":"isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)","tenantId":"6aed3fbbd8078afbe7910ee8","poId":"6aed3fc3d8078afbe791115d","returnId":"6aed3fc3d8078afbe791116a","rejectedReturnId":"6aed3fc3d8078afbe7911178","billId":"6aed3fc3d8078afbe7911181","poLines":[{"sizeId":"6aed3fbbd8078afbe7910ef0","sizeName":"Legacy Lager 750ml","packaging":null}],"receipt":{"receivedQty":6,"siblingByteUnchanged":true},"returnOutcome":{"confirmedQty":1,"overReturnRejected":true,"poReturnedQty":1,"stockAfter":5},"bill":{"currency":"NGN","itemKeys":["6aed3fbbd8078afbe7910eef::6aed3fbbd8078afbe7910ef0"],"quantity":5,"subtotal":500,"total":500},"printSnapshots":[{"sizeName":"Legacy Lager 750ml","packaging":null}]}
DRI_EVIDENCE {"issue":"DRI-14","phase":"purchases_tenant_isolation","environment":"isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)","tenantsChecked":6,"foreignPoRead":404,"foreignReceipt":404,"foreignStatus":404,"foreignBillCreate":404,"foreignBillRead":404,"foreignBillValidate":404,"foreignReturnConfirm":400,"result":"every foreign PO/receipt/bill/return ref is refused and no cross-tenant data moved"}
```

Reading of the evidence: every retail tenant's PO lines carry the exact `'pieces'`/`'units'` entry nouns
and composed size labels; the partial receipt posts only the received variant (qty 2, exactly one
`received` movement) with the sibling raw stock row byte-unchanged; a second receipt completes (deltas
2/3/5, per-receipt movement rows), the confirmed return deducts the exact size and records counters once,
the over-return is rejected with nothing moved, and the bill keeps original-currency figures
(electronics: USD 180; the others NGN 900 / legacy NGN 500 — money straight from the receipt-driven
counters, tax-free) with composite `subProductId::sizeId` item keys; the legacy control keeps packaging
absent (`'bottle'` fallback intact), a single item, and its byte-identical label.

## Acceptance checklist

- [x] Deliverable 1 — pack-noun default at entry, bottle fallback kept, no print branch
- [x] Deliverable 2 — labels aligned on all three surfaces, no data/server-string change, legacy byte-parity
- [x] Deliverable 3 — six-tenant fixture with PO→receive→validate→return→bill + isolation + print payloads
- [x] `poReceive.helpers.test.js` / `vendorReturn.counters.test.js` / `retailVariantIdentity.test.js` / `warehouseTransferTotals` — 51/51 green
- [x] Touched FE files pass focused vitest (290 tests) + type check (no new errors)
- [x] Report doc (this file) + memory updated
- [x] No commit/push/deploy/production action
