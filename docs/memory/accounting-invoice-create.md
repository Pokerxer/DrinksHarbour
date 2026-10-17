---
title: Invoice creation design and functionality
date: 2026-10-13
status: implemented and verified locally
---

# Invoice creation

User requested the same design/function pass on `/accounting/invoices/create`.
Read `docs/superpowers/specs/RESUME-accounting-invoice-create.md` for the concrete
proposal, implementation and verification. The user approved the design and
the creation workspace has been implemented.
The existing SalesCreate invoice context must retain product/pricing/tax/cart/
scan/address/terms features and transactional unpaid issuance of one SalesOrder.

Invoice context now has distinct action states, invoice details, due date,
totals/readiness and draft recovery. Shared SalesCreate has been split into
focused editor, overlays and action/prefill hooks. Keep normal quotation layout
and terminology via invoice-only props; keep all existing sales features.

Browser access was rejected by the URL security policy; no workaround was
attempted. Source/fixture review and automated checks were used instead.

Functional invariants: one foreground save promise per draft; never issue or
print an older snapshot if newer edits remain dirty. On unmount, let an active
save assign its id before flushing later edits as PUT. A failed save or known
issued source must not be rewritten/reposted. Preserve dueDate:null on create
as unset; omission still derives the date from payment terms. No new endpoints
or schemas. The server remains authoritative for tenant ownership and journals.

Full server suite: 3,750 pass, zero fail, six skipped. Full admin suite:
2,773 pass across 326 files, zero failures. Focused accounting/autosave: 92 pass.
Lint and whitespace checks pass. Full TypeScript still has 359 existing errors,
with none reported in invoice creation/composition/autosave files. No live
financial writes, commit or deployment occurred. Browser visual testing remains
blocked by its URL security policy; component fixtures and interface checks were
used. Read the handoff for detailed counts, files and limits.
