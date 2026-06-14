# Multi-Warehouse Inventory — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorming) — pending spec review
**Scope:** Let a tenant store subproducts across multiple warehouses and track stock per warehouse, per size.

---

## 1. Problem

A tenant needs to store the same subproduct in several physical warehouses and track
how many units (per size) sit in each. The current `server/models/Warehouse.js` cannot do
this: it carries a unique index `{ tenant, subProduct }`, so each subproduct can belong to
exactly **one** warehouse record, and `location` is free text — not a real place. The model
is effectively a per-subproduct stock-location row, mislabeled as "Warehouse," and it blocks
multi-warehouse storage.

## 2. Decisions (confirmed with user)

- **Granularity:** per `(warehouse + subproduct + size)`. Consistent with the existing
  per-size `StockMovement` model.
- **Migration:** fresh start. No existing warehouse data to preserve; the old `Warehouse.js`
  is replaced.
- **UI scope (first pass):** all four — warehouse CRUD, per-warehouse stock view,
  transfer between warehouses, per-subproduct warehouse breakdown.
- **Deletion rule:** deleting a warehouse is **blocked** if any of its stock rows has
  `currentQuantity > 0`.

## 3. Data model (server)

Three models replace the single old `Warehouse.js`.

### Warehouse — the physical place (rewritten)

```js
{
  tenant,            // ObjectId → Tenant, required, indexed
  name,              // String, required
  code,              // String, short unique-per-tenant identifier
  type,              // enum: ['warehouse','store','distribution_center'], default 'warehouse'
  address: { line1, city, state, country },
  isActive,          // Boolean, default true
  isDefault,         // Boolean, default false (one default per tenant)
  createdBy,         // ObjectId → User
}
// index: { tenant, code } unique
```

### WarehouseStock — stock of one size of one subproduct in one warehouse (new)

```js
{
  tenant,            // ObjectId → Tenant, required, indexed
  warehouse,         // ObjectId → Warehouse, required, indexed
  subProduct,        // ObjectId → SubProduct, required, indexed
  size,              // ObjectId → Size, required, indexed
  currentQuantity,   // Number, min 0, default 0
  reservedQuantity,  // Number, min 0, default 0
  // optional bin detail carried over from old model
  zone, aisle, shelf, bin,
  minStockLevel, maxStockLevel,
}
// unique index: { tenant, warehouse, subProduct, size }
```

The compound unique index is what enables multi-warehouse: the same subproduct/size can
appear in many warehouses, one row each.

### WarehouseMovement — audit trail (new)

```js
{
  tenant, warehouse, subProduct, size,
  type,              // enum: ['received','adjusted','shipped','transfer_in','transfer_out']
  quantity,          // Number
  balanceAfter,      // Number — warehouse-stock balance for this row after the move
  reference,         // String — e.g. PO id, order id, manual note
  transferGroupId,   // ObjectId — links the two rows of a transfer
  performedBy,       // ObjectId → User
  createdAt,         // Date
}
```

## 4. Stock rollup rule

`SubProduct.totalStock / availableStock / reservedStock` become **derived rollups**:
the sum across all `WarehouseStock` rows for that subproduct. A single helper
`recalcSubProductStock(subProductId)` runs after every warehouse-stock write
(adjust, transfer, receive).

- `totalStock` = Σ `currentQuantity`
- `reservedStock` = Σ `reservedQuantity`
- `availableStock` = `totalStock − reservedStock`

This keeps existing POS / online-store / analytics code untouched — it continues to read
`SubProduct.totalStock`.

## 5. API (server)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/warehouses` | list places for tenant |
| POST | `/api/warehouses` | create place |
| GET | `/api/warehouses/:id` | one place |
| PATCH | `/api/warehouses/:id` | update place |
| DELETE | `/api/warehouses/:id` | delete (blocked if stock qty > 0) |
| GET | `/api/warehouses/:id/stock` | all subproduct/size lines in this warehouse |
| POST | `/api/warehouses/:id/stock/adjust` | `{ subProduct, size, quantity, type, notes }` → write stock + movement + rollup |
| POST | `/api/warehouses/transfer` | `{ subProduct, size, fromWarehouse, toWarehouse, quantity }` → atomic move |
| GET | `/api/subproducts/:id/stock-by-warehouse` | breakdown of one subproduct across warehouses |

**Transfer** wraps source-decrement + dest-increment in a Mongo session/transaction so a
partial move cannot occur. It writes two `WarehouseMovement` rows (`transfer_out`,
`transfer_in`) sharing a `transferGroupId`. The subproduct rollup is unchanged by a transfer
(total conserved); rollup recompute still runs as a no-op safety.

## 6. Client (`client/apps/isomorphic/`)

Mirrors the existing `purchases/` pattern: thin page → shared component → service.

### Services (`src/services/`)
- Rewrite `warehouse.service.ts` → place CRUD against the new `Warehouse` shape.
- New `warehouseStock.service.ts` → `getWarehouseStock`, `adjustStock`, `transferStock`,
  `getStockByWarehouse`.

### Routes (`src/config/routes.ts`)
- Add a `warehouses` route group (`/warehouses`, `/warehouses/[id]`).

### Pages (`src/app/(hydrogen)/warehouses/`)
- `page.tsx` → renders warehouse list component.
- `[id]/page.tsx` → renders warehouse detail component.

### Components (`src/app/shared/warehouses/`)
- `warehouses-list.tsx` — table of places + create/edit modal (name, code, type, address,
  default toggle), delete with the stock-block guard surfaced as a toast.
- `warehouse-detail.tsx` — table of subproduct+size rows (qty / reserved / available),
  per-row **Adjust** action, **Transfer** button.
- `warehouse-transfer-drawer.tsx` — from/to warehouse, subproduct, size, quantity.
- `subproduct-warehouse-breakdown.tsx` — reusable card ("Lagos 40, Abuja 12"), droppable
  onto the subproduct page.

Each requested capability maps to one component: CRUD → `warehouses-list`; per-warehouse
view → `warehouse-detail`; transfers → `warehouse-transfer-drawer`; per-subproduct
breakdown → `subproduct-warehouse-breakdown`.

## 7. Build order

1. Server models (`Warehouse`, `WarehouseStock`, `WarehouseMovement`) + `recalcSubProductStock` helper.
2. Server endpoints + transfer transaction.
3. Client services + routes.
4. Warehouses list / CRUD page.
5. Warehouse detail (stock view + adjust).
6. Transfer drawer.
7. Subproduct breakdown card.

## 8. Testing

- **Server unit tests:** rollup correctness (sum across rows); transfer atomicity
  (total conserved, both movements written, shared `transferGroupId`); unique-index
  enforcement on `{ tenant, warehouse, subProduct, size }`; delete-blocked-when-stock guard.
- **Client:** manual pass per page (create warehouse → add stock → transfer → verify
  breakdown and subproduct rollup).

## 9. Out of scope (this pass)

- Reservation logic tied to live orders (reservedQuantity is tracked but not auto-driven).
- Bin-level pick optimization, lot/expiry tracking, capacity alerts (fields exist but no UI).
- Purchase-order receiving directly into a chosen warehouse (future: wire PO receive →
  `stock/adjust` with `type: 'received'`).
