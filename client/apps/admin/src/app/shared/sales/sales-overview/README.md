# Sales overview

`/sales` is the existing tenant Sales overview. Monetary tiles cover NGN orders
and quotations, not converted mixed-currency totals. Recent documents retain each
document's own currency. No write happens on load or Refresh.

- Server group IDs are display labels; normalize them before lifecycle lookups.
  Quotation grouping must use the real quoteStatus extractor.
- Booked this month: confirmed/partially fulfilled/fulfilled NGN order totals,
  using the Africa/Lagos month boundary. This is booked order value, not GL income.
- To deliver: confirmed and partially fulfilled orders; the displayed value is
  whole order value, not the unshipped portion of each order.
- Open quotations: draft and sent; expired counts are shown separately.
- Outstanding orders: eligible order totals minus recorded payments and allocated
  credits, per order in kobo, clamped at zero. Include partial balances; exclude
  drafts and cancellations. This is an operational order balance, not a claim
  that every Sales order has a posted invoice in the accounting ledger.
- Capped groups (including monthly groups) show the incomplete-total warning.
- Scope requests and displayed results to the current token; ignore superseded
  responses. Signed-out users must not see a perpetual loading state.

Keep the route thin, request state in `use-sales-overview.ts`, money definitions
in helpers and presentation in the KPI/recent components. The 2026-10-15 request
approved focused mobile/spacing changes and a Refresh action, not a new dashboard.

Handoff: `docs/superpowers/specs/RESUME-sales-calculation-audit.md` at repo root.

Spacing preference: compact Sales pages use12px outer padding,16px card padding
and16px section gaps. See `docs/memory/sales-spacing.md`; keep tap targets usable.

Odoo-inspired operations links now open Deliveries, Returns history and Customer
invoices. New return creation remains inside the returns workspace. Read its
rules in `../sales-operations.README.md`; goods, credits and refunds are separate.
