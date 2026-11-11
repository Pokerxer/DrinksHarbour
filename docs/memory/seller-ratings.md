# Seller ratings (TenantReview)

Customer ratings of seller stores. Added 2026-11-11.

## Model

`server/models/TenantReview.js` — mirrors the Product Review rules: rating 1–5,
required comment (min 10 chars, enforced in controller), verified purchase
(a **delivered** Order containing the tenant via `items.tenant`), `pending`
moderation default, one review per user per tenant (unique index
`{ user: 1, tenant: 1 }`). Same moderation statuses as Review:
pending/approved/rejected/hidden.

## Denormalised aggregate

`Tenant.ratingAvg` / `Tenant.ratingCount` (added to the Tenant schema). Recomputed
by `recalcTenantRating()` in `server/controllers/tenantReview.controller.js` from
**approved reviews only** — zero approved reviews must reset to 0/0, never leave
a stale value (same contract as `productSchema.methods.updateRating`). Recalc
runs after every moderation status change.

## Endpoints (all in `server/routes/store.routes.js`)

- `GET  /api/stores/:slug/reviews` — public; approved reviews + summary
  (averageRating, totalReviews, 1–5 distribution) + pagination. Reviewer is
  exposed as `firstName` + `lastNameInitial` only — never IDs or emails.
- `POST /api/stores/:slug/reviews` — `protect`; 401 unauth, 403 no delivered
  order from this seller, 400 duplicate/invalid, 404 unknown/non-approved slug.
  Pending on creation; fires a `new_review_pending` notification to super-admins.
- `PATCH /api/stores/reviews/:id/status` — `protect, superAdminOnly`; platform
  level (tenant admins must never approve their own store's ratings).

`GET /api/stores` and `GET /api/stores/:slug` now include `ratingAvg` /
`ratingCount` via `PUBLIC_TENANT_FIELDS` in `store.controller.js`.

## Client (platform app)

- `components/Stores/RatingStars.tsx` — shared stars primitive (half-star
  support, a11y labelled).
- `components/Stores/directory.types.ts` — Store has `ratingAvg`/`ratingCount`.
- `components/Stores/StoreCard.tsx` — stars + count under the store name when
  `ratingCount > 0`.
- `components/Stores/StoreReviews.tsx` — store-page section: summary, approved
  review list ("Verified purchase" chip), and a submit form (`fetchWithAuth`;
  prompts sign-in when logged out; success message explains moderation delay).
- `app/vendors/[slug]/page.tsx` — stars next to the Verified badge in the
  profile card + `<StoreReviews>` section after products.

## Moderation surface note

No admin-app UI for moderating TenantReviews yet — use
`PATCH /api/stores/reviews/:id/status` (super admin). If an admin-app panel is
built, reuse the `/api/reviews` moderation UI patterns.

## Verification done 2026-11-11

- `node --test __tests__/storeReviews.mongo.test.js` (venuePhase0 Mongo): 2/2 pass.
- `npx tsc --noEmit` in `client/apps/platform`: clean.
- `npx eslint` on the touched platform files: clean (one pre-existing warning
  in `useStoreDirectory.ts`, unrelated).
