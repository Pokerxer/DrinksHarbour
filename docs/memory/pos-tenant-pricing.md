# POS tenant pricing boundary

The POS sells tenant-owned SubProducts. `computePOSPricing` uses the selected
Size's selling/cost prices, falling back to SubProduct base/cost prices. The
pre-pricelist base remains preferred to avoid applying a pricelist twice.

Do not apply platform markup/discount, website regular sales or website flash
sales here. POS checkout must not decrement website flash-sale allowances.
POS pricelists, bundles, cashier discounts and issued quotation prices remain
handled by their existing checkout paths. Sales Orders preserve their existing
website pricing base in `server/services/salesBasePricing.js`; do not reconnect
them to the POS pricing helper.

Regression tests: `posTenantPricing.test.js`, `posProductCatalogueLimit.test.js`,
`posLinkedSalesOrderPricing.test.js`, `salesPricing.service.test.js` in server tests.

2026-09-09 commit verification: all 22 tests across these four files passed.
Local commit requested; no push or deployment authorized.
