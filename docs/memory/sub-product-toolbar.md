---
name: Sub-product toolbar
description: Responsive record toolbar with guarded navigation and accessible actions.
type: memory
---

# Sub-product toolbar

See `docs/superpowers/specs/RESUME-sub-product-toolbar.md`.

Header components are colocated in sub-product/create-edit: toolbar.tsx,
toolbar-menu.tsx, toolbar-stats.tsx, toolbar-navigation.tsx. Headless UI handles
menu accessibility. Keep touch targets 44px and labels visible on small screens;
statistics scroll separately instead of disappearing.

`toolbar-actions.ts` validates/saves dirty edit records before navigation and
stops on failure. Never auto-create from navigation. Successful archive/delete
sets the saved ref to prevent unmount autosave undoing those actions. Price uses
the current currency. Preserve the explicit one-time duplication intent flow.

## Detail page menu — 2026-09-23
`/sub-products/[slug]` now uses `product-details-toolbar.tsx` with Back, New, Edit, status/publication labels, the shared overflow menu and history strip. `detail-action-dialog.tsx` confirms mutations and blocks repeated requests; failures stay visible for retry. Restore reloads the record; archive/delete invalidate navigation cache and return to the list. Duplicate uses the existing one-shot intent; New clears drafts and pending duplicate intent. Generic page heading and duplicate summary actions are removed only on this route. Verification: 122 tests passed in 17 files; 375 pre-existing type errors with none in the new toolbar/dialog; whitespace check passed. Browser interactions and live mutations not exercised.
