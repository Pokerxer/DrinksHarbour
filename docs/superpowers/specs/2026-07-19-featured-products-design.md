# Featured Products — Admin-Curated Display

**Date:** 2026-07-19
**Status:** Approved (pending spec review)

## Problem

The platform has a fully-built `FeaturedProducts` homepage section component, and the
admin product form already has a "Featured Product" toggle wired end-to-end. None of it
works, for two reasons:

1. **The Product schema never declares `isFeatured`.** Mongoose defaults to
   `strict: true`, so `product.isFeatured = isFeatured` in `product.service.js` is
   silently dropped on save. The admin toggle appears to work but never persists, and
   `GET /api/products?isFeatured=true` filters on a field that is always absent → empty.
2. **`FeaturedProducts.tsx` is dead code** — it is not imported or rendered anywhere.

There is also a dedicated `GET /api/products/featured` endpoint whose `getFeaturedProducts`
service function ignores featured status entirely (its own comment: "For now, using recent
bestsellers").

## Goal

Admin-curated featured products, displayed on the homepage. An admin flags a product as
featured; it appears in a Featured Products section on the homepage. When no products are
flagged yet, the section falls back to bestsellers so it is never empty.

## Non-Goals

- No new admin UI (the toggle already exists in `product-seo.tsx`).
- No new API endpoints.
- No per-tenant featured logic (that is the separate `SubProduct.isFeaturedByTenant`).

## Changes

### 1. `server/models/Product.js`

Add the missing field in the PLATFORM / APPROVAL WORKFLOW section (near `isPublished`):

```js
isFeatured: { type: Boolean, default: false, index: true },
```

This is the root fix. It makes:
- the existing admin toggle persist (service already sets `product.isFeatured` for
  super-admins at ~line 1757);
- the existing `?isFeatured=true` list filter (`product.service.js` ~line 3968) return
  real rows.

### 2. `server/services/product.service.js` — `getFeaturedProducts`

Currently matches `{ status: 'approved', isPublished: true }` only. Change it to:

1. First query featured products: `{ status: 'approved', isPublished: true, isFeatured: true }`.
2. If that returns fewer than `limit`, fall back to the existing bestseller/recent logic to
   fill the remainder (dedup by `_id`).

This keeps `/api/products/featured` never-empty and makes it the reliable server-seed
source for the homepage. Response shape is unchanged.

### 3. `client/apps/platform/src/components/Home1/FeaturedProducts.tsx`

Mirror the `FeaturedDeals` server-seeding pattern:

- Add `initialProducts?: ApiProduct[]` to `FeaturedProductsProps`.
- Seed `products` state from `initialProducts` when present, and skip the initial client
  fetch (`const seeded = (initialProducts?.length ?? 0) > 0`).
- Keep the existing `?isFeatured=true` client fetch as the non-seeded fallback path.

No visual changes to the component.

### 4. `client/apps/platform/src/app/page.tsx`

- Add a server helper `fetchFeaturedProducts(limit = 8)`:
  - fetch `${API_URL}/api/products?isFeatured=true&limit=${limit}` (with
    `next: { revalidate: 300 }`, matching `fetchFeaturedDeals`);
  - if empty, fall back to `${API_URL}/api/products/featured?limit=${limit}`;
  - parse the same response shapes the other helpers handle; return `[]` on error.
- Add it to the existing `Promise.all` alongside `fetchFeaturedDeals` /
  `fetchInitialRecommendations`.
- Mount the section **after the Hot Deals `<section>`** and before Benefits:

  ```tsx
  <section className="py-4 bg-white">
    <div className="container mx-auto px-3">
      <FeaturedProducts limit={8} initialProducts={featured} />
    </div>
  </section>
  ```

  Import `FeaturedProducts` via `dynamic(() => import("@/components/Home1/FeaturedProducts"))`,
  consistent with the other below-fold sections.

## Data Flow

```
Admin checks "Featured Product" (product-seo.tsx)
  → PATCH product, service sets product.isFeatured (super-admin only)
  → persists (schema field now exists)
Homepage (server) fetchFeaturedProducts()
  → ?isFeatured=true  (fallback: /api/products/featured bestsellers)
  → initialProducts → <FeaturedProducts> renders crawlable cards after Hot Deals
```

## Testing

- **Server unit test** for `getFeaturedProducts`:
  - returns flagged products first when some are `isFeatured: true`;
  - falls back to bestsellers to fill `limit` when none/few are flagged;
  - never returns more than `limit`, no duplicate `_id`s.
- **Manual:** toggle "Featured Product" in admin, save, confirm it persists on reload and
  the product surfaces in the homepage Featured section.

## Risks / Notes

- Adding an indexed field triggers an index build on `products`; the collection is small,
  so this is negligible.
- Only super-admins can set `isFeatured` (existing service guard) — vendors cannot
  self-feature. Intended.
