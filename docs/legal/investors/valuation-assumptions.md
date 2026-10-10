---
title: DrinksHarbour valuation and operating assumptions
as_of: 2026-10-07
status: provisional analysis, not an agreed valuation
---

# Facts and assumptions

Current commercial direction: the user subsequently requested NGN60m pre-money for the Nigerian document package. This is the proposed negotiating basis, not a fresh analytical appraisal. The35m/range discussion below is historical analysis; use nigerian-company-valuation.md and RESUME-nigerian-60m-documents.md for current documents.

This is the source of truth for `valuation-and-profitability.md` and the scenario calculation. All amounts are NGN. Forecasts are hypothetical monthly operating states, not sales commitments or dated predictions.

## User-confirmed facts

- Two paying tenants: one Enterprise and one Growth.
- No online sales yet.
- The company owns the code. Title documents and third-party licences were not audited.
- The user subsequently confirmed the company also owns drinksharbour.com, used at www.drinksharbour.com. Registrar title, renewal status, encumbrances and transfer authority were not independently checked. Website availability does not establish ownership, traffic or sales.

## Calculated current baseline

Assuming full configured monthly prices, Enterprise is 85,000 and Growth is 35,000: gross subscription MRR 120,000 and annualised subscription run rate 1,440,000. This is not proof of 12 months of collections. Receipts, discounts, taxes and payment frequency are unverified.

At published Paystack local pricing, each payment incurs min(1.5% of price + 100, 2,000); the 100 is waived below 2,500. The two payments cost 1,375 and 625, leaving 118,000 before support, infrastructure, salaries and tax. This assumes DrinksHarbour absorbs charges; check actual invoices and provider deductions.

Current operating costs, founder pay, cash, debt, registration, cap table, cash invested, retention and customer acquisition costs are unknown. Actual profit and equity value adjustments cannot be established from code alone.

## Forecast inputs — analyst assumptions, not actual operating data

| Input | Assumption |
|---|---:|
| Tenant mix | 20% Starter, 40% Growth, 30% Pro, 10% Enterprise |
| Average subscription price | 45,000/month |
| Average subscription payment fee | 775/tenant/month |
| Extra shop adoption | 10% of all tenants, one additional paid shop each |
| Extra warehouse adoption | 5% of all tenants, one additional paid warehouse each |
| Add-on prices | 12,000/shop and 20,000/warehouse/month |
| Average add-on revenue | 2,200/tenant/month |
| Average add-on payment fee | 48/tenant/month |
| Variable service cost | 5,000/tenant/month, including support and incremental infrastructure |
| Marketplace commission | 11% of net fulfilled marketplace GMV |
| Marketplace processing/payout budget | 2% of GMV, estimated; not a verified Korapay quote |
| Marketplace service/delivery subsidy | 3% of GMV |
| Marketplace refund/fraud reserve | 1% of GMV |
| Incremental marketplace acquisition | 2% of GMV |
| Marketplace contribution | 3% of GMV after the above costs |

Add-ons are available only on Pro and higher. The assumed adoption is drawn from the 40% of tenants in eligible plans and is incremental to included locations. Fractional adoption represents an average across time/cohorts. No Venue revenue, advertising, distribution, consumer subscription or gifting premium is required by the core scenarios.

The tenant mix does not prove a GMV mix. The 11% marketplace rate is a separate assumption: actual payouts depend on tenant markup/commission configuration, pack rates, discounts and product pricing. Do not apply marketplace commission to every offline POS sale.

## Scenario states

| State | Paying tenants | Fixed monthly operating costs | Marketplace GMV/month |
|---|---:|---:|---:|
| Bear | 25 | 2,500,000 | 0 |
| Early scale | 50 | 3,000,000 | 5,000,000 |
| Base | 100 | 4,000,000 | 10,000,000 |
| Bull | 200 | 6,000,000 | 40,000,000 |

Fixed operating costs include staff/founder pay, baseline hosting, administration and B2B sales/marketing. Variable support is separately included above; marketplace acquisition is incremental consumer spend. Do not double-count these categories when actual budgets replace estimates. Costs must include continuing development and security maintenance, not just hosting.

Amounts exclude indirect taxes and corporation tax, financing, depreciation/amortisation, exceptional costs and historical development spend. Prices are treated as revenue before any tax charged separately. If listed prices include VAT or another indirect tax, back that out and rerun. Tenant settlements, customer wallet funds and gift-card liabilities are not platform revenue. Marketplace GMV excludes cancelled/refunded sales, taxes and delivery pass-through amounts. Marketplace refund reserve models additional loss exposure, not a second reversal of refunded revenue.

## Valuation judgment

Domain reassessment: company ownership of drinksharbour.com strengthens continuity and the transferable brand/platform asset bundle. It does not justify a separately quantified valuation premium without traffic, organic lead/conversion, comparable-sale or buyer evidence. The 35m working figure and 20–50m fundraising range are retained, now with domain ownership explicitly included as a user-confirmed fact. No standalone domain appraisal is claimed and no domain premium is added to avoid double-counting the website/brand already considered. The www hostname is part of the same domain structure, not a second independently registered asset.

Indicative fundraising range: 20–50 million pre-money, working discussion figure 35 million, assuming no material net debt or other senior claims. This is a low-confidence negotiation assessment, not an appraisal, buyer offer, or statistically derived market comparable. Actual cash, debt and liabilities must be reconciled before agreeing an equity value.

Rebuilding useful commercial scope with existing templates/libraries is estimated at 40–75 million, not a verified supplier quotation and not a company valuation. A central budget is 24 engineering person-months × 1.1m = 26.4m; product/architecture 6 × 0.8m = 4.8m; QA 8 × 0.6m = 4.8m; UX 4 × 0.6m = 2.4m; DevOps 4 × 0.7m = 2.8m; tools/cloud 3.8m: total 45m, plus 25% contingency = 56.25m. These are planning allocations, not Nigerian salary survey results. AI-assisted reuse could materially reduce cost and time. The estimate excludes buying or recreating demand, retention, brand strength and distribution relationships.

Applying an illustrative 35–75% commercial/transferability discount to the 40–75m rebuild range gives approximately 10–49m of recoverable software utility. This sensitivity informs, but does not mechanically determine, the fundraising range. The discount is analyst judgment: two customers, no marketplace demand proof, release work, templates, maintenance and founder dependency constrain recovery. No separate customer multiple is added to this asset estimate.

For an earnings sanity check only, 3–5 times the present annualised subscription run rate is 4.32–7.2m. This selected sensitivity is not a verified Nigerian startup multiple. Mature SaaS benchmarks cannot establish this company's price. The 35m discussion figure is about 24.3 times current annualised subscription revenue, so investors would be buying software and future execution potential rather than established earnings.

## Sources checked 2026-10-07

- Pricing and eligibility: `server/config/erm-plans.js`.
- [Paystack Nigerian fees](https://paystack.com/pricing).
- [Kora card payments](https://support.korapay.com/hc/en-us/articles/33567660971410-Card-Payments): provider asks merchants to contact support for fees; obtain the actual merchant rate card.
- [SaaS Capital 2025 private SaaS benchmarks](https://www.saas-capital.com/blog-posts/private-saas-company-valuations-multiples/): predicted 4.8× bootstrapped and 5.3× equity-backed; historical, larger B2B cohort, not current Nigerian micro-startup comparables.
- [Bumpa subscription plans](https://support.getbumpa.com/support/solutions/articles/150000193102-bumpa-subscription-plans): generic retail competitor, not a valuation comparable.
- [Public DrinksHarbour website](https://www.drinksharbour.com/): reachable during the domain reassessment, not evidence of company title or demand.
- [Sedo domain appraisals](https://sedo.com/uk/services/domain-appraisal/): domain analysis and comparable transactions; no paid appraisal commissioned.
- [ICANN registration process](https://www.icann.org/resources/pages/domain-name-registration-process-2023-11-02-en): registrant rights. Company ownership is a founder representation pending registrar evidence.

To refresh: replace user-confirmed traction/receipts and unknown costs first, edit the assumptions and matching constants in `calculate-valuation.py`, regenerate `profit-scenarios.csv`, then update the report. Never promote a hypothetical model output to an actual financial statement.
