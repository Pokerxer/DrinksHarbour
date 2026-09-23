# Warehouses responsiveness — 2026-09-19

The Warehouses section is fully responsive on the page level (grids collapse,
no horizontal overflow at 360–1440px). On mobile the nav header uses a
**Menu button + dropdown** instead of any inline strip: below `md`, the tab
strip is `hidden md:flex` and a hamburger `PiList` button (labelled with the
active section) toggles `mobile-nav-menu.tsx`, a full-width panel with direct
links plus collapsible groups (Catalog, Purchases, Configuration). Nav is a
single **47px row** at 360→640px; the full tab strip returns at `md+`.

- `shared/warehouses/mobile-nav-menu.tsx` — the dropdown; closes on Escape,
  route change, and outside click. Outside-click is handled by the **host
  header's** `navRef` (not the panel) so the toggle button never fights its
  own panel. Active + sub-active links get `aria-current="page"`.
- `shared/warehouses/warehouses-nav-header.tsx` — owns the Menu button and
  desktop tab strip.
- `shared/nav-dropdown-panel.tsx` — viewport clamp (`min(…px, 100vw-1.5rem)`
  + `useLayoutEffect` right-edge shift) so desktop/module dropdowns never
  spill; applies to purchases/POS consumers too.

Verification was browser-based (Playwright at 360/480/640/768/1024/1280 over
`/warehouses`, `/warehouses/analysis`, `/warehouses/[id]`,
`/warehouses/product/[id]`). Full write-up:
`docs/superpowers/specs/RESUME-warehouses-responsiveness.md`.

Test login used for the audit: `heroogene@gmail.com` / `TestPass123!`
(dev-only temporary password set for browser testing — revert if noticed).
Never `npx tsc` in this repo (resolves bogus `tsc@2.0.4`); use
`./node_modules/.bin/tsc --noEmit`. If sign-in stops working against the dev
server, the `.next` cache may have gone stale (missing `app/signin`
chunk) — `rm -rf .next` and restart `next dev`.