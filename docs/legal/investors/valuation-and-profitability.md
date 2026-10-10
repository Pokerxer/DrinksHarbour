---
title: DrinksHarbour valuation and route to profit
as_of: 2026-10-07
status: provisional investor discussion analysis
---

# DrinksHarbour: current value and route to profit

My provisional fundraising assessment is **₦20 million–₦50 million pre-money**, with **₦35 million** as a working discussion figure. Pre-money means before the new investment enters the company. This is a low-confidence commercial judgment based on the repository and the founder's traction report, not an independent appraisal or a buyer commitment. Cash, debt, other liabilities, ownership documentation and registration still need reconciliation before agreeing an equity price.

The software has substantial operating scope, but commercial validation is early. Two businesses pay for the service; there are no online sales yet. A higher price would require stronger evidence of customer growth, retention and reliable live operations. I would not defend a ₦250m current valuation from the evidence available.

The facts, external sources, rebuild budget and all model assumptions are in [valuation-assumptions.md](valuation-assumptions.md). [profit-scenarios.csv](profit-scenarios.csv) contains the reproducible financial scenarios. None is an actual company profit statement.

The later foreign-company question was clarified as selling/licensing the software for a foreign buyer's use. See [software-sale-pricing.md](software-sale-pricing.md) for scope-based USD proposals. Software-rights pricing and buyer build-versus-buy utility are separate from the Nigerian business fundraising valuation; no company registration, contract or ownership change is asserted.

## Domain ownership reassessment

The founder subsequently confirmed the company owns drinksharbour.com, including its www website address. This strengthens the company's control of the platform's public identity and reduces reliance on a founder or third party for the domain. It is a useful transferable business asset, subject to verifying registrar records and rights. The public site was reachable when checked on 2026-10-07; this does not establish title, customer traffic or transaction activity.

My updated assessment explicitly includes the company-owned domain within the business asset bundle and retains the **35m NGN working pre-money figure and 20–50m range**. The earlier assessment already contemplated the operating website and brand; adding an unsupported domain premium would double-count those benefits. The www address is not a second independent domain asset. Ownership alone supplies no defensible extra million-naira figure.

A separate premium requires evidence such as relevant completed domain sales, a credible buyer offer, or sustained organic traffic that produces customers and economic contribution. [Sedo's appraisal service](https://sedo.com/uk/services/domain-appraisal/) uses domain characteristics and comparable transactions; no appraisal was purchased here. Traffic, search visibility, lead conversion, domain title and trademark rights remain unverified. Provide monthly genuine visitor counts, organic enquiries/signups and conversions if available for a more informed reassessment. No change is made to the user-directed 35m contractual cap.

## Clarification: online sales are a second earning engine

On 2026-10-07 the founder emphasised that online sales generate earnings under the negotiated tenant model. This is correct: DrinksHarbour is both operational SaaS and a commerce platform. The order controller snapshots customer proceeds less the tenant's contractual payout as platform gross spread. A cost markup percentage is not necessarily the same percentage of customer sales. The actual two tenant agreements and expected online volumes have not yet been supplied.

The valuation above already includes marketplace potential; it is not subscription-only. However, its numerical precision exceeds the available commercial evidence. Treat 35m as a cautious discussion starting point, not a proven fair value or a ceiling. No revised factual sales forecast follows from identifying a revenue stream that was already included. No new price is agreed by this clarification.

At hypothetical 10m monthly fulfilled online GMV, the sensitivity below shows why the agreed platform share matters. An 8% total variable cost budget is taken from the existing model (processing/payout 2%, service/subsidy 3%, refund/fraud exposure 1%, consumer acquisition 2%). It is an assumption, not observed costs or a provider quote. Higher sales volumes might change those costs. Rates are effective gross platform shares of customer sales, not tenant cost-markup rates.

| Effective platform share | Gross platform earnings | Variable-cost budget | Contribution before fixed overhead |
|---|---:|---:|---:|
| 9% | 900,000 | 800,000 | 100,000 |
| 11% | 1,100,000 | 800,000 | 300,000 |
| 13% | 1,300,000 | 800,000 | 500,000 |
| 20%, illustrative spread, not an agreed rate | 2,000,000 | 800,000 | 1,200,000 |

At 30m monthly online GMV, an 11% effective share and the same 8% cost budget imply 900k monthly marketplace contribution, or 10.8m annualised before fixed overhead. Such repeatable contribution would be materially stronger evidence than current subscriptions alone and would require a refreshed valuation. Today it is a scenario: online sales remain zero. Obtain the two agreements, realistic online conversion of tenant demand, order economics and company costs before raising the current valuation on this basis.

## Current commercial baseline

| Item | Monthly amount |
|---|---:|
| One Enterprise tenant, at configured price | ₦85,000 |
| One Growth tenant, at configured price | ₦35,000 |
| Gross subscription revenue | **₦120,000** |
| Online marketplace revenue | **₦0** |
| Illustrative subscription payment fees | ₦2,000 |
| Cash after these fees, before other costs | **₦118,000** |

The two tenants, zero online sales and company ownership of the code are user-confirmed. Prices are from `server/config/erm-plans.js`; full-price receipts and payment frequency are not verified. Annualised subscription revenue is ₦1.44m, not proof of a full year of collections. Fees use [Paystack's published local pricing](https://paystack.com/pricing), assuming the platform absorbs charges and excluding tax adjustments.

Enterprise contributes 70.8% of this subscription income. Losing that customer would leave only ₦35,000/month before costs. Actual profit cannot be calculated without the company's expense records. Even a founder-run company should include the continuing cost of development, support and replacement labour when assessing sustainable profit.

## What the code contributes to value

The review covered pricing, subscription billing and entitlements, marketplace order pricing/payout snapshots, settlement, table checkout/booking, reorder rules, advertising models, route registration, frontend structure and release documentation. It is not a full security, licence or deployment audit.

| Capability | Evidence reviewed | Commercial implication |
|---|---|---|
| Multi-tenant operations and subscriptions | `erm-plans.js`, `erm.service.js`, `erm.routes.js`, entitlement documentation | Businesses can pay to manage their operations even without marketplace sales. |
| Inventory, POS, purchases, accounting and CRM | Registered backend routes and admin surfaces | Broader operational utility can support higher subscription tiers; actual usage still needs confirmation. |
| Central catalogue and tenant selling instances | Order controller, SubProduct references, server-authoritative tenant resolution | Supports shared product discovery with tenant-specific stock, prices and fulfilment. |
| Marketplace monetisation | `order.controller.js:116–205` | Actual platform spread is captured after tenant payout; it varies with pricing and revenue configuration. |
| Venue bookings and table-service payment | `booking.service.js`, `tableCheckout.service.js:13–16` | Venue tier is ₦150k/month; table-service commission is explicitly 9%. No paying Venue customer confirmed. |
| Gift cards, wallets, loyalty and referrals | Routes and corresponding backend tests | Can support repeat purchases. Stored balances and points are not automatically revenue or profit. |
| Advertising | Banner model/controller with impression and click tracking | Paid CPC/CPM billing was not demonstrated in the inspected money paths; forecast revenue remains zero. |
| Reorder automation | `reorder.service.js:314–315` | Inventory rule checking exists, but automatic purchase-order creation and notifications remain TODOs there. This does not establish a live consumer auto-reorder subscription. |

The admin originated from an Isomorphic template (`client/apps/admin/README.md`). Third-party libraries and generic screens should not be priced as exclusively original intellectual property. The value lies in the useful integration, beverage workflows, operational correctness and customers' willingness to keep paying. Code quantity, AI integrations and feature names do not independently establish a valuation.

The backend suite completed with **3,407 tests: 3,405 passed, zero failed, two skipped**. The initial restricted run could not open local test-server ports; rerunning with local ports available removed those failures. Passing offline tests provides evidence of engineering work, not market demand or complete production readiness. `docs/saas/six-area-validation.md` explicitly leaves live provider workflows, mail delivery and scheduled-job evidence to staging validation. No live charges, database mutation or deployments were performed for this assessment.

## How I arrived at the valuation range

1. **Present revenue is a low anchor.** An illustrative 3–5× annualised revenue calculation gives ₦4.32m–₦7.2m. This is a selected sensitivity, not a Nigerian startup comparable. [SaaS Capital's 2025 research](https://www.saas-capital.com/blog-posts/private-saas-company-valuations-multiples/) predicted roughly 4.8–5.3× for its private B2B cohorts, but these historical figures are not directly applicable to a two-customer Nigerian business.
2. **The useful software would take resources to replace.** My rough budget is ₦40m–₦75m, with a worked central estimate of ₦56.25m in the assumptions file. It allows template/library reuse and includes implementation, product work, QA and operations. It is not a supplier quotation. AI-assisted rebuilding could lower this considerably.
3. **An investor cannot recover all development cost automatically.** Applying a wide illustrative transferability discount gives approximately ₦10m–₦49m of recoverable utility. Limited customers, founder dependence, unproven demand, maintenance and remaining release work justify the discount. These percentages are judgment, not observed transactions.
4. **Fundraising also prices execution potential.** The ₦20m–₦50m discussion range reflects the software and opportunity to expand the subscription business. I have not added a software value to a revenue multiple; doing so would double-count the same earning asset. At ₦35m, the price is about 24.3× current annualised subscriptions, so investors must believe in future execution rather than present earnings.

Use the lower end if payments are irregular, live billing/settlement remains unreliable, onboarding depends heavily on the founder, or expensive custom work is needed for every tenant. The upper end needs clean IP/title documents, demonstrated live billing and repeat usage, manageable support effort and a credible paid sales pipeline. A cash sale of the code could be materially lower than a fundraising valuation.

Competition constrains pricing. [Bumpa's published plans](https://support.getbumpa.com/support/solutions/articles/150000193102-bumpa-subscription-plans) include ₦15k quarterly Starter, ₦250k yearly Growth and ₦750k yearly Scale: approximately ₦5k, ₦20.8k and ₦62.5k per month respectively, with different terms and capabilities. DrinksHarbour must demonstrate beverage-specific operational savings to defend its prices. This is a product comparison, not a valuation comparable.

## The most credible route to profit

**First, sell and retain the ERM subscription.** Focus initial selling on Abuja beverage shops, distributors and venues that need stock control, POS, purchases and reconciliation. Demonstrate a measurable benefit using the two existing customers: fewer stock discrepancies, faster billing, better cash collection or less administrative work. Do not promise a quantified saving until it is measured. Charge for the operational value rather than requiring online sales to justify the subscription.

**Second, increase recurring revenue from appropriate upgrades and locations.** Prices are Starter ₦15k, Growth ₦35k, Pro ₦65k, Enterprise ₦85k and Venue ₦150k per month. A Growth-to-Pro upgrade adds ₦30k/month; Enterprise-to-Venue adds ₦65k when venue functionality is useful. Paid extra shops are ₦12k and extra warehouses ₦20k on eligible plans, above their included allowances. Avoid giving away bespoke implementation through an unlimited fixed-price plan; quote separately for work that has a real delivery cost.

**Third, add profitable marketplace transactions.** Fulfilled online orders can generate additional spread or commission. The plan schedule is 9–13%, but the order controller uses tenant markup/commission settings, pack rates and product pricing: a flat 13% assumption would overstate some revenue. Tenant offline POS turnover is not automatically marketplace GMV or commission income. Main customer checkout defaults to Korapay; ERM subscription billing uses Paystack, and a separate integration storefront checkout uses Paystack. Obtain actual provider rates before finalising margins.

**Then test advertising, gifting and venue expansion as additional income.** Start with a small paid campaign or corporate order whose margin can be measured. Loyalty is primarily a retention mechanism with a cost. Gift-card purchases and wallet funding create fulfilment obligations. Physical distribution should wait for a separate inventory/working-capital budget; a 25% cost markup equals only a 20% gross sales margin before delivery, losses and staffing.

## Monthly economics under explicit assumptions

The core mix assumes 20% Starter, 40% Growth, 30% Pro and 10% Enterprise, giving **₦45,000 average subscription revenue per tenant**. Estimated support/infrastructure is ₦5,000 per tenant; average subscription payment fees are ₦775. This leaves **₦39,225 contribution per tenant before fixed overhead**.

Assumed add-on adoption adds ₦2,200 average revenue and ₦48 payment fees per tenant, lifting contribution to **₦41,377**. Adoption is hypothetical and incremental to included locations. If additional locations materially increase support costs, this contribution falls.

At ₦3m monthly fixed overhead, subscription break-even is **77 paying tenants without add-ons**, or **73 with assumed add-ons**. At ₦4m overhead the corresponding numbers are **102 and 97**. These are arithmetic thresholds, not forecasts of when customers will arrive.

| Hypothetical monthly state | Tenants | SaaS + add-on revenue | Marketplace GMV | Total platform revenue* | Fixed overhead | Operating profit/(loss)** |
|---|---:|---:|---:|---:|---:|---:|
| Bear | 25 | ₦1.180m | ₦0 | ₦1.180m | ₦2.5m | **(₦1.466m)** |
| Early scale | 50 | ₦2.360m | ₦5m | ₦2.910m | ₦3m | **(₦0.781m)** |
| Base | 100 | ₦4.720m | ₦10m | ₦5.820m | ₦4m | **₦0.438m** |
| Bull | 200 | ₦9.440m | ₦40m | ₦13.840m | ₦6m | **₦3.475m** |

\* Includes only the 11% assumed marketplace commission, not full GMV. Agent-style net revenue treatment here is a modelling convention; final accounting requires review of actual contracts.

\** After estimated payment, service, marketplace variable and fixed costs; before tax, financing, depreciation/amortisation and exceptional costs. These are steady-state scenarios, not Year 1–3 predictions. VAT-inclusive pricing would require reducing revenue. No current actual expense data was provided.

Marketplace margin is thin in this model: ₦10m GMV generates ₦1.1m commission, then ₦200k processing/payout budget, ₦300k fulfilment support/subsidy, ₦100k refund/fraud exposure and ₦200k incremental acquisition, leaving **₦300k contribution**. [Kora's official card-payment help](https://support.korapay.com/hc/en-us/articles/33567660971410-Card-Payments) asks merchants to contact support for fee information; the 2% budget is not a provider quote. Consumer acquisition and delivery subsidies can easily erase this margin.

The model is sensitive to costs: at 100 tenants, every additional ₦5,000 of support cost removes ₦500k monthly profit, turning the base scenario into a loss. Raising fixed overhead by ₦1m has the same one-for-one impact. Failed collections and churn also lower revenue. An assumed ₦150k B2B acquisition cost divided by ₦41,377 contribution implies a 3.6-month payback before overhead; neither CAC nor retention is measured yet, so no lifetime-value claim is made.

## Practical milestones

- Next 30 days: verify actual receipts and expenses; measure weekly use and support time for both tenants; obtain testimonials with consent and a documented onboarding checklist. Confirm live provider and settlement/reconciliation evidence.
- Next paid cohort: seek ten retained, regularly paying businesses before expanding acquisition spending. At ₦45k average base subscription price this would be ₦450k MRR; it is a target, not pipeline revenue.
- Before a larger raise: show 25–50 paying tenants, cohort collections/retention and onboarding cost. At the assumed mix this is ₦1.125m–₦2.25m base subscription MRR. Model burn against cash runway rather than assuming these volumes are profitable.
- At approximately 100 paying tenants: demonstrate support cost and fixed overhead consistent with the model. Treat marketplace and advertising as optional upside until their cash contribution is measured.

## Implication for the convertible loan draft

Subsequent instruction on 2026-10-07: the user requested the contract be redone using NGN 35 million. The current convertible source and Word draft therefore adopt a fixed NGN 35,000,000 pre-money cap, superseding the negotiating suggestion below. Actual Principal and bridge limit remain blank. This is a user-directed draft term, not an independent valuation certification.

The earlier ten-times-bridge cap formula and its ₦25m/₦250m example were hypothetical negotiation terms, not verified current company value. They should not be used to justify a ₦250m cap solely from today's traction.

For a small proposed ₦5m–₦10m bridge, a **₦40m–₦50m pre-money cap** with the existing proposed **20% conversion discount** is a more defensible discussion starting point; the lower conversion price should apply rather than stacking the two benefits. A cap protects conversion pricing and is not a formal current valuation. Raise size, runway, existing notes and founder dilution must be checked before accepting it. No agreement is amended by this analysis.

For illustration, ₦10m principal at the draft's 8% simple interest for 24 months becomes ₦11.6m. At a ₦50m cap, assuming cap-based conversion and no other convertibles/options or new round dilution, approximate ownership is 11.6 ÷ (50 + 11.6) = **18.8%**. Actual shares depend on the defined fully diluted capitalisation and round mechanics. A ₦20m note would become ₦23.2m and about **31.7%** under the same simplified assumptions, illustrating why funding amount matters. Counsel must reconcile any chosen cap with the contract definition.

Current revenue cannot support a large maturity repayment. A ₦10m note plus two years' simple interest repaid over six equal months would require about **₦1.93m/month**, versus today's ₦120k gross monthly subscriptions. A 24-month note therefore requires a credible conversion/refinancing plan and negotiated fallback; extension is not assured. The proposed 8% rate, 20% discount and 24-month maturity remain negotiable, not a legal or market guarantee.

Before fixing terms, collect: actual subscription receipts/prices, monthly expenses including founder pay, bank cash/debt, ownership/registration and cap table, customer start dates/retention, onboarding cost, licence/IP assignments and live release evidence. Those inputs could materially change both valuation and affordable financing.
