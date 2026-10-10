# Warehouse analysis filters

See [resume](../superpowers/specs/RESUME-warehouse-analysis-filters.md) and
[plan](../superpowers/plans/2026-10-03-warehouse-analysis-filters.md).

Use `product_<SubProductId>` and `warehouse_<WarehouseId>` for exact choices;
never key product selection by a display name. Same-section selections match
any choice; different sections intersect. Text queries further narrow exact
selection. Stock states are alternatives and use server flags when available;
reserved/expiry conditions intersect with them.

Wait for tenant stock plus product metadata before exposing the ready report.
Build choices from unfiltered report stock so selecting one product doesn't
remove the others. All reporting consumers must share the filtered rows.
Preserve individual chip removal, Clear all and string-key favorite compatibility.

Verification 2026-10-03: admin 197 files / 2,268 tests passed; full log
`/tmp/warehouse-analysis-admin-final.log`. Existing typecheck baseline remains
390 errors, no changed analysis paths; `/tmp/warehouse-analysis-types-final.log`.
No backend/live stock writes, historical migrations, commits or deployment.

Per-location usage: `WarehouseAnalysis` accepts an optional `warehouseId` and
scopes source rows before any filters/aggregation. Local favorites use a key
suffixed with that ID. See [per-warehouse analysis](per-warehouse-analysis.md).
