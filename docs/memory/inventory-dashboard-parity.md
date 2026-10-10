# Inventory overview analysis rules

2026-10-04. Handoff: docs/superpowers/specs/RESUME-inventory-dashboard-parity.md.

`/inventory` stock cards/charts/panels/CSV use one filtered warehouse stock feed with includeUnstocked=true. Products match ANY selected ID; warehouse and today's stock health intersect. History dates/references never change current stock. Historical product options can exist without present stock.

Use getAllMovements, never a single capped page, for movement totals. Show persistent incomplete-history warning at safety limit. Only confirmed movements count as stock changes. Warehouse selection uses actual leg warehouse, not both transfer endpoints. Return mirrors with endpoints and Return of ... references reverse original transfer directions; keep gross/returned/net quantities distinct. Net in = transfer in − return out; net out = transfer out − return in. Those are event-period quantities, unlike purchase invoice totals with cumulative later returns.

Keep all stock products/warehouses in finite scrollable charts, including zero/negative values and complete labels; aggregate products by ID, not display name. Failed feeds clear stale data and expose unavailable figures. Do not mix tenant-global low-stock or valuation snapshots into warehouse-selected totals.

Verification: full backend 3,334 passed; full admin 218 files / 2,355 passed. TypeScript remains at the pre-existing 390-error baseline with no changed dashboard/pagination errors. No live authenticated browser verification was performed.
