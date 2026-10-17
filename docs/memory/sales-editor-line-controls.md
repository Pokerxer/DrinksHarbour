---
date: 2026-10-15
type: project
---

# Sales editor line controls

Approved direction is implemented inline with one agent. No commit/push/deploy or
customer-data operation. Resume/evidence:
`docs/superpowers/specs/RESUME-sales-editor-line-controls.md`.
Colocated rules: sales/sales-editor-controls.README.md under admin shared UI.

Table/footer monoliths are split into small row, input, action and summary files.
Sections group following products; removing headings keeps products. Notes and
product descriptions are multiline, labelled and preserved. New presentation rows
precede an unfinished product without discarding its search text. Notes retain
position in print; product/section totals exclude presentation rows.

packages/sales-money is the shared server/editor contract. Fixed discounts apply
to whole lines. Switching fixed/percentage preserves the resolved reduction;
tax after discounts/promotions and footer amounts round to kobo. Stored lineTotal
is still pre-promotion; displayed untaxed values deduct promotion once. Historical
read-only snapshots are not recalculated. Include packages source in deployments.

Draft pricing now resolves the same tenant promotions as saving, including on
manual-price lines without overwriting their price. Inputs affecting promotions
invalidate preview, text does not. Footer shipping has validated Apply/Remove;
global percentage clearly replaces existing line discounts. Coupon errors reach
the panel, which keeps input; current draft is saved before coupon calculation.
Rewards apply at explicit payment, never unpaid stock Confirm.

Full frontend3024 pass, focused closure36 pass, type359 existing diagnostics.
Backend final results and precise lint/logs are in the resume. No authenticated
browser tab was available; do not claim live visual/account acceptance.

Final backend full3886 pass,16 optional skips. Final saved-label tests consume
stored tax/discount snapshot values instead of recomputing historical rounding.
New numeric input guards reject nonfinite/negative/unsafe line totals. Lint and
whitespace checks pass. Full evidence and final targeted counts are in the resume.

2026-10-16: fixed shared import preceding use-client in useSalesCreateForm.ts.
New sales-client-compile.test.ts uses installed Next loader/SWC server-component
checks across86 client modules; regular Vitest transforms alone missed this.
Always place imports after directives. See resume for verification logs.

2026-10-16 spacing: wider sales line quantity, pack size, packs, unit price and
untaxed total columns; quantity/price fields fill available width. Discount type
is now symbol-only ₦/% with its accessible label and conversion preserved.
Table keeps horizontal scrolling on narrow screens. Seven focused interaction
and Next compiler tests passed; see resume for evidence.

2026-10-16 follow-up: user prefers the earlier inline discount number field with
small adjacent ₦/% toggle (restored from saved table layout), rather than stacked
dropdown and input. Preserve monetary conversion when toggling; show percentage
savings below only when nonzero. Surrounding wider columns remain.

2026-10-16 final column balance: user requested smaller Packs and larger Product.
Packs is now 96px (previously 144px), giving the flexible Product column 48px
more room. Next client compile regression, table lint and whitespace checks pass.

2026-10-16 responsive page: sales-line-responsive.module.css uses editor container
width to switch existing table rows into labelled two-column cards below1200px.
No duplicate controls; Product/untaxed total and section/note text span the card.
Preserve data-label attributes used by card styling. Section subtotal belongs
in the wide text cell. Sidebar stacks until2xl, mobile padding/actions shrink
and wrap, search menus fit inputs, navigation wraps onto its own phone row.
Live local create-page checks passed at320/390/768/1440/1920px, including no
320px page/field overflow and Other Info fitting.17 focused tests, touched lint
and diff checks passed. Details/evidence in resume; no saved business mutations.
