# Purchase detail workflow and quotation cancellation

The purchase detail page shows a stage-specific action group above the document tools. Drafts can be prepared or approved. Confirmed purchases show receiving. Pending receipts show validation. Eligible received purchases can be billed and purchases with posted stock can be returned. An active bill replaces Create Bill with View Bill.

A draft purchase or confirmed RFQ can be cancelled through PATCH /api/purchase-orders/:id/status if it has no receipt activity. The tenant-scoped conditional write sets status and, for RFQs, rfqStatus to cancelled. It checks stored receipt flags, receipts and line counters. Receipt writes and draft approval recheck the source state at save time so they cannot reopen a cancelled document.

Receive Products opens the purchase receipt directly. Validate Receipt opens it in validation mode and posts recorded quantities with no new receipt. The server resolves the recorded warehouse. An outstanding balance stays on the same purchase.

Verify with purchases-po-detail.test.tsx, purchases-receipt-detail.test.tsx and purchaseCancellation.mongo.test.js. The Mongo fixture covers cancellation before receipt, tenant scope, cancellation retries, both write orders in a cancellation/receipt race, and tenant-scoped bill lookup.
