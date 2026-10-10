---
title: Shop banner fallback and URL filter state
updated: 2026-10-10
---

ShopHeroBanner resolves dedicated bannerImage (featured images alone use the shop fallback), subcategory
before parent, and keeps artwork/link/analytics on the same entity. Missing
artwork uses the main `shop` placement. When that placement is empty, show a
compact heading and navigation, never an empty coloured hero. Generic
`category_top` adverts are no longer appended to category results.

Shop filter header remains accessible for empty/loading grids. filterQuery.ts
restores all URL filter fields, including ranges, rating, size and volume;
explicit price pins survive catalog-bound initialization. Catalog origin facets
use API `countries` (legacy `origins` accepted); flavours use unique categories.
Aborted old product requests cannot overwrite newer filter results. Subcategory
chip navigation resets pagination. No backend/schema changes.

See docs/superpowers/specs/RESUME-shop-banner-filters.md for verification.
