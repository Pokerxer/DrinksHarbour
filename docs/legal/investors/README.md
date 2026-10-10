# Investor agreement drafts

## General investor agreement review

Latest user instruction selects NGN5,000,000 for5% in `drinksharbour-investor-agreement.md` and `DrinksHarbour Investor Agreement.docx`. On the new-share subscription basis, implied valuations are95m pre-money/100m post-money. Schedules1–3 are updated; Schedule2 states5%/95% allocation with actual registered counts and holder names still needed for the closing annex. Schedule3 proposes a six-month5m advertising/acquisition budget following the existing marketing purpose. The ten-page Word copy was regenerated and visually inspected; ownership and all budgets reconcile. Earlier loan and60m valuation documents below remain separate historical proposals. Complete remaining identities, registered share data, approvals and thresholds and obtain Nigerian legal review before signing. See `docs/superpowers/specs/RESUME-investor-agreement.md` for the latest handoff.

## Current Nigerian package — NGN 60 million

The user requested return to Nigerian contracts and a proposed NGN60,000,000 pre-money Company equity valuation. Current documents: [Nigerian Advertising Loan Agreement](DrinksHarbour%20Nigerian%20Advertising%20Loan%20Agreement.docx), [Nigerian Company Valuation](DrinksHarbour%20Nigerian%20Company%20Valuation.docx), [Nigerian Funding Plan](DrinksHarbour%20Nigerian%20Funding%20Plan.docx). Sources: `drinksharbour-nigerian-loan.md`, `nigerian-company-valuation.md`, `nigerian-funding-plan.md`; builder: `build-nigerian-documents.py`.

All three record60m as a proposed negotiating valuation, not an independent appraisal. The staged5m advertising debt remains non-convertible with no equity rights, proposed8% simple interest,36mo per draw and6mo payment grace. Valuation does not change repayment. All5/2/3 rendered pages inspected; archive integrity and arithmetic verified. Names, RC, dates, bank details, approvals and per-draw schedules remain incomplete. Earlier35m analytical estimates and convertible cap, and USD software licence documents, are retained historical/separate alternatives; they are not current package terms. See `docs/superpowers/specs/RESUME-nigerian-60m-documents.md`.

## Updated review documents — 7 October 2026

- [Commercial software licence](DrinksHarbour%20Commercial%20Software%20Licence%20Agreement.docx): proposed NGN 60,000,000 non-exclusive commercial source-code licence for a Nigerian buyer and Nigerian territory. Payments18m/24m/18m; liability cap60m. DrinksHarbour retains original IP, domain, brand and business. Parties, scope, third-party inventory and acceptance criteria remain to be agreed.
- [Software pricing assessment](DrinksHarbour%20Software%20Pricing%20Assessment.docx): updated Nigerian NGN60m licence asking-price note with scope, evidence and limitations; not a company appraisal or established market price.
- [Advertising funding proposal](DrinksHarbour%20Advertising%20Funding%20Proposal.docx): staged NGN 5m non-convertible funding proposal for both businesses and shoppers, with no equity and proposed 8% simple interest. Lender acceptance and affordability remain unverified.
- [Advertising loan agreement](DrinksHarbour%20Advertising%20Loan%20Agreement.docx): existing separate zero-equity facility review draft; complete parties and dated schedules before signing.

`build-current-documents.py` builds the first three files from `drinksharbour-commercial-software-licence.md`, `software-pricing-assessment.md` and `advertising-funding-proposal.md`. The final renders contain five, two and three pages respectively; all were visually inspected. The earlier ordinary-equity and convertible documents below are retained alternatives, not the current recommendation for advertising finance. None is executed. Resume at `docs/superpowers/specs/RESUME-commercial-software-licence.md`.

`drinksharbour-investor-agreement.md` is the editable source for the Word review draft. This is a proposed ordinary equity subscription into the company operating DrinksHarbour, not an investment in a tenant business and not a loan or revenue-sharing arrangement.

All bracketed fields require completion. The investment structure is an assumption pending the user's response. No company registration, ownership, valuation, funding commitment, IP ownership or operating milestone has been independently confirmed. Proposed time periods and consent thresholds are negotiable.

Before execution, Nigerian counsel should reconcile the agreement with the company's articles and any existing shareholders' agreement, obtain all necessary shareholder signatures, verify title to the platform IP and the capitalisation table, and confirm applicable corporate, securities, tax, foreign-investment and execution requirements.

The contract source is authoritative; regenerate and visually inspect the Word copy after changes. Legal research and outstanding actions are recorded in `docs/superpowers/specs/RESUME-investor-agreement.md`.

`build-agreement.py` regenerates the Word document from the Markdown source using the bundled document runtime. It preserves the intentional page divisions and tables. Run it with the Python path returned by `load_workspace_dependencies`, then use the documents skill renderer and inspect every page before delivery. The builder's base directory currently points to this checkout; update it if the project moves.

## Convertible loan alternative

Current preference update: the user rejected approximately 14% dilution for a 5m advertising loan. For that purpose the recommended proposal is now [marketing-funding-plan.md](marketing-funding-plan.md), a staged non-convertible facility with no equity. The convertible Word draft below is retained as an earlier alternative, not the current recommended advertising structure. Neither document is executed.

The requested current deliverables are `DrinksHarbour Advertising Loan Agreement.docx` (source: `drinksharbour-marketing-loan.md`) and `DrinksHarbour Advertising Funding Plan.docx` (concise source: `marketing-funding-summary.md`). Both concern zero-equity staged advertising funding for businesses and shoppers. `build-marketing-documents.py` regenerates both with the bundled Python document runtime. Complete parties, dates, cash forecast and per-draw schedules and obtain legal review before execution. Later advances require a signed draw confirmation, not merely a KPI result. The full working proposal retains alternatives and unverified assumptions; it is not incorporated automatically as operative loan terms.

`drinksharbour-convertible-loan.md` and `DrinksHarbour Convertible Loan Agreement.docx` contain the separate convertible bridge proposal requested on 2026-10-07 and subsequently revised at the user's direction to a fixed NGN 35,000,000 pre-money valuation cap. Proposed 20% discount, 8% simple interest and 24-month maturity are retained. The lower cap/discount share price applies without stacking. The cap is independent of the loan amount and bridge funding limit; it replaces the earlier ten-times-limit proposal. Principal and party details remain blank. The final appendix's NGN 5 million loan is illustrative, not an agreed investment, and the cap is not a formal appraisal or guaranteed ownership percentage.

`build-convertible-loan.py` regenerates this alternative without overwriting the equity agreement. See `docs/superpowers/specs/RESUME-convertible-loan.md` for outstanding legal and commercial review and verification. Conversion formulas and repayment obligations require counsel review, including current securities rules and tax withholding on converted interest.

## Company valuation and profitability

The detailed revenue and profit explanation is [drinksharbour-revenue-and-profit.md](drinksharbour-revenue-and-profit.md), with an editable `DrinksHarbour Revenue and Profit Explained.docx`. It covers earning channels, costs, unit economics, illustrative operating scenarios, break-even, the latest NGN 5 million for 5% investment and investor dividends/share sales. Actual profit remains unverified pending receipts and expense records. `build-profit-report.py` regenerates the document; resume at `docs/superpowers/specs/RESUME-revenue-and-profit-explanation.md`. The latest report adds custom tenant website design from NGN 500,000 once and proposed management at NGN 35,000/month. All 13 final pages were rendered and visually inspected. This offer is documented here only; it was not added to the website footer.

The earlier foreign-buyer software transaction proposal, now historical, is [software-sale-pricing.md](software-sale-pricing.md). Founder means selling/licensing the application for the buyer's use, not foreign incorporation. Proposed commercial licence range USD25k–50k, opening quote35k; exclusive transferable-code/IP range50k–100k. These are low-confidence negotiating estimates, not appraisals, offers or currency conversions of the fundraising estimate. Rights, scope and buyer needs require verification.

The 2026-10-07 code-grounded assessment is in [valuation-and-profitability.md](valuation-and-profitability.md), with facts and assumptions in [valuation-assumptions.md](valuation-assumptions.md). User confirmed two paying tenants (Enterprise/Growth), zero online sales and company code ownership; these replace the earlier absence of traction/IP information above, but do not constitute independent verification. Registration, actual receipts, expenses and cash/debt remain unconfirmed.

The provisional fundraising range is NGN 20–50 million pre-money (working figure 35 million), not an appraisal. The user subsequently directed use of 35 million in the convertible draft; that draft's cap is now fixed accordingly. The previous hypothetical 250m cap example is superseded. `calculate-valuation.py` regenerates [profit-scenarios.csv](profit-scenarios.csv) without external services. Resume at `docs/superpowers/specs/RESUME-valuation-profitability.md`.
