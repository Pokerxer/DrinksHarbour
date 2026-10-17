# Empty Vendor payments: live evidence

2026-10-14. User reported no payments after the Purchases-linked update.

Read-only audit `server/scripts/audit-vendor-payments-visibility.js` uses existing
server DB configuration, autoIndex false and counts/totals only. Run from server.
Live result: Wyn City7 validated purchase orders, VendorBill0, VendorPayment0,
relevant vendor-payment/bill/order journals0, unlinked bill payment histories0.
CKK Giftery1 validated purchase order and all corresponding bill/payment/history/
journal counts0. Generic listPayments vendor returns total0 for each tenant.
No actual cash/vendor payment can be inferred from validated order status.

No financial read-model fix can reveal nonexistent payment documents. Asked user
whether purchases are already paid and require payment recording, or are unpaid
and need bills first. Do not generate bills, post payments, infer tender method,
full settlement or payment date from order validation. User confirms already paid; prepare a read-only order review. Amounts, method, date and business scope still require user input before financial recording. No live data writes/imports/journal replay.

Vendor empty state now explains purchase orders do not record money paid and
links to /purchases and /purchases/bills. Test reproduced missing guidance/link
before the change. Focused vendor/workspace9 tests passed. Full admin2,870 passed across354 files,zero failures; lint/diff and audit-script syntax checks clean. No backend product logic changes, so prior server3,797/13skip verification retained. Existing
vendor filtering/linking/payment transaction and customer receipts unchanged.
Prior browser restriction preserved. No subagents or commits. User confirms already paid. Read-only candidate bill review saved at docs/superpowers/specs/vendor-payment-recording-review.md: Wyn City7 candidate bills total NGN141,345,791.16, CKK1 NGN34,000.00. These amounts use received quantities/current unit costs/taxes; never treat them as actual payment evidence. Await business/order scope, full/partial paid amounts, actual method/date/reference. Before posting historical bills also review existing inventory postings to avoid duplicate recognition; never replay PO validation/stock.

Resume: docs/superpowers/specs/RESUME-empty-vendor-payments.md.
