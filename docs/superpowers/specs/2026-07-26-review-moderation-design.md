# Product Review Moderation — Design

**Date:** 2026-07-26
**Status:** Approved, ready for implementation plan

## Problem

A customer left a review on "Imperial Blue Blended Grain Whisky". It appears nowhere —
not on the platform product page, not in the admin. Three compounding causes:

1. **`server/models/Review.js:110`** — new reviews default to `status: 'pending'`.
2. **`server/services/product.service.js:6197`** — the platform queries only
   `status: 'approved'`. Same constraint in `getProductReviewSummary` (`:6327`) and
   `getProductRatingDistribution`. A pending review is therefore invisible to shoppers
   by design.
3. **`client/apps/admin/src/app/shared/ecommerce/review/table.tsx:5`** — the admin
   Reviews page renders `@/data/product-reviews`, the Isomorphic **demo fixture**.
   No review moderation API exists on the server at all; `server/routes/product.routes.js`
   exposes only get / submit / helpful.

The review is sitting in Mongo as `pending` with no surface anywhere that can display
or approve it.

### Latent fourth bug

`Product.updateRating()` (`server/models/Product.js:842`) is defined but **never called
by any code path**. Even after approval, `averageRating` / `reviewCount` stay stale.
This is also the open GSC `aggregateRating` warning recorded in project memory.

The method is additionally wrong: when the aggregate matches zero approved reviews it
takes the `if (stats.length > 0)` false branch and leaves the previous values intact,
so unapproving the last approved review would strand a phantom rating on the product.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Full moderation module | Makes the review visible *and* approvable, and fixes the stale-aggregate bug |
| Authority | `superAdminOnly` | Reviews attach to platform-level `Product` docs with no `tenant` field; a tenant admin approving one would publish content on a product other tenants also sell |
| Intake policy | Stay `pending`, add notification | Preserves editorial control; the real failure was silence, not moderation |
| Code location | New dedicated `review` module | `product.service.js` is already 12,100 lines |

### Rejected alternatives

- **Extend the product module** (`/api/products/reviews/*` on `product.controller.js`).
  Marginally less wiring, but grows an unmanageable file and buries review logic.
- **Generic moderation module** spanning products, reviews, and future blog comments.
  YAGNI — product approval already works standalone; unifying couples unrelated workflows.
- **Tenant-scoped moderation** (derive tenant from the linked `Order`). Correct for a
  mature marketplace, but needs a schema field plus a backfill. Revisit when a second
  tenant is actually selling.

## Architecture

### Server: new `review` module

**`server/services/review.service.js`**

- `listReviews({ status, product, rating, verified, search, page, limit, sortBy })`
  Populates `user` (name/email/avatar) and `product` (name/slug/image). Returns
  `{ reviews, pagination, counts }`, where `counts` is a `$facet` tally per status so
  the UI can badge "3 pending" without a second round trip.
- `moderateReview(reviewId, { status, note }, moderatorId)`
  Sets `status`, `moderatedBy`, `moderatedAt`, `moderationNote`; then recomputes the
  product aggregate.
- `deleteReview(reviewId)` — hard delete, then the same recompute.
- `getReviewStats()` — totals for the page header.

**`server/controllers/review.controller.js`** — thin `asyncHandler` wrappers matching
existing controller style.

**`server/routes/review.routes.js`** — mounted in `server.js` at `/api/reviews`, every
route behind `protect` + `superAdminOnly`, with `express-validator` on ids and the
status enum.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/reviews` | list + filter + paginate |
| GET | `/api/reviews/stats` | status counts |
| PATCH | `/api/reviews/:id/status` | approve / reject / hide / re-pend |
| DELETE | `/api/reviews/:id` | remove |

`PATCH` accepts `status` ∈ `pending | approved | rejected | hidden` (the existing
`Review.status` enum) and an optional `note` persisted to `moderationNote`.

### Aggregate recomputation

Rewrite `Product.updateRating()` to always write, defaulting `avg` and `count` to `0`
when no approved reviews match, and call it from every moderation path
(`moderateReview`, `deleteReview`). Once the Imperial Blue review is approved the
product JSON-LD will emit a real `aggregateRating`, closing the GSC warning.

### Notification on submission

Add `new_review_pending` to the `Notification` type enum (`server/models/Notification.js:12`).
Add `sendNewReviewPendingNotification(reviewId)` to `notification.service.js`, mirroring
the existing `sendNewProductPendingNotification` (`:205`): in-app notification to all
super admins via `getSuperAdmins()` + `createNotification()`, with `actionUrl` deep-linking
to the admin Reviews page and `actionLabel: 'Moderate Review'`.

Called fire-and-forget from `submitProductReview` (`product.controller.js:1042`), wrapped
so a notification failure can never fail the customer's submission.

### Admin UI

**`client/apps/admin/src/services/review.service.ts`** — follows the `banner.service.ts`
fetch pattern: `API_URL` from `NEXT_PUBLIC_API_URL`, bearer token argument, `response.ok`
check throwing `error.message`.

**`client/apps/admin/src/app/shared/ecommerce/review/table.tsx`** — rebuilt on the
`blog-list/table.tsx` pattern: `useSession()` for the token, `useCallback` fetch keyed on
filters, skeleton / error / empty states, `react-hot-toast` for action feedback.

- Status filter tabs showing live counts
- Rating and free-text search filters
- Per-row actions: Approve, Reject, Hide, Delete

Remove the `@/data/product-reviews` demo import and the "Add Review" button on
`client/apps/admin/src/app/(hydrogen)/ecommerce/reviews/page.tsx` — admins do not author
reviews.

## Testing

Repo tests use **`node:test`, not jest**. New `server/__tests__/review.moderation.test.js`:

- moderation transitions write `moderatedBy` / `moderatedAt` / `moderationNote`
- approving recomputes `averageRating` and `reviewCount`
- unapproving the **last** approved review resets both to `0` (the latent bug)
- non-super-admin is rejected
- `listReviews` filters correctly by status

Run the full server suite to confirm no regression against the known baseline.

## Known constraint

Atlas blocks this local IP, so the stored state of the Imperial Blue review cannot be
queried locally and no browser smoke test is possible. Implementation and unit tests
proceed against the code; final end-to-end confirmation ("the review now appears") must
happen from a permitted host.

## Out of scope

- Tenant-scoped review moderation (needs schema + backfill)
- Auto-approval of verified purchases
- Customer-facing email when a review is approved or rejected
- Bulk moderation actions
- Review reply / merchant response
