# Extracted product inventory workbook

2026-09-21: Converted the Downloads `extracted_product_list.xlsx` (90 rows) to
`outputs/01a0c4d2-inventory-import/extracted_product_list_import.xlsx`.
User confirmed Price (NGN) means selling price per item/set. First sheet matches
the inventory importer's 14 headers. Quantities and prices remain numeric.
Purchase costs are unknown, not inferred from retail prices. Count-based sizes
use unit-single except explicit six-piece and two-piece sets.

Missing source data: Signature Collection (Baylis & Harding) lacks price/quantity;
Cashew Nut lacks price. Highlighted in the workbook and explained in Review.
Linking existing catalog products requires positive costPrice. Opening quantities
require a warehouse selection. Live import was not performed.

## Subsequent authorized CKay import

User asked to add these products to CKay, then explicitly instructed temporary
cost price to equal selling price. Import completed through existing service
functions for 88 complete rows (144 sellable items/sets), with two unpriced rows
held pending. Target Gift Center, tenant `6aabec2b9294f4afed5ce61f`.
Jack Daniel's Old No. 7 links to existing Product `6a5a2a991d733baa9e9151b0`.
Per-row verification/progress lives in `outputs/01a0c4d2-inventory-import/ckay-import-progress.md`.
Do not blindly rerun imports: check the results and reconcile any partial write.
The delivered workbook predates the cost-equals-selling instruction and retains
blank cost columns; the authorized live import applies the new costs separately.

Final read-only verification on 2026-09-22 passed: 88 imported SubProducts, 144
units/sets, 92 CKay SubProducts total, four original listings unchanged. Created
87 pending central Products and linked one existing Product. All prices, costs,
size stock, warehouse quantities and opening movements match. Two unpriced rows
remain pending user data. Evidence: `outputs/01a0c4d2-inventory-import/ckay-final-verification.json`.

All source rows reconcile after export, isolated importer validation returns zero
row errors, and 17 existing importer tests pass. See
`docs/superpowers/specs/RESUME-extracted-product-inventory-import.md`.

On 2026-09-22 the ckay taxonomy was created so these products can be categorized
when edited: 3 new top-level categories (Snacks & Treats, Beauty & Grooming,
Home & Living) and 17 subcategories (8 new + 9 added to existing glassware /
drinkware-flasks / bar-tools-equipment / gift-sets-hampers). The size taxonomy
was extended the same day (11 new size values: bar-single/bar-2, bag-100g–1kg,
tin-single/200g/500g, box-single; plus SIZE_OPTIONS/size-preset tabs and
getSizesForType coverage for glassware, bar_tool, decanter, gift_set, snack,
beauty/home). Full product→shelf mapping lives in
`docs/superpowers/specs/RESUME-ckay-taxonomy.md`. The 88 imported products were
NOT re-categorized, published, or re-sized in this step.
