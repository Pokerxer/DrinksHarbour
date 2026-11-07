<!-- /founder:pricing-strategy · 2026-10-23 · input: DrinksHarbour, a beverage marketplace and tenant ERM platform for the UK -->
# UK pricing proposal

[Likely] Test £49 / £99 / £199 monthly for ERM. Charge marketplace commission only for demand DrinksHarbour generates. Converting Nigerian prices into pounds would ignore UK alternatives and service costs.

Assumption: initial buyers are independent UK bottle shops and wine merchants with one to three locations. Bars, distributors and larger groups need separate validation because their workflows differ.

Assumption: this is a UK scenario, not confirmation of relocation or UK customers. UK willingness to pay, acquisition costs and operating expenses are unverified. Existing Nigerian prices and contracts remain separate.

Assumption: all proposed prices exclude VAT where applicable, hardware, delivery and merchant card-processing charges. Tier entitlements are proposals, not verified UK-ready capabilities.

## 1. Model choice

Fit scores are [Likely] judgments, not research measurements.

| Model | Fit /5 | Advantage | Disadvantage |
|---|---:|---|---|
| Flat subscription | 5 | Predictable bill for daily operations | Heavy accounts need limits |
| Usage-based | 3 | Marketplace fee follows generated sales | Charging own-channel sales penalises growth |
| Per-seat | 2 | Easy to count | Discourages individual staff accounts |
| Freemium | 2 | Low initial friction | Support costs start before revenue |
| Credits | 1 | Can meter costly optional services | Poor fit for routine inventory work |
| One-time purchase | 1 | Upfront cash | Cannot sustainably fund hosting and support |

[Likely] Use a subscription per tenant with location and capacity limits because inventory value persists without marketplace orders. Include staff bundles because named accounts improve accountability. Offer a 14-day trial because merchants need to try their own stock workflow.

## 2. Three proposed tiers

Annual contracts cost ten monthly payments: **16.7% less**, paid upfront. Capacity means active tenant selling SKUs, not ownership of central Products. Do not cap historical records or block export.

| Entitlement | Starter | Growth | Scale |
|---|---|---|---|
| Monthly | £49 | £99 | £199 |
| Annual total | £490 | £990 | £1,990 |
| Annual monthly equivalent | £40.83 | £82.50 | £165.83 |
| Locations | 1 | 1 | 3 |
| Named staff | 3 | 10 | 25 |
| Active selling SKUs | 500 | 2,500 | 10,000 |
| Sales and stock | 1 POS session; barcode stock counts | 3 POS sessions; purchase orders and batch/expiry tracking | 10 POS sessions; transfers across included locations |
| Selling channels | 1 branded subdomain storefront | 1 custom domain; 3 customer price lists | 1 domain; 10 price lists; 1 website API integration |
| Reports | Daily sales, stock and margin; CSV export | Starter plus purchasing and product profitability | Growth plus consolidated location reports |
| Service | Email; target 2 business days | Email; target 1 business day | Priority email; target 4 business hours; 1 onboarding session |

These seven entitlement rows define each package; higher tiers inherit lower-tier capabilities except where limits replace them. Response targets are proposed service commitments, not resolution guarantees.

[Likely] Starter attracts single-shop operators because it combines stock and selling. Growth earns its £50 uplift through purchasing, expiry control and wholesale pricing because these reduce operational work. Scale is sales-assisted because multi-location setup increases migration risk. Additional locations on Scale: £49/month each because each adds support and inventory traffic; more than five locations requires a quote.

Upgrade triggers: Starter exceeds 500 SKUs, three staff or needs purchasing; Growth opens a second location or needs API access; Scale exceeds five locations, 25 staff or 10,000 SKUs and needs scoped pricing. Never force an upgrade by withholding basic stock accuracy.

## 3. Competitive context

[Certain] Official pages checked **23 October 2026**; promotional prices excluded. Hardware, payment fees, billing terms and tax treatment must be compared separately.

| Alternative | Published price and scope | Proposed position and reason |
|---|---|---|
| [Square Retail](https://squareup.com/gb/en/point-of-sale/retail/pricing) | Free £0; Plus £49/month/location, advanced inventory, barcode labels and COGS reports; processing extra | Starter matches Plus. Growth costs more and must prove beverage purchasing/expiry value. |
| [Shopify UK](https://www.shopify.com/uk/pricing) | Annual-billing equivalents: Basic £19, Grow £49, Advanced £259/month; online store; POS Pro adds £69/month/location | Starter exceeds online-only Basic; Growth sits below Grow plus POS Pro (£118), because stock operations are the intended wedge. |
| [Lightspeed Retail UK](https://www.lightspeedhq.com/uk/pos/retail/pricing/) | Displays Basic £75, Core £149, Plus £189/month; retail POS, inventory and one included register; page has billing/payment selectors | Starter/Growth below Basic/Core; Scale exceeds Plus but includes three proposed locations. Obtain comparable written quotes because selector terms and extras affect totals. |

[Likely] A beverage label alone cannot justify a premium. Demonstrate less stock loss or less purchasing/admin time before charging above established alternatives.

## 4. Marketplace charging

[Guessing] Pilot **10% of merchandise value excluding VAT, delivery and refunded items**, only on completed marketplace-generated orders. Apply the same rate across ERM tiers because subscription upgrades should reflect operational value. Own storefront, POS and tenant-sourced orders: **0% platform commission**; payment processing remains payable. Establish attribution and refund rules before billing.

Estimate: a £50 net order yields £5 commission. If the platform bears £1.45 processing on a £60 checkout, £0.75 support, £0.50 risk reserve and £0.50 rewards, contribution is **£1.80 before acquisition and fixed costs**. These are assumptions, not provider quotes. Charging processing to merchants changes this calculation; do not count it twice. Delivery must be separately funded because this contribution cannot support an unpriced delivery subsidy.

Estimate: at a merchant's assumed 25% gross margin, 10% commission consumes 40% of gross profit before other costs. This is why marketplace volume and merchant margin need separate validation.

## 5. Unit economics

[Guessing] Planning estimates per **paying tenant/month**, excluding VAT revenue, assuming approximately 100 tenants sharing infrastructure. No invoices confirm these costs. Software costs below include compute, database and storage allocations.

| Monthly cost | Starter | Growth | Scale |
|---|---:|---:|---:|
| Hosting/database/storage | £6 | £10 | £20 |
| Email/monitoring | £1 | £2 | £4 |
| API/AI allowance | £0.80 | £2 | £5 |
| Support at £25/hour | 0.2h = £5 | 0.4h = £10 | 0.8h = £20 |
| Subscription collection allowance | £1.50 | £3 | £6 |
| **Direct cost, sum above** | **£14.30** | **£27** | **£55** |
| **Monthly gross margin: (price − cost)/price** | **70.8%** | **72.7%** | **72.4%** |
| **Tenants covering £5,000 fixed/month** | **145** | **70** | **35** |

Break-even = ceiling(£5,000 / (monthly price − direct cost)), assuming all customers buy that tier. Fixed overhead is an estimate for development, administration and base marketing, excluding already allocated direct costs; setup expenditure and acquisition surges are additional.

Estimate: 50% Starter / 40% Growth / 10% Scale gives **£84 monthly subscription ARPU**, £23.45 direct cost and £60.55 contribution: **83 tenants** cover £5,000. All-annual billing gives £70 recognised monthly ARPU and, conservatively retaining the same costs, £46.55 contribution: **108 tenants**. Annual tier margins fall to **65.0% / 67.3% / 66.8%**. Commission is excluded because unproven demand should not fund subscription break-even.

## 6. Presentation and rollout

- **Anchor:** show Scale at £199 because three-location operators provide a credible upper reference.
- **Decoy:** none. Highlight Growth only when its purchasing tools fit because an artificial package weakens trust.
- **Annual:** show “£990/year, equivalent to £82.50/month, save £198” because the payment commitment should be explicit.

[Likely] First 90 days: £39 / £79 / £159 monthly for each founding tenant's first three paid months because onboarding is still being refined. Disclose £49 / £99 / £199 from month four upfront. Offer annual billing after the pilot because early annual lock-in hides churn. No lifetime grandfathering; honour signed annual prices until renewal because support costs persist.

Before a new-customer increase to **£59 / £119 / £239**, require at least 20 completed UK trials, 30% paid conversion at list price and 90% three-month paid retention. These are proposed decision gates, not industry benchmarks. If direct-cost margin stays below 65% for three months, diagnose support costs and scope before repricing. Give existing customers 60 days' notice and change annual prices only at renewal.

## 7. UK commercial dependencies

[Certain] [Paystack's supported merchant countries](https://support.paystack.com/en/articles/2130562) omit the UK. Accepting international cards does not establish UK merchant onboarding or GBP settlement. Verify an eligible GBP subscription and marketplace settlement arrangement before collecting UK payments; this proposal makes no payment-provider change.

[Certain] The [UK standard VAT rate](https://www.gov.uk/vat-rates) is 20%. Actual invoice treatment depends on the supplying entity and customer. Confirm that treatment, alcohol-sale responsibilities and age-verification costs before publishing a UK offer; the costs above do not establish readiness.
