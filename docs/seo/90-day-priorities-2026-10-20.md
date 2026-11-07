---
title: DrinksHarbour 90-day organic growth priorities
date: 2026-10-20
status: website implementation locally verified; ongoing programme prepared; not deployed
---

# Decision

[Likely] Improve existing commercial destinations and prove their delivery and
trust claims before expanding the number of indexed pages. The proposed themes
are useful; the order and several ranking assumptions need correction.

The user authorised implementation after reviewing this programme. Local website
work and ongoing operational work are tracked in
[the release folder](growth-2026-10/README.md). Day 1 starts at actual release;
this programme is not a traffic forecast or a claim that production has changed.

## Evidence and limits

[Certain] The October 19 stored audit records 1,011 pages, health 92/100 and
508 Search Console clicks for July 19–October 16. GA4 was not connected in that
report. These figures are historical, not a fresh crawl or current baseline.
See [audit evidence](audit-2026-10-19/README.md).

[Certain] Local code already has Abuja and Lagos delivery pages; Product JSON-LD
includes origin, ABV, offers/availability and conditional ratings/reviews. Category
pages already have FAQs. Existing SEO patches and the competitive storefront
release are documented, but those records do not establish production deployment.

[Certain] Category detail metadata currently canonicalizes to
`/shop?category=<slug>`. Treat this as a deliberate existing policy to assess,
not a defect to reverse automatically. Empty taxonomy noindex and private-page
exclusions must remain intact.

[Guessing] Lagos demand being much larger, Drinks.ng owning the named terms, and
authenticity being DrinksHarbour's strongest competitive differentiator remain
hypotheses. No fresh keyword-volume, competitor ranking, customer research or
conversion dataset was retrieved for this review.

## Correct the strategy

- [Certain] Google retired FAQ rich results on May 7, 2026. Keep helpful visible
  FAQs; adding FAQ schema everywhere is not a rich-result quick win. See
  [Google's changelog](https://developers.google.com/search/updates#may-2026).
- [Certain] Google does not require special schema for AI search features.
  Product markup should reflect visible, current facts; ABV and origin provide
  useful detail without guaranteeing snippets or AI citations. See
  [Google's AI guidance](https://developers.google.com/search/docs/appearance/ai-features).
- [Likely] A chatbot can reduce purchase friction when it answers genuine buying
  questions. More time on site may also signal confusion. Do not use engagement
  inflation as a ranking tactic or claim an automatic ranking reward.
- [Likely] Repeated absolute badges are weaker than evidence. Publish verification
  steps, responsible parties, limitations and a complaint/remedy process only
  after operations confirms them. Do not invent checks or an absolute guarantee.
- [Certain] In this platform, selling businesses are Tenants. Public copy can say
  approved sellers; implementation must preserve Tenant/SubProduct ownership.
- [Likely] Do not force location, authenticity and delivery into every H1. Keep
  the H1 readable; put supporting benefits in a useful visible introduction.
  Avoid duplicating an existing category with a keyword-only landing page.

## Priority order

| When | Priority and deliverable | Owner role | Completion evidence |
| --- | --- | --- | --- |
| Days 1–14 | P0: inventory production vs local fixes; recrawl representative routes; settle canonical ownership | Engineering + SEO | Live URL checks, canonical/indexability map and current crawl snapshot |
| Days 1–14 | P0: verify Search Console and analytics; record organic purchase value, orders and quote leads | Analytics + commercial | Tested purchase/lead events, deduplicated order IDs, baseline report |
| Days 1–14 | P0: validate delivery coverage, cutoffs and bottle verification claims | Operations | Written evidence and approved public wording |
| Days 15–30 | P1: improve 5–8 existing stocked category/subcategory pages and 10 important product pages | SEO + merchandising | Unique visible copy, correct metadata/schema, working browse/purchase paths |
| Days 15–30 | P1: strengthen Abuja/Lagos delivery pages and add a documented authenticity page if evidence is ready | Operations + editorial | Useful destination-specific details and clear customer remedy/contact path |
| Days 15–45 | P1: fix measured mobile template bottlenecks and verify age-gate crawlability | Engineering | Before/after measurements and Search Console rendered-page checks |
| Days 31–60 | P2: pilot bulk/case buying and a wedding hub; corporate/gifting hub if fulfilment supports it | Commercial + editorial | Real pack/quantity pricing or an actionable quote flow; sample orders/leads tracked |
| Days 31–60 | P2: improve comparable seller offers and collect verified-purchase reviews | Product + operations | Same-size/pack comparisons, stock/delivery clarity, genuine moderated reviews |
| Days 61–90 | P3: expand only successful hubs; pilot one additional city if demand and service justify it | SEO + operations | Distinct local utility, fulfilment evidence and measurable search/customer demand |
| Days 61–90 | P3: publish a useful deals roundup and one seller spotlight pilot | Merchandising + editorial | Current offers, permissions, stock-aware links, dated refresh ownership |

These counts are proposed capacity limits, not predictions of traffic gains.
If measurement or operational evidence slips, defer new page expansion.

## Page and content decisions

1. Map one primary intent to one canonical destination. First assess Search
   Console indexing and landing-page performance for category detail vs filtered
   shop pages. If adopting self-canonical category pages, align internal links,
   sitemap and structured data in a reviewed change. Prevent filter index bloat.
2. Choose initial categories from impressions, achievable positions, stock depth
   and margin. Gin, scotch, tequila and champagne are candidates, not verified
   high-volume priorities. Use existing taxonomy where it serves the intent.
3. Example category title: `Buy Scotch Whisky in Nigeria | DrinksHarbour`.
   H1: `Buy Scotch Whisky Online in Nigeria`. Do not label all scotch single malt;
   include blended styles where stocked. Write unique selection guidance and
   fulfilment context instead of mechanically changing a category name.
4. Use accurate ABV, origin, bottle size, current selected-offer pricing, stock
   and real approved reviews on product pages. Validate representative rich
   results and visible/schema parity; do not rebuild existing schema blindly.
5. Expand Lagos around real coverage, fees and lead times. Local copy currently
   says an estimated 2–3 business days; operations must confirm it. Same-day
   claims outside Abuja require actual capability. Even Abuja needs cutoffs,
   eligible areas and availability qualifications.
6. City pages need distinct service information and useful shopping paths.
   Defer Port Harcourt/Ibadan templates with only city-name substitutions:
   [Google's doorway policy](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse)
   specifically addresses thin regional funnels.
7. Compare identical product, volume, pack count and order quantity across
   current seller offers, with delivery costs/times visible or qualified.
   Extend existing size/bulk work. Avoid unsupported nationwide lowest-price claims.
8. Trust content should show genuine inspection evidence, who performs checks,
   what happens when a bottle is questioned and how refunds/returns work.
   Existing hidden SEO text is not a substitute for customer-visible evidence.
9. Request reviews consistently after fulfilment, not only from happy customers.
   Photos need permission and moderation. No fabricated reviews or gated negative
   feedback. Any automated requests or external outreach are separate work.
10. Link helpful guides to relevant categories and products, with return paths
    to delivery/trust guidance. Every new hub needs an existing navigation source.
    Start with two researched guides monthly; increase cadence only if useful
    content and current offers can be maintained.

## Technical acceptance

- Test home, category, product and delivery templates on mobile before/after age
  verification. Measure real-user data when available; use lab diagnostics when
  field traffic is insufficient. Do not equate smaller payloads with proven CWV gains.
- Confirm crawlable product text/links/schema behind the overlay using Search
  Console's live rendered test. Avoid consent redirects. If crawler-specific
  handling is needed, verify Googlebot requests; a user-agent string alone is
  insufficient. Preserve adult purchase checks. See
  [Google's interstitial guidance](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials).
- Preserve privacy exclusions, sold-out product handling and server-authoritative
  tenant stock/pricing. Confirm HTTPS canonicals and current production deployment.

## Measurement and day-90 decision

Record baseline and subsequent 28-day comparisons, annotated for releases,
promotions, stock outages and seasonality. This programme crosses holiday demand;
raw growth alone cannot establish an SEO effect.

| Measure | How to use it |
| --- | --- |
| Organic orders, purchase value and contribution where available | Primary commercial outcome; split new/existing customers where reliable |
| Organic conversion rate and qualified event/bulk leads | Detect traffic that does not produce business; track quote-to-order outcome |
| Non-brand GSC clicks, impressions and CTR by landing page/query cluster | Assess category, product, brand and delivery intent separately |
| Fixed competitor keyword sample | Track DrinksHarbour and Drinks.ng using the same Nigeria/mobile setup and fixed location; separate Abuja/Lagos local checks |
| Current referring domains and relevant earned links | Check freshness and quality; do not optimize for a provider authority score |
| Indexing/canonical status, schema errors and mobile performance | Diagnose access and template problems; not substitutes for sales |

Track the user's six intent groups: buy drinks online Nigeria, buy wine online
Nigeria, buy whiskey/whisky online Nigeria, alcohol delivery Abuja, bulk drinks
Nigeria, and stocked major-brand + Nigeria terms. Do not claim competitor traffic
or conversions from public ranking tools. Search Console covers our site only.

At day 30 assess deployment, indexing and event reliability; at day 60 assess
category and hub demand; at day 90 expand pages that attract relevant traffic
and convert. If impressions rise without orders, investigate stock, pricing,
delivery cost and checkout before publishing more pages. Numerical growth targets
remain unset until a reliable current baseline is available.
