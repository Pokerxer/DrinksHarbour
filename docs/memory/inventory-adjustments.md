# Inventory adjustment history

The adjustment writer stores adjustment_in/out in category=in/out. Use scope=
adjustments on the movement read endpoint, matching those types OR the legacy
adjustment category. Tenant, product, date and explicit category restrictions
remain at query root. Find and count use the same predicate. No stock mutations
or changes to the older aggregate adjustment endpoint in this history-page task.

Classify increases/decreases using confirmed recorded stock deltas, with the type
as direction fallback only for unposted records. Unchanged is explicit. Pending,
cancelled/rejected and unknown changes stay separate from posted stock totals.
Correction cost is the recorded gross value, not net inventory valuation; missing
cost and incomplete/unavailable totals remain disclosed. Do not rescale legacy
recorded financial values to fabricate a valuation.

Use shared product-alternative search, warehouse/status/source/date filters, saved
views, sorting before pagination, selection and safe exports. Reasons have a
sortable column; balances describe the historical warehouse leg. Single rows and
one selected row print the full Stock Adjustment Report with reasons/notes and
balances; multiple/all print Stock adjustment history. General Moves Adjustment
tab uses correction identity rather than category alone. Inventory theme remains
full width without new outer margins.

Handoff: docs/superpowers/specs/RESUME-inventory-adjustments.md.

Posting follow-up: New adjustment now uses the explicit warehouse/count contract;
the aggregate mutation was replaced. See inventory-adjustment-entry.md and
docs/superpowers/specs/RESUME-inventory-adjustment-entry.md for current rules.
