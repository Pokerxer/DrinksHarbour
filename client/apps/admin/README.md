# DrinksHarbour admin

Back-office application for DrinksHarbour platform administrators and tenant
teams. Includes POS, inventory, purchasing, sales, HR and reporting. Tenant access
is enforced by the API as well as the dashboard navigation.

From the repository root, use Node from `.nvmrc` and pnpm11.9.0:

```bash
pnpm --dir client install --frozen-lockfile
cp client/apps/admin/.env.local.example client/apps/admin/.env.local
pnpm --dir client --filter admin dev
```

Use the app's `type:check`, `lint`, `test` and `build` scripts before release.
See [release procedures](../../../docs/operations/release.md) and
[source handover requirements](../../../docs/operations/source-handover.md).
Internal shared-package names retain compatibility; product branding is
DrinksHarbour. Third-party provenance and license notices must be retained.

## Upload authorization

UploadThing upload middleware verifies the server session against the current
backend `/api/users/me` profile before issuing upload permissions. Use the
configured backend origin; derive the tenant from its authenticated response.
Do not restore starter fake identities or add blanket route authentication that
would block UploadThing's signed completion callbacks. File deletion requires
an explicit ownership and authorization design before adding a server action.
See `docs/audits/client-dependencies-2026-10-23.md` at the repository root.

## Product editor header

The `/products` layout owns the Products navigation header. List, pending,
create, detail and edit pages use that shared header. Adding
`EcommercePageHeader` inside those pages creates duplicate module navigation.
The composed page/layout regression lives in `products/layout.test.tsx`.

Product editor header: `product/create-edit/header/` separates product identity,
actions, real metrics and a single record navigator. Save/New/AI and record
navigation use the existing form handlers. Browser drafts are labeled separately
from platform saves; placeholder actions and Purchased counts are not displayed.
Handoff: `docs/memory/product-edit-header-design.md` at the repository root.

On hand opens a full-width read-only dialog with current tenant listings, sizes,
SKUs, quantities and statuses. Search filters rows; Refresh checks the current
product without resetting unsaved fields. Header and dialog use listing totals
(or size totals if absent); missing quantities and mismatches are explicit.
Warehouse balances are a separate inventory view. Files live in
`product/create-edit/on-hand/`; see `RESUME-product-on-hand-modal.md` in specs.

Reserved and Available balances come from the private product stock endpoint
(`/products/admin/:id/stock`), with JWT tenant scoping. Totals use per-size balances
and manual Refresh; unknown reservations stay unknown and inconsistent balances
are flagged. The modal does not create or release reservations. Deploy the server
and admin changes together; no schema migration is required.

## Development compiler memory

Development writes generated files to `.next-dev`; production build/start use
`.next`. Keep these separate: running a production build against a live dev
server's output corrupts its vendor chunks and React client manifests. The
`VENUE_NEXT_DIST_DIR` override remains available for isolated checks; use a unique
directory per concurrent process. Stop the relevant server before clearing its
output folder. `cache:clean` clears both default generated folders.

The admin uses a 4 GB Node heap for `pnpm dev`. Webpack filesystem caching is
intentionally disabled in development and production: cache serialization can
allocate large buffers and exhaust that heap when compiling the full invoice/sales
editor. Development module parallelism is capped at two; production remains one.
Cold compilation can take longer. Keep these limits in `next.config.mjs` when
changing the dev/build setup; increasing the heap alone does not address caching.

If port 3000 belongs to another application, run `pnpm dev --port 3001` and use the
URL printed by Next.js. Do not terminate another project's server to free the port.

## Report loading and Redis

Dashboard and reporting reads use a bounded backend Redis cache when configured.
Website analytics uses one combined report request. Authentication and tenant
checks still run on every request; successful authenticated JSON writes invalidate
affected reports. See [admin Redis operating notes](../../../docs/performance/admin-redis.md)
for covered endpoints, freshness, configuration and local measurements.

Sub-product lists load independent statistics in parallel; detail/edit reads reuse
the authorized base document. List images use bounded Cloudinary derivatives with
original-image fallback, and edit history panels load on demand. Operational stock
and prices remain live. See `docs/superpowers/specs/RESUME-sub-product-speed.md`
at the repository root for checks and the current full-catalog filtering limit.

Redis also reuses sub-product summary counts and central catalog labels while
operational records stay live. List refresh/detail reload can bypass those caches.
See [SubProduct Redis notes](../../../docs/performance/sub-product-redis.md)
for independent configuration, invalidation and local measurements.

## Product Sold history

The product editor's Sold metric opens a full-width sales history with buyer names,
Lagos dates/times, tenant, size, receipt/channel and sold/returned/net quantities.
Header and modal share the private `/products/admin/:id/sales` report. Unknown or
incomplete counts display a dash. Search, date filters, 25-line pages and Refresh
preserve unsaved product edits. See [sales definitions and limits](../../../docs/memory/product-sold-history.md).

View website opens the platform `/product/<saved-slug>` page. Configure
`NEXT_PUBLIC_PLATFORM_URL` for a local or alternate platform host; it defaults to
`https://drinksharbour.com`. The admin record ID and unsaved slug edits are not
used as the public product address.

## Sub-Product review

Review Sub-Product now uses a full viewport dialog with a pricing worksheet,
listing details and stock/reserved/available table. Existing settings seed local,
adjustable margin targets; suggestions never change tenant costs or agreements.
Approval persists changed prices only, and failures keep the review open.
See [review calculations and rules](../../../docs/memory/subproduct-review-pricing.md).

The review workspace also searches/filter sizes, compares current/proposed prices,
applies viable suggestions to unchanged rows, and resets price edits. Blocking
prices remain visible through footer feedback even when hidden by a filter/tab.
See [workspace behavior](../../../docs/memory/subproduct-review-workspace.md).

Sub-Product review draft protection and identity header rules:
`docs/memory/subproduct-review-edit-protection.md` at repository root. Close/reload
prompt only when edits would be discarded; successful review writes close directly.

Occasion planning: platform-only `/occasion-requests` queue and review screen share saved customer profile conversations. Private AI drafts require staff approval; WhatsApp is staff-sent. See `src/app/shared/occasion-requests/README.md`.

## New operations workspace usability (2026-10-27)

Merchant/country/enrollment/channel controls share the foundation workspace's
focus, touch sizing and theme tokens. Delivery location failures offer Retry.
Occasion queue results belong to their session/filter/page and reject late reads.
Handoff: `docs/superpowers/specs/RESUME-ui-admin-polish.md` at repository root.

## POS and KDS realtime availability

Both socket hooks use `hooks/pos-realtime.ts` to probe the backend's public
`/realtime-status` endpoint without credentials before opening a socket. Vercel
reports unavailable because its handler never attaches Socket.IO. REST polling
continues when unavailable, during probe failure, or with older backends. Supported
servers allow three reconnect attempts per connector lifetime. Deploy the backend
endpoint before or alongside this admin change. See
`docs/memory/runtime-service-errors.md` at the repository root.
