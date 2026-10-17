---
date: 2026-10-15
type: project
---

# Sales edit order actions

User requests Odoo cancel, lock, delivery on `/sales/[id]/edit`.
Approved design, implementation and verification are recorded in
`docs/superpowers/specs/RESUME-sales-edit-order-actions.md`.

Cancel now has a confirmation and server guards for lock/payment/delivery/invoice
evidence; bulk cancel shares policy. Navigation is labeled Back to order.
SalesOrder locked/lockedAt/lockedBy persist through new tenant-scoped lock/unlock
endpoints; lock guards edits, coupon/repricing and quotation/confirm transitions.
Delivery and returns remain available. Unlock does not reopen paid/closed orders.

Read-only editor pins original prices/totals despite live price responses,
prevents autosave and prints saved data without editing. Tabs remain inspectable.
Lock forces saving pending draft edits; cancel discards edits only after success.
Session-scoped loader ignores stale responses and shows sign-in/error/retry.
Delivery reuses existing fulfillment, with ordered/gross delivered/remaining
quantities and saved history. Returns do not create new delivery demand.

Local contract: `client/apps/admin/src/app/shared/sales/sales-edit.README.md`.
Backend full suite3827 pass/14 optional skips. Typecheck359 baseline diagnostics;
new files clean. Final frontend suite:2920 passed across367 files. Final focused
tests:19 passed. Lint clean; diff whitespace clean. No authenticated visual check
or deployment performed. Changes remain uncommitted.
