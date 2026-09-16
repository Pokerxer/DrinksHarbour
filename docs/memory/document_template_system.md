---
name: Tenant document template system
description: Eight integrated PDF layouts, scoped defaults and shared export UI; live acceptance check pending tenant login.
type: project
---

The user approved eight styles on 2026-09-07: Classic, Modern, Editorial, Ledger,
Signature, Axis, Atelier, Blueprint. Implemented under Settings → Document
templates; persists Tenant.documentTemplates through own-tenant GET/PUT endpoints
with settings:write authorization. Missing preferences resolve to Classic.

Existing sales, purchases, price-list, stock, A4 invoice, movement-history and
legacy direct-print outputs now use a common preview/export dialog. Selection is
explicit per PDF; no global palette or tenant localStorage. Thermal receipts/CSV
unchanged. Generic issuer enrichment must never relabel the platform address as
a tenant address or replace a selected warehouse's letterhead.

Server suite: 2,744 passed after allowing local HTTP sockets. Admin suite: 1,780 passed across 108 files.
Actual PDFs for all eight styles inspected and supplied in docs/document-templates.
Unrelated project TypeScript failures remain; touched template files are clean.

User authorized using the displayed local test account, but login rejected its
credentials. A working tenant session is needed for final save/reload browser
acceptance; do not reset passwords. See [resume](../superpowers/specs/RESUME-document-template-system.md)
for exact coverage and next actions. No commits or pushes.

2026-09-08 navigation follow-up: centralized routes.documentTemplates and added
an administrator/owner shortcut in the tenant menu/launcher. Settings brand goes
to General; only the most specific tab is active, with accessible link labels.
Manage defaults closes the export dialog and uses Next navigation. Password/MFA
sign-in now honors a validated same-origin callbackUrl, and stale-session redirects
preserve print query options. Regression/auth checks: 66 tests across 10 files
passed. Live authenticated acceptance still requires a working tenant account.

2026-09-08 design correction: user asked to use the original document design.
Historical reference is pdf-render.ts at 3c78f3fc. All eight choices now share the
original slanted header, badges, party/reference cards, compact bordered table,
rounded totals/notes and muted signatures. Palettes and saved IDs are retained;
Classic uses the original red/gold. Replaces prior eight different compositions.
Gallery thumbnails and sample PDFs refreshed. Print suite: 57 tests passed;
all eight catalogue pages visually compared with the historical PDF.

Cloud Bay preview requested: docs/document-templates/cloudbay-pricelist-preview.pdf
and .png use nine saved snapshot products through the actual pricelist builder
and Classic renderer. Explicitly labelled sample; no live pricing/discount/stock
verification. One-page generation checked; temporary generator removed.

Unit-price alignment follow-up: header and secondary price text now use the
column alignment, with matching horizontal padding. Right-aligned amounts and
was-prices share an edge in all PDF templates. Screenshot values rendered in
docs/document-templates/cloudbay-alignment-preview.pdf/.png; visually checked.
Print suite plus temporary preview check: 58 passed; preview harness removed.

2026-09-15 POS integration: shared templates now cover POS orders, sessions,
order analysis, order detail invoices, checkout receipts, returns, session
reports and Z-reports. POS preference reads use protected `/api/pos/document-
templates` and are read-only; admin Settings remains the write surface. A4
adapters preserve totals, refunds, payments, session controls and tenant issuer
details. Thermal receipts and wide sales analytics retain specialized formats.

2026-09-15 masthead spacing correction: long tenant names now fit on one
independent baseline, with address, contact details and the department badge on
their own fixed lines. This prevents the Cloud Bay business name from
overlapping its address in every shared invoice, quotation, purchase, stock and
pricelist template. Cloud Bay alignment preview PDF/PNG regenerated.

2026-09-15 pricelist bundle correction: `/inventory/stock` customer pricelist
printing now preserves the exact markup-on-cost bundle calculation to two
decimal places instead of rounding it up to the nearest ₦100. Checkout pricing
behavior is unchanged; the change applies to the printed PDF, HTML and CSV
pricelist outputs. Inventory pricelist regression coverage: 140 tests passed.

2026-09-15 pricelist matrix controls: the print modal now lets staff hide the
Bundle Qty column (the heading shows `Bundle Price ×N`), toggle “was” prices,
and add up to three named price columns linked to separate tenant pricelists.
Those columns flow through PDF, browser print and CSV output.

Column headings now inherit the selected pricelist name automatically, and the
modal provides up/down controls to reorder added price columns before export.

2026-09-15 bundle-column correction: added pricelist columns now resolve a
selected pricelist's bundle tier before falling back to its unit price, so
wholesale/distribution columns show the saved bundle value rather than retail.

Exports wait for added pricelist rules to load, and reuse the full primary
pricelist document when selected again as an added column, preventing fallback
to retail values.

Inventory stock CSV export now includes the size-level Wholesale Price field.
This is required for Cloud Bay pricelist rules that calculate distribution or
wholesale bundles from a wholesale basis.

Wholesale reference alignment: bundle-based added columns now always label their
bundle quantity (for example `Distributors Price ×6`) and print the tier total;
the recommended sales column remains the standard unit price. This matches the
uploaded wholesale-price-list reference layout.

Reference layout clarification: added bundle-based columns now print the tier
total as the headline value (for example `Distribution Price ×6`), with the
original tier total available as its “was” value. Unit Price remains the
recommended per-unit column.

Duplicate coverage warning keys in the print modal now include the item index,
so repeated rules with the same label/reason render safely without React key
collisions.

Price-source cards now support multi-select: the first selected pricelist drives
Unit Price and subsequent selections become named, reorderable price columns.

2026-09-09 commit verification: all 57 current print tests across eight files
passed. Includes refreshed sample PDFs and Cloud Bay previews in the commit.
No push or deployment requested.

Generated `docs/document-templates/cloudbay-requested-pricelist.pdf` from the
uploaded 2026-09-15 Cloud Bay inventory CSV. Standard unit selling prices are
included; distribution and wholesale columns are marked as requiring their
pricelist rules because those rules were not present in the CSV.
