# Product updates

`/notifications/products` uses the shared server-paginated category page, with
products-only Approved / Needs changes decision controls. Search, dates, read
state and stable oldest/newest sort apply before pagination. Read state is an
acknowledgement, independent of catalogue approval. These are historical decisions;
do not infer current listing status or invent pending approvals from this inbox.

`product-updates-list.tsx` composes the shared list and notification detail panel.
Opening details does not mark read. Recorded rejection reasons and safe existing
listing links appear in details; mark-read remains explicit and permission scoped.
Selected facts follow refreshed rows. The category page keys the list by the
authenticated query scope, closing details on tenant/filter/date/page changes.
Older notification responses can omit matchingUnreadCount; their page-only count
is explicitly labelled. New responses count all matching unread decisions while
the existing unreadCount retains its account-wide semantics for the bell.

Approval/rejection saves dispatch through productDecisionNotification.js into
notification.service.js, using the saved decision snapshot and tenant recipients.
Failures are logged without undoing the catalogue decision. Notices include
productName and, for rejections, the recorded reason. Single and bulk workflows
share these service hooks. Updates link to the
tenant SubProduct list. No catalogue status mutation, backfill, or fabricated
historical product evidence occurs here. See RESUME-notifications-products.md.
