# Wyncity import 21

Prepared 7 October 2026 from Product Variant (product.product) (21).xlsx after a read-only live Wyncity comparison.

- Output: `outputs/wyncity-2026-10-07/Wyncity_unmatched_stock_import_21.xlsx`.
- 27 source rows; 12 unmatched import rows, 11 distinct new products; 15 existing matches excluded.
- Two Alvisa VSOP 10yrs size rows (50cl, 1L) share one product identity.
- Explicit source sizes override the 70cl spirit default. Wine default remains 75cl; syrup 70cl, puree 1L for future files.
- Existing Otard and St Remy XO have source/database size conflicts; do not create duplicates or modify them without resolving labels.
- Source prices, costs, barcodes and quantities retained, including zero stock and blank barcodes.
- Stock Import is the import sheet; Match Review and Import Guide are reference only. Use Create mode and select correct warehouse.
- No live data changed. Export/reopen matrix, independent source/size validation and visual checks completed.

## Live import request follow-up

User requested import into Wyn City warehouse. Confirmed WH-001 (`6a32ad2c78f1e3c27bda089a`), app preview passed 11 new products / 12 sizes, unlimited budget. Commit stopped before any writes because no primary Tenant.admin is assigned and five admin accounts exist. Need user-selected administrator for required stock-history attribution. See `docs/superpowers/specs/RESUME-wyncity-import-21-execution.md`.

Completed after user selected heroogene@gmail.com: imported 11 pending central Products, 11 Wyncity SubProducts and 12 Sizes through the canonical app importer. 12 total units applied only to WH-001 across 3 nonzero rows; zero rows retained with zero stock. Prices, costs, sizes and barcodes verified. All 1,066 previous listing identities/prices/stock and 1,104 previous warehouse stock records unchanged. Result and independent verification evidence live beside the workbook. Do not re-import this workbook as unmatched; it now exists in Wyncity. Ownership was not changed and no excluded products were touched.
