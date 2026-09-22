---
name: Product non-beverage detail view & save
description: Admin product detail/wire-up + unblocking save for gift & lifestyle (glassware/gift_set/bar_tool) products.
type: project
---

2026-09-22: The admin **product detail view** (`(hydrogen)/products/[slug]`) was a
disconnected demo (`modernProductsGrid` lookup always fell through to item 0 for
real Mongo-ObjectId route params), and **saving** the ckay gift/lifestyle
products failed because `glassware`/`gift_set`/`bar_tool` were missing from the
client zod `type` enum and both admin `productTypes` dropdowns.

Fixes (all verified):
- zod enum + product/sub-product `form-utils.ts` dropdowns now include
  `glassware`, `bar_tool`, `gift_set` (new "Gifts & Lifestyle" group).
- Server create-route validator (`server/routes/product.routes.js`
  `productValidation`) now accepts them (model + `VALID_TYPES` already did).
- Detail page loads the real product via `productService.getProductById(slug,
  token, includePending=true)` and renders a read-only summary (price via
  subProduct `baseSellingPrice`, size chips humanized from size codes,
  status/type badges), a real image gallery (placeholder when none), and a
  conditional spec table — beverage rows (abv/volume/origin) vs non-beverage
  rows (material / pack count / shelf life). Demo fallback preserved for the
  twin `sub-product/product-details.tsx` page.
- New shared `src/utils/product-types.ts` (`isBeverageProductType` mirroring
  server `NON_BEVERAGE_TYPES`). Edit form hides the **Beverage Info** step for
  non-beverage products (via derived `displaySteps` in
  `create-edit/index.tsx`); `currentStep` is clamped when the step list shrinks.

Server `VALID_TYPES` and `Product` model were already correct; the empty
`category:''`/`brand:''` the form sends for bossed products is normalized to
`null` server-side (`if (category)`, `if (brand)` guards) — no CastError.

Verification: server suite 2881 pass / 0 fail; admin `tsc` no new errors
(376 pre-existing baseline, none in changed files); live `getProductById` for a
ckay `glassware` product returns pending product + subProducts + sizes.
AI generation made type-aware in the same session — see the
"AI generation — type-aware" section of
`../superpowers/specs/RESUME-product-nonbeverage-detail-and-save.md` (persona,
generate-product/description/seo prompts, beverage-only origin fact short-circuit,
client handleFillAll + description/origin section gating).