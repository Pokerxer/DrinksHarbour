# Toolbar Price shows the size price(s) for sized listings (2026-11-08)

One shared rule now drives every admin price display — toolbar stats AND the
/sub-products list cards AND the /product central surfaces (extended
2026-11-09): **if the listing/product has sizes, the price shown is the size
price(s), never the listing base price.**

## Shared resolver (`utils/sub-product-pricing.ts`)

`resolveSizePrices(variants, fallback)`:
- effective per-row price = `salePrice` when `isOnSale` (and sale > 0), else
  `basePrice` (form rows) / `sellingPrice` (server sizes);
- drops non-positive prices; multiple distinct prices → min–max via
  `priceMax` (omitted when all agree, or max ≤ min);
- no priced size → `fallback` (listing base price).

`resolveToolbarPrice(product)` (edit form) delegates to it.

## Central surfaces (2026-11-09)

- `getAdminProductList` (server) now computes per-product `price` / `priceMax`
  / `priceCurrency` from one Sizes aggregate over the product's listings
  (positive `sellingPrice`), falling back to the min/max of the listings'
  `baseSellingPrice` when no size is priced — the /product cards had no price
  at all before this.
- `product/product-list/components/ProductGridCard.tsx` — central grid card
  gains a bold price line (`₦2,500 – ₦5,000` style) under brand/type; the
  central compact card shows the price in place of the plain variant count
  (variant count remains on the grid card).
- `product/central-product-listings.tsx` (`/product/[id]` tenant listings
  table) — the "Base price" column is now "Price" and quotes each listing's
  size min–max via `resolveSizePrices`, with `baseSellingPrice` as fallback.
- The server test `__tests__/adminProductListSizePrices.mongo.test.js` pins
  the payload contract (priced sizes win; base fallback; sale-aware rows
  covered by the util tests).

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
  - `ProductGridCardCompact.tsx` — its inline min/max replaced by the same
    resolver (gain: per-size sale prices now honoured if the endpoint sends
    them).
  - `resolveToolbarPrice` = thin wrapper over `resolveSizePrices` with the
    form's `basePrice` rows.
- `create-edit/index.tsx` — stats spread `resolveToolbarPrice(watch('subProductData'))`
  so the toolbar tracks unsaved row prices live.

## Verification

- `toolbar.test.tsx` — 2 new cases: range rendering (₦1,500.00 – ₦200,000.00)
  and single-price rendering for equal/inverted/no-range inputs.
- `variant-pricing.test.ts` — 7 new cases for `resolveSizePrices` (range,
  uniform, per-size sale override, non-sale sale-price ignored, base fallback,
  form-row `basePrice`, empty arrays).
- `ProductGridCard.test.tsx` — new case (both card variants): sizes' prices
  shown instead of the base price; uniform sizes → one figure; unsized → base.
- `central-product-details.test.tsx` — new case: the /product/[id] listings
  table quotes `₦2,500.00 – ₦5,000.00` for a sized listing and the base price
  for a sizeless one.
- Server: `__tests__/adminProductListSizePrices.mongo.test.js` — priced sizes
  define `price`/`priceMax` on the admin list payload; sizeless listings fall
  back to base; a priced size beats a high base.
- Suites: server mongo tests green; admin `src/utils` + `src/app/shared/ecommerce`
  — 730 tests green; `tsc --noEmit` clean for touched files.

## Notes

- `forms`: a `pack-12` row prices itself via its own `basePrice` — no change
  needed there; the range simply reflects whatever sizes carry.
- Unaffected: `resolveSubProductPricing` (API base-price resolution for
  validation) — separate concern from the display stat. The /product list
  price is ADMIN OWNER data (all listing statuses), unlike the storefront's
  eligible-listing-only range.
