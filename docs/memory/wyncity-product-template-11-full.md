# Wyncity replacement template 11 batch

Completed live import after explicit user approval, 7 October 2026: deduplicated both requested files into 51 unique sizes / 40 new pending central Products / 40 Wyncity listings / 8,388 units in Wyn City WH-001. Verified 35 stock movements and unchanged original 1,077 listings, 1,102 sizes and 1,107 warehouse-stock records. Only missing Amstel 664 units recovered after partial connection errors; no whole-file retry. Two new alcohol flags corrected and audited. 31 held rows and 10 existing exclusions not imported. DO NOT reimport full or clarified sheets. Final evidence: `outputs/wyncity-2026-10-07/wyncity-template11-import-recovery-result.json`; details and known product-type validation issue: `docs/superpowers/specs/RESUME-wyncity-template11-live-import.md`.

Preparation history: user asked towork on48held rows.17resolved using exact-barcode research; `outputs/wyncity-2026-10-07/Wyncity_unmatched_stock_import_template_11_clarified.xlsx`:51readyrows,40products,8,388units;31held,10existing. Original34readyrows unchanged. These ready rows are now imported. Details: `docs/superpowers/specs/RESUME-wyncity-48-clarifications.md`. Questions about8negativecounts,Heinekenkeg/serving,anduncertainpacklabels remainawaitinguser.

On 7 October2026 user explicitly replaced the earlier partial22/23 batch with all92 rows of `Product (product.template) (11).xlsx`. Latest deliverable: `outputs/wyncity-2026-10-07/Wyncity_unmatched_stock_import_template_11_full.xlsx`.

- 34 import-ready size rows / 23 products / 6,501 units; 48 held; 10 existing/same identity excluded.
- Import only Stock Import; Needs Details and Match Review are confirmation/reference tabs. No live stock changes this turn.
- User defaults: unspecified named cans33cl, wines75cl, spirits70cl, syrups70cl, puree1L; explicit sizes override. Never apply spirits70cl to beer or ready-to-drink mixtures; unlabeled juices and energy drinks remain held.
- Source costs, sales prices, quantities, text barcodes preserved exactly. Negative counts never silently zeroed. Importer types/sizes, duplicate grouping and source reconciliation independently verified; all three tabs visually checked.
- Replaces overlapping22/23 preparation artifacts; never import multiple versions. Earlier workbook21 import was already completed; do not repeat it. Email previously provided is not fresh authorization to import this batch.
- Full details and restart instructions: `docs/superpowers/specs/RESUME-wyncity-product-template-11-full.md`.
