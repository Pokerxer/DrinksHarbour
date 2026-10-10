# Wyncity files 22 and 23

Superseded preparation: user later requested the whole template11 file instead. Use `docs/memory/wyncity-product-template-11-full.md` and its full92-row workbook. These overlapping older files must not also be imported.

Prepared 7 October 2026 from the two supplied Product Variant workbooks (20+10 rows). Live read-only catalog includes workbook21's completed import: 1,212 Products, 1,077 Wyncity listings, 1,102 sizes.

- Combined output: `outputs/wyncity-2026-10-07/Wyncity_unmatched_stock_import_22_23.xlsx`.
- Stock Import: four complete new rows, 350 units total. Coke 600ml (source60cl), Fanta Orange35cl, Five Alive Berry Blast75cl, Power Horse Energy Drink25cl.
- Existing Chivita Active Carrot + Orange1L excluded by barcode.
- Needs Details: 25 unmatched held. Fill yellow confirmation fields before regenerating import. File23 Sales boolean is not a retail price; all ten rows need selling prices. Soft-drink volumes absent must be confirmed, not inherited from wine/spirit defaults.
- Four negative counts preserved, not imported or converted to zero. Spirit Can may be Sprite Can but is not silently renamed/merged. Tomi sparkling by24 requires packaging/identity and zero-cost/NGN1 price confirmation. Predator40cl needs supported custom-size handling.
- All source costs/prices/barcodes/quantities retained, including full-precision costs and boolean Sales. Import and review matrices reopened exactly; independent source/size checks and all-sheet visual review passed.
- No live database changes for this batch. Prior heroogene@gmail.com attribution applies to completed workbook21 import; do not infer authorization to commit new batch from uploads alone.

## Latest revision

User's Product (product.template) (11).xlsx resolves seven missing file23 prices. Applied33cl only to cans explicitly named Can with no explicit volume; ambiguous Spirit Can remains held. Retained explicit sizes, shared canonical names across can/bottle size variants, and latest Sprite35cl count558.

Use `outputs/wyncity-2026-10-07/Wyncity_unmatched_stock_import_22_23_updated_11.xlsx` instead of original batch workbook: 11 ready size rows / 7 products / 2,790 units, 18 held, 1 existing excluded. Additional template11 products outside the old30-row batch are not included. Predator/Pure Heaven/Schweppes Ginger still lack prices. No live imports; do not import both revisions.
