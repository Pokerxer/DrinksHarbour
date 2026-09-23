# Inventory header + transfers responsiveness — 2026-09-19

The Inventory section header now uses the same **Menu button + dropdown** as
Warehouses. Below `md`, the wrapping tab strip is replaced by a single button
(hamburger `PiList` + active-section label) that toggles `MobileNavMenu`
targeting `inventory-mobile-menu`. Nav is a single **47px row** on mobile; the
full tab strip returns at `md+`.

`shared/warehouses/mobile-nav-menu.tsx` was generalized so both headers use
it: it now accepts direct links, flat `items[]` groups, AND `sections`
groups (the Inventory Configuration menu uses `NavSection[]` with headings),
and takes an `id` prop. Keep passing a unique `id` and a flat-typed nav array
when wiring up new module headers.

The Inventory pages were already responsive except `/inventory/transfers`
(`shared/purchases/stock-transfers-list.tsx`): its 9 status tabs (~777px)
overflowed the 360px viewport. The tabs container is now `overflow-x-auto`,
both tables `overflow-x-auto` (scroll instead of clip), and the
Search/"New Transfer" toolbar wraps with a `w-36 sm:w-48` search input.
Also fixed a latent `res.data._id` unknown-access in the same file.

Browser sweep of 14 inventory routes at 360/640/768/1280: no horizontal
overflow, menu toggle + section expansion verified. Full write-up:
`docs/superpowers/specs/RESUME-inventory-header-responsiveness.md`.

Test login: `heroogene@gmail.com` / `TestPass123!` (dev-only temp password).
Never `npx tsc` (resolves bogus `tsc@2.0.4`); use `./node_modules/.bin/tsc
--noEmit`. If sign-in regresses to native GET submit, the `.next` cache is
stale — `rm -rf .next` and restart `next dev`.

---

# Inventory stock browser responsiveness — 2026-09-19

`shared/inventory/inventory-stock-browser.tsx` is a fixed-height app panel
(`h-[calc(100dvh-47px)]`) that squeezed itself off the screen at 360px:
the control bar (title + 6 status tabs + 7 actions) was one rigid 674px row
inside an `overflow-hidden` parent (Import/Export clipped, unreachable) and
the idle detail panel (`w-72` = 288px) sat next to the list, crushing it to
72px. Fixes:

1. **Control bar** → `flex flex-wrap`; title `basis-full` on mobile, tabs
   `min-w-0 flex-1 overflow-x-auto sm:flex-none`, actions `w-full sm:ml-auto
   sm:w-auto`. All buttons reachable at every width.
2. **KPI strip** → `grid-cols-5`… became mobile-flex: `flex shrink-0
   items-stretch gap-px overflow-x-auto sm:grid sm:grid-cols-3 lg:grid-cols-5`,
   cells `bg-white min-w-[168px] shrink-0 sm:min-w-0`, hairline `gap-px`
   dividers on a `bg-gray-100` container. One swipeable row of 5 on phones.
3. **Body** → `flex flex-1 flex-col lg:flex-row`: list + detail stack
   vertically on phones. Detail panel idle state is `hidden lg:flex`
   (no more 288px thief on mobile); list gets `border-b lg:border-b-0
   lg:border-r`, and the 58/42 selected-split only applies at `lg`.
4. **List table** (11 cols, 1001px) is horizontally scrollable on mobile —
   the `overflow-y-auto` wrapper provides x-scroll.

Verified at 360/480/640/768/1024/1280: zero overflow, all controls visible,
KPI 2/3/5 columns responsive, table scrollable. `tsc`/`next lint` clean on
the file. Full write-up:
`docs/superpowers/specs/RESUME-inventory-stock-responsiveness.md`.

General rule for `(hydrogen)/inventory/*` pages: any page with a
non-wrapping header row or a fixed-width side panel has the same squeeze —
apply `flex-wrap` + `hidden lg:` on idle side panels. The `w-[58%]`/`flex-1`
selected-split is `lg:`-scoped now.