# Payments source visibility — 2026-10-14

User confirmed missing Wyn City Sales/POS payments and approved source visibility.
Resume: docs/superpowers/specs/RESUME-payments-source-visibility.md.
Rules: server/services/accountingPayment.README.md, Sales/POS visibility section.

Verified root: CustomerPayment0/VendorPayment0 for both businesses, while paid
Sales/POS source activity exists. The former page read manual Accounting records
only. Sales/POS tender capture normally posts source journals instead of creating
CustomerPayment. Source counts overlap; never add counters as receipt money.

Customer browsing now merges read-only source tenders with manual records before
pagination/search/method/date filters and summary. Source records use stable
journal IDs, finite balanced posting + source-total + NGN + tenant proof;1300
account charge is not money collected. Duplicate/mismatching postings are not
confirmed receipts. Linked Sales receivable posting adds no duplicate cash row.
Invoice/source links, Sales/POS labels and separate verified refund state appear;
source receipts use original Sales/POS flow, never Accounting cancellation.
Refund verification reuses existing per-refund journals/reversal proof, then
counts actual cash/bank/wallet payouts only. Legacy refund counters stay reviewable.
Manual allocation/unallocated totals remain distinct; no phantom on-account cash.

Read-only updated live query finds5 verified Wyn City receipts (formerly0); CKK1
through same tenant-scoped logic. Audit runner prints aggregate counts only,
autoIndex false; no credentials/PII or business writes. No journals/imports/replays,
indexes, commits, push or deployment. Original invoice snapshots unaffected.

Server3,779 pass/12 optional skips. Local source payment integration passed;
source unit3 and UI5 passed. Type359 existing errors/no new diagnostics; changed-
file lint clean. First full admin2,841 pass/1 unrelated Inventory5000ms timeout;
isolated4 passed unchanged (affected case2079ms). Final full admin2,842 passed across346 files with the same default timeout/2
workers; Inventory file passed unchanged. No Inventory code/test changes. Temporary Mongo
stopped cleanly and test database dropped. Browser restriction respected;
CodeRabbit unavailable, single-agent local review.

Implemented and verified; task complete. Refresh Customer receipts. Only posting-backed source tenders are confirmed; there is no saved-payment import or journal duplication.
