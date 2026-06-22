# Sales Create Page — Odoo-Style Layout Restructure

> Scoped sub-project of a larger "make `/sales/create` look like Odoo's quotation
> editor" request. That request spans ~9 independent subsystems (see
> "Deferred subsystems" below); this spec covers only the first — the visual/
> layout restructure of the existing create page. Each deferred subsystem gets
> its own future spec → plan → build cycle.

## Goal

Restyle `client/apps/isomorphic/src/app/shared/sales/sales-create.tsx` to match
the visual structure of Odoo's Sales quotation editor (tabbed status header,
two-column field layout, tabbed Order Lines / Other Info content, restyled
line-items table, bottom totals row) — using **only fields and actions that
already exist**. No new backend, no new models, no new endpoints.

Reference screenshot: `docs/superpowers/specs/assets/2026-06-22-sales-create-odoo-reference.png`
(Odoo's quotation editor — used for visual structure/spacing/placement
reference only; see "In scope" below for exactly which elements transfer).

## In scope

1. **Status pill row** — a non-interactive row under the page breadcrumb:
   **Quotation** (active/highlighted) — **Quotation Sent** (grayed) — **Sales
   Order** (grayed). Purely decorative: this page only ever produces a draft
   quotation or order (the user picks the outcome via button choice, not by
   progressing through stages), so the grayed pills have no click behavior and
   reflect no live state — they exist for visual parity with the screenshot
   only.

2. **Action buttons** — stay in their current top-right position (same row as
   the page title), restyled to match the screenshot's button-row visual
   treatment (spacing, grouping). Only the 2 real actions remain: **Save as
   Quotation**, **Create Order** (+ Cancel). No placeholders for Send / Send
   Pro-Forma Invoice / Print / Confirm / Preview — those belong to deferred
   subsystems or to the (untouched) detail pages.

3. **Two-column field area** — replaces today's single "Customer" card plus
   the separate "Validity & Notes" card:
   - **Left column:** Customer search (`CustomerSearch`, unchanged behavior).
     The pricelist auto-apply note (currently floating green text below the
     search box) becomes a field-row styled consistently with the rest of
     this column, still just informational text — no new interactivity.
   - **Right column:** **Quotation Date** (NEW — read-only display of
     today's date, e.g. `new Date().toLocaleDateString()` computed client-side
     at render time; purely informational, not sent to the backend, since
     `createdAt` is server-set and we don't support backdating) and
     **Expiration** (renamed from "Valid Until" — same date-input behavior,
     same state variable, same payload field `validUntil`, label text only).

4. **Order Lines / Other Info tabs** — a tab strip replacing today's stacked
   cards:
   - **Order Lines** tab (default/active): the existing line-items table.
     Same columns as today — Product, Qty, Unit Price, Discount, Line Total
     — restyled to a cleaner borderless-row look matching the screenshot's
     table treatment (no boxed input cells; right-aligned numeric columns).
     No Unit/Taxes/Disc.% columns (no UoM or tax concept in our model; our
     discount is a flat per-unit amount, not a percentage — keep it as-is).
     The "Add Line" action becomes a text-link (`+ Add a product`) below the
     table instead of today's bordered button above it, matching the
     screenshot's placement — same `addLine()` handler, just relocated and
     restyled. No "Add a section" / "Add a note" / "Catalog" links (deferred
     subsystem #4 — order-line sections/notes + catalog picker).
   - **Other Info** tab: today's Notes and Terms textareas move here
     unchanged (same state, same labels, same payload fields).

5. **Totals** — single **Total** row at the bottom of the Order Lines tab,
   right-aligned, in the screenshot's visual style (no box border needed,
   just typography/spacing). No "Untaxed Amount" row — we have no tax system,
   so a separate untaxed figure would be redundant with (and potentially
   confused for being different from) the Total.

## Explicitly out of scope (deferred subsystems, each its own future cycle)

These appear in the reference screenshot but require new backend work or new
data models and are **not** touched by this spec:

- Invoice Address / Delivery Address fields (new `SalesOrder` fields)
- Payment Terms (configurable terms-of-payment, not our free-text Terms field)
- Order-line sections & notes + "Catalog" grid picker
- Coupon codes
- Rewards (loyalty point redemption against an order)
- Activity / chatter log (comments + activity timeline — no equivalent
  subsystem exists anywhere in this codebase yet)
- Pro-forma invoice (send-by-email action) + Print/PDF
- Taxes (per-line tax column, "Untaxed Amount" distinct from Total)
- Merging `sales-create.tsx` with `sales-quotation-detail.tsx` /
  `sales-order-detail.tsx` into one Odoo-style unified form (explicitly
  rejected for now — the 3-page split stays; only the create page is
  restyled)

## Non-goals confirmed during scoping

- The right-side chatter panel space is **not** reserved in the new layout —
  the form is full-width. If/when the chatter subsystem is built, that's a
  separate follow-up layout change.
- No change to `sales-quotation-detail.tsx` or `sales-order-detail.tsx` in
  this cycle.

## File(s) touched

- `client/apps/isomorphic/src/app/shared/sales/sales-create.tsx` (restructure
  only — same props, same service calls, same validation, same state shape;
  this is a presentation-layer rewrite of the existing component, not new
  logic).

No other files change. `salesOrderService`, `sales-helpers.ts`,
`CustomerSearch`, `ProductLineSearch`, `useSalesCustomerPricelist` all stay
exactly as built in Stage A Task 3 — this spec only touches how
`sales-create.tsx` arranges and styles them.

## Verification

- `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` — no new
  errors beyond the existing 27 `TS2688` baseline.
- Manual browser check: page renders the new layout; customer search,
  pricelist auto-apply, line-item add/edit/remove, qty/discount recompute,
  Save as Quotation, and Create Order all still function identically to
  before (this is a restyle, not a behavior change) — confirm by repeating
  the same manual flow already used for the original Task 3 build.
