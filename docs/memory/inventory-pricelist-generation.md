# Inventory price-list columns

`/inventory/stock` uses `inventory-pricelist-print-modal.tsx` and its adjacent
column picker, document options, preview, settings, pure data helpers and data
hook. Keep the components small. No backend/schema changes were needed.

`PricelistPrintOptions.priceColumns` is the explicit ordered output contract.
Each entry has a label, full pricelist (or null for retail) and `unit`, `bundle`
or `auto` mode. `inventory-pricelist-columns.ts` computes all columns from the
original size-level values; never chain column results. The persisted `bundle`
mode now means pack/bundle total: use an eligible bundle, otherwise price the
size's unitsPerPack through per-unit rules at that quantity. Missing full rules
throw rather than silently quote retail. Legacy adapters remain supported.

Follow-up 2026-10-02: the user's real screenshot exposed a formula-only list
incorrectly rendered as unavailable in bundle mode. `inventory-pricelist-quote.ts`
now handles formula packs and quantity-gated formulas. The user explicitly
requested saved wholesale-price fallback for products not covered by a selected
list's rules. Label those cells `Saved wholesale price` in preview, PDF, HTML
and CSV; PDF/preview explain that no selected rule covers the product. Do not
change saved rule scope or product prices to force the sample's numbers.

Read-only database inspection confirmed Cost price = wholesale basis +7.5%,
while Wholesale Price's two rules target other products. The three Lagar sizes
have wholesale bases 11,808 / 13,392 / 11,808 and pack size 6. Cost-price pack
totals are 76,161.60 / 86,378.40 / 76,161.60; wholesale fallback pack totals are
70,848 / 80,352 / 70,848. Retail remains saved 16,000 / 18,000 / 16,000.

The UI blocks exports until directories, selected full rules and any requested
catalogue are loaded. Failures support retry. Preserve cancellation and the
tenant/user/token remount boundary; never persist global rule caches. Settings
use `dh-inventory-pricelist-print-v2:<tenant>:<user>`. Old unscoped storage is
not read. Catalogue and list requests follow pagination. An empty explicit
product selection must not export the current stock view.

Tax wording is optional and never alters prices. Formula bundle totals retain
precision until final rounding; other discounts keep per-unit rounding.
PDF, print and CSV all use the same column grid. Per-row bundle quantity avoids
assuming one pack size for an entire list.

Verification 2026-10-02 follow-up: admin 2,242/2,242, server 3,226/3,226, rendered reference
fixture verified as a one-page PDF. Full TypeScript check retains unrelated
existing project errors; changed price-list files have no reported errors.
Browser automation could not initialize because its sandbox kernel exited;
interaction behavior was exercised using React Testing Library, and the
actual rendered PDF was visually inspected.

Handoff: `docs/superpowers/specs/RESUME-inventory-pricelist-generation.md`.
Sample: `docs/document-templates/inventory-generated-pricelist-preview.pdf`.
Actual screenshot correction: `docs/document-templates/inventory-corrected-pricelist-preview.pdf`.

Latest presentation request (2026-10-02): remove “Saved wholesale price · ”
from price cells. PDF, HTML and modal preview now omit this label; the PDF also
omits the obsolete “Prices marked…” note. Fallback calculations and bundle
quantity/per-unit details are unchanged. CSV retains source metadata.
Verification: full admin suite 2,242 tests passed.
