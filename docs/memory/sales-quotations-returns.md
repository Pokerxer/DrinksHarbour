---
date: 2026-10-15
type: project
---

# Returned orders on quotations

User requested `/sales/quotations` show orders with returned goods. Keep existing
quotations and add returned orders; do not turn orders back into quotations.
The route opts into `includeReturnedOrders=1` through the shared parameter
builder. `server/services/salesQuotationReturns.js` resolves actual Sales/POS
returns and unions qualifying IDs before count/pagination/grouping. All reads
remain tenant-scoped; search and advanced filters remain in force.

Read-only hasReturns annotates result rows/groups. Lifecycle label retains the
delivery state with Returned appended. Quotation kanban gives those orders a
Returned orders bucket, including legacy convertedFrom-linked POS returns.

Resume and verification: `docs/superpowers/specs/RESUME-sales-quotations-returns.md`.
Local contract: `client/apps/admin/src/app/shared/sales/sales-quotations.README.md`.

Full tests:2909 frontend passed;3821 backend passed/14 optional skips. Focused
regressions:42 frontend and31 backend passed. No authenticated visual verification.
Typecheck remains at359 existing diagnostics; no new list/quotation diagnostics.
Lint has only the existing two duplicate-import warnings; diff whitespace clean.
