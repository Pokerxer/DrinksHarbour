---
name: Brands directory behavior
description: Complete public catalog, accessible brand filters and request lifecycle, 2026-11-02.
type: project
---

/brands retains server-rendered cards and matching CollectionPage JSON-LD. Shared
components/Brands/loadBrands follows every API page with active status, preserves
backend alias search results, deduplicates IDs and compacts payloads through
brandCardData. Failed/partial data must not masquerade as an empty directory.

Keep unfiltered catalog separate from visible results: stable country choices,
hero totals and available initial letters come from the full catalog. Sort and
letter filters are local; choosing another letter remains possible. Country is
an exact-value native select. Search debounces and uses abort/generation guards.
A successful empty seed skips refetch; unavailable totals show dashes, not zero.
Search failures show explicit status/Retry. Cards render without opacity/stagger;
missing product counts must not hide a published brand or imply stock status.

UI is decomposed under components/Brands; 16px controls, 44px alphabet targets,
labelled native selects and wrapped alphabet work on mobile. Public brand API is
active-only. Admin unpublished review uses protected /api/brands/admin/:id with
session token on SSR; see brand-publication.md. Release server before/with admin.

Handoff and exact tests: docs/superpowers/specs/RESUME-brands-directory.md.
25 DOM checks, 142 module checks and platform/admin TypeScript pass; server 4516 pass,
66 unchanged test-DB setup failures, 258 skips. Full admin 3532 pass/4 failures;
all 18 checks in affected files pass independently. No commit/push/deployment.

Real browser: 419 brands, direct A→B (28 B brands), Scotland (14), GLEN +
Scotland (4); stable country options and selected letter. Mobile 390px has no
overflow with literal 44px targets and 16px inputs. Last full-grid card is
visible without delayed opacity. Desktop preview: /tmp/drinksharbour-brands-preview.png.

Filter layout follow-up: BrandsControls.module.css owns essential grid, input
height/font and alphabet sizing rather than generated utility classes. Desktop
at 768px+ uses search plus two up-to-200px selects; smaller screens stack them.
Alphabet targets stay 44px with 8px gaps and wrap. Verified at desktop 1280/1440px
and mobile 390px with no horizontal overflow. Keep this explicit containment and
sizing when editing controls. Fresh 25 component checks, 142 module checks and
platform TypeScript pass. Layout change remains local and undeployed.
