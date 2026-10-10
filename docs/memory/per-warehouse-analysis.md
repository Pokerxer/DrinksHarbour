# Analysis within each warehouse

See [resume](../superpowers/specs/RESUME-per-warehouse-analysis.md).

The warehouse detail's Analysis action opens `/warehouses/[id]/analysis` with
stock, purchases, transfers and stock movement history. Warehouse scope is an
immutable source constraint, not a removable filter. Global stock analysis is
still available. Store saved favorites separately for each warehouse.

Use `/api/warehouses/:id/history` for paginated histories: kind purchases,
transfers, movements or transfer_movements. All queries and counts are scoped
by the JWT tenant and exact warehouse; check warehouse ownership first. Purchase
receipts can belong to different warehouses than their order header. Attribute
receipt quantities per location and exclude cancelled receipts/lines. Whole
order/document money must never be presented as a location-specific amount.

Transfer returns carry parentMovement. Do not identify them only by reference
text, which is user-editable for lightweight warehouse transfers. Histories are
read-only; current stock is authoritative for available quantities.

Verification 2026-10-03: server 3,264 tests and admin 2,275 tests passed. Existing
typecheck baseline remains 390 unrelated errors, with no new errors in the
changed files. Logs and implementation details are in the resume.

Design update: visited tabs retain state, with roving keyboard focus. Date
shortcuts use inclusive UTC boundaries. Reject reversed ranges before a history
request. History export is explicitly the displayed page, not the full matching
history; keep spreadsheet formula guards for text and numeric stock changes.
Stock analysis within a warehouse defaults to product grouping and uses a compact
header. Global analysis still defaults to warehouses. Admin: 2,280 tests passed
in 200 files, `/tmp/warehouse-design-admin-final.log`; typecheck baseline 390.

History filter contract: multiple product IDs are comma-separated (OR), combined
with status, inclusive UTC created dates and literal reference search (AND).
Single-product callers remain supported. Keep frontend status choices in sync
with model enums and backend `warehouseHistory.filters.js`. Transfer mode
changes reset status; all filter changes reset pagination. Clear filters also
resets option search even when no product was selected.

Get option choices from `/api/warehouses/:id/history/products`, not only current
stock. It includes warehouse-linked purchases, transfers and movement products,
then scopes SubProduct lookup by tenant. Search options by product name/SKU;
reference search filters records separately. Retain warehouse/tenant scope in
all queries/counts. Admin 2,285 and server 3,270 tests passed; typecheck existing
baseline 390 errors with no changed history errors (logs in resume).

Recharts bar labels: do not use default LabelList text sizing for warehouse bar
labels/totals. ParentViewBox can be incomplete and yield width=NaN, even when
bar geometry is finite. Use `warehouse-analysis/bar-label.tsx` to check finite
coordinates/values and render only valid SVG text props. Regression uses the
actual Recharts LabelList. Admin 2,292 tests passed; unchanged typecheck baseline
390 unrelated errors (`/tmp/warehouse-label-types-final.log`).

Transfer totals: Transfers defaults to document mode. GET history responses include
`transferTotals` for documents/movements, computed across all matching records,
not paged rows. Keep currencies separate and show counterpart warehouse/net values.
Whole-document net totals plus saved return values define original value. Product
filters require per-line terms/refund attribution, never repeat the full invoice
amount per product. Summary excludes documents without historical sent/received
quantities. Dates select transfer creation dates, with cumulative returns on those
transfers. Movement history has quantity totals but no reliable monetary snapshot.
See resume for calculation caveats and verification logs.

Totals verification: server 3,276 and admin 2,294 tests passed. Existing typecheck
baseline 390 unrelated errors. Logs in the resume.

Product search UX: one searchable checkbox picker, not separate search + native
select. Comma/semicolon-separated terms match any product; each term's words match
names/SKUs with accent normalization. Selections survive new searches, API failures
and tab switches. Select matches respects the 100-ID cap. Product fetch failure
must show retry without discarding selected IDs. Reference search is debounced
250 ms; Clear filters resets reference draft and product option search.

Screenshot network failure was caused by the local API not running. Restarted
using node -r dotenv/config server.js in server/, PID 19573 / session 33455;
health returned HTTP 200. This process needs restart after backend changes (no
nodemon). Full admin 2,297 tests passed; existing typecheck 390 unrelated errors.

Net columns: Total transfer in is incoming minus returnedOut; Total transfer out
is outgoing minus returnedIn (quantity and value). Document/movement tables,
summary cards, warehouse-pair breakdown and CSV include these columns. Original
quantities and return columns remain visible. A movement return is a negative
correction to its original transfer direction, not a new opposite-direction
transfer. Use movementNetQuantities for row projection. Do not clamp negative
movement period totals; filters can select only returns. Local API now PID 25704
(session 14581), `/tmp/net-transfer-api-final.log`, after loading backend changes.

Net columns verified: full server 3,280 tests and admin 205 files / 2,301 tests
passed. Admin rerun with two workers resolved concurrent-run timeouts without
code changes. Typecheck baseline remains 390 unrelated errors; changed paths
clean. Local API health HTTP 200. Final logs are recorded in the resume.

User clarified total transferred in/out must sum all transfers. Dedicated "All
matching transfers" table uses unpaginated server aggregates per currency (net
units and values after returns). Individual history rows/CSV say Transferred
in/out, not Total. Gross/return cards and counterpart breakdown remain visible.
No backend production change required; totals queries already ignore pagination.
Verified full admin 2,302 tests; focused backend aggregation 10 tests. Typecheck
unchanged baseline 390 errors; changed paths clean. See resume for logs.

Purchase analysis now has unpaginated currency totals: received, returned, net
purchased units/value. New warehousePurchaseTotals.js shares receipt/return
metrics with history rows. Only this warehouse's active stock-adjusted vendor
returns are deducted. Tenant-scoped return documents from other warehouses are
read to prevent global PO counters from misattributing those returns here.
Legacy counter remainder is safe only for orders received at a single location.
Split orders without return warehouse records cannot be attributed automatically.
PO receivedQty is already net after returns: reconstruct historical quantities
with returnedQty only for orders without partial receipts. Use receipt snapshots
otherwise. PO line cost/tax values receipts; saved return amounts value returns.
CSV includes net quantities and values. This is goods value, not cash refunds.
API process now PID 35453 / session 73085, health 200. Full admin 2,305 tests pass;
typecheck unchanged 390 unrelated errors. Final full server 3,288 tests passed;
see resume for logs. No migration, browser validation, commit or deployment.

Stock analysis has a visible multi-product picker under ControlBar, reusing
history ProductFilter (name/SKU, comma/semicolon terms, accent normalization,
Select matches, chips, All products). Atomic product updates remove product ID
and product_search restrictions only, preserving other facets. Report data
already shares applyFilters across charts/KPIs/pivot/export. Generic chips omit
duplicate product IDs; saved searches remain compatible. No backend changes.
Verified full admin 207 files / 2,307 tests passed; typecheck unchanged 390
unrelated baseline errors, changed paths clean. Logs in resume.

All-products chart fix: MainChart no longer silently truncates bar/line data to
30 groups. Bounded scrolling handles large bar/line charts, all bar category
labels retained. Pie retains an explicit Others bucket; pivot/table unchanged.
Show all products always available; clears product IDs/text and picker search,
preserving other facets. Regressions cover 45 chart groups and search reset.
Verified full admin 2,309 tests / 208 files; typecheck unchanged 390 unrelated
errors, changed paths clean. No backend changes. See resume for logs.

Eight-product layout regression: Recharts did not discover axes inside the
conditional fragment. Direct XAxis/YAxis children fix actual rendering; prior
stub tests missed this. Normal/stacked bars now use stable horizontal rows at
every count, numeric container height (40px/product, minimum320) and bounded
scrolling. Real Recharts tests verify 8→9→45→1 transitions, ticks/bar counts and
finite geometry; preserve these in addition to data boundary stubs.
Verified full admin 2,311 tests / 209 files; final typecheck baseline 390 unrelated
errors with changed paths clean. Actual renderer rechecked after fixture type
correction. No browser visual check or backend changes; logs in resume.

Analysis routes restore content margins because shared warehouse layout uses
negative margins: centered max1600px main, horizontal padding16/24/32px at
mobile/small/large, vertical24/32px. Applied to global and location analysis,
covering every tab/state. Formatting/diff checks and 3 location tests passed.

Stock history: adjusted quantity is an absolute balance target, NOT a delta.
New manual warehouse movements save optional balanceBefore/stockChange. History
metrics reconstruct normal signed changes, but legacy recounts without before
snapshot have unknown changes. Never count them as stock additions. Show before/
after, recount target and unknown change warning; CSV preserves recorded qty.
Movement totals sum all filtered records independently of pagination (added/
removed/net units, unknown count), using exact tenant and warehouse scope. Units
across products aren't current balance. History page sizes20/50/100 reset page1.
Server full3,293 tests passed. Local API PID57277 auto-restarted after backend
edits; health200. No migration or deliberate business-data writes. See resume.
Full admin2,313 tests /209 files passed; final typecheck baseline390 unrelated
errors, changed paths clean. git diff --check passed. Logs in resume.
