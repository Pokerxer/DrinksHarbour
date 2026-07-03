# Inventory Module — Design (2026-07-03)

## Goal

Add an Odoo-style **Inventory** module to the admin app at `/inventory`, structured
like the existing Point of Sale module (in-page nav header + thin route pages over
`app/shared/<module>` components), with three header menus:

- **Operations** — Transfers, Receipts, Deliveries, Internal, Adjustments,
  Physical Inventory, Scrap, Procurement, Replenishment
- **Reporting** — Stock, Locations, Valuation, Moves History
- **Configuration** — Settings; Warehouse Management (Warehouses, Operation Types,
  Locations, Storage Categories, Putaway Rules); Products (Categories, Attributes);
  Delivery (Delivery Methods, Package Types)

## Approach

Follow the warehouses-module pattern (a `layout.tsx` hoists the nav header for all
`/inventory/*` routes) rather than the POS pattern of per-component headers — less
duplication. Reuse the shared `NavDropdownPanel`, extended with optional
**sections** (heading + items) for the grouped Configuration menu (backward
compatible with existing callers).

Pages are backed by existing services — no new backend:

| Page | Data source |
|---|---|
| Dashboard | `inventoryService.getMovements` + `getLowStockItems` + `getInventoryValuation` |
| Transfers | reuse `shared/purchases/stock-transfers-list` (standalone component) |
| Receipts / Deliveries / Internal / Adjustments / Scrap / Moves History | generic `InventoryMoves` list over `GET /api/inventory/movements` with category/type presets (`in`, `out`, `transfer`, `adjustment`; scrap = out-types damaged/expired/theft/written_off) |
| Physical Inventory | `warehouseStockService.getAllStock` + counted-qty apply via `adjustStock` |
| Procurement | `reorderService.getSuggestions` + low stock → links into Purchases |
| Replenishment | `reorderService.getRules` / `checkAllRules` / `triggerRule` |
| Stock | `warehouseStockService.getAllStock` (rows per warehouse/product/size) |
| Locations | `warehouseService.getWarehouses` → links to warehouse detail |
| Valuation | `inventoryService.getInventoryValuation` + per-line value from stock rows |

Configuration items without an existing backend (Operation Types, Locations config,
Storage Categories, Putaway Rules, Attributes, Delivery Methods, Package Types)
render a shared `InventoryConfigPlaceholder` page (honest empty-state describing the
future capability, linking to related settings). Settings → `/settings#warehouses`,
Warehouses → `/warehouses`, Categories → `/categories` (existing modules).

## Files

- `config/routes.ts` — new `routes.inventory` block
- `app/shared/nav-dropdown-panel.tsx` — optional `sections` prop
- `app/shared/inventory/` — `inventory-nav-header`, `inventory-dashboard`,
  `inventory-moves`, `inventory-stock`, `inventory-locations`,
  `inventory-valuation`, `inventory-physical`, `inventory-procurement`,
  `inventory-replenishment`, `inventory-config-placeholder`
- `app/(hydrogen)/inventory/` — `layout.tsx`, `page.tsx` and one thin page per
  menu entry (`transfers`, `receipts`, `deliveries`, `internal`, `adjustments`,
  `physical-inventory`, `scrap`, `procurement`, `replenishment`, `stock`,
  `locations`, `valuation`, `moves`, `configuration/{operation-types, locations,
  storage-categories, putaway-rules, attributes, delivery-methods, package-types}`)
- `middleware.ts` — add `/inventory/:path*` to the auth matcher
- `layouts/hydrogen/tenant-menu-items.tsx` — Inventory entry under the Inventory
  section (also feeds the app launcher)
- `shared/warehouses/warehouses-nav-header.tsx` — direct link to Inventory

## Out of scope

New server models/endpoints for operation types, storage categories, putaway rules,
package types, delivery methods; multi-step Odoo routes (2/3-step receipts).
