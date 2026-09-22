---
name: Sub-Product Detail View Wired
description: Admin sub-products/[slug] now shows real sub-product data (sizes + pricing + stock, tenant/revenue model) instead of the demo storefront card.
type: memory
---

# Sub-Product Detail View Wired

The admin sub-product detail route is now data-wired. See
`docs/superpowers/specs/RESUME-subproduct-detail-view.md` for the full spec.

Key facts for future sessions:
- Route param `[slug]` is the **sub-product `_id`** (same as the edit page).
- Data source: `subproductService.getSubProduct(id, token)` →
  `GET /api/subproducts/:id` → `{ success, data: { subProduct } }` with `product`,
  `tenant`, `sizes`, `vendor` populated (server, no changes needed).
- `shared/ecommerce/sub-product/product-details.tsx` is the container (loading /
  empty / error states); `product-details-summary.tsx` is the new read-only
  summary (per-size pricing + stock chips, SKU/barcode, tenant + revenue model,
  Edit button → `/sub-products/{id}/edit`).
- Reuses shared `ProductDetailsGallery` + `ProductDetailsDescription`
  (+ `ProductSpecTable`, which branches on `isBeverageProductType`).
- Verification: admin `tsc` at 376 baseline, zero errors in these files.