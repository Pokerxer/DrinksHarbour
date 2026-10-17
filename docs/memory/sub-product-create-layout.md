---
name: Sub-product create layout
description: Product information and pricing on the left, sizes on the right, with accessible section navigation.
type: memory
---

# Sub-product Product step

`create-edit/product-step.tsx` owns the Product section presentation. Product Info
and Pricing stack in the left column; Sizes occupies the right column. Below
960px of available form width, all three sections stack in reading order.
The Product step allows 1600px total width; other wizard steps retain 1024px.

Use named container queries for inner pricing grids and size rows: viewport
breakpoints alone crowd inputs when the dashboard sidebar and columns narrow
their available space. The Sizes column is slightly wider for variant controls.
Section links are native anchors with focusable named section destinations and
44px touch targets. Do not imply completion from scroll position.

Create, duplicate and edit use this shared Product step. Form state, tenant
ownership, catalog selection, validation and saving stay in existing components.

See `docs/superpowers/specs/RESUME-sub-product-create-layout.md` for verification.

## Conditional pricing

Once a non-empty size is selected, base pricing becomes optional collapsed
defaults. Single-item mode and forms without a selected size show Pricing in full.
Keep the pricing inputs mounted while hidden so edits and registration survive
mode switches. Base pricing errors force these inputs visible.

`src/utils/sub-product-pricing.ts` resolves effective API base prices from explicit
base defaults or the default selected variant, falling back to the first selected
variant if no default exists. Schema validation, save guard, API transformation,
required-field checking and toolbar summary use the same helper. Hidden retained
variants must never supply prices in single-item mode. Resolution does not mutate
the editable base defaults or variant prices.
