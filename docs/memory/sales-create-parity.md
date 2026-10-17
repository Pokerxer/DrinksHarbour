---
name: Sales create workspace parity
description: Invoice workspace improvements applied to Sales create with quotation semantics.
type: project
---

User requested all invoice-session improvements on `/sales/create`.
Pricing/dropdown/autosave improvements already applied through the shared editor.
Remaining header, review sidebar, collapsible activity, action states and draft
loader parity are implemented. Sales draft URLs now retain the create route with
`?draft=<id>`; the shared SalesDraftWorkspace loads them and exposes auth/retry.
InvoiceCreate composes the same loader with invoice=true.

Save/print/confirm share an action gate; print/confirm force-save current edits.
Confirmation retry checks the existing source before writing, and navigates to
an already-converted order instead of reconverting. Actual products and finite
line values are required; positive totals are required for confirmation. Sales
keeps currency support and quotation expiry; confirmation creates a sales order.
Existing extra header functions remain in sales-create-more-actions.tsx.

Full admin suite: 2,794 passed (335 files). Touched-file lint clean; 359 existing
typecheck errors, none in parity files. No live writes or deployment. Browser
verification remains blocked by the previous security denial. See
docs/superpowers/specs/RESUME-sales-create-parity.md for files and verification.
