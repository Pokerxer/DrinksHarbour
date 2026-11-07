# DRI-7 — POS till acceptance across all five retail business types

**Date:** 2026-11-05 · **Issue:** DRI-7 (parent DRI-6) · **Mode:** local, read/synthetic-only verification — no commit, no deploy, no production action, no real tenant data.

## What was verified

The verified DRI-4 POS/till acceptance pattern (`posTillAcceptance.mongo.test.js`, kept byte-stable) was
extended to all five newly added retail business types — **Fashion Retail, Electronics Retail,
Beauty & Skincare, Home & Living, General Retail** — with a new opt-in Mongo acceptance fixture:

- `server/__tests__/posRetailTypesAcceptance.mongo.test.js`

Per the DRI-6 CEO decision (`docs/memory/pos-retail-accommodation.md`, POS is business-type-agnostic),
**no gating or behaviour change was introduced** — the fixture verifies the contract empirically. Static
scan confirms no `businessType`/beverage gate exists anywhere in `server/routes/pos.routes.js` or
`server/controllers/pos.controller.js`; the runtime walk confirms it end-to-end.

## Fixture shape

- Boots the **real** `server/routes/pos.routes.js` via `__tests__/helpers/routeAuthHarness.js` against the
  persistent `:29127` `venuePhase0` replica-set mongod; each run owns and drops a PID-suffixed database.
- For each of the five types, seeds one tenant (`businessType` values matching the DRI-3
  `seed-fixture.js` taxonomy), a POS-enabled retail warehouse (`posSettings.retailWarehouse`), a
  `tenant_staff` POS seller, one SubProduct with **type-appropriate catalogue type** and two same-size
  colour variants in the DRI-4 label shape:
  - Fashion Retail → `fashion_dress` (Emerald / Ivory gown)
  - Electronics Retail → `electronics_audio` (Graphite / Sand speaker)
  - Beauty & Skincare → `beauty_skincare` (Rose / Unscented blend)
  - Home & Living → `home_kitchen` (Sage / Terracotta glaze)
  - General Retail → `gift_set` (Red-ribbon / Gold-ribbon hamper)

## Run commands (local)

```bash
# New five-type fixture
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/posRetailTypesAcceptance.mongo.test.js
# → 1 pass / 0 fail (~10.5s)

# DRI-4 evidence fixture — unchanged, still green
cd server && DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
  node --test __tests__/posTillAcceptance.mongo.test.js
# → 1 pass / 0 fail
```

## Results

### Deliverable 1 — five-type till walk: **1 pass / 0 fail**

For **each** of the five business types, the full walk asserted:

1. `GET /api/pos/products` returns only own-tenant sellable variants with per-row colour labels
   (`colorName`, `colorHexCode`, `optionName`, `sku`, `availableStock: 10`) and correct tenant selling prices.
2. `POST /sessions/open` → session bound to the tenant's own POS-enabled warehouse.
3. `POST /api/pos/orders` cash simulation → paid receipt: `paymentStatus: 'paid'`, `source: 'pos'`,
   `posWarehouse`, `posSessionId` stamped; totals 3 000 / change 2 000 (₦).
4. Per-row `WarehouseMovement` `shipped` rows with `balanceAfter` (8 and 9).
5. Cross-type wrong-tenant SubProduct refused **409** "Product is unavailable for this POS." and foreign
   Size ID refused **409** "Size does not belong to this product." — **zero stock movement**.
6. Oversell (sizeB quantity 10 with 9 remaining) refused **409** /Insufficient/, stock unchanged.
7. Drawer totals: one paid receipt lands on the session (`orderCount: 1, totalSales: 3000, cashSales: 3000`).

### Cross-type isolation sweep: held

Full ordered-pair sweep (5 × 4 = **20 pairs**): a POS token from each retail type read and attempted to
sell every other retail type's SubProduct — picker never returns foreign rows; every cross-tenant sale is
refused 409; every foreign Size ID refused 409; **zero stock movements** across the sweep; exactly 5 paid
POS receipts exist at the end. Isolation holds across the new types, not only beverage-vs-retail.

### DRI_EVIDENCE (fixture output, 6 lines)

```
DRI_EVIDENCE {"issue":"DRI-7","phase":"retail_type_till_walk","businessType":"Fashion Retail","environment":"isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecd06873091132621404fe","warehouseId":"6aecd06873091132621404ff","productType":"fashion_dress","subProductId":"6aecd06a7309113262140502","sizeIds":["6aecd06a7309113262140503","6aecd06a7309113262140504"],"sessionId":"6aecd06c730911326214059e","receipt":"RCP-20261105-0001","stockBefore":{"a":10,"b":10},"stockAfterSale":{"a":8,"b":9},"oversellResult":{"status":409,"message":"Insufficient unreserved stock for this sale"}}
DRI_EVIDENCE {"issue":"DRI-7","phase":"retail_type_till_walk","businessType":"Electronics Retail","environment":"isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecd06a7309113262140508","warehouseId":"6aecd06a7309113262140509","productType":"electronics_audio","subProductId":"6aecd06a730911326214050c","sizeIds":["6aecd06a730911326214050d","6aecd06a730911326214050e"],"sessionId":"6aecd06e73091132621405a4","receipt":"RCP-20261105-0002","stockBefore":{"a":10,"b":10},"stockAfterSale":{"a":8,"b":9},"oversellResult":{"status":409,"message":"Insufficient unreserved stock for this sale"}}
DRI_EVIDENCE {"issue":"DRI-7","phase":"retail_type_till_walk","businessType":"Beauty & Skincare","environment":"isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecd06a7309113262140512","warehouseId":"6aecd06a7309113262140513","productType":"beauty_skincare","subProductId":"6aecd06a7309113262140516","sizeIds":["6aecd06a7309113262140517","6aecd06a7309113262140518"],"sessionId":"6aecd06f73091132621405aa","receipt":"RCP-20261105-0003","stockBefore":{"a":10,"b":10},"stockAfterSale":{"a":8,"b":9},"oversellResult":{"status":409,"message":"Insufficient unreserved stock for this sale"}}
DRI_EVIDENCE {"issue":"DRI-7","phase":"retail_type_till_walk","businessType":"Home & Living","environment":"isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecd06a730911326214051c","warehouseId":"6aecd06a730911326214051d","productType":"home_kitchen","subProductId":"6aecd06a7309113262140520","sizeIds":["6aecd06a7309113262140521","6aecd06a7309113262140522"],"sessionId":"6aecd07073091132621405b0","receipt":"RCP-20261105-0004","stockBefore":{"a":10,"b":10},"stockAfterSale":{"a":8,"b":9},"oversellResult":{"status":409,"message":"Insufficient unreserved stock for this sale"}}
DRI_EVIDENCE {"issue":"DRI-7","phase":"retail_type_till_walk","businessType":"General Retail","environment":"isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"tenantId":"6aecd06a7309113262140526","warehouseId":"6aecd06a7309113262140527","productType":"gift_set","subProductId":"6aecd06b730911326214052a","sizeIds":["6aecd06b730911326214052b","6aecd06b730911326214052c"],"sessionId":"6aecd07073091132621405b6","receipt":"RCP-20261105-0005","stockBefore":{"a":10,"b":10},"stockAfterSale":{"a":8,"b":9},"oversellResult":{"status":409,"message":"Insufficient unreserved stock for this sale"}}
DRI_EVIDENCE {"issue":"DRI-7","phase":"cross_type_isolation","environment":"isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)","physicalTillUsed":false,"pairsChecked":20,"sample":[{"from":"Fashion Retail","to":"Electronics Retail","crossSell":{"status":409,"message":"Product is unavailable for this POS."},"tamperedSize":{"status":409,"message":"Size does not belong to this product."}},{"from":"Fashion Retail","to":"Beauty & Skincare","crossSell":{"status":409,"message":"Product is unavailable for this POS."},"tamperedSize":{"status":409,"message":"Size does not belong to this product."}},{"from":"Fashion Retail","to":"Home & Living","crossSell":{"status":409,"message":"Product is unavailable for this POS."},"tamperedSize":{"status":409,"message":"Size does not belong to this product."}},{"from":"Fashion Retail","to":"General Retail","crossSell":{"status":409,"message":"Product is unavailable for this POS."},"tamperedSize":{"status":409,"message":"Size does not belong to this product."}}],"result":"all 20 cross-type read/sell walks refused with 409; zero stock movements; five paid receipts only"}
```

DRI-4's fixture reprint (unchanged file) also reproduced its `DRI4_EVIDENCE` line and passed 1/0.

## Deliverable 2 — cosmetic copy neutrality: SKIPPED per the concurrent-edit rule

The two beverage-flavoured placeholder strings live in
`client/apps/admin/src/app/shared/point-of-sale/pos-loyalty.tsx`, which **carries an uncommitted
in-flight edit at handover** from the concurrently-held workspace (run 4b9254dd / DRI-3 — a
`posApi.getCategories(adminToken)` industry-scope change). Per the issue's explicit rule
("skip this untouched-co-existing-file item if a concurrent edit in that file is in flight … coordinate
via commits only"), the two-line copy change was **not** applied and no vitest/type check was run for it.

- **Skip consequence:** the placeholder examples ("e.g. 20% off all spirits this weekend" /
  "e.g. On all spirits and cocktails") remain beverage-flavoured for now. Follow-up routes to the parent
  owner (DRI-6): apply after run 4b9254dd lands — suggested replacements per the issue
  ("e.g. 20% off all summer sandals this weekend" / "e.g. On all kitchenware and décor"), plus a focused
  vitest/type pass on that file.
- `posTillAcceptance.mongo.test.js` was not modified (byte-stable, tracked as `??` untracked as
  DRI-4 left it).

## Acceptance checklist

- [x] New fixture passes: all five types complete the full till walk; cross-type isolation refused
      (20/20 pairs, zero stock movements).
- [x] Existing `posTillAcceptance.mongo.test.js` still passes unchanged (1 pass / 0 fail).
- [ ] ~~Focused vitest/type check for the copy change~~ — **SKIPPED** per the concurrent-edit rule
      (in-flight edit in `pos-loyalty.tsx` from run 4b9254dd); skip recorded above.
- [x] Evidence recorded: DRI_EVIDENCE IDs above + this report doc.
- [x] No commit / push / deploy / production action taken.

Follow-ups (for the parent owner, DRI-6): apply the two-line copy change once the concurrent edit lands.
