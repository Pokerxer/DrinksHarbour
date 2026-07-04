# Shop Hero — Dynamic Filter Reaction (Piece 1)

**Date:** 2026-07-04
**Status:** Approved design, pending implementation plan
**Scope owner:** `/shop` hero banner

## Goal

Make the `/shop` hero banner (`ShopHeroBanner`) robustly reflect the **active applied
filter state** — category, subcategory, and brand — regardless of whether that state
was set via a URL link or the sidebar filter panel, and regardless of whether one or
multiple values are selected.

This is **Piece 1** of a larger effort. A follow-up piece ("real admin-managed images
over CSS gradients") is explicitly out of scope here.

## Background / Current State

- `ShopHeroBanner.tsx` renders a themed hero (gradient, copy, subcategory chip rail)
  keyed off URL params `?category=`, `?subcategory=`, `?brand=`. Themes come from a
  hardcoded `CONFIGS` map plus `SUBCAT_PARENT` / `SUBCAT_LABELS` lookups. No server data.
- The sidebar filter (`components/Shop/index.tsx` → `updateFilter`) **already writes**
  the applied category/subcategory/brand to the URL via `router.replace`. A sync effect
  reads `searchParams` back into filter state. So for a **single** selection the hero
  already reacts to the filter panel.
- Product results are fetched purely from `searchParams` (`buildApiUrl` in `ShopClient`).

## Problems to Fix

### Bug 1 — Multi-select silently drops the theme
Selecting 2+ categories makes the sidebar write `?category=whisky,wine`. The hero does
`CONFIGS["whisky,wine".toLowerCase()]` → `undefined` → falls back to `DEFAULT_CONFIG`
("All Drinks"). Result: the more the user filters, the *less* specific the hero becomes.
Same failure for multi-select subcategory.

### Bug 2 — Chip rail highlights only one subcategory
`activeSub` is a single string. With multiple subcategories applied, at most one chip
shows as active.

### Bug 3 — (Adjacent, OUT OF SCOPE for this piece)
`updateFilter` rebuilds the query string from scratch and only re-adds
category/subcategory/brand/sort/sale, **wiping** any active price / ABV / origin /
flavor / size / rating / search params when a category is toggled. Documented here as a
**separate follow-up**; not implemented in Piece 1.

## Design

The hero resolves a single **primary theme** from whatever filter state is active,
handling single and multi values uniformly.

1. **Parse params as arrays.** Treat `category` / `subcategory` / `brand` as
   comma-separated lists (they already may be comma-joined by the sidebar). Normalize to
   lowercase, trimmed arrays.

2. **Theme resolution (priority order):**
   - If ≥1 category selected → theme to the **first** category (selection order).
   - Else if ≥1 subcategory selected → resolve parent via existing `SUBCAT_PARENT`
     from the first subcategory.
   - Else → `DEFAULT_CONFIG`.
   - Key rule: **when any category/subcategory filter is active, never fall back to the
     flat generic "All Drinks" default.** A themed hero always wins over the default
     while a relevant filter is present.

3. **Headline / subtitle:**
   - Single category or single subcategory → current specific copy (unchanged).
   - Multiple categories → parent theme headline, with a subtitle indicating the count,
     e.g. `"3 categories selected"`.
   - Multiple subcategories under one parent → parent category headline, subtitle
     indicating the count, e.g. `"2 styles selected"`.

4. **Chip rail:** replace the single `activeSub` string with a `Set` of active
   subcategory slugs so **every** applied subcategory chip highlights. Apply the same
   set-membership logic to multi-select categories in the default/category chip rail.

5. **CTA URLs:** the existing "clear subcategory" / "All {category}" reset links must
   continue to work with the array model (clearing removes all subcategory values).

## Scope Boundaries

**In scope (files touched):**
- `client/apps/platform/src/components/Shop/ShopHeroBanner.tsx` — theme/label/chip
  resolution logic (arrays, `Set`-based active state, count subtitles).
- `client/apps/platform/src/app/shop/ShopClient.tsx` — ensure the param(s) passed to
  `ShopHeroBanner` carry the full (possibly comma-joined) value, not a pre-split subset.

**Out of scope:**
- Bug 3 param-wipe fix (separate follow-up).
- Real admin-managed banner images / consuming the server `Banner` model (Piece 2).
- Any server, API, or product-query changes.

## Testing / Verification

Manual browser verification on `/shop`:
- Single category link → correct themed hero + copy.
- Single subcategory link → subcategory copy, parent theme, correct chip active.
- Sidebar multi-select 2 categories → parent-themed hero (first selected), "N categories
  selected" subtitle, both category chips highlighted (no generic fallback).
- Sidebar multi-select 2 subcategories under one parent → parent hero, "N styles
  selected", both chips highlighted.
- Clear filters → returns to `DEFAULT_CONFIG` "All Drinks".
- Brand-only filter → brand override headline unchanged.

## Follow-ups (not this piece)

- **Bug 3:** make `updateFilter` preserve unrelated active params.
- **Piece 2:** render admin-managed `category_top` `Banner` images (with the gradient
  config as fallback), consuming `GET /api/banners/placement/:placement`.
