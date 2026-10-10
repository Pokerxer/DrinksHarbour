# Warehouse quantities in stock imports

Updated 2026-10-04. Handoff:
`docs/superpowers/specs/RESUME-warehouse-stock-import.md`.

Imported quantity belongs to the selected warehouse and size. Update replaces
that local balance; other warehouses are untouched. Size/SubProduct stock remains
the aggregate across locations. Blank quantity means no stock change, zero means
clear that warehouse in Update. Require a warehouse even for explicit zero.

Use `warehouseImportStock.js` and canonical warehouse adjustStock. Never follow
adjustStock with recordReceiptMovement: it duplicates audits and increments the
aggregate size stock again. Propagate warehouse errors rather than reporting a
successful aggregate-only fallback. Tenant-scoped WarehouseStock rows derive size
stock and available stock; the canonical warehouse writer recalculates SubProduct.

Regression example: A=10, B=30, import A=5 => A=5, B=30, total=35. Repeat =>35.
Import A=0 => total=30, still in stock. Tests enforce these rules. No live data
repair was performed; the change applies to subsequent imports.

History follow-up: each imported stock update and both history entries commit in
one MongoDB transaction with aggregate rollups. Include Product in auditContext so
product history can show its name. Warehouse before/after and signed delta are
local, not aggregate. Keep zero-delta recount audits without counting stock twice.
Source is sync; import descriptions are searchable. Do not swallow transaction
audit failures. Use ordered:true for session-bound document arrays, and always
end the session. Pricing/catalog creation outside the stock step isn't part of
this transaction. Existing history wasn't rewritten.
