# Stock list includes nonpositive and unassigned lines

2026-10-04. Resume: docs/superpowers/specs/RESUME-inventory-stock-zero-products.md.

Warehouse stock endpoint already includes persisted zero and negative balances.
Products absent from the warehouse ledger are displayed only when stock/all opts
into includeUnstocked=true. /inventory/stock requests this option; analysis,
valuation and counts keep their ledger-only data. Tenant SubProduct/size catalog
completion adds zero display rows under Unassigned. Never create fake warehouse
assignments or history to render zero lines. Deduplicate by tenant selling instance
and size across all warehouses, not by product name. Keep size population matched
to tenant. Synthetic ids are display-only; exclude blank warehouse ids from import
warehouse choices and warehouse counts. See inventoryStockCatalog regression tests.
