# SEO / AI-search files for drinksharbour.com — 2026-11-10

Context: installed `coreyhaines31/marketingskills` globally (~50 skills) and ran
the `seo-audit` + `ai-seo` skills against the live platform site.

## Audit conclusion

The platform app's SEO/AI-search surface is already strong. Verified live:
`robots.txt` (parameter filters + AI crawlers explicitly allowed),
`llms.txt` (accurate, well-structured), homepage metadata (title/description,
canonical, hreflang `en-NG` + `x-default`, OG/Twitter, geo tags), and three
server-rendered JSON-LD blocks (`OnlineStore`, `Organization`, `WebSite` with
SearchAction). Dynamic sitemap includes products, brands, categories,
vendor storefronts (only stores with stock) and blog posts.

## What changed this session

1. **`client/apps/platform/public/pricing.md` (new)** — machine-readable vendor
   pricing for AI agents/buyers. Data taken verbatim from
   `server/config/erm-plans.js` (Starter ₦15k/13% … Venue ₦150k/9%, add-ons
   ₦12k shop / ₦20k warehouse, 14-day trial, Pro+ for add-ons per AGENTS.md).
   Mortgage note: AGENTS.md and the erm-plans comment disagree on whether
   add-ons are Pro+ only — I followed AGENTS.md; re-check at next pricing-page
   change.
2. **`.agents/product-marketing.md` (new)** — context document all marketing
   skills read first (product, ICP, positioning, voice, guardrails).
3. **`llms.txt`** — added link to `/pricing.md` under "For beverage businesses".
4. **`vendors/register/page.tsx`** — small text link to `/pricing.md` in the
   final CTA block (`tsc --noEmit` passes).

## Follow-ups (2026-11-10, same day)

- **DRI-5 sitemap leak — fixed.** `navigationCounts.js` (which backed the
  public category/subcategory `productCount` that sitemap.ts gates on) counted
  all approved products, so retail-kind-only subcategories (beauty-grooming,
  home-living, glassware — ckay gift-shop taxonomy) appeared in the sitemap
  while DRI-5 keeps those off the platform marketplace. The service now keeps
  two cache flavors: `marketplaceOnly` (beverage-kind, via
  `catalogKind.marketplaceWhereClause()`) for main-marketplace/sitemap callers
  and the legacy all-product tally for `x-is-tenant-site` callers (DRI-9
  surface flag, same convention as `getProductBySlug`).
  Tests: `server/__tests__/navigationCountsSurface.test.js` (4 pass).
- **Variant subcategory slug pairs — guarded in the sitemap.** Live data holds
  `fruit-liqueur`+`fruit-liqueurs` and `cream-liqueur`+`cream-liqueurs` (same
  parent). `src/lib/subcategorySitemap.ts` collapses variant pairs per parent
  (higher productCount wins; tie keeps the longer slug). Tests:
  `src/lib/subcategorySitemap.test.mjs` (3 pass). `tsc --noEmit` passes.
- **Still open (data migration, needs prod DB):** merge the two duplicate
  SubCategory pairs into one record each (repoint products, 301 the losing
  slug), then drop the sitemap guardrail if desired. Also decide whether
  glassware/snacks/home/beauty subcategory docs should carry an explicit
  non-marketplace status so admin surfaces stop offering them for beverage
  marketplace grids.
