## Isomorphic Starter Template with Internationalization support

**Run the following commands from the packages root**

First install the dependencies by running the following command.

```bash
pnpm install
```

Now to start the local development server run

```bash
pnpm iso:dev
```

To learn more please follow our [Documentation](https://isomorphic-doc.vercel.app/getting-started/installation)

## Product editor header

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
