# Wyncity template16 stock/cost update — completed with held rows

## Verified update — 27 October 2026, 17:26 Lagos

Supersedes earlier pending notes below. User renewed stock/cost request after WH-001 recovery. Updated 696 matched existing rows in 20 audited transactions: 684 absolute stock balances and 167 tenant Size standard costs (overlap). 258 already matched, untouched. 317 held for missing/unrecognized barcodes, conflicting sizes/identity/vintages, batch reconciliation, missing target stock lines, zero cost or pack ambiguity. No forced matches/new products.

Fresh independent verification 16:26:23UTC passed: same1,282 WH-001 lines now26,297units; selling prices/publication, other warehouse quantities, all batch records and every pre-existing movement unchanged. Added one entry in each stock ledger per684adjustments and20systemaudits covering696rows exactly once. Verified tenant owner request account heroogene@gmail.com; system maintenance audit, no JWT forging. No application-code changes in this update follow-up.12helpertests passed.

Evidence/review under outputs/wyncity-2026-10-27-template16/: stock-update-before.ejson, stock-update-after.ejson, update-plan.json, stock-update-progress.json, stock-update-result.json, stock-update-verified.json, Wyncity_stock_cost_update_review.md. Never rerun apply-update.cjs --commit or old recovery/imports. Detailed handoff RESUME-wyncity-template16-2026-10-27.md. Future work addresses only317held rows with fresh checks.

UPDATE27October: userauthorizedrestore+prevention. OriginalWH001restoredandindependentlyverified16:05:32UTC;1282lines29405units, alltenantstock/historyunchanged. Rootproductemptywarehouseformdeletionbugreproduced/fixed, modelharddeletesblocked, ordinaryremovaldeactivates. See warehouse-identity-safety.md and RESUME-wh001-recovery-guard-2026-10-27.md. Oldblockerbelowresolved; doNOTreapplyrecovery. Spreadsheetstock/costupdatesstillpendingidentity/size/cost/batch/reservationreview, notappliedduringrecovery.

2026-10-27 user requests existing Wyn CityWH001stock/cost updated using Product(product.template)(16).xlsx barcodes+product info. Quantity On Hand treated as target balance, not added receipt; selling prices/publication unchanged. Read-only source/live comparison prepared under outputs/wyncity-2026-10-27-template16/. No DB/workbook writes.

BLOCKER: live14:13:04UTC exact global Warehouse6a32ad2c78f1e3c27bda089a lookup null, while1282WynCitystock rows/29405units still reference originalID. OnlyWH002/003warehouse records exist. Ask user to authorize restoring original warehouse then resume update. Do not create anotherID, rerun old recovery/import or rewrite orphanedstock. Prior10October recovery is historical; subsequent deletion cause unknown.

1271source rows;82missingbarcodes, no populated duplicates, GiftBoxcost0hold. Preliminary matches613exactbarcode/name,413barcode/namevariation review,163no barcode match. Not final updateapproval. Need identity/size review,reservation/batch checks,beforebackup,supportedtransactionalstockadjustment/costupdate and independentverification after warehouse resolved. Details docs/superpowers/specs/RESUME-wyncity-template16-2026-10-27.md.
