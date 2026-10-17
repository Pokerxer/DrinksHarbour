---
name: Sub-product summary widget behavior
description: Widget counts, filters and catalog loading share a consistent tenant-scoped result universe.
type: memory
---

`sub-product-list/widget-summary.ts` derives widget counts from the list's current
search, chips, visibility and advanced/quick/custom filters, excluding only the
widget status filter. The status is then applied by the existing filter pipeline.
Thus clicking a widget produces its advertised count; clicking it again clears
only that status. Pagination resets remain in the table.

`components/StatsHeader.tsx` (re-exported from states) exposes pressed states,
keyboard-operable buttons, refresh feedback and disabled unavailable metrics with
a retry action. Header/visibility counts retain full-catalog scope.

Low-stock predicates use the SubProduct's `lowStockThreshold ?? 10`, including a
valid explicit zero. Widgets, stock facets, quick filters and grouping share the
same predicate. Thirty-day counts use the same scope and exclude future dates.

`hooks/sub-product-catalog.ts` reads every authorized server page (5000 per page)
before publishing client-side results, validates JSON shapes and removes duplicate
IDs across pages. Failed later pages do not expose a partial catalog. The hook
clears old data on token changes and rejects late responses from older requests.
Manual refresh bypasses caches for every page. No tenant ID is supplied by client.

See `docs/superpowers/specs/RESUME-sub-product-widgets.md` for verification.

Verified October 11, 2026: 45 focused checks passed; real catalog reader accepted
1,639 tenant products. Full admin suite: 2,705 passed / one unrelated inventory
sorting timeout, whose entire file passed separately. Type checking has 359
remaining existing diagnostics, no new reader/widget diagnostics. Live browser
interaction could not be verified because the browser tool cannot start.

List performance follow-up: complete catalogue reads now request `view=list` and
omit server summary queries. Widget calculations remain unchanged and complete;
see sub-product-list-design-speed.md. The rendered page default is now 50.
