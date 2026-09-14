# SiteGuru SEO baseline and patch

2026-09-09 screenshot request: MarketplaceIntro is rendered inside a Tailwind
`sr-only` wrapper. Its SEO/accessibility text and crawlable links remain in the
HTML without occupying visual space for sighted visitors.

2026-09-09 follow-up: added shared `SeoContextBlock` to categories, brands,
shop, deals, shipping, About and FAQs. Each block is page-specific and contains
real internal links; it is `sr-only` and remains accessible to assistive tech.
Google's current guidance says page content should be accessible in the DOM and
useful to people; avoid expanding this into unrelated keyword stuffing.

Extended `SeoContextBlock` to category/subcategory detail, blog index/articles,
product detail and public store detail pages. Heading IDs are deterministic and
unique so nested blog layouts do not create duplicate IDs.

Added the same venue-specific block to `/venues`, covering venue discovery and
table requests with links to shopping, categories, delivery and FAQs.

Shared hidden SEO context now states DrinksHarbour sells original products from
verified channels, does not sell counterfeit drinks and checks products before
dispatch. Homepage SEO context carries the same claim.

2026-09-09 full gap remediation: added `/catalogue` A–Z server links using the
public sellable-slugs endpoint (629 current products, covers all 277 product
orphans); store-directory server links cover both store orphans; VIP signup
linked from main footer. Split vendors/page into server wrapper + VendorsClient.
Descriptions: all 95 rows mapped to brand/product/store/static/signup templates;
84 brand/product audit cases pass length checks plus 39 focused tests.
See docs/seo-orphan-inventory.md, docs/seo-description-inventory.md and
docs/seo-authority-actions.md. Authority remains external work, not fixed.
No deployment or refreshed live audit yet.

2026-09-14 opportunity-product remediation: the shared product template now
falls back to a product-name title and SEO H1, validates real SKU/GTIN values
before Product JSON-LD, and renders an opportunity-only buying-details block.
The homepage, category hub, brand hub, blog articles and product pages now
carry crawlable links to the eight SiteGuru opportunity products, including
Bold 98, Salamanca, Laphroaig, Famous Grouse, Whitley Neill, Old Smuggler,
Pata Negra and Glenfiddich 18. The live Bold 98 route confirmed the expected
slug. Focused SEO tests pass; the full typecheck still has unrelated baseline
errors. Deploy and rerun SiteGuru/GSC after indexing.

2026-09-09 user direction: target "buy drinks online" as the homepage's primary
search intent. Title/H1 now use "Buy Drinks Online in Nigeria"; description and
visible introduction reinforce online shopping. Abuja delivery remains supporting
context. This refinement remains local, not deployed.

SiteGuru is callable in this workspace; always discover connector tools before
claiming it is unavailable. Accessible domain: https://www.drinksharbour.com.

2026-09-08 baseline: 95 overall health, homepage 78, authority metric 0/100,
280 orphan pages, 95 description issues, 23 slow pages, 12 no-response crawl
failures. Google Search Console connected; GA4 not connected in SiteGuru.
Competitor backlink comparison has no stored data and needs user-run paid lookup.

Local patch improves homepage/venue metadata, ten page descriptions, brand
fallback descriptions/titles, Abuja delivery context and server-rendered blog
links. 35 targeted tests passed. Application typecheck fails in unrelated files.
No deployment or live score increase confirmed. Preserve private-page noindex.

Full evidence, files, validation and remaining work:
[SEO resume](../superpowers/specs/RESUME-seo-siteguru.md).
# Commit preparation

- Corrected the store layout's SEO context to derive the store name locally from its slug, avoiding an undefined browser-global reference during server rendering.
- Commit scope excludes unrelated document-template, popup-banner and POS changes. No push or deployment requested.
