# Vendor payments and Purchases

2026-10-14. User approved vendor filtering, bill/order links, allocation details,
fresh recording balances and consistent states without duplicate entries.

Purchases POST /api/vendor-bills/:id/pay already uses accountingPayment.service
createPayment. Preserve that shared transaction; VendorBill.payments contains an
accounting:<paymentId> mirror, never a second Accounting payment to import.

accountingPayment.browse now validates vendor selection, scopes rows/count/totals
with trusted tenant and enriches bill allocations with current status/outstanding.
PurchaseOrder lookup also requires tenant; invalid foreign order refs have no link.
Customer invoice linkage preserved. Allocation metadata is current bill state,
not the original payment status or proof of another transfer.

UI filter panel reuses PaymentPartySelect with All vendors, more/retry, then Apply
filters. Clear removes applied vendor. Desktop/mobile rows and detail show bills,
purchase orders, current bill Paid/Partially paid/Unpaid/Overdue/etc and outstanding.
Vendor names link to Purchases vendor records when the scoped vendor is available.
Form adds Refresh bill balances (reload first page); vanished selected bills block
saving through existing allocation validation. No Financial write API changes.

Verification: backend regressions4 + existing workspace5 passed; UI16 passed.
Local Mongo integration passed: payment settles bill, cancellation reopens partial
balance, payment mirror count stays correct, summary respects vendor, foreign PO
is suppressed. Disposable database dropped and local Mongo stopped cleanly.
Final full server3,797 passed,13 optional skips,zero failures. Changed-file lint/diff clean. Type check
363 errors with none in changed files; four more than previous359 are unrelated
appraisals/peer-rating/cycle-setup.test.tsx errors from other workspace work.
Final review caught endpoint omission of req.query.vendor; reproduced it with a failing controller regression and added the forwarding line. All nine focused backend tests pass. Final full server3,797 passed/13 optional skips; full admin2,869 passed across354 files,zero failures. Controller forwarding is included in the final server suite. Counts include other existing workspace work. CodeRabbit unavailable; single-agent review verified endpoint forwarding, tenant scoping and current-versus-original balances. No browser verification attempted under the existing restriction. No live business writes/imports/journal replay/commit/deploy.
Prior browser access restriction remains; no UI workaround. Single-agent review.

Resume docs/superpowers/specs/RESUME-vendor-payments-purchases.md.
