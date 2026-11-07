---
name: Semrush October crawl remediation
description: Robots image query conflict, OnlineStore schema and icon link text.
type: project
---

Next image requests use a `q` quality parameter that collides with robots.txt's
global search-parameter exclusions. Public render resources need explicit
allowances in every matching user-agent group; preserve private-route exclusions.

OnlineStore inherits Organization, not LocalBusiness. Do not attach geo,
openingHoursSpecification, priceRange, currenciesAccepted, paymentAccepted or
hasMap directly to an OnlineStore node.

Icon-only links should contain descriptive text (visually hidden when needed),
not only aria-labels. Maintain empty/inert states for non-clickable banners.

The supplied Semrush PDF lists aggregate page totals, not issue details. Exact
schema-error and low-text-ratio pages remain unconfirmed. See
`docs/superpowers/specs/RESUME-semrush-october-audit.md` for progress and checks.

Implemented the shared image-resource allowance, OnlineStore property/asset
correction and descriptive text for icon/overlay links. All 138 platform tests
passed, including six new regressions. Typecheck still fails in unchanged files;
no errors in this patch's files. Live browser confirms the original shared
schema/link defects. Deployment and a new Semrush crawl remain outstanding.
