# Business catalog presentation

`catalog-business.ts` owns the presentation vocabulary. Resolve detail sections
from the central Product.type, never from a tenant's preferred business alone.
Unknown types remain general. Explicit business selection filters the already
server-authorized list; it is presentation, not an authorization boundary.

Single-industry tenants default to their industry. Mixed and platform catalogs
default to All. Switching tenant discards the previous tenant's selection.
Catalog summary totals are explicitly labelled as covering all businesses.

Use recorded product and Size fields only. Missing ingredients/allergens mean
Not recorded, never free from. Product pages combine option data from referenced
listings; tenant detail pages show only that listing's options. Pricing and
operational actions remain in their existing tenant-owned components.

Routes use [slug] to carry IDs. /subproducts and /subproducts/[slug] redirect to
the existing /sub-products routes. No new product copies or backend data changes.

Legacy beverage compatibility: `utils/legacy-beverage-types.ts` mirrors the
server's explicit original Product enum vocabulary. Include these types in
business classification and editor choices; do not infer beverage membership
from a short dropdown. Preserve legacy spellings and validate parity in tests.
Bottle volume, coffee/tea weight, pack count and venue sale unit are independent
stored facts. Never infer pack contents or prices from a display label.

Business ownership (2026-11-04): recognized beverage types now resolve to
`beverage` in `industries.ts`; they are not shared/global choices. The admin
`beverage-industry-types.ts` mirror is checked against server BEVERAGE_TYPES.
Category/subcategory industry membership is persisted in the database; the
existing server industry-scope flag still controls endpoint visibility rollout.

AI drafts: business-generation-panel supports listing (default) and product
modes. Product content may save only central description fields; SEO saves the
existing central meta fields. Product-target generation is platform-admin-only
and requires a saved Product ID. Listing mode retains tenant ownership checks
and listing save routing. No draft auto-saves; provider/model attribution comes
from the server. The old sub-product panel path is a compatibility re-export.

Correction 2026-11-04: central Product pages no longer mount the additional
BusinessGenerationPanel. User intended the existing full-product generator.
The existing edit form/header now receive researched Product.specifications,
using the bounded server registry and parity-tested client mirror. BusinessDetails
renders these saved facts. Listing content/SEO panel behavior is unchanged.
See docs/memory/original-product-generator.md for the complete flow and field list.

Detail pages use the product type to choose the specification and variant
presentation. The central catalog surfaces linked listing options, while the
tenant listing keeps selling actions and inventory on the tenant record.
Both use saved size measurements and pack data. Avoid copying a tenant's
price, stock, or listing description into central product facts.
