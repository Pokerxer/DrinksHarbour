---
date: 2026-10-20
status: locally implemented and verified; not deployed
---

# SEO growth release and operating files

This folder executes the [90-day strategy](../90-day-priorities-2026-10-20.md).
It separates code that can be delivered now from evidence and activity that
require real operations, customers and subsequent reporting periods.

- [Baseline](baseline.md): returned Search Console periods, traffic and existing product opportunities.
- [Measurement](measurement.md): event definitions, release checks and editable scorecard.
- [Editorial calendar](editorial-calendar.md): 12-week content and merchandising work queue.
- [Operational evidence](operational-evidence.md): shipping, authenticity and review requirements.
- [Release preflight](release-preflight.md): deployment context and actual-app HTTP checks.
- [Implementation plan](../../superpowers/plans/2026-10-20-seo-growth-implementation.md).

## Website scope

- Enrich eight canonical category shop destinations, retaining existing
  category-to-shop consolidation. Suppress category-only guidance for compound
  filters and later result pages. Preserve document metadata overrides.
- Serve product buying guidance to humans and crawlers equally. Add useful
  visible product questions and retain 0% ABV in Product structured data.
- Add /bulk-drinks, /occasions, four occasion guides and
  /authenticity-guarantee, using existing catalogue, contact and policy paths.
- Strengthen Abuja and Lagos guides with qualified delivery information,
  commercial links and clear distinctions between local and interstate options.
- Add customer-visible home/footer/product/category links and sitemap entries.
- Track WhatsApp enquiry intent separately from accepted contact-form leads.
  Count confirmed paid orders as purchases, with merchandise value excluding
  shipping/tax and the order number as transaction ID. No payment flow changed.
- Invite delivered customers to the existing verified-purchase review/photo flow.
- Keep the age gate usable when browser storage is blocked. No unverified bot
  bypass is introduced; the underlying product HTML stays server-rendered.

## Release boundary

No database or catalogue metadata mutations, new payment behavior, new analytics
account, external messages, outbound review requests, scheduled publishing,
backlink submissions, commitments to delivery outside existing policy, or
production deployment are included in this local patch.

Ongoing work is prepared, not falsely marked complete. Real inspections, customer
reviews, supplier evidence and 90 days of results cannot be generated in a code
session. Remaining operational work must use the files above rather than chat
history. Existing prior SEO/performance fixes remain in the shared working tree.

## Release verification

Platform: 190/190 tests pass; TypeScript and focused ESLint pass. Production
Webpack build passes. Required backend suite: 4,096 pass, 36 skipped, zero fail.
The initial sandbox-denied HTTP failures are superseded by the successful
network-enabled run. The pre-existing homepage streaming test harness was
updated for existing async tenant routing and the new discovery component.

Wedding guide inspected at actual 390px and 1280px viewports using isolated
rendering of the real server components and built storefront CSS. Each had one
H1 and no horizontal overflow. This is not a full application/checkout test,
field Core Web Vitals measurement or live GA4 event validation.

Continuation: all nine new/expanded landing pages also passed actual built-app
HTTP checks: 200 responses, one H1, matching HTTPS www canonicals and parseable
JSON-LD. An unknown occasion returned 404/noindex. Deployment remains pending:
the platform directory is not linked to an existing Vercel project and the shared
checkout is not an identified reviewed release revision. See release-preflight.md.

Shared public-origin normalization now protects root/home, shop, product,
category/subcategory detail, brand detail, delivery/new-guide URLs and sitemap
from an official HTTP/apex configuration. Other existing page-level metadata
still relies on the correct deployment environment. No environment file edited.

Read [the resume](../../superpowers/specs/RESUME-seo-growth-implementation.md)
for exact commands and decisions. Before deployment verify the
production public origin is https://www.drinksharbour.com, API/tenant routing is
correct, and source changes are released with their existing dependencies.
After deployment test representative pages and GSC rendering, then obtain a
fresh crawl. The stored SiteGuru score is not a post-release improvement.
