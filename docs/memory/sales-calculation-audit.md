---
date: 2026-10-15
type: project
---

# Sales overview audit

User requested `/sales` functionality/calculation fixes and approved focused
layout changes (mobile rows, spacing, Refresh). Resume:
`docs/superpowers/specs/RESUME-sales-calculation-audit.md`.

Actual server lifecycle groups use title-case labels; normalize before lookups.
Server now supports quoteStatus grouping and additive net outstanding (payments
and allocated credits deducted in kobo). Overview financial reads are NGN-only;
eligible order balances exclude draft/cancelled orders and include partial debt.
Month start is Lagos-based. Every capped aggregate, including monthly, warns.

Request state is token-scoped and guards late responses. Signed-out loading ends.
Mobile recent rows preserve document/customer/state/value; quotations do not get
an Unpaid badge. Refresh reloads all reads; no write/reconciliation occurs on GET.

Sales order balances are operational, not guaranteed posted invoice balances.
Keep the group cap warning and do not blend currencies. Current rules live in
`client/apps/admin/src/app/shared/sales/sales-overview/README.md`.
Verification and browser sign-in limitation are recorded in the resume file.
Final server3817 passed/14 optional skips; Sales23 passed (also under UTC).
Full admin2894 passed/4 unrelated timeout failures; all four affected files passed
their serial rerun (16 tests). No timeout workarounds. Typecheck359 existing
diagnostics/no overview errors; targeted lint/whitespace clean. No live writes,
commit, push or deployment. Authenticated visual checks await a signed-in browser.
