# Linked Sales Order stock leaves its own warehouse

A POS sale settling a linked Sales Order must draw stock from the **Sales
Order's own warehouse**, never from the terminal's resolved default. The server
(`createPOSOrder`) is authoritative: `linkedSalesOrderId` → `so.warehouseId` →
`requirePOSLocation` → deduction → `posWarehouse` → fulfilment warehouse — one
source for the whole trail.

Before 2026-09-19: `createPOSOrder` used `resolveShopWarehouse` (retail default)
and ignored the linked SO. SO00007 (tenant Wyn City) recorded WH-002 (Cloud Bay)
while stock physically left WH-001 (Wyn City) — order/fullfilment/stock trail
named three warehouses. 156 units were re-attributed WH-001 → WH-002 by the
one-off `server/scripts/fix-so00007-warehouse.js`.

Gotchas:
- `Order.posWarehouse` is `immutable: true` — fixing it requires a raw
  collection `$set`, not `save()` or model `updateOne`.
- Don't just add `warehouseId` to the client payload: AGENTS.md Workstream B
  wants warehouse server-derived — SO's warehouse wins, body is only a fallback
  for old tills. Offline replay sends no `warehouseId`, so server-side is the
  only durable fix.

Regression tests: `posLinkedSalesOrderPricing.test.js` (so-warehouse + ordinary
fallback). Full server suite 2844/2844 pass.
Spec: `docs/superpowers/specs/RESUME-linked-sales-order-warehouse.md`.