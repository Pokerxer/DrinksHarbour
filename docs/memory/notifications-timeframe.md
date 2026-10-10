# Notification custom timeframes

2026-10-09: All notification pages include explicit From/To, Apply and reset.
Use Lagos dates, inclusive end, max 366 days, no future dates. Planning uses only
completed days; notices include today. Default metrics retain 30-day/weekly behavior.

Planning URLs preserve location/product/size scope. Additive periodUnits,
periodPreviousUnits and periodDemandUnits power selected-period sales/movement
sorting. Warehouse movement includes net posted transfers out. Performance
compares the preceding equal window. Stock/forecasts/restock stay current and are
labelled accordingly. Custom period reads do not persist minimums or emit alerts.
Reader expands older evidence, cache includes dates, report permissions redact
new metrics. Unknown local assignment stays unknown; tenant sales are never
allocated to invented locations.

Notice dates filter before server paging and counts; range bulk reads cannot mark
outside dates. Hooks isolate date scopes and reject late responses. Shared date
control lives in notifications/notification-timeframe.tsx; backend validation in
server/utils/notificationDateRange.js. Handoff and verification:
docs/superpowers/specs/RESUME-notifications-timeframe.md. Uncommitted/undeployed.

Final verification: dashboard 283 files / 2,596 tests; backend 3,598 passed /
five skipped; focused UI 25 files / 115 tests. Scoped types, feature/service
lint and whitespace checks passed. Browser preview unavailable.
