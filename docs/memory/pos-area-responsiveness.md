---
name: pos-area-responsiveness
description: Layout rules for making the /point-of-sale area responsive — table scroll wrappers, master-detail overlay pattern, viewport-driven stat grids.
type: convention
---

# POS area responsiveness — 2026-09-29

The POS pages render inside the Hydrogen shell, so a fixed `h-dvh` page frame
is *not* overlay-broken (the shell header scrolls, it is not `fixed`). Leave the
height model alone. What breaks narrow windows is **width**: fixed side panels
and tables with no scroll floor.

## The three recurring defects, and the fix for each

**1. A data table with no scroll floor.** `w-full` alone means columns crush
until the text wraps into unreadable ribbons. Every table gets:

```
<div className="overflow-x-auto">
  <table className="w-full min-w-[…px] …">
```

`min-w` is tuned to the real column count (orders list 1060, sessions 860/900,
sales-details lines 1360 / grouped 820, history 900, sell-orders 880,
session-report 560/420/640). A table with no `min-w` inside an
`overflow-x-auto` is a bug — the wrapper alone does nothing.

> **Do not nest the x-scroller inside the y-scroller.** `overflow-x-auto` sets
> only one axis, and CSS resolves the other (`visible`) to `auto` — so the inner
> div silently becomes a *second* scroll container and a `sticky` `<thead>` in it
> stops sticking, because the element that actually scrolls vertically is the
> outer one. This bit the orders list when the `overflow-x-auto` wrapper was
> added. One element must be both scrollers: `<div className="flex-1 overflow-auto">`
> around the table, with `sticky top-0` on the `thead`. Only use a nested
> `overflow-x-auto` for tables whose header is *not* sticky.

**2. A master–detail split that squeezes instead of stacking.** Orders and
sessions both put a list beside a detail panel. The detail becomes an overlay
below `lg` and returns to the in-row split above it:

```
// row
<div className="relative flex flex-1 overflow-hidden">
// list (orders) — full width on small
`${selected ? 'w-full lg:w-[56%]' : 'flex-1'}`
// detail (orders)
`${selected
  ? 'absolute inset-y-0 right-0 z-20 w-full shadow-2xl sm:w-[440px] lg:static lg:z-auto lg:w-auto lg:flex-1 lg:shadow-none'
  : 'hidden w-72 shrink-0 md:flex md:flex-col'}`   // empty-state prompt yields its 288px
```

The pattern needs `relative` on the row. `pos-sell-orders` was already correct —
`hidden xl:flex` side panel plus a `fixed inset-0 xl:hidden` mobile overlay. Use
that as the reference implementation.

**3. A stat strip with a fixed inline column count.** The sales-details strip
used `style={{ gridTemplateColumns: repeat(colCount, minmax(0,1fr)) }}`, which
can never wrap — six cards each collapsed to a sliver. Card count there is
dynamic (Returns/Voided cards appear conditionally), so the columns are
**viewport-driven, not count-driven**:

```
grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6
```

Anything with `colCount` or an inline `gridTemplateColumns` is suspect.

## Other fixes worth repeating

- **A fixed-width side panel in a two-pane frame never yields.** The session
  report's `flex … overflow-hidden` frame held a `w-[260px]` session list beside
  the report, so a 390px phone got ~130px of report. Either stack the frame
  (`flex-col lg:flex-row`, panel `max-h-[45vh] w-full lg:max-h-none lg:w-[300px]`,
  header `shrink-0`) or — where a `pos-sell-orders`-style overlay is already the
  pattern — make the detail a sheet. A `style={{ height: calc(100vh - 49px) }}`
  frame works fine in `flex-col`; only the axis changed.
- **`flex-1` does not shrink a native `date` input.** Its intrinsic min width
  wins, so a pair of them overflowed the 260px panel *before any of the above*.
  `flex-1` needs a matching `min-w-0` on the input (and the row).
- **An absolutely-positioned panel with a hard `minWidth` overflows.** The
  orders "Group By" popover was `absolute right-0` with `style={{ minWidth:
  460 }}` — 460px inside a 390px window. It needs the `shared/nav-dropdown-panel`
  treatment verbatim: `max-w-[calc(100vw-1.5rem)]`,
  `minWidth: min(460px, calc(100vw - 1.5rem))`, and a `useLayoutEffect` that
  nudges `marginLeft` left by exactly the spill. Stack its columns too
  (`flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0`).
- **Fixed-width native inputs set a large min-content floor.** The orders date
  range was two `w-[116px]` dates + two `w-[72px]` times ≈ 500px. Native
  `date`/`time` inputs need `w-full min-w-[…]` *and* `min-w-0` on every
  ancestor between them and the wrapping row, or they refuse to shrink.
- **A sheet that overlays content needs a scrim and Escape.** Below `lg` the
  orders receipt floats over the table: add a `lg:hidden` `absolute inset-0 z-10`
  scrim that closes on click, and a `keydown` Escape listener, otherwise the
  rows underneath still look clickable and there is no obvious way back out.
- **Long single-value fields need a wrap floor in a narrow panel.** A split
  receipt renders every tender leg into one value ("Cash ₦2,000.00 + Card
  ₦8,000.00"); in a 440px sheet that pushed the metadata row past the edge.
  `min-w-0 break-words text-right` on the value, `shrink-0` on the label.
- **Keep horizontal tab strips scrollable rather than letting them crush.**
  `flex items-center overflow-x-auto` on the strip plus `shrink-0
  whitespace-nowrap` on each tab, with tighter `px-3 sm:px-4`.
- **A chip/badge strip wraps.** The session-report orders tab carried up to four
  status chips in one `flex items-center gap-3` row; it needs `flex-wrap` and
  `px-3 sm:px-5`.

- **The sell screen's cart was `w-[480px] shrink-0`**, leaving the product grid
  unusably thin on a tablet. It now scales: `w-[min(480px,45vw)] xl:w-[540px]`,
  and the grid column needs `min-w-0` or it cannot shrink below its content.
  The product grid's own cards were already responsive
  (`grid-cols-2 sm:3 xl:4 2xl:5`).
- **Fixed-height single rows crush.** `flex h-14 items-center` control bars
  become `flex flex-wrap … py-2 md:h-14 md:flex-nowrap md:py-0`, and a centred
  status-tab group takes its own full-width row below `md`.
- Compact 2–3 cell stat rows (Total/Items/Returned) and the 7-day strip are
  *fine* at `grid-cols-3` / `grid-cols-7` — leave them.
- Panels that are already `sm:`/`lg:` responsive: `pos-order-analysis` grids,
  `pos-dashboard` rows at `lg:grid-cols-4`, `pos-nav-header` (brand label hides
  below 480px, nav links wrap). Do not re-churn these.

## Verifying

`scripts/pos-responsive-audit.js` (repo root) logs in, then for each POS route at
390/768/1024/1440px measures `documentElement.scrollWidth > clientWidth` and
reports the **widest offending element** so a failure is actionable rather than
a bare number. It aborts if the session is not authenticated, so a stale login
cannot silently "pass" by measuring the signin page.

```bash
npm install --no-save playwright && npx playwright install chromium --only-shell
node scripts/pos-responsive-audit.js
```

Browser verification is still unrun — the `heroogene@gmail.com / TestPass123!`
login in `warehouses-responsiveness.md` now returns **401**. See
`docs/superpowers/specs/RESUME-pos-area-responsiveness.md`.

## Orders follow-up: measured corrections

The prior advice to leave `h-dvh` everywhere does **not** apply to orders on
phones: stacked filters and summary cards can consume the entire list height.
Orders now uses natural document height below `lg`, a 28rem minimum body, and a
70dvh maximum table scroller. Desktop retains the viewport-height layout.

`components/orders-date-range.tsx` replaces the clipped native date/time inputs.
Keep full From/To rows stacked below `sm`; each input has its own labelled,
shrinkable grid cell. Merely shrinking the surrounding flex row clips controls.
The grouping popover measures both viewport edges and translates itself back
inside the viewport on resize; margin-left on a right-anchored panel was wrong.

Validation: `node scripts/pos-orders-layout-audit.cjs` renders the real page with
synthetic orders and stubbed auth/navigation. It checks 320, 390, 640, 768, 1024,
and 1440px with detail closed/open: no page overflow, no undersized date inputs,
and at least 180px table height. This is isolated layout validation, not a live
login, interaction, or full application-shell test.
