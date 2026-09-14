---
title: Accounting workflows and responsive workspace
date: 2026-09-14
status: local implementation; rollout reconciliation required
---

# Accounting workflows

## Scope and files

The accounting workspace now uses responsive navigation, a common page shell,
mobile invoice/bill cards, desktop tables, source links, actionable AR/AP balances,
and payment forms prefilled from a selected document. Dialogs contain scrolling,
trap keyboard focus, support Escape, and restore focus. Lists have persistent error
states and retries. Directory searches debounce and discard stale results. Payment
forms reject invalid/duplicate allocations and repeated submissions. Journal print
output escapes account names and memos. Files live in
`client/apps/admin/src/app/shared/accounting/` with small extracted helpers/views.

Server changes in `server/services/accounting*`, `arAp.service`, journal, credit,
batch, tax and operational controllers fix:

- Undefined request pagination envelopes and the wrong payment-service import.
- Actual sales/bill identifiers and date fields; due-date aging; inclusive end dates;
  literal search; NGN-only AR/AP filters; credits in outstanding balances.
- Transactional accounting payment creation/cancellation, allocation balance updates,
  and matching journal entries. Tenant/party validation, positive finite amounts,
  outstanding limits, and duplicate allocation rejection happen before writes.
- Credit notes reduce invoice outstanding and cancellation reverses both effects.
- Batch claim/cancellation transactions and conditional deposit transitions prevent
  partial claims and conflicting batch states. Batches remain organisational, not
  bank-transfer journals.
- Manual journal entries append independently; business entries use immutable
  insert-only document identity; account IDs cannot bypass tenant/code validation.
- Validated supplier bills own payable/input-tax posting; purchase commitments no
  longer create a second payable. Bill validation reverses legacy PO accruals.
  Mixed stock/expense bill lines split between inventory and operating expenses.
- Supplier payment entry points use accounting payment allocation and journals.
  Supplier return reversal awaits posting and uses tenant-scoped updates.
- Paid operational Orders capture tenant journal entries from stored snapshots.
  POS separates cash/bank/wallet, output tax, tips, and inventory cost. Marketplace
  sales use snapshotted tenant shares/commission, keeping platform receivables
  separate from cash. Linked POS receipts clear sales receivables; quotation
  conversion/reconciliation retries receipt posting against the resulting order.
- Owner equity appears in the balance sheet. Profit calculation handles zero stock
  costs and net cost reversals instead of losing profit.
- Order capture failures persist `accountingStatus=needs_review` and a reason, shown
  with source links on the accounting dashboard (latest ten exceptions).

New schema fields: SalesOrder.creditedAmount; Order.linkedSalesOrder,
accountingStatus/accountingIssue/accountingCheckedAt. Seeded accounts add customer
wallet liability 2200 and tips payable 2300. Payment methods retain cheque/other
compatibility; accounting wallet registration is rejected because it cannot mutate
stored wallet funds. POS owns wallet consumption.

## Verification

- Focused accounting server suite: 47 passing tests, including transaction session
  propagation, receipt cancellation, invalid tenant allocations, mixed vendor bills,
  quotation/refund review states, journal identity, equity and profit regressions.
- POS quotation and linked-price regression suite: 12 passing tests.
- Admin accounting helper and sales tests: 143 passing tests across nine files.
- Changed accounting client files: lint clean. Full admin typecheck was run with
  installed TypeScript 5.9.3; it reports unrelated errors, none in accounting/arAp.
- Changed server JavaScript syntax checks and `git diff --check` pass.
- Full server suite: all 2,801 tests pass after the final changes. Sandbox-only
  runs have 97 socket failures; local-port access resolves them.
- Authenticated visual verification was unavailable: local admin required sign-in;
  no user credentials or live financial data were used. Browser responsiveness and
  full database transactions still need a signed-in tenant test environment.

## Rollout and remaining limitations

No commit, push, deployment, database backfill, payout or external message occurred.
Use MongoDB replica-set transaction support. The unit tests stub database models;
run tenant-scoped integration checks on a replica-set staging database before release.

Historical books are not rewritten. Review old PO/bill duplicates, historical
payments/credits, missing Order postings, inventory opening balances and wallet
funding/opening liabilities. The journal backfill script is still dry-run by default,
excludes purchase commitments and foreign currency, and now fails on skipped posting
instead of claiming success. It does not replay operational Orders or wallet funding.
Do not blindly apply it to unreconciled history. Legacy bill inventory classification
also needs review; immutable journals require explicit adjusting/reversal entries.

Marketplace partial refunds lack a tenant settlement breakdown. POS refunds with
VAT or an unspecified split refund tender also require review. These are flagged,
not automatically allocated by an invented rule. Standard untaxed POS refunds/voids
post paired revenue/tender and restock-cost effects. Tips and wallet funding still
need their operational payout/funding reconciliation; new receipt liability entries
assume correct opening balances.

The tax reporting screen still uses TaxRecord; POS tax journal lines need tax-record
reconciliation for filing reports. COGS reports use journals when present and legacy
inventory-movement fallback otherwise, so mixed historical coverage must be reconciled.
Foreign-currency source records are excluded from the NGN AR/AP workspace; foreign
Order postings are flagged for conversion. There is no general FX ledger in this pass.

Order review flags currently clear on a successful operational retry. Manual ledger
adjustments alone do not clear the source flag; reconcile and retry deliberately.
These limitations mean this work improves existing operational accounting, not a
claim that historical books, tax filings, or all marketplace settlements are complete.


## Invoice creation — 2026-09-14

Accounting → Customer invoices now has a Create invoice action opening
`/accounting/invoices/create`. It renders the existing SalesCreate form in invoice
context, retaining customer selection, catalog/scan/cart imports, product/section/note
lines, pricelists and repricing, discounts/coupons, taxes, warehouses, addresses,
terms, totals and history. The invoice header adds save draft, pro forma print,
payment due date and Issue invoice. Draft URLs stay under the accounting page with
`?draft=ID` and reload restores the existing sales draft. Drafts use existing
quotation storage; unfinished drafts remain accessible in Sales as well.

Issuing calls `POST /api/accounting/receivables/invoices/:id/issue`, protected by the
existing Accounting tenant/admin/capability chain. The same SalesOrder becomes
confirmed/unpaid and `invoiceIssuedAt` marks idempotent issuance. Source state and
receivable/revenue/tax journal commit in one transaction. No payment is collected,
no inventory is moved and no email is sent. Tax capture follows the normal source
capture path. Issued invoices appear in the open Accounting invoices list, link to
the source details and accept accounting payments. A lost-response retry checks the
issued document before attempting another draft save. Failed draft saves prevent
issuing stale data. Explicit due dates persist on draft create/edit.

Files: accounting invoice-create/header and route; SalesCreate context extension;
useSalesAutosave draft-path and save-result handling; accountingInvoice.service and
its tests; Accounting router/controller; SalesOrder.invoiceIssuedAt and explicit
sales draft due-date handling.

Verification: five new invoice service tests pass (unpaid transactional issue,
tenant isolation, retry identity, invalid dates, existing-payment rejection).
Shared sales/accounting client regression tests: 143 pass. Touched client lint passes.
Full server run: 2,803/2,804 passed; unrelated embeddingProviderLatch cooldown timing
failed under concurrency and passed in isolated rerun alongside accounting tests.
No authenticated browser test or deployment performed.

Invoice typecheck: full admin TypeScript check completed with existing project errors,
including pre-existing salesOrder.service response-typing errors (also present in
prior accounting baseline). No invoice page/header, SalesCreate, useSalesAutosave,
AR/AP service or accounting route type errors were reported.

## Invoice route compiler OOM — 2026-09-14

The admin dev process previously exhausted its 4 GB V8 heap while compiling
`/(hydrogen)/accounting/invoices/create`; the stack showed external-memory pressure
and `NewJSArrayBuffer`, consistent with Webpack filesystem-cache serialization. The
admin config now disables the Webpack filesystem cache for development as well as
production and caps dev module parallelism at two (production remains one). The
existing `pnpm dev` 4 GB heap limit remains unchanged. This avoids masking the
issue by only increasing the heap.

A direct Next development compiler verification compiled `/accounting/invoices`,
`/accounting/invoices/create`, and `/sales/create` using the route-group entries:
peak observed memory was heap 1.85 GB / RSS 1.95 GB; all routes completed. The
normal dev command should be run from `client/apps/admin` with `pnpm dev --port
3001` when another project owns port 3000. In this session sandbox port binding
prevented starting that command directly, but the initialized compiler check passed.
Do not stop the unrelated service on port 3000.
