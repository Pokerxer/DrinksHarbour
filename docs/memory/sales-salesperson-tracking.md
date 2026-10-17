# Salesperson tracking

User asked for correct salesperson tracking on /sales/quotations (2026-10-16).
User authentication exposes firstName/lastName, not name. The old creation
controller saved a blank name; duplicates omitted assignment entirely.

server/services/salesSalesperson.js owns actor name/ID derivation and the
authenticated My Quotations predicate. SalesOrder retains salesperson as the
historical display string and adds salespersonUser (User ref, tenant composite
index). Creation/import pass server-derived assignment; edits cannot change it,
and duplication preserves it. Conversion updates the same document.

My Quotations sends myQuotations=1, never a client session name/ID. Server ANDs
the actor predicate with tenant/search/advanced filters before returned-order
expansion, pagination/counting and grouping. Linked records match by actor ID;
legacy unlinked records may match their stored name. Missing historical names
remain unknown. No bulk reassignment or production data migration performed.

Board cards now show the same snapshot used by table, spreadsheet and export.
Evidence and final verification: docs/superpowers/specs/RESUME-sales-salesperson-tracking.md.

Verified: full backend3901 pass/16 optional skips;44 focused frontend tests pass;
touched lint, server syntax and diff checks pass. Type baseline remains359
existing diagnostics. Restricted HTTP test run failed to bind ports; rerun with
local-network permission passed. No production data changes or deployment.

2026-10-16 user superseded preserve-on-edit for quotations: salesperson now
means latest successful quotation editor. saveSalesEdit in salesSalesperson.js
stamps the authenticated name/ID in the same save for content, price-update and
coupon endpoints. Reassignments log activity after persistence. Rejected/read-only
edits and failed saves retain assignment. Sales-order edits remain unchanged.
Force both actor paths modified even if equal to loaded values, so an older
loaded document cannot omit attribution from a later successful save.
Verification:38 focused tests and full backend3909 passed/16 optional skips;
server syntax and whitespace checks pass. Full evidence is in the resume.

Completion overrides latest-editor attribution: final manual/POS delivery
snapshots and locks the completing user's name/reference. Details and guard
contracts: docs/memory/sales-fulfillment-attribution.md. Historical fulfilled
orders are not reassigned automatically without completion evidence.
