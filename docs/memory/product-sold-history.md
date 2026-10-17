# Product editor Sold history

Date: 2026-10-17. User requested the same full-width detail interaction as On hand,
including buyers, sale dates and proper underlying sales data.

## Files and contract

- `server/services/product-sales-report.js` composes existing POS/Sales unit rules,
  linked receipt recovery and overlapping return projection. Explicit serialization
  returns buyer name/id, tenant name, size, reference/channel, date/basis, gross,
  returned and net units. No buyer contacts, tender credentials or cost prices.
- `server/services/product-sales.service.js` performs bounded, read-only queries.
  `GET /api/products/admin/:id/sales` uses product routes' protected read roles and
  `resolveTenantContext` after auth. JWT tenant scope wins; platform admins without
  a target may read all. Responses are private/no-store.
- `tenantProductInsights.sales.js` gains optional `details: true` metadata only;
  default insight output and existing sales semantics remain unchanged.
- Admin `create-edit/sold/`: runtime response validator/filter, abortable hook,
  full-width Headless UI dialog and separate responsive sales table.
- Parent loads the report on existing product/token selection. Header Sold shows
  report net units, or a dash while loading/failed/incomplete. Clicking opens the
  report. Refresh updates that same count without resetting the product form.

## Sales definition

Paid, non-void/non-cancelled POS purchases; paid actually-delivered online orders;
paid posted Sales fulfillments, using actual fulfilled units. Linked POS/Sales
records are counted once. Returns reduce net quantities without counting an
explicit Sales/POS overlap twice. Fully refunded online purchases with recorded
prior delivery remain visible as gross and returned units, net zero.

Date sources: POS paidAt (legacy createdAt is labelled Recorded), online deliveredAt,
Sales fulfillment at. Display/filter dates use Africa/Lagos. Unknown dates remain
unknown. Incomplete fulfillment coverage or missing quantities prevents a definitive
header count. Refund states without item-level quantity evidence are incomplete.

Buyers use receipt snapshot, tenant-validated POS customer name, or linked User name;
Sales uses the snapshot or tenant-validated customer name. Unidentified POS is
Walk-in customer; missing named buyer data is Unknown customer. No invented users.

## UI and operational limits

All-time gross/returned/net/transaction summary; newest-first records; buyer,
reference, tenant, channel and size search; inclusive From/To dates; 25-line pages;
clear filters; refresh/retry; explicit empty, signed-out, failure and incomplete
states. Totals remain all-time while row filters are active, with explanatory copy.
Headless UI handles focus trap, Escape/backdrop and return focus. Table scrolls
horizontally on narrow screens; modal spans viewport minus desktop gutters.

Reads are bounded at 20,000 Order documents and 20,000 SalesOrder documents per
product; exceeding either returns explicit 422 rather than partial totals. Client
receives this bounded reconciled report and paginates locally. High-volume products
will need database-backed report pagination/exports; no truncation is presented as
complete. No schema migration or historical data writes. Deploy backend/admin together.

## Verification

Full backend: 3,942 passed, zero failed, 16 skipped. Full admin: 385 files and
3,075 tests passed. Focused editor/read tests: 37 passed; final Sold-only rerun:
7 passed. Scoped lint and diff whitespace checks pass. Type check retains 359
pre-existing diagnostics, none in new Sold/header files. Browser inventory has no
connected browser, so no live visual verification was possible. No production
sales data was modified or used as test fixtures. Detailed logs and limitations:
`docs/superpowers/specs/RESUME-product-sold-history.md`.
