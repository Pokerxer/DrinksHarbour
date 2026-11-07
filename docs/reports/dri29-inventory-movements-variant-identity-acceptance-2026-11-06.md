# DRI-29 — /inventory: movement-feed variant identity + six-tenant movements fixture (extension #7)

**Date:** 2026-11-06 · **Issue:** DRI-29 (parent DRI-2) · **Mode:** local, synthetic-only — no commit, no push, no deploy, no production action, no real tenant data.
**Agent:** DrinksHarbour Backend Engineer · workspace concurrently held by DRI-27 (client files; audit-only there, coordinated via commits).

## Defect (verified in repo before fixing)

`server/services/inventory.service.js` `getMovements()` (the only movement feed the `/inventory`
module consumes — `getInventorySummary` is not read by the shared module, verified by tracing the
client imports) populated size with `.populate('size', 'displayName size')`. The `/inventory`
movement rows — adjustments entry picker source rows (`use-adjustment-entry.ts`, already
sizeId-keyed), receipts `sizeLabel` (`inventory-receipts-support.tsx`:
`m.sizeName ?? m.size?.displayName ?? m.size?.size`), dashboard movements, history scope labels —
therefore showed a bare `M` for what the tenant stocked as `M · Emerald` / `M · Black · Wi-Fi`.
Same defect class DRI-14 fixed on `/purchases` and DRI-16 on `/warehouses`.

## What was delivered

### Deliverable 1 — populate identity plumbing (data provision only, no label re-composition)

`server/services/inventory.service.js` `getMovements()` — the size populate is now
`.populate('size', 'displayName size colorName colorHexCode optionName')` (with a DRI-29 comment
block). Emission is **only with identity** (DRI-16 additive-fields precedent): Size docs carry
these columns only on retail variant rows (`server/models/Size.js` — no defaults, absent keys on
legacy beverage rows), so every legacy movement payload keeps its exact pre-change wire shape.
Pure data provision — no label composition, no display strings server-side, no frontend edits.

Deliberately NOT touched (per issue scope + CEO decision 2 in
`docs/memory/pos-retail-accommodation.md`): the sibling `getInventorySummary()` populate (L807,
not consumed by the module), pricelist browser/print payloads (identity inherits the stock
payload; print stays byte-identical), `/api/pricelists` routes, the `tenant_staff`
custom-permission gate on `/inventory`, and all DRI-27 mid-edit files.

### Deliverable 1b — load-bearing defect fix on the adjustments writer (discovered by the fixture)

`server/services/stockAdjustment.js` L80 queried the Size with `subProduct: subProductId`, but
`server/models/Size.js` stores the sub-product under **`subproduct`** — the filter matched no
document, so the real adjustments writer (`POST /api/inventory/adjust` →
`postStockAdjustment`, the exact path the `/inventory` adjustments entry calls) failed with
`NotFoundError('Size does not belong to this product')` on every invocation. One-word fix to
`subproduct` (every other Size query in `server/services/` uses the schema spelling; verified by
grep). `server/__tests__/stockAdjustment.test.js` had encoded the defect (asserted the old
`subProduct` filter); its assertion now asserts `subproduct`.

### Flagged, not fixed (outside slice, fail-closed)

`POST /api/inventory/movements` with `type: 'adjustment_in'/'adjustment_out'` delegates through
`inventoryService.createMovement` to `postStockAdjustment` with `resolveTenantId()`'s raw
`req.tenant._id` (an ObjectId) — the writer's string-only ID regex then rejects it with 400.
Unreachable from the `/inventory` UI (its only `/movements` POST caller sends
`damaged/expired/written_off`, `category: 'out'`; the adjustments entry uses `/adjust`, whose
controller passes the string-normalized `getTenantId(req)`). Fail-closed either way; left for a
board decision.

### Deliverable 2 — six-tenant movements verification fixture

New opt-in Mongo fixture `server/__tests__/inventoryMovementsRetailTypes.mongo.test.js` (the
DRI-16 `warehouseRetailTypes.mongo.test.js` pattern: disposable PID-suffixed replica-set Mongo on
:29127, real `inventory.routes` behind `protect` + `attachTenant` + `requireOwnTenant`; no other
fixture modified). Per tenant — the five retail business types plus ONE legacy beverage control —
over the real HTTP path:

1. **Seed** tenant + warehouse + Product + SubProduct with **TWO same-size colour variants**
   ("M · Emerald" / "M · Ivory" for Fashion; same-size option/sku analogues for Electronics,
   Beauty, Home & Living, General Retail; legacy beverage gets ONE colourless volume row
   `Legacy Lager 750ml`, no identity columns at all — absent keys, not empty strings) with
   zero-balance WarehouseStock rows.
2. **Adjustment writes** — POST `/api/inventory/adjust` with the EXACT body the adjustments entry
   sends (`use-adjustment-entry.ts` → `inventoryAdjustment.service.create`:
   `warehouseId/subProductId/sizeId/targetQuantity/expectedQuantity/requestId/reason/notes`) per
   variant, DISTINCT counted quantities (A=4, B=9, legacy=7) → real
   `stockAdjustment.postStockAdjustment` ledger posts (`adjustment_in` movements carrying `size`),
   cross-tenant write probe rejected 404.
3. **GET `/api/inventory/movements?scope=adjustments`** (adjustments entry picker source) and the
   **unscoped feed** (dashboard movements / receipts): movement rows keyed by DISTINCT exact
   `size._id`, each carrying its own counted delta (`quantity`/`quantityAfter`), with
   `colorName`/`colorHexCode`/`optionName` verbatim in the populated Size; the legacy row's
   populated size keeps EXACTLY its pre-change keys (`_id`, `displayName`, `size`) — byte-identical
   wire shape; colour rows exactly `_id, colorHexCode, colorName, displayName, optionName, size`;
   option-only rows exactly `_id, displayName, optionName, size` (no `colorName`/`colorHexCode`
   keys).
4. **Tenant isolation** — every movements projection surfaces only the caller's own sub-product
   rows and no foreign size identity.

Evidence log emitted by the fixture:
`DRI_EVIDENCE_DRI29_INVENTORY_MOVEMENTS_VARIANT_IDENTITY` (tenants, adjustment quantities,
payload surfaces, invariants — full JSON in the test output).

## Verification

All from `server/` with `/Users/mac/.local/bin/node --test` (plain `npm test` is broken):

| Check | Command | Result |
|---|---|---|
| New movements fixture | `DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' node --test __tests__/inventoryMovementsRetailTypes.mongo.test.js` | **1/1 pass** (190.8s, box shared with the concurrent DRI-26 full-suite run) |
| DRI-16 template regression | `… node --test __tests__/warehouseRetailTypes.mongo.test.js` | **1/1 pass** |
| Writer + history + identity suites (plain) | `node --test __tests__/stockAdjustment.test.js __tests__/inventoryAdjustmentHistory.test.js __tests__/inventoryInternalHistory.test.js __tests__/warehouseMovementHistory.test.js __tests__/retailVariantIdentity.test.js` | **16/16 pass** |

No checks skipped. The fixture run shares the machine with the concurrently running DRI-26 full
suite (separate PID-suffixed databases; no interference).

Post-rotation continuity re-verification (2026-11-06, recovery wake): after the authoring session
rotated, the assigning run re-executed all three checks from scratch on the unchanged tree —
movements fixture 1/1 pass (156s, evidence ID re-emitted), DRI-16 template regression 1/1 pass,
plain five-file suite 16/16 pass. No result is reliance on the pre-rotation run.

## Files touched

- `server/services/inventory.service.js` — getMovements size populate + DRI-29 comment (only change in the file; `getInventorySummary` untouched).
- `server/services/stockAdjustment.js` — one-word Size query fix (`subProduct` → `subproduct`) + comment.
- `server/__tests__/stockAdjustment.test.js` — assertion updated to the schema field.
- `server/__tests__/inventoryMovementsRetailTypes.mongo.test.js` — NEW six-tenant movements fixture.

Not touched: all client files (DRI-27 mid-edit or DRI-30's slice), pricelist payloads/routes,
tenant middleware, `getInventorySummary`.
