# Merchandising — Upsell & Cross-sell Pipeline

Date: 2026-11-14. Spec: docs/superpowers/specs/2026-11-13-merchandising-upsell-cross-sell-design.md.
Plan: docs/superpowers/plans/2026-11-14-merchandising-upsell-cross-sell.md.

## What exists now
- `server/config/merchandising.js` — beverage family map (type→family) + family pairings.
  Families reuse `expandedProductTypes` group names; non-beverage retail verticals map to
  OTHER, which pairs with nothing (always falls through to semantic/related tiers).
- `server/services/merchandising.service.js` — tiered hybrid engine:
  boughtTogether: co-purchase → pairing_rules → related_fallback;
  crossSells: pairing_rules → semantic; upSells: price_band → brand_premium → semantic.
  Every item carries `source`. Process-local 5-min Map cache, no Redis.
- `GET /api/products/:id/merchandising?context=pdp|cart` (public). Marketplace surface =
  beverage-only aggregates; tenant storefront (x-is-tenant-site + x-tenant-slug) = that
  tenant's published, online-visible SubProducts at `baseSellingPrice`.
  Old dead endpoints/controllers for /bought-together, /cross-sells, /upsells were deleted.
- Platform frontend: `useMerchandising` hook; PDP `BoughtTogether` bundle +
  "Step Up Your Pick" rail (reuses RelatedProducts); cart `CartCrossSellStrip`.
  GA4: view_item_list with item_list_id bought_together / cart_cross_sell;
  add_to_cart_merchandising carries the recommendation `source`.

## Rules to keep
- Cross-sell pairings must reference families that have enum members (test-enforced in
  merchandisingConfig.test.js). New Product.type values must be mapped in
  server/config/merchandising.js.
- Cart context never excludes in-cart items server-side; the client filters (cart state
  is client-owned).
- No costPrice/vendor PII in any recommendation payload (Workstream B).
