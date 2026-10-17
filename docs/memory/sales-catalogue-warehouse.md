# Sales catalogue warehouse membership

2026-10-16 user requires displayed catalogue items to belong to the selected
warehouse. Warehouse ID was already passed correctly, but stock joins only
decorated rows, leaving tenant-wide products visible.

server/services/sales-catalogue.js now joins warehouse stock and filters actual
membership BEFORE facets/counts/pages. sales-catalogue-stages.js supplies a
warehouse-size filter used before variant SKU search and price sorting, or
before projecting paged sizes. Other-location variants cannot be added from
the picker. Tenant scope and foreign-warehouse rejection remain enforced.

Preserve out-of-stock selection requested earlier: a stock record with zero
available units still belongs to the warehouse. Only In stock requires positive
availability. No warehouse selected retains all-location browsing. Frontend
scope cancellation/cache guards remain; empty-state copy explains assignment.

Verified with a real disposable Mongo fixture (9 backend tests, no skips),24
frontend tests, lint/syntax/diff checks. Fixture dropped; Mongo stopped. No real
inventory changes. Details: docs/superpowers/specs/RESUME-sales-catalogue-modal.md.
