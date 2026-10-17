---
date: 2026-10-15
type: preference
---

# Compact Sales spacing

User requested reduced padding across `/sales` pages after the overview audit.
Use 12px page padding (16px on wide create/edit views), compact shared navigation
and 8px vertical list-row padding. Overview cards/detail shell panels use16px
instead of24/20px. Overview section gaps16px; tile gaps12px. Keep existing widths,
responsive layouts and functional behavior. Print routes/templates are excluded.

Handoff: `docs/superpowers/specs/RESUME-sales-calculation-audit.md`.

Follow-up explicitly names `/sales`, `/sales/orders`, `/sales/fulfill` and
`/sales/returns`: these use full-width8px page padding and8px Hydrogen gutters
instead of the centered max-w-7xl cap and16–40px outer gutters. Other routes keep
their layout gutters. Fulfillment/returns cells use12px horizontal/8px vertical
padding; heading gaps12px and empty states48px. This supersedes the general12px
page-padding preference for these four routes only.
