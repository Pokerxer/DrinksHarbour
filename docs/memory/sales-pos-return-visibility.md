---
name: Linked Sales and POS returns
description: Returns on linked Sales/POS orders must be visible in both modules without inventing refunds or restoring stock twice.
type: project
---

2026-09-28 — SO00008 / RCP-20260928-0001, Wyn City tenant
699165839f3308b1baeca8fc, inspected read-only. Sales stored 60+60+18 = 138
returned units; the linked POS receipt stored no refunds. Sales returns restore
stock only. POS refunds record money and optionally restore stock. These were
independent histories, not a missing stock movement.

`server/services/linkedReturns.helpers.js` composes quantities by subproduct and
size, with an unambiguous default-size fallback. Sales quantities allocate once
across linked receipts in chronological order, capped to sold quantities.
`linkedReturns.service.js` performs tenant-scoped batched reads. Neither writes
historical records. POS GET history includes a `source: sales` stock-return row
with zero cash, no invented timestamp, and an explicit explanation. Sales detail
and list (`includeReturns=1`) include POS return quantities and source history.

Only raw Sales-origin returnedQty is persisted on SalesOrder. Response returnedQty
is combined/capped; salesReturnedQty and posReturnedQty explain its sources.
Never save that projected response back into the document. Real Order.refunds
remain authoritative for cash/accounting. Synthetic Sales rows must not count as
money refunds, consume the cashier's monetary refund allowance, or print a cash
refund receipt. Offline history preserves the source marker.

A later POS cash refund can settle Sales-returned goods. Per-refund-item
salesReturnedQuantity records the overlap; restockedQuantity records actual
POS stock restoration. Restore only the non-overlapping quantity. Sales return
writes subtract POS-returned units from remaining returnability. No migration or
historical stock/refund replay is needed. A POS return with restock=false still
counts as returned goods (e.g. damaged units), without restoring sellable stock.

Sales return list and create selector load all pages of fulfilled/partial orders.
Sales detail labels returned item value separately from actual cash refunds.
POS history, session views and refund reports distinguish stock-only returns.

Live projection check: SO00008 shows 138 units in Sales and the same 138 in POS,
cash refunded 0, persisted POS refund rows still 0. Historical records unchanged.
No sale/refund was submitted against the live database. Browser runtime was
unavailable; verification uses real database reads and controller/unit tests.

Limits: legacy Sales counters have no per-return date/receipt attribution. Split
receipts use deterministic FIFO allocation, and ambiguous duplicate product/size
lines are not guessed. This does not redesign concurrent stock writes or voids.
SO00008 also has a pre-existing Sales/POS total discrepancy; this return-visibility
fix does not alter historical payment amounts. See the session resume for checks.

Verification: backend suite 2,943 passing, admin suite 2,021 passing, focused
return suite 15 passing. Diff whitespace check clean. Full typecheck still has
373 workspace errors; no new diagnostics in files changed for this task.
Implementation is local/uncommitted; no deployment was requested.

## User-requested persistence repair — applied 2026-09-28

The user subsequently explicitly requested correcting the database. Applied
`server/scripts/repair-so00008-pos-return.js --apply` after a successful dry run.
Receipt 6aba04c59b6015e3034ed102 / RCP-20260928-0001 now stores exactly one
`Order.salesReturns` evidence snapshot, repairKey
`SO00008-sales-return-20260928-v1`, linked to SalesOrder
6ab5ec8199cb791195ca8ae9 and existing POS session 6aa871217d5558f9ff4ac428.
Quantities 60/60/18 match InventoryMovement IDs 6aba68420c954f5302e70c2c,
6aba68420c954f5302e70c3a, and 6aba68430c954f5302e70c45. Original timestamps
13:14:42.308–13:14:43.542 UTC and original actor/warehouse are preserved per line.
The aggregate return date is the final movement timestamp, not the repair time.

This supersedes the earlier no-database-write status for this specific receipt.
Cash Order.refunds stays empty. Stock quantities/movements were not rewritten;
SalesOrder and POSSession documents were compared before/after and unchanged.
One projected POS history row still shows 138 units and zero money refunded.
History selects salesReturns and merges its date into the existing Sales row;
it never appends the snapshot as a second return or a cash refund.

Repair script defaults to dry-run, validates exact tenant/order/session and
movement quantities, writes only salesReturns + updatedAt with concurrency
preconditions, and does not append if repairKey already exists. Backup:
/tmp/SO00008-sales-return-20260928-v1-1790606839657.json (mode 0600).
For rollback, remove only the salesReturns element with this repairKey, scoped
to this tenant/receipt; preserve all subsequent receipt updates. Never reverse
stock or cash for this metadata-only repair. No rollback performed.

Post-repair verification: all 2,947 backend tests pass; git diff --check clean.
Database correction is live; supporting code changes remain local/uncommitted.


Screenshot UI fix: shared POSStockReturnDetail now handles Sales-source returns
in POS history and sell-orders. Shows original receipt unit prices and proportional
net returned-goods value, separately labelled from cash refund status. Synthetic
zero cash fields are never used as merchandise prices. Removes irrelevant
cashier/refund-method rows, wraps product names, and separates the stock-return
explanation from metadata. No database changes in this follow-up.
Verification: full admin suite 2,024 passing plus focused component-render and
value tests (4 passing, including the newly added render regression). Browser
layout not verified. Files: components/pos-stock-return-detail.tsx and
stock-return-value.ts under admin shared/point-of-sale; diff check clean.


## Receipt return limits — 2026-09-28

User requires returned goods to be unavailable for another return, including
partial returns. This SUPERSEDES the earlier cash-after-stock allowance through
the ordinary POS return action. computeReturnedMap counts Sales stock returns
and POS returns, subtracting legacy salesReturnedQuantity overlap. Monetary
computeRefundedMap remains separate. Receipt lines show Sold / Returned /
Remaining (including zero), full/partial returned banner; returned lines cannot
be selected. Selected quantities and preview totals cap to remaining units.
Accepted returns update local receipt counters immediately and selected history
records refresh from server; local rows deduplicate by return receipt number.

Server refundPOSOrder independently subtracts Sales-returned units and previous
POS returns, minus legacy overlap, before accepting new return quantities. New
POS returns have salesReturnedQuantity=0 because they concern remaining goods.
The ordinary return action cannot now be used to pay for already-returned goods.
No changes to historical money/stock, and no new refund-settlement flow added.

Partial-return regression: sold10, Sales-returned6 => reject5, accept4, reject1
on repeat; no second cash/refund/stock entry. SO00008 returned60/60/18 => remaining
0/0/0. Printed A4 invoices and receipt previews display returned quantities,
including partial returns; historical overlapping refund rows are not doubled.

Verification: 2,947 backend tests, 2,028 admin tests passed; diff check clean.
No live sale/return submitted. Concurrent cross-module transactions remain an
existing architecture limitation; this change checks persisted quantities on
each request and prevents duplicate indices within a request, not distributed
locking. Changes remain local/uncommitted.

Full admin typecheck: 373 existing workspace errors; no diagnostics in the changed return/receipt files.


## Session history totals — implemented 2026-09-28

`posSessionHistory.service.js` enriches session-list responses with fresh totals
from receipts scoped to tenant and the returned session IDs, in one order query.
It reuses canonical posSessionTotals calculations for partial/full refunds,
excludes held/voided/unsettled orders, and preserves stored drawer closing
balances and Z-report snapshots. Refunds after closing are reflected in current
history totals without rewriting the original close. Sales-source projected
rows are explicitly excluded from money refunds/tender calculations.

History overview/list now show gross sales, monetary refunds, net sales and
separate Sales stock-return value. The orders tab shows net sales and refunds
using settled orders; selected session refreshes when history reloads.

Read-only live check of session 6aa871217d5558f9ff4ac428: 2 settled orders,
gross/net monetary sales 3,193,430.40; actual monetary refunds 0;
Sales stock-return value 1,596,715.20 (SO00008). Do not invent cash payouts or
subtract stock-only value from cash collections. No live database writes.
Tests cover session isolation, partial+full refunds, stale saved totals,
unchanged closing snapshots, and separation of stock value from cash.

Session history verification: 2,949 server tests and 2,028 admin tests passed. Diff check clean. Typecheck retains 373 workspace errors; none in the changed session UI/types.


## Net sales widgets — completed 2026-09-29

Supersedes earlier use of monetary net collections as displayed net sales.
`posReturnTotals.service.js` calculates commercial net sales from original receipt
value minus POS money refunds and Sales returned-goods value. Legacy overlap is
subtracted once. Sales value prorates the original payable total over line
weights (including taxes), so full return => zero and partial returns preserve
footer discounts/tax allocation. netCollections remains separate; no cash
payment/refund or closing-balance mutation is inferred from a stock return.

Session history/current/session-info and dashboard's currentSession use fresh
order-derived totals. Terminal card reads enriched session-info and labels Net
Session Sales with deduction amount. Recent Orders now includes paid, partially
refunded and refunded receipts, excludes voids, shows original and net amounts
and full/partial return labels. Session order-list summaries consume server
netSales. Close-control cash calculations and archived closing balances remain
cash/tender snapshots; general dashboard date-chart analytics are separate.

Read-only live verification: active session 6aa871217d5558f9ff4ac428 now has two
fully returned receipts. RCP-20260928-0001/SO00008: Sales stock return
1,596,715.20, zero cash refund. RCP-20260928-0002: recorded POS refund
RTN-20260928-0001 for 1,596,715.20. Gross sales 3,193,430.40; combined return/
refund deduction 3,193,430.40; commercial net sales 0.00; net collections
1,596,715.20. The second refund was already in live records; this task did not
create it or modify any database records.

Checks: 2,952 backend tests and 2,028 admin tests passed. One extra scenario
added afterward: all 6 focused total tests passed. git diff --check clean.
Typecheck still reports pre-existing workspace errors, none in changed widget
files. No browser screenshot verification. Local code remains uncommitted.


## POS analytics and reports — completed 2026-09-29

Updated `/point-of-sale/order-analysis`, `/point-of-sale/orders`,
`/point-of-sale/sales-details`, `/point-of-sale/session-report`, plus dashboard
period cards and seven-day chart. Shared `posAnalyticsNet.service.js` derives
per-line net sales and remaining quantities from the canonical projected returns;
rounding reconciles to the receipt net. Full/partial refunds stay in the order
population. Sales stock returns and historical POS settlement overlaps count once.
Dashboard periods attribute returns to the original sale's createdAt date;
chart keys preserve the server's calendar day without UTC-midnight shifting.

Orders/groups/chart measures/CSV net values use authoritative net sales. Original
receipt and explicit gross/subtotal measures remain original sale values. Sales
Details uses remaining quantities for cost/profit and net values for revenue.
Product-filtered analysis overrides the receipt net with selected line values.
Session payment breakdowns and PDF exports use currentPaymentTotals and
netCollections; drawer reconciliation remains the historical closing snapshot.
PDF items-sold excludes returned quantities, and stock-only returns do not count
as cash-refunded orders. These reports are sales-performance views, not a ledger
of cash movements grouped by refund date.

Read-only live check: both September 28 receipts have netSales 0 and all line
netQuantity 0 (60/60/18 returned). New RCP-20260929-0001 is unreturned, net sales
1,716,469.20. The current three-order session therefore has net sales 1,716,469.20.
No database mutations were made for this analytics task.

Verification: full backend suite 2,957 passed; full admin suite 2,031 passed.
After the final export/filter changes, seven focused report/export tests passed,
including a new session-document test. Typecheck baseline remains 373 workspace
errors; no new report diagnostics in the completed earlier run. Final typecheck
is recorded below. No browser screenshot verification. Existing report pagination
limits (500 orders / 200 session receipts) were not redesigned by this change.
All changes remain local/uncommitted, mixed with pre-existing unrelated work.

Final verification: TypeScript reports the same 373 existing diagnostics with no
new diagnostics after normalizing source line numbers. The new session export
test passes with a fully typed session fixture. git diff --check passes.
