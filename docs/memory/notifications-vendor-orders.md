# Vendor order overview and purchase handoff

2026-10-09. Shared RestockResults keeps reviewed product selections; vendor-order
modules provide separate group search/sort/currency filters and pagination.
Filters change displayed groups, not prepared product quantities. Product
subtotals remain separate per currency and exclude unspecified taxes/delivery.
Urgency comes from the most urgent included supplier projection. Exact supplier,
product/size and receiving-location identity stays intact. Manual-review reasons
and estimated delivery range remain visible before preparing an editable purchase.

Drafts are ten-minute user/tenant scoped session storage. Exclude summary/unassigned
rows and repeated keys from grouping; reject mixed group identities, duplicate
product/size IDs, invalid pack math and prices. Fresh prefill checks purchasing
permission and product/size identity, updates names/SKU/packaging/prices with a
changed-term notice, and preserves reviewed units. Backend save still verifies
current terms. Successful save clears the scoped draft without allowing storage
cleanup errors to mask success. No automatic purchase, vendor message or migration.
Handoff: docs/superpowers/specs/RESUME-vendor-orders-functionality.md.

Verified: full dashboard 290 files / 2,637 passed; backend 3,615 passed / five
skipped. Focused workflow nine files / 37 passed. Scoped notification/purchase
types, lint, formatting and whitespace passed. Existing ESLint deprecation only.
Browser visual verification unavailable. Work remains uncommitted/undeployed.

Prepare purchase follow-up: refreshed offer terms now stay in client preparation
state. Save references follow remaining exact product/size rows, so deleting a
line works; valid quantity edits remain supported. Changed supplier/location/
currency, price/pack, added/replaced/duplicate products fail before sending with
review guidance. Expected arrival uses the slowest supplier lead in Lagos dates,
with invalid dates unset. Prepare has opening feedback and locks other groups
until navigation; errors unlock retry. See RESUME-prepare-purchase.md.

Prepare follow-up verified: full dashboard 291 files / 2,643 passed; backend
3,615 passed / five skipped. Final focused preparation/vendor/prefill 21 passed;
scoped types/lint/format/whitespace passed. Browser preview unavailable. Work
remains uncommitted/undeployed.
