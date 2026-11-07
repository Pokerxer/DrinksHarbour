# WH-001 recovered10October2026

27October2026 recurrence: recordmissingagainwith1282survivingstocklines29405units. Userauthorizedrecovery+prevention. OriginalIDrestoredagainandindependentlyverified16:05:32UTC, allpre-existinginventory/historyunchanged. Confirmedrootapplicationbug emptyproductwarehouseform callsunscopedphysicaldelete; fixed+regressiontested, modelharddeleteguard+safe deactivation. See warehouse-identity-safety.md and RESUME-wh001-recovery-guard-2026-10-27.md. DoNOTreplayeitherrecovery. Historicalactor/timeunproven. No spreadsheet16stock/costchanges yet.

Subsequent explicit "import it" completedtemplate13:4MGSpirit listings/101bottles inrecoveredWH001. Recovery-before balances remain historical, not a reason to rewind laterstock. See wyncity-product-template-13.md. Recovery itself never repeated.

User requested recovery after template13 preflight found location missing. Restored original Warehouse6a32ad2c78f1e3c27bda089a, tenant699165839f3308b1baeca8fc,nameWyn City,codeWH-001,typewarehouse,active/defaulttrue. Surviving1151stock rows/26493units and34batches reconnected by originalID. No stock rewrites; independently compared all existing tenant warehouses,stock,batches,sizes,SubProducts and both movement ledgers, unchanged. Transactional recovery audit6ac97362e526051330186958.

No deletion audit found; actor/cause/time unknown. Missing address/contact/managers/original timestamps not backed up and not reconstructed. Recovery record has schema defaults and new creation timestamp. Do not claim exact full metadata restoration. Template13 import still deferred, not executed during recovery. Full evidence outputs/wyncity-2026-10-10-wh001-recovery/ and spec docs/superpowers/specs/RESUME-wyncity-wh001-recovery.md. Never rerun recovery --apply.
