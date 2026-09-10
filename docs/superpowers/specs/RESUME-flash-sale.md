---
title: Homepage flash sale visibility fix
status: complete
updated: 2026-09-09
---

# Homepage flash sale visibility fix

## Delivered

- Switched `FlashSale.tsx` to the shared `API_URL` resolver instead of a hardcoded localhost fallback.
- Kept the strict on-sale query sorted by discount and added a catalogue fallback when it returns no products.
- Recognized active product-level discounts, tenant sale fields, size discounts, and real current-vs-original price reductions.
- Removed the client-side filter that only accepted `size.discount.hasDiscount`, which could discard valid promotions returned in other supported shapes.
- Preserved the existing card, countdown, carousel, quick-view, and `/deals` behavior.
- Increased the source query window from 20 to 100 because the API applies its on-sale filter after pagination; the UI still caps the rendered carousel at 20 products.
- Changed the loader to walk every public catalogue page (`limit=100`) before filtering promotions locally, so the section no longer depends on the API's post-pagination sale filter.
- Fetches page one first and loads remaining catalogue pages concurrently, while homepage server-fetched deals render immediately as a seed during the background refresh.
- Scoped the homepage blog card's full-card link overlay to its own positioned article so blog URLs cannot intercept Flash Sale controls.

## Verification

- Focused ESLint passes for `client/apps/platform/src/components/Home1/FlashSale.tsx`.
- Platform type-check reports no errors from `FlashSale.tsx`; it remains blocked by existing errors in banner route types, checkout, shop, policy content, loyalty, and other unrelated files.
- The local API was not running, so live response verification was not available in this session.
