---
date: 2026-10-15
type: project
---

# Odoo-inspired Sales operations

User approved compact delivery/return queues with search, order warehouse/status
filters, counts, selling quantities and review links, plus overview navigation.
Resume: `docs/superpowers/specs/RESUME-sales-operations-workspaces.md`.
Local rules: `client/apps/admin/src/app/shared/sales/sales-operations.README.md`.

Both loaders read all pages, compose Sales/POS returns and deduplicate IDs. State
is token-scoped with late-response protection; failure hides misleading empty
counts and supports Retry.25-row pagination happens after complete filtering.
No financial summary across currencies; original order value is not a refund.
Goods returns, credits and cash refunds remain separate workflows.

Quantity correction: original unshipped = ordered minus gross fulfilled, clamped
at0. ReturnedQty is already part of fulfilledQty; subtracting it again hid open
deliveries. Client/server helpers now agree. Full delivery plus return stays at0
original unshipped units: replacement delivery needs an explicit new workflow.
No historic record rewrites or stock/financial mutations performed by this work.
Verification and auth/browser limitations are recorded in the resume file.
Final full suites:2906 admin tests passed;3818 backend passed/14 optional skips.
Focused operations/overview32 passed and fulfillment28 passed. Lint/diff checks
clean; remaining project type diagnostics are recorded separately in the handoff.
