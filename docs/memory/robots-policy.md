# Robots policy — 2026-10-19

Source: `client/apps/platform/src/app/robots.ts`. Wildcard and named AI crawler
groups share the same allow/disallow arrays; do not weaken private restrictions
in a named group. Preserve the user's current public/AI crawling policy.

Query restrictions use first-parameter `/*?q=` and later-parameter `/*?*&q=`
patterns for each blocked key. The former `/*?*q=` also blocked unrelated keys
such as `faq=`. Do not reintroduce substring matching. Keep pagination, category,
subcategory, brand and sale parameters crawlable for discovery/canonical signals.
Rendering resources and llms.txt remain accessible. API root, API queries and
API descendants are blocked. Robots is crawl guidance, not access control;
private endpoints still require application authorization.

The sitemap declaration normalizes main-site www/apex HTTP URLs to
`https://www.drinksharbour.com/sitemap.xml`. Malformed/unsupported configuration
falls back to that URL. Explicit tenant/custom origins are preserved, public
origins upgraded to HTTPS; loopback development origins may use HTTP. This fixes
robots only; it does not change sitemap entries or metadata elsewhere.

Verification: 165 platform tests pass, normal TypeScript passes, and actual Next
metadata serialization produced `docs/seo/robots-preview.txt` (2,521 bytes).
Two new regressions failed before the fix. Existing private/noindex policy and
AI access retained. No production deployment or fresh build/HTTP check this turn.

Matching reference: https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec

Reviewed commit follow-up (2 November 2026): two focused route policy checks pass
in an isolated checkout. Query restrictions and origin normalization are included
without other SEO/content changes. No production build or deployment performed.
