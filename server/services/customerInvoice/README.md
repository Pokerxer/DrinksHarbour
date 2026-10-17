# Saved customer invoices

CustomerInvoice is the numbered financial document; SalesOrder and POS Order are
the source documents. Unique tenant/source/sourceId and tenant/number indexes
make repeated imports and retries safe. InvoiceCounter has its own sequence.

Full fulfillment, paid Sales orders, manual issuance, and completed POS receipts
are eligible. Linked POS receipts use one canonical Sales invoice. Partial
fulfillment alone does not invoice an entire order. Draft editor autosaves can
materialize a draft using invoiceDraft. Posted details are frozen. Source edits
produce a reconciliation issue; they never replace issued customer/product/price
snapshots. Payments and credits remain linked to their existing source IDs.

Sync never posts accounting entries. It checks source revenue, payment and credit
records; missing or inconsistent evidence leaves new invoices as drafts. Posted
invoices retain their snapshots and show issues for review. Receipt/tab payments
use FIFO across the customer's full ledger before page/date filters.

GET list reads CustomerInvoice; detail adds read-only tenant-scoped issuer and
payment/credit activity. Financial values remain the saved snapshot. Current bank
instructions come only from validated Tenant.bankAccounts, never settlement fields.
Shared POS account repayments show their customer-account scope, not a claimed
per-invoice allocation of their full amount. Refresh is a GET; Reconcile is a POST.
Source save and accounting hooks refresh invoices; checkout hook failures are
logged as invoiceSyncFailed and repaired by the same import/retry service.

Historical import (from server):

    node scripts/import-customer-invoices.js --tenant=<id>
    node scripts/import-customer-invoices.js --tenant=<id> --apply

Default is a read-only dry run. Apply ensures the required unique indexes. Each run
is bounded to 5,000 candidates, --limit up to 10,000. If hasMore is true, continue
with --after=<cursor>. On errors rerun that batch without advancing the cursor.
Repeated apply runs reuse records and never duplicate GL revenue or cash.

Tests use DRINKSHARBOUR_SAVED_INVOICE_TEST_MONGO_URI and require a disposable
localhost database named drinks_saved_invoice_test_*. They drop that database.

## Goods returns, refunds and reviewed credits

List/detail returnSummary is read-only live evidence over frozen invoice quantities.
Reuse raw Sales returned counters and persisted POS refund items, subtracting legacy
Sales/POS overlap. Broken links and ambiguous item matches are not guessed. Return
filters run before invoice pagination. Inventory can filter by an owned invoice ID.
Issued items/prices/totals and numbering are never replaced by return details.

refundedAmount counts balanced, posted, unreversed OrderRefund journals only.
A linked POS refund debits receivable1300; it is not the Sales commercial credit.
Fully refunded linked receipts remain attached to the canonical Sales invoice.
Missing/excess/legacy refund postings remain reconciliation issues. Credit planning
uses verified net collection while preserving gross Sales source counters. No
return GET/Reconcile creates a credit or refund journal; reviewed CreditNote posting
retains its existing single-entry ledger and allocation lifecycle.

creditedAmount remains credit allocated to this invoice. creditNoteAmount separately
shows valid posted credits named against the invoice, including customer credit
left unapplied on a paid invoice. Do not add commercial note totals to allocations
or infer a cash refund from them. OrderRefund posting/reversal and named/unallocated
CreditNote changes refresh the same saved invoice through existing hooks.

The invoice page header reads saved posted balances via receivables/invoices/summary,
with POS account balances counted once. Other AR/customer reports retain their
existing source-ledger behavior. Reviewed return credit forms begin as drafts,
with amounts/VAT left for operator review. PDF/CSV expose return/credit status;
the shared inventory template and original four PDF columns/VAT totals remain.

Disposable check: node scripts/test-invoice-returns.js (localhost replica27192 only).
Existing issuance/FIFO/credit regression: node scripts/test-existing-saved-invoices.js.
Both refuse business URIs and drop only their named local test databases.

Credit workspace reads may specify scope credit to select paid/open posted,
reviewed Sales NGN invoices, and customer to scope open application choices.
These are read filters only; credit posting/application still resolves the saved
invoice to its tenant-scoped Sales source and validates the existing lifecycle.
See ../creditNote.README.md and RESUME-credit-notes-workspace.md.

## Outstanding header and draft discrepancies

The invoice header includes positive saved draft balances with reconciliation
issues in its displayed invoice balance/open count, matching the amounts visible
in the ledger. The summary exposes them separately as reviewOutstanding and
reviewBalanceCount; reviewCount also counts issue-bearing drafts with zero balance.
Posted totalOutstanding/count and aging remain separate, unchanged financial totals.
A review banner identifies the unverified draft portion and opens the draft ledger.
Do not silently show an all-clear zero when these review balances exist, and do not
post drafts or rewrite payment counters to make the totals agree. Currency remains
NGN; clean drafts/cancelled/foreign-currency documents do not enter review totals.

## Calculation audit (2026-10-15)

Aging uses Africa/Lagos calendar dates, matching invoice row due labels. Missing
or invalid due dates stay in the current/undated bucket; never invent an overdue
date from the invoice issue date. Existing aging ranges remain unchanged.

POS FIFO repayments require balanced posted journal evidence. A reversed linked
POS settlement cannot count as paid on a Sales invoice. Payment and credit-note
allocations must be finite, non-negative and fit within the source payment or
VAT-inclusive credit total before any allocation reduces invoice outstanding.
Inconsistent evidence is excluded and flagged for reconciliation, never silently
clamped into an apparently settled balance. Existing one-kobo reconciliation
tolerance remains unchanged.

See `docs/superpowers/specs/RESUME-invoice-calculation-audit.md` at the repository
root for reproductions and verification. Existing saved balances update through
the normal explicit reconciliation/source hooks; this audit did not rewrite live
financial records or frozen invoice snapshots.
