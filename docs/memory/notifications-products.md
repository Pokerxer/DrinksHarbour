# Product updates notification page

Products category contains product_approved and product_rejected decisions for
the authenticated recipient and tenant. A validated `type` query only accepts
these two in the products category and intersects existing permission types.
Filtering, search and Lagos date ranges happen before stable server pagination.
`matchingUnreadCount` counts all filtered unread notices, independent of page;
`unreadCount` retains account-wide bell semantics. Explicit reads use existing
recipient-scoped mutation. No read-all category action is introduced.

The shared category page adds product-only decision selection and clamps pages
after totals shrink. ProductUpdatesList reuses list/details with an optional
onOpen callback; the bell's existing list is unchanged. Scope-keyed selection
closes on tenant/query/page changes. Refresh supplies current evidence/read state;
opening details does not mark read. Empty history does not imply approval.

Handoff: docs/superpowers/specs/RESUME-notifications-products.md.

2026-10-10: product.service.js now calls productDecisionNotification.js immediately
after successful approval/rejection save; both single and bulk decisions share
these service functions. Previously the actual workflow retained TODO hooks.
The helper logs delivery failure without throwing or undoing the saved decision.
Existing notification producers accept an internal saved-product snapshot and
include productName plus rejectionReason. Do not re-read a concurrent different
decision for notice text. Recipients still require active tenant membership and
product-read permission. These changes do not backfill historical decisions.
