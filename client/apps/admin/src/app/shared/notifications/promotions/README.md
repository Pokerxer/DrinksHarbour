# Promotion suggestions

Read-only /notifications/promotions uses a local basket association model.
Page settings change the authenticated API query; result filters/sorts/pagination
operate over the complete bounded response. Each offer is scoped to a warehouse;
no implicit pooling across locations. Dates and historical counts are explicit.

Cards open the shared Headless UI modal with measured evidence, stock capacity
and editable discount/quantity previews. Editing cannot exceed the server's safe
discount ceiling or stock capacity. No create/activate request occurs. Staff
without owner/admin pricing authority see Review pricing, never cost or margin.
Uncertain sales/location history cannot be used to claim a supported combo.
All scope changes remount results so another tenant/query cannot retain a modal.

Special-day dates use Lagos today through day 60 in the input and submission
validation. Apply/reset are disabled during loading; server validation remains
authoritative for all query settings and financial bounds.

Special-day date selection uses the shared dashboard calendar with a button
trigger, disabled out-of-window days and month navigation. Convert selected
browser-local calendar fields to ISO date keys without UTC shifting; Lagos still
defines the allowed window. Clear special day clears name/date together in the
draft; Apply offer settings refreshes recommendations. Loading disables the
calendar and clear action. No campaign is persisted or activated.

Upcoming world drinks events come from the server's source-linked catalogue.
Selecting an event fills its paired name/date, highlights event days in the
calendar and exposes its source. Changing the date/name permits a custom event;
only exact catalogue selections retain verified source identity and themed
matching. No future events beyond the established 60-day horizon are selectable.
