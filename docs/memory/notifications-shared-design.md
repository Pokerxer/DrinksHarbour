# Notification page design and controls

Updated 2026-10-09. Approved performance styling now extends to warehouse,
low-stock, forecasts, restock, vendor-order, product-update, expiry and inbox pages.
Shared POS header, icon summary buttons and search/filter/sort/reset controls live
in `client/apps/admin/src/app/shared/notifications/`.

Warehouse metric counts use selected location; donor/location cards still use the
full plan. Transfer logic and compact product details modal remain intact.
Restock searches supplier names too. Quantities and supplier/currency/location
groups always use all lines, including lines hidden by filters. Filters never
remove orders. Stock/forecast links include product and size IDs.

Category search and newest/oldest sorting run on the backend before pagination.
`useNotifications` supports search/sort and guards late responses by scope.
Regex is escaped and search limited to 200 characters; JWT tenant/recipient scope
is unchanged. Category unread count is explicitly for the current page.
Inbox summary buttons filter notices; Clear all also resets date ordering.

Verification and exact implementation: see
`docs/superpowers/specs/RESUME-notifications-shared-design.md`.
Browser kernel unavailable; no claimed visual verification. Uncommitted, undeployed.

Verified: full dashboard 282 files / 2,588 tests; backend 3,593 passed / five
skipped; final focused notifications 24 files / 108 tests. Scoped types and
notification lint passed. Full suites precede the final inbox clear-ordering and
view refinements; the final focused suite covers those refinements.

Custom timeframe sorting added next: see notifications-timeframe.md and
RESUME-notifications-timeframe.md for Lagos date boundaries, period totals,
current-stock semantics, server filtering and final verification.

Dedicated forecast functionality followed: see notifications-forecasts.md and
RESUME-forecasts-functionality.md. The production route uses forecasts/forecast-page,
with horizon/fit/shortfall controls and a validated baseline/AI selection model.
