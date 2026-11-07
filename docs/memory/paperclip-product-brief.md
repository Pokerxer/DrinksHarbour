# DrinksHarbour platform brief

Build the operating platform for Nigeria's premium beverage industry, starting in Abuja. DrinksHarbour gives subscribing beverage businesses a branded storefront and back-office ERM, and gives shoppers a single marketplace for discovering and buying from eligible businesses.

## Product scope

- Marketplace and storefronts. Give customers a shared catalogue and checkout. Route fulfillment to the eligible business and location. Each subscribing business has its own branded subdomain. The current main platform app and `/platform` route (drinksharbour.com marketplace) is for beverage businesses only: beverage catalogue, beverage taxonomy, and beverage eligibility apply there. The newly added retail business types (Fashion, Electronics, Beauty & Skincare, Home & Living, General Retail) must be accommodated outside that beverage-only surface — do not blend non-beverage listings, taxonomy or eligibility into the beverage marketplace without an explicit board decision.
- ERM SaaS. Give businesses tools for inventory, purchasing, POS, sales, accounting, and staff. Keep subscription entitlements separate from marketplace seller eligibility.
- Revenue expansion. The roadmap covers advertising, Corks & Points loyalty, clubs and lounges, subscriptions and gifting, and later physical and B2B distribution. Sequence each against the readiness gates in the strategy.

## Engineering boundaries

- A Tenant is a subscribing business. A Vendor is an external supplier. The platform owns the central Product catalogue. Tenants own SubProducts, which carry retail pricing, cost, inventory, variants, and availability. New tenant-originated Products require platform approval before marketplace publication.
- Use authenticated tenant context and tenant-scoped data access. Enforce seller eligibility and preserve historical payment, payout, and order snapshots. Verify stock, checkout, fulfillment, and recovery as end-to-end flows.
- Keep the existing Next.js marketplace/storefront and admin apps with the Express API and MongoDB. Wyn City's separate website integrates through the API. Keep country, currency, language, payment, and delivery policies configurable. Nigeria rollout comes before later UK activation, subject to each market's gates.

## Working references

Start with `AGENTS.md` for repository rules and `README.md` for the code map. Use `docs/audits/specification-v3/strategy.md` for product scope and sequencing. Verify current implementation and release status against the relevant resume spec and source before planning or changing behavior. Resolve any conflict between older broad seller-onboarding assumptions and current market policy before changing eligibility. The roadmap records intent and release gates. Production activation, commercial changes, and live migrations need their own authorization.
