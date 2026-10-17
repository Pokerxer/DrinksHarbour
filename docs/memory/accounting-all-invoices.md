---
name: Unified Sales and POS invoice browsing
description: Paid/fulfilled order visibility and oldest-first POS account repayment display.
type: project
---

User explicitly expanded `/accounting/invoices` to paid/fulfilled Sales and POS
orders, then approved oldest-outstanding-receipt-first POS account repayment
display. Browsing reads existing documents; never manufacture invoices/journals
on GET or backfill paid flags from POS checkout status alone.

`arAp.listInvoices` uses `invoiceBrowse.query.js` to union tenant-scoped SalesOrder
and POS Order records. Deduplicate POS receipts only against an eligible linked
Sales invoice in the same tenant. Payment status derives from outstanding funds,
cash received and credits. POS refund arrays reduce paid amounts. Holds,
cancellations, voids, drafts and other tenants stay out. Existing NGN scope stays.

`posInvoiceBalance.query.js` derives tab receipt balances from the whole customer
ledger before invoice date/status/page filtering. Payments settle oldest charges;
receipt credits reduce charges, voided/other-tenant entries are ignored. No writes.
No ledger entry for a charged receipt falls back conservatively to accountCharge.

Browser default includes all statuses. `scope=open` keeps receipt/credit
allocations restricted to open Sales invoices; POS IDs cannot enter that flow.
POS debt links to the existing POS workflow. Summary labels retain separate
Sales vs POS account balances and prevent misleading counts/double counting.

Local Mongo fixture proves status/pagination/isolation/dedup/FIFO/refunds and
date-filter independence. Full admin: 2,797 tests passed; touched-file lint clean.
Typecheck still has 359 existing errors (including existing customer-credit-panel
diagnostics); no new errors. Full server results recorded in the resume spec.
No live writes, migration, commit or deployment. Browser-policy block remains.

Final server suite: 3,759 passed, 7 skipped. Opt-in Mongo fixture separately
passed; fixture database dropped and local mongod stopped. First full run caught
an outdated pagination-contract mock; updated and full rerun passed.
