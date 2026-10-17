# Expiry notification page

The existing category page renders ExpiryAlertsList. Default ordering is earliest
batch expiry, with latest expiry and notification creation orders available.
Search includes product, size, location and batch number. Status/date/read filters
are server-side and apply before pagination.

Future custom dates are enabled only for expiry; other notification date ranges
retain completed-history validation. Viewing an alert opens the shared details
panel without marking it read. Details show remaining batch units, batch number,
expiry, quarantine status, location and scan time when recorded.

Expired/quarantined notices have review guidance, including legacy cached rows.
The stock review link opens existing inventory tools. This page does not
quarantine stock, change quantities, or create promotions. Facts are snapshots;
confirm current inventory before action. No page-load expiry scan is introduced.

The daily scan is at 02:00 Lagos time. Incomplete references remain visible with
safe labels until corrected. Only tracked positive-stock batches in the configured
warning window qualify. Test: expiry-page.test.tsx plus shared category tests.
