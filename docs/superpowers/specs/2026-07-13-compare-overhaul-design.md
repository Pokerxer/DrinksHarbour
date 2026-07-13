# Compare Feature Overhaul — Design

**Date:** 2026-07-13
**Area:** `client/apps/platform/src/app/compare/`, `context/CompareContext.tsx`, `components/Modal/ModalCompare.tsx`

## Goal

Full redesign of the product comparison experience with smarter logic: fix layout
bugs, make it responsive, highlight meaningful differences, refresh stale data, and
allow adding to cart directly from the comparison view.

## Problems in current implementation

1. **Hardcoded 4-column grid** (`grid-cols-[200px_repeat(4,1fr)]`) — renders empty
   ghost columns when fewer than 4 products are being compared.
2. **Broken remove button** — `absolute top-4 right-4` on a non-`relative` parent, so
   it anchors to the wrong ancestor.
3. **No mobile responsiveness** — a 5-column grid is unusable on phones.
4. **No differentiation** — every cell looks identical; the compare view fails at its
   one job of surfacing differences.
5. **Stale snapshots** — prices/stock are frozen at add-time in localStorage.
6. `View Details` link instead of real add-to-cart.
7. Currency symbol read from `localStorage` on every render.

## Design

### 1. Context layer (`CompareContext.tsx`)
- Keep reducer, dedup, max-4, localStorage persistence.
- Add `toggleCompare(item)` convenience.
- Add `refreshCompareData()` + `isRefreshing` flag: on mount, re-fetch each stored
  item via `GET /api/products/slug/{slug}` (≤4 parallel requests). Merge fresh
  `price`, `originPrice`, `availability`, `availableAt`, `rating` onto the stored
  snapshot; silently keep the snapshot on any failure. Response shape:
  `data.data.product` (fallback `data.data`).

### 2. Compare page (`compare/page.tsx`) — desktop
- **Dynamic grid:** template string built from real count:
  `200px repeat(${count}, minmax(0,1fr))`. No ghost columns.
- **Fixed remove button:** column wrapper gets `relative`.
- **Best-value highlighting:** `useMemo` computes, per comparable numeric row, which
  product wins (Price → lowest, Rating → highest). Winning cell gets a green ring +
  a small chip ("Best price" / "Top rated"). Ties → no highlight.
- **"Show differences only" toggle:** hides rows whose formatted values are identical
  across all products.
- **Real add-to-cart per column:** replicate `Product/Card` pattern — resolve first
  in-stock size + vendor from `availableAt`, call `addToCart(...)`, `openModalCart()`,
  and show an inline "Added ✓" state for ~1.5s. Disabled + "Out of stock" when no
  stock.
- Trim framer-motion to opacity/transform only (no layout-thrashing per-row x-anims).

### 3. Compare page — mobile (`< md`)
- **Stacked per-product cards.** Each product = a full-width card: image + name +
  price header, then an attribute list (label / value rows), best-value chips inline,
  and its own add-to-cart button. The "differences only" toggle applies here too.

### 4. Robustness
- Read currency symbol once into state.
- Guard image URL access (string vs `{url}`).
- Normalize `rating` vs `rate`; derive stock from `availability.inStock` /
  `availableAt` sizes / `quantity`.

## Non-goals (YAGNI)
- Share-compare-via-URL, compare history, more than 4 items, cross-category warnings.

## Testing
- Manual/browser: 1/2/3/4 items render correct column counts; remove/clear; toggle;
  add-to-cart opens cart modal; mobile stacked view; refresh corrects a changed price.
