# DrinksHarbour SEO audit — 2026-10-19

## Baseline

SiteGuru reports 92/100 health over 1,011 pages. Search Console is connected
(508 clicks, July 19–October 16); GA4 is not. These are retrieved stored results,
not a newly triggered crawl or proof that local changes are deployed.

All 18 report categories were retrieved. Full available inventories were paged
to completion for titles, descriptions, headings, alt text, structured data,
canonicals, speed, OG, orphans, hreflang, indexation and placeholder text.
Most returned 1,011 rows; descriptions returned 945 and speed 42. Issue snapshots
in this folder preserve affected URLs. Counts can differ between summaries and
GSC coverage rows: 66 crawler exclusions versus 434 GSC/crawler suggestions.

| Check | Reported finding | Decision |
| --- | --- | --- |
| Broken links | 8 targets on 12 pages | Resolve current product identities and repair source links |
| Error pages | 4 no-response URLs | Recheck availability; do not invent redirects |
| Descriptions | 37, all category/subcategory pages | Normalize existing catalogue text |
| Headings | 8 | Fix public storefront SSR; preserve private-page noindex |
| OG tags | 17 | Complete missing image metadata on affected routes |
| Orphans | 133 products, 16 categories, 2 delivery pages | Verify live directory coverage; link useful destinations |
| Canonicals | 45 | Existing category→shop consolidation is intentional; do not reset blindly |
| Indexation | 65 noindex + 1 robots-blocked | All excluded pages are private flows or empty taxonomy; preserve |
| Speed | 42 below 90; brands hub 38, blog hub 41 | Inspect shared rendering/data cost; require measured verification |
| Titles, alt, schema, hreflang, placeholders | No reported issues | Preserve; SiteGuru schema presence is not full rich-result validation |
| Sitemap | Valid, 1,069 entries; no listed errors | Preserve canonical-only visibility rules |
| HTTPS/www/slash/404/favicon/robots | Passing | Preserve |
| Backlinks | 12 referring domains; data dated September 8 | Stale external metric; no disavow/outreach based on score alone |

The task list also flags 30 similar-content pages; the report API does not expose
that report type. Canonical strategy must be reviewed before content rewrites.

## Implementation structure

Use the existing `src/lib/seoDescription.ts` for taxonomy snippets. Add a small
social-metadata helper and colocated tests, then apply it to flagged layouts.
Keep public store headings available in initial HTML. Inspect catalogue/blog
product references against current public data before changing them. Record
verification and remaining operational items here and in the resume/memory files.

## Applied fixes

- Both taxonomy metadata generators now normalize short copy with category-specific
  shopping context; all 37 captured examples measured 120–160 characters.
- `src/lib/socialMetadata.ts` supplies per-route OG/Twitter images while retaining
  existing URLs, titles, custom metadata and private-page robots rules. Applied to
  12 static layouts, both delivery pages and the store-detail generator (3 stores),
  covering the 17 flagged routes.
- The shop carousel now emits its seeded H1 before loading banners. Public store
  layouts emit one server H1; the client store title becomes H2. The deals client
  already has an H1, as do the private cart/account/wishlist pages; those findings
  need recrawl rather than duplicate headings or privacy-rule changes.
- `src/lib/catalogueLinks.ts` resolves six stale editorial product paths to current
  public catalogue entries. Blog inline links and curated product cards use it.
  Springfield Estate's public brand endpoint returned 404 while its bottles remain
  public; product brand links now open a search for that brand instead of the 404.
- Linked Abuja and Lagos delivery pages from shipping information.
- Blog list/related-post payloads omit full article bodies; article detail keeps
  its content. Measured using 20 current public posts: serialized summaries shrink
  from 224,497 to 27,091 bytes (88%). This is a payload measurement, not a new
  Lighthouse score or a guarantee that all 42 speed findings are resolved.

## Fresh public checks

- All four `no_response` URLs now return HTTP 200. No speculative redirects added.
- The current public slug endpoint contains 759 sellable products. Actual catalogue
  rendering includes HTML links to 132 of the 133 flagged product orphans. The
  missing `whispering-angel-cotes-de-provence-rose` is absent from that public list;
  do not force it into navigation without confirming sellability.
- The old Dona Ermelinda URL no longer appears in that public catalogue; its
  cached broken-link warning needs recrawl. The endpoint's current red-wine entry
  is `dona-ermelinda-tinto-red`; no automatic redirect between bottles was added.
- Of 16 category orphans, 15 are intentionally noindexed empty styles. The useful
  demi-sec page has the parent category's existing dynamic style-link mechanism;
  inspect a fresh crawl before adding a second taxonomy directory.

## Verification and limits

- 158 tests passed across all 39 platform `.test.cjs`/`.test.mjs` suites, including
  20 new SEO audit cases. New regressions failed before implementation.
- The workspace's platform Next.js 16.1.6 symlink is dangling. A normal run had
  16 missing-import test failures; offline pnpm restoration requested purging the
  shared modules directory and was aborted. Shared dependencies were left intact.
  Full verification used an isolated exact Next.js 16.1.6 package in `/tmp`, with
  references to already-installed matching `@swc/helpers`, `@next/env` and
  `styled-jsx`; production manifests/lockfiles were not changed by this task.
- Type checking with isolated Next types still fails in existing banner route
  params, checkout/Set typing, policy contact links, loyalty styles, shop filters
  and discount typing; existing root analytics package imports are also missing.
  No diagnostics in the new SEO helper, taxonomy, store or blog changes.
- `git diff --check` passed. Manual diff review completed. CodeRabbit was already
  unavailable; no external review or production build completed.

No commit, push or deployment performed. Restore the platform dependency links
before normal local builds, deploy the reviewed platform patch, and rerun SiteGuru
and Semrush. SiteGuru's 92 score is the baseline, not an improvement measured here.
The provider tools expose stored reports but no crawl-trigger capability.

Remaining operational items: remeasure the 42 speed findings, inspect the 30 similar
content pairs in SiteGuru's UI, verify GSC exclusions/indexing over time, and review
fresh backlink data. No outreach, backlink purchase or disavow submission performed.
SiteGuru reports schema presence; it does not independently clear the exact two
Semrush structured-data errors reported earlier.

## Continuation — normal workspace verification

The earlier dependency limitation was resolved by concurrent workspace repair.
Normal `npm run type:check` now passes. Banner routes await Next.js 16 promised
params; three regressions confirm click/impression targets and placement query
forwarding. Existing compiler errors in Set iteration, policy-link types, loyalty
styles, filter animation and sale-discount types were corrected. The checkout's
legacy persisted-cart tenant fallback remains intact.

Brands directory sends only card, image, filter and sort fields to the browser.
All 407 published brands remain discoverable, including 40 with zero/missing
cached product counts. Fresh public data: 212,592→88,132 serialized bytes (59%).
Long stories remain on detail pages; descriptions in cards are capped at 240
characters. This is data reduction, not a new speed score. Two regressions check
field preservation, payload removal and discoverability.

All 163 platform tests in 40 files pass with normal installed dependencies.
TypeScript passes independently of the existing build setting that skips types.

Production verification completed: `npm run build -- --webpack` exited 0 with
network access for Google Fonts (57 static pages generated). Default Turbopack
build was interrupted after ~4 minutes without progress; the initial sandboxed
Webpack attempt failed only on font DNS. Existing nonfatal warnings: multiple
lockfiles/root inference, middleware convention, Elms Sans fallback metrics.
Normal build script/compiler configuration was not changed.

Built site smoke check on temporary port 3017: `/llms.txt` HTTP 200, text/plain,
4,053 bytes identical to source; `/robots.txt` HTTP 200 and Next image/static
allowances in both crawler groups. Temporary server stopped. The local `.env`
sets public base URL to `http://www.drinksharbour.com`, so this local build's
sitemap declaration uses HTTP. Production configuration must use
`NEXT_PUBLIC_BASE_URL=https://www.drinksharbour.com` and be rebuilt; this local
setting does not establish what Vercel currently uses. Environment files were
not edited. Deployment and provider recrawls remain outstanding.

### Robots follow-up

The subsequent robots patch fixes its HTTP sitemap declaration at source, without
editing environment files: official apex/www origins normalize to HTTPS www;
invalid configuration falls back safely. Other metadata/sitemap content still
requires the correct production base URL. Parameter matching now requires a real
key boundary (so `faq=` is not mistaken for `q=`), and the API root is covered.
165 tests, TypeScript and actual Next metadata serialization pass. Reviewable
output: `docs/seo/robots-preview.txt`; handoff: `RESUME-robots-improvements.md`.
