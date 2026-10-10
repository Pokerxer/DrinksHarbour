# Vendor orders

Vendor orders group reviewed tenant SubProduct/size quantities by external
supplier, currency and receiving location. Currency totals must never be added
together. Product filters preserve complete order groups; overview filters only
change displayed groups, never prepared items. Preparing opens an editable
purchase form and does not save, send or reserve stock.

order-draft.ts owns exact group identities, pack math and a ten-minute user/tenant
scoped session-storage draft. Stored values are untrusted. Purchase prefill refreshes
current authorized supplier terms and identities; backend restock/purchase.js
validates supplier, currency, location, product, size, packaging and price on save.
Invalid quantities, refresh and missing tenant session block preparation.

See docs/superpowers/specs/RESUME-vendor-orders-functionality.md for current work.

## Implemented overview and handoff rules

Supplier-order search matches supplier, destination, product, size and SKU; it
never truncates an order's prepared items. Currency filtering and group pagination
change display only. Priority is the most urgent included supplier projection.
Cost sorting compares amounts within currency; subtotals stay per currency and
include all selected groups, including hidden ones. Product subtotal excludes
unspecified taxes/delivery fees. Cards show pack terms, estimated delivery range
and manual-review reasons before preparation.

Summaries, unassigned destinations and repeated row keys cannot enter grouped
quantities. Draft creation verifies one supplier/currency/destination and unique
product/size identity. Stored pack quantities/prices must agree with unit math.
Fresh prefill checks purchasing access, exact product/size identity and current
pack/MOQ/maximum terms. Names/SKU/packaging/prices are refreshed; changed prices
or packaging produce a visible notice while reviewed unit quantities persist.
Successful purchase save removes only that user's tenant draft; unavailable
cleanup storage cannot turn a successful save into an apparent failure.

## Prepare purchase editing

Purchases/restock-preparation.ts maps the remaining edited product/size rows to
the refreshed exact plan references. Removing lines is supported; quantities may
change within current pack/MOQ/maximum terms. Supplier, currency, receiving
location, price/pack changes, replacement/additional products and duplicates
require re-preparation and fail locally before sending. Server terms remain the
final check. Estimate the receiving date from the slowest selected supplier line
in Lagos calendar dates; invalid lead times remain unset for manual review.
Prepare locks while opening to prevent another group overwriting the handoff;
storage/navigation failures show a message and unlock for retry.
