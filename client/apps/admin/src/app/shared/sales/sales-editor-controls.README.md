# Sales document structure and amounts

The user approved clearer section/note/description controls, explicit discount
types, tax/shipping controls and consistent previews/saved/printed money.

## Boundaries

- sales-line-table: sortable composition and section subtotals, with a contained
  horizontal table on narrow screens. Types live in sales-line-types; the table
  re-exports them for existing callers. Sortable attributes belong on move handles,
  not on semantic table rows. Pointer and keyboard sorting use existing dnd-kit.
- sales-line-product-row / selected-sales-product / sales-line-inputs: product
  selection, multiline description, quantity/price, discount type and tax fields.
  Product takes remaining table space; Packs is compact at 96px, returning 48px
  to Product. Quantity, pack size, unit price and untaxed total retain their
  wider columns; numeric inputs fill their cells. Discount uses the earlier
  inline number field and adjacent ₦/% toggle, with an accessible label and
  money-preserving conversion. Percentage savings appear below the field.
  The line wrapper is a size-query container. Below 1200px of available editor
  width, the same editable rows become two-column labelled cards (no duplicate
  controls/state). Product and total span the card; section/note rows stay full
  width. Wider editors keep the fixed-column table and compact Packs allocation.
  Responsive rules live in sales-line-responsive.module.css. Shared read-only,
  sorting, pricing and reservation behavior remains in the existing components.
- section/note rows: autofocus new text, labelled delete actions, no priced cells.
  Removing a heading keeps its products. New headings/notes precede an unfinished
  trailing product without losing its draft. Standalone notes print in position.
- sales-totals: composition; actions, adjustment panels and summary are separate.
  Global discount explicitly replaces product-line discounts;0 clears them.
  Shipping is a flat charge with Apply/Remove. Coupons await saved current lines;
  errors propagate to the open panel, with retry input retained.
- packages/sales-money: shared pure money contract with TypeScript declarations.
  No copy of line discount/tax math should be reintroduced in editor/server paths.

## Monetary contract

Fixed discount means off the whole product line. Percentage scales with gross.
Switching type preserves resolved money, including decimal percentage precision.
Tax applies after line discounts and promotions; explicit0 remains tax-free.
Line amounts, tax and footer adjustments preserve kobo. Shipping is added after
existing coupon/spend adjustments, without new tax or inclusive-price policies.

Stored lineTotal remains post-line-discount/pre-promotion for compatibility.
Displayed line/section untaxed totals subtract the stored promotion once; footer
shows gross, line discounts, promotions, untaxed amount, tax, coupon/spend and
shipping. Printed totals start with gross, avoiding a second apparent deduction.
Read-only documents use stored amounts; new math does not migrate their snapshots.

Draft price preview asks the same tenant pricing/promotion engines as saving.
Discount/tax/manual-price changes invalidate preview; stale responses cannot
replace the current document. Manual prices remain manual while promotion
metadata updates. Description/text edits do not trigger pricing requests.
Rewards are planned for explicit payment; stock Confirm never collects money.

Verification/resume: docs/superpowers/specs/RESUME-sales-editor-line-controls.md.

## Catalogue pricing

Normal catalogue pages request authoritative server quotes for the explicit
selected pricelist and current variant quantities. The server uses the same
computeLinePricing as Sales: platform base, wholesale formula, pack bundles and
rounding. Preserve salesPricing through the compact mapping and do not run POS
client rules on top. Added selections carry enginePriced=true, retaining their
quote until document preview/save; they are never marked manual overrides.

List/quantity changes invalidate the page's quote cache. Keep same-page cards
mounted. Quantity-only edits stay interactive and refresh quotes after 250ms of
inactivity, with superseded timers/requests cancelled. Quantity1 reuses the
existing default quote. Scope/list/page/filter and explicit stock refreshes
block until fresh data arrives. Display Updating prices during quantity refreshes;
ignore superseded responses. Missing
server pricing is an explicit retry error. Browsing quotes products independently,
so an unselected visible product cannot activate a cross-product cart offer.
Manual prices and cart-wide promotion policies remain with the order.
See docs/superpowers/specs/RESUME-catalogue-pricelist.md for parity evidence.

## Warehouse IDs

Saved orders may populate warehouseId as an object. The sales form exposes its
normalized string ID to every consumer (picker, catalogue, scanner, autosave and
warehouse selector). A TypeScript cast cannot convert a populated reference;
never pass raw warehouse state into query parameters. Clearing stays an empty
string in the form and null in the saved payload.
