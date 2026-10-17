# Payments summary and filters

2026-10-14. User approved screenshot-focused toolbar changes.

`payments-workspace-toolbar.tsx` composes `payment-summary-strip.tsx` and
`payment-filter-panel.tsx` under client/apps/admin/src/app/shared/accounting.
Keep existing monochrome dashboard styling and font. Received and Verified
refunds lead customer totals; Accounting allocated/unallocated explicitly exclude
source receipts. Vendor view uses Paid to vendors and has no source refund tile.
Unavailable/loading totals and source amounts remain masked with dashes.

Filter controls now have persistent labels and matching height/focus treatment,
a wide search field, responsive stacking and explicit Apply filters. Draft
changes do not trigger intermediary requests. Invalid from/to ranges show an
accessible error and cannot apply. Clear filters resets both applied and unsent
values. Existing hook still resets pagination, ignores stale responses and uses
same-origin authenticated AR/AP transport. No API/accounting record changes.

Regression tests payments-toolbar.test.tsx cover refund visibility, scope labels,
unavailable money, invalid/corrected dates, trimmed search, unsent reset, vendor
wording and applying status/method together. Initial regressions failed before
implementation; first focused toolbar/workspace run passed 10 tests. Final focused toolbar: six passed. Full admin: 2,861 tests passed across 353 files, zero failures. Changed-file lint and diff checks passed. Type check retains 359 pre-existing diagnostics, none in changed files. Single-agent review checked gross/refund separation, unavailable totals, vendor wording and filter/reset/date behavior. CodeRabbit unavailable. Backend untouched; server suite not rerun for this UI-only change. Prior browser restriction remains; no UI
access workaround or live financial writes.

Resume: docs/superpowers/specs/RESUME-payments-toolbar.md.
