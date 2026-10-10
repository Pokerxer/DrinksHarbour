# Receipt history conventions

/inventory/receipts remains category=in history, not a second stock receiving mechanism. Purchase receipt writers use type=received: classify by relatedPurchaseOrder/referenceType as well as type. Bulk imports must not appear as purchases just because the writer uses referenceType=purchase_order. Return rows remain separate; classifier drives receipt tabs, receipt type grouping and sort. Internal transfers live in Internal.

Summaries count confirmed positive on-hand changes and disclose missing cost; pending units separately. Loading/error totals are unavailable, capped totals label loaded entries only. Per-line and one-selected receipt print full Goods Receipt Note; many/all lines print Goods receipt history. Never repost historical stock or infer invoice taxes.

Supplier/balance columns and raw-reference/lot search make receipt matching reliable. History PDF/CSV preserve supplier, SKU, unit cost, batch/lot and full notes. Keep inventory/stock's full-width theme without outer margins. Shared filter state and pagination are small composed modules; receipt saved-view keys remain compatible.

Handoff: docs/superpowers/specs/RESUME-inventory-receipts.md. Verification recorded there after final checks.

Verified 2026-10-04: full admin 238 files / 2,421 tests, focused receipt/movement TypeScript and whitespace checks passed. No authenticated browser verification; backend unchanged.
