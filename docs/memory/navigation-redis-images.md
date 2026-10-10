---
title: Redis public navigation count cache and CDN image delivery
updated: 2026-10-10
---

Category/subcategory list count labels use namespaced Redis with 60s TTL, max100KB
per field and local fill coalescing. Missing Redis, corrupted entry or outage
falls back to one approved-product aggregation. Rows/publication remain live;
operational product/stock/price/checkout data is never response-cached. Set
REDIS_NAVIGATION_COUNTS_CACHE=false to disable. Old slow public metadata cache
remains off. Counts can lag changes by one minute; they do not authorize selling.

Shared UI OptimizedImage uses Cloudinary final delivery transformations only on
unsigned versioned raster uploads; signed/GIF/SVG/query URLs and other providers
keep native Next loading. Product cards include grid/list sizes; shop grid passes
sizes for the selected column layout. No asset/settings/provider/deploy changes.

Local count benchmark 49.74ms vs1.26ms warm; one real public product image sample
62,582 bytes JPEG vs14,396 bytes AVIF at384px. Production page speed not measured.
Handoff: docs/superpowers/specs/RESUME-navigation-redis-images.md.
Details: docs/performance/navigation-redis-images.md.
