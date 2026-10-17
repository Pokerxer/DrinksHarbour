# Sales catalogue verification — 2026-10-15

Cold modal request count: two requests previously (open plus debounced effect),
one now, verified by the UI test after waiting through the debounce interval.
Page size: 60 full records previously, 24 compact records now. No dashboard
statistics request; no product-detail page prefetch links in the product grid.
Cloudinary thumbnails request 240px, fit rather than cropped bottles.

Disposable localhost Mongo fixture: 85 products across two tenants, 84 belonging
to the target tenant, four catalogue pages, a brand only on product 81, variant
SKU/barcode, and warehouse reservations. All query checks passed. Latest measured
first page: 105.0ms, 15,022 JSON bytes. The comparison fixture for the old 60-row
full-record response was 6,643,591 bytes because each synthetic product includes
a large description. This is a local synthetic payload comparison, not a
production latency benchmark. Ordinary name pages now populate operational
metadata after pagination; no production indexes or data were changed.

Full backend regression: 3,857 passed, 16 skipped, one failure:
`server/__tests__/salesOrderLock.test.js` — “server rejects edit, repricing,
coupon, confirmation and cancellation when locked” expected confirmSalesOrder
409 but observed 400. That controller/service was not edited by this work.

Full admin run: 2,913 passed, 22 failed. This run used the initial reopen UI test,
whose check raced the dialog portal; it now waits for dismissal and reopening
and passes. The remaining observed failures were outside the catalogue code.
A reduced-concurrency rerun of the affected files passed 62 of 63 tests; the one
remaining failure was the movement-browser sorting test's five-second timeout.
The other prior failures, including sales confirmation tests, passed on rerun.

Final isolated movement-browser run passed all four tests with a 15-second
timeout; the sorting test took 12.95 seconds. The backend sales-order-lock test
still failed in isolation (three other tests in that file passed). Final type
check reported 362 diagnostics elsewhere and none in the catalogue changes.
Changed-file lint passed, with only ESLint's existing config deprecation notice.
Browser access yielded an empty sales page, so no visual/layout timing claim is
made. The temporary test database process and browser tab were closed.

Observed full-run failures (retained for reproducibility):

-  src/app/shared/inventory/customer-returns.test.tsx > shows non-restocked goods, matched totals, source links and server pagination
-  src/app/shared/inventory/inventory-adjustments.test.tsx > loads all correction categories, shows actual totals/reasons/balances and prints full documents
-  src/app/shared/inventory/inventory-adjustments.test.tsx > combines product alternatives with source/status and shows unavailable totals on refresh failure
-  src/app/shared/inventory/inventory-deliveries.test.tsx > shows actual issued stock, pending units, source and historical balances and prints a full delivery note
-  src/app/shared/inventory/inventory-deliveries.test.tsx > combines multiple products, source and status filters and searches either sales reference
-  src/app/shared/inventory/inventory-internal.test.tsx > loads internal return scope and shows separate in/out/return totals and full internal notes
-  src/app/shared/inventory/inventory-internal.test.tsx > combines route filters with actual warehouse and saves and restores their IDs
-  src/app/shared/inventory/inventory-movements-browser.test.tsx > sorts all matching rows before pagination and resets the view to newest first
-  src/app/shared/inventory/inventory-movements-browser.test.tsx > prints all matching records and keeps checked records across pages
-  src/app/shared/inventory/inventory-movements-browser.test.tsx > disables complete-history exports if loading is capped and clears failed refresh totals
-  src/app/shared/inventory/inventory-movements-browser.test.tsx > combines multiple products with warehouse/status filters and restores a saved view
-  src/app/shared/inventory/inventory-receipts.test.tsx > shows supplier and balances, pending units separately and prints the exact receipt
-  src/app/shared/inventory/inventory-receipts.test.tsx > combines products, supplier and status and clears receipt filters without losing the incoming scope
-  src/app/shared/inventory/inventory-stock-browser.test.tsx > failed refresh removes stale totals and offers retry
-  src/app/shared/inventory/inventory-stock-browser.test.tsx > retains selections across pages and prunes only stock hidden by product filters
-  src/app/shared/sales/sales-catalog-modal.test.tsx > reopening reuses the page while refreshing stock, and stale controls stay disabled
-  src/app/shared/sales/sales-edit-controls.test.tsx > confirmation stops if saving edits fails and never opens a payment request
-  src/app/shared/sales/sales-edit-controls.test.tsx > confirmation reserves without payment and a locked order can check availability
-  src/app/shared/notifications/expiry/expiry-page.test.tsx > offers expiry status/date sorting, opens safe batch details and accepts future expiry ranges
-  src/app/shared/notifications/forecasts/forecast-page.test.tsx > tenant summaries explain allocation and do not offer a local purchase
-  src/app/shared/notifications/restock/restock-page.test.tsx > keeps edited quantities in complete order groups while search and status hide products
-  src/app/shared/notifications/warehouses/warehouse-page.test.tsx > shows shortages first, ranks faster depletion, filters stock and searches products
