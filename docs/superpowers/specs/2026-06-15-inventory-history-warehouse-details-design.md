# Inventory History — Warehouse Details

**Date:** 2026-06-15
**Status:** Approved for planning
**Area:** Sub-product edit page → Inventory → History tab

## Problem

The inventory **History tab** (`InventorySummaryCard` + `ServerMovementsList`) renders
`InventoryMovement` records but shows **no warehouse context** on any row. A user
looking at the ledger cannot tell which warehouse a sale/receive/adjustment hit, or —
for a transfer — which warehouses stock moved between.

The data model is *capable* of this but unused on this surface:

- `InventoryMovement` already has `warehouse`, `sourceWarehouse`, `destinationWarehouse`
  ref fields. But:
  - `getMovements` (and the summary's `recentMovements`) never `.populate()` them, so
    even when set they arrive as bare ObjectIds.
  - Most creation paths never **set** `warehouse` — only the legacy
    `transferStock` stamps `sourceWarehouse`/`destinationWarehouse`.
- A separate `WarehouseMovement` ledger (written by `warehouse.service.js`) is the real
  per-warehouse truth, but is out of scope here — we are enriching the existing
  `InventoryMovement` ledger, not merging the two.

`Warehouse` has an **`isDefault: Boolean`** flag per tenant, and PO-receive already
resolves a target warehouse via `resolveTargetWarehouse(explicit, default)`. So every
creation path either already knows its warehouse or can fall back to the tenant default.

## Goal

On the History tab, every movement shows which warehouse it affected; transfers show
`Source → Destination`. Achieved by (1) stamping `warehouse` at every creation path,
(2) populating warehouse refs in the read endpoints, (3) rendering warehouse on the
client rows + detail panel.

Non-goals: changing any stock math; merging `WarehouseMovement` into the timeline;
backfilling historical rows via a migration (existing rows simply show no warehouse
until re-created — acceptable).

## Layer 1 — Server: stamp `warehouse` at creation

Add a small helper in `server/services/inventory.service.js`:

```js
// Resolve the warehouse a movement should be attributed to.
// Returns explicit id when provided, else the tenant's default warehouse, else null.
async function resolveMovementWarehouse(tenantId, explicitWarehouseId) {
  if (explicitWarehouseId) return explicitWarehouseId;
  const def = await Warehouse.findOne({ tenant: tenantId, isDefault: true })
    .select('_id').lean();
  return def?._id || null;
}
```

Notes:
- `inventory.service.js` does not yet require the `Warehouse` model — add
  `const Warehouse = require('../models/Warehouse');` to the imports.
- `null` is allowed (tenant may have no default warehouse) — the field stays unset and
  the client renders nothing, exactly like today. No throwing.
- Keep it cheap: the default lookup is a tiny indexed query; paths that loop over many
  items (order `audit`) should resolve the default **once** per call, not per item.

Set `warehouse` at every `InventoryMovement.create` site:

| Path | Location | Warehouse source |
|---|---|---|
| Manual receive | `inventory.service.js:281` | `data.warehouseId` → default |
| Manual adjust | `inventory.service.js:401` | `data.warehouseId` → default |
| Customer return | `inventory.service.js:445` | `data.warehouseId` → default |
| Generic `createMovement` | `inventory.service.js:573` | `data.warehouseId` → default |
| Transfer out | `inventory.service.js:507` | `warehouse = sourceWarehouseId` (keep src/dest) |
| Transfer in | `inventory.service.js:527` | `warehouse = destinationWarehouseId` (keep src/dest) |
| Order audit (sold/shipped/return) | `inventory.service.js:63` | resolve default **once** before the loop |
| PO vendor return | `purchaseOrder.controller.js:1712` | resolved target WH → default |
| POS sale / refund | `pos.controller.js:151, 209, 236` | register/store WH if available → default |

Rules:
- Transfers: set `warehouse` to the per-side warehouse (out→source, in→destination) so a
  single-warehouse filter/label is meaningful, while `sourceWarehouse`/`destinationWarehouse`
  remain the pair for the `A → B` route display.
- Wherever a caller already threads a warehouse (PO receive target, future POS register
  warehouse), pass it as the explicit id; otherwise the helper falls back to default.
- All stamping is additive — no existing field or quantity logic changes.

## Layer 2 — Server: populate on read

- `getMovements` (`inventory.service.js:619`): add
  `.populate('warehouse', 'name code')`
  `.populate('sourceWarehouse', 'name code')`
  `.populate('destinationWarehouse', 'name code')`.
- Summary `recentMovements` (`inventory.service.js:646`): same three `.populate` calls.

Selecting only `name code` keeps the payload small.

## Layer 3 — Client: render warehouse

**Type** (`services/inventory.service.ts`, `InventoryMovement`): tighten `warehouse` and
add the transfer pair:
```ts
warehouse?: { _id: string; name?: string; code?: string } | string | null;
sourceWarehouse?: { _id: string; name?: string; code?: string } | string | null;
destinationWarehouse?: { _id: string; name?: string; code?: string } | string | null;
```

**Helper** (in `ServerMovementsList.tsx`, alongside `getSourceBadge`):
```ts
const whLabel = (w) => !w ? null : typeof w === 'object' ? (w.name || w.code || null) : null;

// Returns { kind: 'single', label } | { kind: 'route', from, to } | null
function getWarehouseInfo(m) {
  const from = whLabel(m.sourceWarehouse), to = whLabel(m.destinationWarehouse);
  if (from && to) return { kind: 'route', from, to };
  const single = whLabel(m.warehouse) || from || to;
  return single ? { kind: 'single', label: single } : null;
}
```

**Row** (badge strip, `ServerMovementsList.tsx:~2473`): add after the size chip — a
`PiWarehouse`-iconed chip:
- single → `🏭 {label}`
- route → `🏭 {from} → {to}`
- null → render nothing (no empty chip).

Use a muted style consistent with existing chips (e.g. `bg-gray-100 text-gray-600`).

**Detail panel** (field list, `ServerMovementsList.tsx:~2285`): add one field after
`Source`:
- route → label `Route`, value `{from} → {to}`
- single → label `Warehouse`, value `{label}`
- null → omit (uses the existing `.filter(Boolean)` pattern).

`MovementDetailPanel` is also imported by `MovesTab`, so the detail enrichment is shared
for free.

## Error handling

- `resolveMovementWarehouse` never throws; a missing default → `null` → field unset.
- Populate of a null ref yields `null`; client helper already guards for it.
- No new failure modes in stock mutation paths — stamping is a field assignment on an
  object already being created.

## Testing

Server (`inventory.service` unit/integration):
1. `resolveMovementWarehouse` returns explicit id when given.
2. Falls back to the `isDefault` warehouse when no explicit id.
3. Returns `null` when the tenant has no default warehouse.
4. `createMovement` / receive / adjust / return persist `warehouse`.
5. `transferStock` sets `warehouse` per side **and** retains `sourceWarehouse`/`destinationWarehouse`.
6. `getMovements` returns populated `{ name, code }` objects for the three refs.

Client:
7. `getWarehouseInfo` → `route` when both src & dest present.
8. → `single` when only `warehouse` present.
9. → `null` when none present (asserts no chip / no field rendered).

Manual QA: receive stock, adjust, transfer between two warehouses, make a POS sale →
each new row shows the expected warehouse / route chip; old rows show none.

## Files touched

- `server/services/inventory.service.js` — helper + 7 create sites + 2 populates
- `server/controllers/purchaseOrder.controller.js` — 1 create site
- `server/controllers/pos.controller.js` — 3 create sites
- `client/.../services/inventory.service.ts` — type
- `client/.../inventory/HistoryTab/ServerMovementsList.tsx` — helper + row chip + detail field
