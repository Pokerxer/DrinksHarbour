---
name: SEO 90-day strategy review
type: project
date: 2026-10-20
---

User asked to review/prioritize the supplied SEO recommendations, not implement.
Plan: `docs/seo/90-day-priorities-2026-10-20.md`.
Resume: `docs/superpowers/specs/RESUME-seo-90-day-strategy.md`.

Google retired FAQ rich results May 7, 2026; official changelog verified this turn.
Existing Product schema and Abuja/Lagos routes should be audited, not duplicated.
Category detail canonicals currently point to filtered shop URLs: assess ownership
before scaling independently ranked category pages. Do not blanket-reverse them.
Prioritize production verification, measurement and evidence for delivery/trust
claims, then existing commercial pages, then small occasion/geography pilots.
No verified keyword-volume, competitor-position or conversion baseline retrieved.
No code, production changes or external communications in the initial review.

Continuation: user subsequently authorised implementation. Local source work and
verification are complete; see docs/memory/seo-growth-implementation.md and
docs/seo/growth-2026-10/README.md. No deployment or ongoing publication claimed.

Occasions audit (DRI-20, 2026-11-06, findings-only, issue marked done): full
ranked list lives on the DRI-20 Paperclip thread; feeds frontend child DRI-23.
Key evidence: prod /occasions, /occasions/weddings, /bulk-drinks 404 and live
sitemap.xml has zero /occasions URLs (whole surface undeployed). Quick wins
identified: add 8 registered subpages to app/sitemap.ts; fix breadcrumb depth in
components/CommerceGuides/GuideStructuredData.tsx + CommercialGuide.tsx; dead
#occasion-chat anchor on Weddings via components/Occasions/planning/SubpageNav.tsx
(weddings mounts WeddingPlanner id="wedding-list" only); add in-copy links to
each occasion's own subpages (corporate/gifting/house-parties missing the
WeddingQuantities.tsx pattern). Rejected: FAQPage (rich results retired
2026-05-07) and Event schema (pages are undated planners). Follow-up watch:
corporate/client-gifts vs gifting/corporate-gifts overlap needs an editorial or
canonical decision in DRI-23.

Occasions implementation (DRI-23, 2026-11-06): all five quick wins shipped —
sitemap now lists all 13 occasions URLs (8 subpages added via
`getOccasionSubpages`); `GuideStructuredData` builds breadcrumbs from real path
depth (subpages get Home → Occasions → occasion → leaf; `/occasions` leaf is
named "Occasions", not the meta title) and swaps in CollectionPage with
itemListElement when `collectionItems` is passed; `CommercialGuide` renders the
parent-occasion link in the visible breadcrumb on subpages; `SubpageNav` takes
`planHref` and the weddings page passes `#wedding-list`; in-copy links to own
subpages added via the shared `components/Occasions/planning/SubpageInCopyLinks.tsx`
sentence-rendering primitive (corporate, house-parties) plus inline gifting body
links; `/occasions` index now links each occasion's subpages as chips on
OccasionCard. Design polish: gifting story sections flattened to the shared
body rhythm (unboxed, same h2/p/space-y-8 as corporate/house-parties),
house-parties shelf grid gap-6 and summary card aligned to the shared
gold-border SuggestionQuantities treatment. CTA strings verified verbatim
against the DRI-21 marketing pack §2 (already live; no copy change needed).
Not done here: FAQPage/Event schema (rejected by audit); client-gifts vs
corporate-gifts differentiation (editorial decision, still open); per-occasion
OG images (asset production, follow-up); P0 deploy of the whole surface (the
quick wins have zero live SEO impact until it ships — verify live afterwards).
