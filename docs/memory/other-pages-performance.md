# Public page loading improvements — 2026-10-10

## Implementation
- Homepage sends the category drawer, title and hero shell immediately. `HomeSections.tsx` fetches its four existing seeds in parallel inside Suspense; server product cards and their matching JSON-LD arrive together. Existing seed endpoints, freshness policies and lazy sections are preserved.
- Brand/category/subcategory heroes, emblems, preview products and related tiles use `OptimizedImage` with explicit responsive widths. Directory thumbnails, blog images and remaining promotional/banner variants share that loader too. Animated GIF exclusions and blog blur/error handling are preserved.
- Blog article and article-navigation reads start together through `getArticleData`; missing articles still trigger `notFound`.
- Redis category/subcategory counts from the earlier change already accelerate navigation throughout these pages. No extra cache of prices, stock, private tenant data or personalized content was introduced.

## Validation
- Platform tests: 79 passed, 0 failed. New tests verify hero output while catalog is suspended, streamed product links after release, concurrent article requests and responsive blog images with blur placeholders.
- Scoped ESLint: clean. Fixed existing unescaped text in two touched views without changing the rendered wording.
- Platform type check: still fails on 19 pre-existing diagnostics; none in this change's files. See `docs/superpowers/specs/shop-banner-filter-type-errors.md`.
- Backend suite: 3,647 passed, 0 failed, 5 skipped (3,652 total). Local diff review and scoped whitespace check completed. CodeRabbit CLI unavailable.
- Browser tooling was unavailable in this session (existing CUA kernel initialization failure). No visual or deployed speed measurement claimed.

## Resume
Changes are uncommitted and undeployed. Extensive unrelated working-tree changes must be preserved. Live production rollout needs a deliberate release of the intended files; do not deploy the entire dirty checkout. Existing Redis metadata cache remains disabled because prior measurements showed it slower. See `docs/performance/navigation-redis-images.md` for Redis and Cloudinary evidence.
