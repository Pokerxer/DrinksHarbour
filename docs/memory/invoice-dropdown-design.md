---
name: Invoice editor dropdown design
description: Shared accessible menus and consistent suggestion styling.
type: project
---

User approved `docs/superpowers/specs/2026-10-13-invoice-dropdown-design.md`.
`sales-editor-select.tsx` composes the existing RizzUI listbox. It provides
44px touch targets, searchable names, bounded scrolling, wrapping option names,
selection checkmarks, and badges. Pricelist and warehouse use search; payment
terms use the same compact menu without search. Stored IDs and pricing rules
are unchanged. Pricelist async loading/retry and live-arriving options remain.

`sales-dropdown-styles.ts` shares menu surfaces, row spacing and focus styling
with customer/product suggestions. Customer suggestions now support Enter/Space
selection and an accessible Customer field name. Product lookup logic unchanged.

Browser verification remains prohibited by the earlier policy denial. Use
component fixtures; do not bypass that denial. Full verification results and
existing typecheck failures are recorded in the approved design spec.

Final verification: 2,784 admin tests passed; focused 10 passed; touched-file
lint clean. 359 existing typecheck errors remain, including two pre-existing
product-line-search `.data` response-type diagnostics. No commit/deployment.
