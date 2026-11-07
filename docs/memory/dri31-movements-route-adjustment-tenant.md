# /inventory movements route — adjustment delegation tenant normalization (DRI-31)

`POST /api/inventory/movements` with `type: adjustment_in|adjustment_out` delegates
through `inventoryService.createMovement` to `stockAdjustment.postStockAdjustment`
(or sends `category: 'adjustment'`). The movements controller resolves the tenant
via `resolveTenantId()`, which returns the RAW `req.tenant._id` / `req.user.tenant`
ObjectId, while the writer validates every id with a string-only 24-hex regex —
so every API-direct adjustments write through the movements route failed with
400 "Select a valid warehouse, product and size" (fail-closed; the /inventory UI
always reaches the writer via `/api/inventory/adjust`, whose controller uses the
string-normalized `getTenantId(req)`).

Fix (bounded): `inventoryService.createMovement` string-normalizes the tenant at
the delegation point — `require('../utils/tenantContext').normalizeTenantId(tenantId)` —
the same string form `getTenantId(req)` produces. Do not change:

- the writer's id validation in `stockAdjustment.js` (it is the identity guard,
  not the defect),
- `resolveTenantId` / `getTenantId` semantics or tenant scoping (cross-tenant
  writes still 404 — the writer's tenant-scoped lookups are unchanged),
- the adjustments-entry payload shape (the movements route passes `req.body`
  through untouched; legacy populated-size shape stays `_id/displayName/size`).

Note: `inventory.service.js` also has `adjustInventory(input, tenantId, performedBy)`
which delegates to the same writer; its only callers pass an already-string
tenant, so it was deliberately left untouched in the bounded fix.

Verification (2026-11-06, disposable replica-set Mongo on :29127):

- `server/__tests__/inventoryMovementsRetailTypes.mongo.test.js` — DRI-21 suite +
  new `inventory_movements_route_api_direct_adjustment_in_dri31` sibling (real
  router, real models; API-direct `type: adjustment_in` through the movements
  route is 201 for one retail and one legacy tenant row, movement stores the
  exact sizeId, cross-tenant write still 404s). Pre-fix run of the sibling test
  reproduces the defect: `{"status":400,"message":"Select a valid warehouse,
  product and size"}`. Post-fix: 2/2 pass.
- Focused plain suites `stockAdjustment.test.js`,
  `inventoryAdjustmentHistory.test.js`, `inventoryInternalHistory.test.js`:
  8/8 pass.

Future API-direct callers of the movements route must keep sending the writer's
contract body (warehouseId, subProductId, sizeId, targetQuantity,
expectedQuantity, requestId, reason) — the route is a passthrough to the writer,
not a different contract.
