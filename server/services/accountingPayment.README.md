# Accounting payment records

CustomerPayment/VendorPayment record money already received or paid. They do not
initiate bank transfers, payment gateway requests or cash refunds. POS payment
receipts remain in their existing flow; do not duplicate them into this ledger.

Posting/allocation/reversal lives in accountingPayment.service.js. Read-only
workspace search, summaries and allocation links live in accountingPayment.browse.js.
Every lookup includes trusted tenant. Validate status/method/date/side; escape
search. Summary covers every matching record, not just the visible page. Cancelled
amount is shown separately and excluded from active/allocated/unallocated totals.

Request side may be provided by query or body (existing client uses body on POST).
Reject invalid/conflicting values. Never default an explicit vendor request to
customer. Party IDs are validated in the tenant and allocations remain limited
to one party. Source saved invoice IDs resolve to tenant-scoped Sales sources.
Vendor open document choices accept a tenant-scoped vendor filter.

For a linked POS refund, Sales gross collection counters remain gross. New receipt
allocation checks use effectiveCreditInvoice's verified net balance, just like
reviewed credits. Missing/inconsistent refund proof stays reviewable. Recording
and cancelling the new receipt normally changes the original source gross counter;
no legacy repair, duplicate credit, refund journal or invoice rewrite is implied.

Cancellation reverses the entry and rolls back allocations in the existing
transaction. Only active unbatched payments can be cancelled. Review the batch
for batched payments. Original allocation rows remain available as reversed history.
Unallocated money is not an individual invoice/bill settlement, and this workspace
does not introduce a later-allocation API or automatic sweep for those amounts.

UI resets on side/session change, ignores obsolete replies, removes old rows on
failure and shows unavailable totals instead of zero after failed reads. Account
and allocation choices provide explicit more/retry controls. Recording previews
show amount, allocations and remainder, with name-only fallback clearly labeled.

Verification: full server command node --test '__tests__/*.test.js' (from server).
Disposable local integration: node scripts/test-payments-workspace.js; only
localhost27192 drinks_payments_workspace_test_local, dropped during test cleanup.
Resume: docs/superpowers/specs/RESUME-payments-workspace.md.

## Sales/POS visibility (2026-10-14)

Customer receipt browsing now includes read-only source tenders from existing
posted SalesOrder sales_revenue and POS Order sales_revenue/customer_payment
journals. This extends the former Accounting-only read scope. It does not create
CustomerPayment rows or new journals. Vendor browsing is unchanged.

Source projection lives in accountingPayment/sourceReceipts.js and sourceRows.js.
Validate finite/nonnegative balanced posting, cash/bank/wallet tender plus account
charge against source total, tenant-owned source and NGN currency. Account charges
(1300 debit) are not collected money. Duplicate source postings and mismatching
proof are not treated as confirmed receipts. Original journal IDs provide stable
prefixed display identities. Posted reversals give cancelled receipt history.

Source receipts link to saved invoices via source identity or recorded receipt
IDs. They open original Sales/POS records for changes and never use the Accounting
cancel action. Refund totals use existing per-refund posting/reversal verification,
then count only cash/bank/wallet payouts; receivable credits are excluded. Legacy
or inconsistent refund evidence stays reviewable. Original receipt gross and
verified refund remain separate; no automatic commercial credit is implied.

Manual accounting allocations/unallocated amounts remain separate from source
receipts tracked in their original records. Customer pagination/search/date/method
and full summary include both sources, without synthesizing manual allocation
rows. See RESUME-payments-source-visibility.md for live-count verification.

Converted Sales quotations also resolve their receipt link to the saved invoice
for convertedTo, using tenant-scoped sources and invoices. An existing direct
source invoice takes priority. This changes navigation only: the original receipt
URL, tender and posted journal remain authoritative. Missing targets never
create an invoice or hide an otherwise verified receipt.

## Vendor payments and Purchases (2026-10-14)

Purchases bill payment recording already calls the shared transactional payment
service. VendorPayment is the single saved payment record; do not import another
payment from the mirrored VendorBill.payments accounting:<paymentId> entry.
Purchase confirmation/stock receipt is not evidence of money paid.

Vendor browsing supports a validated vendor ID combined with the trusted tenant
in records, counts and summaries. Bill allocations include current bill status
and outstanding balance; purchase-order links are looked up separately in that
same tenant. Missing/cross-tenant order references never create a usable link.
These current bill balances describe the bill today, separately from the original
recorded allocation and cancelled payment history.

Vendor filter uses the existing Accounting vendor directory backed by Purchases
vendors, with explicit more/retry controls. Bill recording uses fresh scoped open
bills and provides Refresh bill balances; vanished/settled documents block saving.
Existing create/cancel service remains unchanged and updates the same Purchases
bill balances, payment mirror and journal within its transaction.
