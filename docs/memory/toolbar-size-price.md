# Toolbar Price shows the size price(s) for sized listings (2026-11-08)

One shared rule now drives the admin price displays for the TENANT LISTING
(/sub-products) surfaces: toolbar stats AND the /sub-products list cards
(grid + compact). **If the listing has sizes, the price shown is the size
price(s), never the listing base price.**

Scope note (2026-11-14, user decision): the same rule was briefly extended to
the central /product cards and the /product/[id] tenant-listings table, and
was REVERTED — these changes were mainly meant for /subproducts. Central
/product surfaces are back to their original behavior (admin list carries no
price fields; the details table's "Base price" column quotes
`baseSellingPrice`; the /product/[id] pricing test was removed).

## Shared resolver (`utils/sub-product-pricing.ts`)

`resolveSizePrices(variants, fallback)`:
- effective per-row price = `salePrice` when `isOnSale` (and sale > 0), else
  `basePrice` (form rows) / `sellingPrice` (server sizes);
- drops non-positive prices; multiple distinct prices → min–max via
  `priceMax` (omitted when all agree, or max ≤ min);
- no priced size → `fallback` (listing base price).

`resolveToolbarPrice(product)` (edit form) delegates to it.

## Central surfaces (REVERTED 2026-11-14)

The 2026-11-09 extension to the central /product surfaces (server
`getAdminProductList` price fields, central card price display, the
/product/[id] "Price" column) was rolled back on the user's instruction —
the size-price rule was mainly meant for /subproducts. Removed:
- server: the price `$addFields`/`$set`/`$project` stages in
  `getAdminProductList` (variant counts kept) and
  `__tests__/adminProductListSizePrices.mongo.test.js`;
- client: `ProductListItem` price fields, the central grid/compact card price
  rendering, the /product/[id] listings-table price computation (column is
  "Base price" again), and the added pricing test in
  `central-product-details.test.tsx`.

`utils/sub-product-pricing.ts`'s `resolveSizePrices` stays (it serves the
/sub-products surfaces; its loose `ReadonlyArray<unknown>` input remains
harmless and future-proof).

## Complaint

On the sub-product details toolbar stats ("On hand · Price · Purchased · Sold
· Returns"), the Price always showed the sub-product's base price (screenshot:
₦10,000,000.00) even when the listing sells size variants whose actual prices
are different.

## Rule

**If the sub-product has sizes, the Price stat is the size price(s):**

- one priced size (or all sizes agreeing) → that single size price;
- multiple distinct size prices → a min–max range formatted
  `₦1,500.00 – ₦2,000.00` (en dash; the toolbar chip wraps in an overflow row);
- an active per-size sale shows that size's `salePrice` instead of its
  `sellingPrice`, mirroring the storefront pricing rule;
- sizes exist but none is priced → falls back to the sub-product's
  sale/base price (and only then to `Not set`).

The same rule applies on the **edit page toolbar** (`SubProductToolbar`),
which shares `ToolbarStats`, watching the live form state so the stat follows
unsaved price edits.

## Implementation

- `create-edit/toolbar-stats.tsx` — `ToolbarStatsProps` gains optional
  `priceMax`; `priceLabel()` renders the range only when the max is strictly
  greater than the min (an inverted max never widens the price).
- `sub-product/product-details.tsx` — new `toolbarPrice(viewModel)` maps
  sizes → effective price (`isOnSale && salePrice > 0 ? salePrice :
  sellingPrice`), filters non-positive values and returns `{ price, priceMax? }`;
  falls back to sale/base price when there are no priced sizes.
- `utils/sub-product-pricing.ts` — new `resolveToolbarPrice()` for the form
  side: rows use `salePrice` when `isOnSale`, else `basePrice`; identical
  min/max/range and fallback behavior. Consolidated under
  `resolveSizePrices()` (2026-11-08), which the list CARDS also call:
  - `ProductGridCard.tsx` — previously showed only the FIRST size's price;
    now min–max across all sized prices with base fallback, rendered
    `₦2,500 – ₦5,000` style (en dash, lighter max).
  - `ProductGridCardCompact.tsx` uses the same resolver, with a currency
    symbol on each end of the range. The private `view=list` size projection
    supplies `salePrice` and `isOnSale` to both cards.
  - `resolveToolbarPrice` = thin wrapper over `resolveSizePrices` with the
    form's `basePrice` rows.
- `create-edit/index.tsx` — stats spread `resolveToolbarPrice(watch('subProductData'))`
  so the toolbar tracks unsaved row prices live. “Sell Without Sizes” uses
  the base price even while the form retains hidden size rows.

## Verification

- `toolbar.test.tsx` — 2 new cases: range rendering (₦1,500.00 – ₦200,000.00)
  and single-price rendering for equal/inverted/no-range inputs.
- `variant-pricing.test.ts` — 7 new cases for `resolveSizePrices` (range,
  uniform, per-size sale override, non-sale sale-price ignored, base fallback,
  form-row `basePrice`, empty arrays).
- `ProductGridCard.test.tsx` — new case (both card variants): sizes' prices
  shown instead of the base price; uniform sizes → one figure; unsized → base.
- Suites (after the 2026-11-14 central revert): admin `src/app/shared/ecommerce`
  + `src/utils` — 120 files / 860 tests green; `tsc --noEmit` clean. The
  server pricing and lightweight-catalog suites passed all 8 tests. The
  full server run encountered sandbox errors opening local HTTP ports.

## Notes

- `forms`: a `pack-12` row prices itself via its own `basePrice` — no change
  needed there; the range simply reflects whatever sizes carry.
- Unaffected: `resolveSubProductPricing` (API base-price resolution for
  validation) — separate concern from the display stat. Central /product
  surfaces stay as originally shipped (no admin-list price fields; see the
  scope note above).
