# Invoice payment badges — 2026-10-14

Shared payment-status-badge across invoice list/mobile/detail/summary. Paid green,
Partially paid blue, Unpaid amber, Payment closed gray for cancellation, including
when the stored historical payment status is paid. Explicit text + hidden icons;
separate invoice Draft/Posted state. No financial status recalculation, backend
writes or template changes. Shared inventory PDF flow remains intact.

Cancelled invoices say No payment due instead of green Settled.
22 focused tests pass; lint clean; 359 existing type errors unchanged. Final full
frontend: 2,814 passed in 338 files, zero failures after the cancellation fix. Resume:
docs/superpowers/specs/RESUME-invoice-payment-badges.md.
