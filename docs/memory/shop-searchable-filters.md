---
name: Searchable and scrollable shop filters
description: Platform /shop category, subcategory and brand filter accessibility, 2026-10-31.
type: project
---

The shop drawer uses shared filters/SearchableFilterList for categories,
subcategories and brands. Search is immediate, case-insensitive, whitespace-trimmed
and runs on readable names across the complete supplied option list. No slicing.
Search only changes visible options; pending and applied selections remain intact.
Native labelled checkboxes, clear-search buttons, match totals, empty states and
scroll hints support keyboard/touch use. Existing Apply/Clear behavior is retained.

Each list has a bounded 16rem scrolling region, stable scrollbar gutter and touch
pan support. The shared FilterSection no longer clips open content at screen height;
collapsed content is hidden from keyboard navigation. Drawer uses dynamic viewport
height, min-h-0 scrolling content and nonshrinking header/footer. Source components
are small; unrelated filter types retain their previous controls.

The shop already requests catalogue-wide facet options; the backend applies no
brand/category facet limit. No API/schema/filter URL changes were needed. Do not
reintroduce first-page-only lists or a viewport max-height on expanded sections.

Checks: 5 DOM/component integration tests, 130 existing platform module regressions
and TypeScript pass. Desktop browser fixture confirms all three lists scroll to
the last item and Apply stays visible. Smaller viewport confirms no horizontal
overflow and independently scrolling lists. The real local shop could not load
products from its configured backend, so browser layout was verified with the
actual drawer and explicit test fixture options in a temporary local-only route.
The temporary route/server and generated config additions are removed afterward.
No deployment, commit or push. Handoff: docs/superpowers/specs/RESUME-shop-searchable-filters.md.

Commit-review follow-up: user authorized committing completed work. The isolated
checkout passes the five shop tests without other pending platform changes.
The commit includes explicit test dependencies already resolved in the baseline
workspace lockfile; no unrelated dependency updates are included.

Reviewed commit follow-up (2 November 2026): five isolated shop interaction checks
pass. Required test packages reuse already-locked workspace resolutions. Type
diagnostics for this feature match the original committed baseline. No deployment.
