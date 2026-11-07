# Selling-price markup agreement

Authoritative design: `docs/superpowers/specs/2026-10-31-selling-price-markup-design.md`.
Execution: `docs/superpowers/plans/2026-10-31-selling-price-markup.md`.

Tenant model `selling_price_markup` uses `sellingPriceMarkupPercentage`, default0,
range0–500. Platform admins manage it through `/tenants/[id]/edit`, Revenue;
`/tenants/[id]` shows the agreement. Default0 is inert until configured. Existing
markup and commission fields/semantics remain separate.

SubProduct (sizeless) or its Size owns nullable `sellingPriceMarkupOverridePct`.
Price review125,000 on retail100,000 stores25%; changing retail120,000 yields
150,000. Overrides retain percentages across default changes; null inherits live
Tenant default. Zero is explicit. No marketplace amount is frozen on the listing.
Existing effective percentage inversion has four decimal places and is checked
against the requested clean-hundred NGN price before persistence.

Payout is current retail, not supplier cost or wholesale. No commission, second
markup, undercut or automatic pack discount. Catalogue/listing discounts and
basket coupons consume platform contribution; approval/checkout reject a final
amount below payout. Existing clean-NGN100 rounding remains. No new fee policy.

Use tenant default is a review draft, committed only by approval. Generic Size
writes cannot set/clear these platform fields; the protected review API handles
owned listing/Size records. Tenant callers cannot edit overrides via review.
Mongoose documents must be converted with toObject before reset copies; spreading
a document drops schema properties. Preserve explicit percentages on cost/retail
updates; never snapshot an effective old cost markup for the new model.

New order model/rate/shares are fixed at checkout. Existing merchant fulfilment,
payout/accounting and refund allocation use those stored shares. No historical
order migration/repricing; existing refund-review constraints remain. Tenant
storefront/POS merchandise prices stay retail. No real orders or payments created.

Relevant checks and limitations are recorded in RESUME-selling-price-markup.md.

Direct channels: native POS, manual tenant Sales, and tenant website checkout under
this model allocate actual direct merchandise to the tenant with zero marketplace
surcharge. They must not fall through to the old cost-markup allocation. Existing
markup/commission channel behavior is retained. Marketplace child fulfilment uses
original stored allocations. Helpers: services/posRevenue.js and Sales row builder.

Storefront consumer audit: shop/search/detail requests use current server prices;
category pages force dynamic rendering. The installed platform Next16.4.2 guide
(`caching-without-cache-components.md`) documents force-dynamic as no-store for
all fetches in the segment. Main product service does not use the legacy
search.service response cache (its imported searchProductsNew is unused).
No platform client-side pricing calculation or new platform UI field is needed.

Final verification2026-10-31: backend4764 passed/18skipped/0failed; admin3427
passed,0failed. Final focused backend60/admin49 pass; TypeScript and scoped
lint/syntax/whitespace pass. Temporary test MongoDB stopped cleanly. No production
build/authenticated browser/deployment check. Exact environment/skip limits are
in RESUME-selling-price-markup.md. Work remains uncommitted.
