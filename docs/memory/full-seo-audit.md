---
name: October full SEO audit
description: SiteGuru baseline, confirmed fixes, intentional exclusions and verification limits.
type: project
---

2026-10-19 SiteGuru baseline: 1,011 pages, health 92. Full report summaries and
available inventories retrieved; evidence and decisions live in
`docs/seo/audit-2026-10-19/README.md` with issue snapshots alongside it.

Use `withSocialMetadata` when route metadata overrides nested OpenGraph objects:
Next does not merge parent image fields into that override. Taxonomy descriptions
now use the shared normalizer. Shop carousel and public store layouts have H1s in
initial HTML. Six stale product paths are handled by `resolveCatalogueHref`; the
removed Springfield brand opens a product search. Update those mappings only
against public catalogue identities, never by guessing bottle equivalence.

Blog `getPosts()` intentionally returns empty content arrays for listings and
related navigation; `getPostBySlug()` retains article bodies. This reduced the
20-post serialized summary from 224,497 to 27,091 bytes, not measured page speed.

Preserve private-flow and empty-category noindex and the documented category→shop
canonical policy. 132/133 orphan products already have live catalogue links; the
last is absent from the sellable catalogue. All four no-response pages returned
200. Backlink data is stale, and Google indexing/ranking cannot be fixed by
removing legitimate privacy exclusions or submitting an unreviewed disavow.

Continuation (2026-10-19): shared dependency links were repaired concurrently;
normal platform TypeScript now passes. Banner tracking and placement handlers await
Next 16 promised route params (3 regressions). Existing Set iteration, policy-link,
animation, loyalty-style and sale-discount types were corrected. Persisted cart
`tenantId` remains an optional compatibility field; checkout fallback is retained.

Brand directory now projects only card/filter/sort fields into client props.
407 live brands retained, including 40 with zero/missing product counts. Serialized
brand data measured 212,592→88,132 bytes (59%); full stories stay on detail pages.
Two new projection regressions pass. Normal platform test run: 163/163 pass in
40 files, without isolated dependencies. Build status is recorded in the audit
README and resume file. No deployment, commit, push or fresh provider crawl.

Production Webpack build passed with network access for fonts; local HTTP verifies
llms.txt (200 plain text, 4,053 bytes) and both robots rule groups. Default
Turbopack attempt was stopped after no progress. Existing local public base URL
is HTTP; verify production uses HTTPS before deploying (see audit README).
