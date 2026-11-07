---
title: Restaurant and club profit tracking reference research
updated: 2026-10-30
status: researched-observations-and-proposed-reporting-contract
---

# Scope

The user asked how the previously compared systems track profit. Official documentation checked30October2026. [Certain] means a documented feature or inspected code; [Likely] means our proposed adaptation. A revenue/spend dashboard is not automatically a profit calculation. No live financial data or runtime changes were involved.

# Documented approaches [Certain]

| System | What is documented | Official evidence |
|---|---|---|
| Toast with xtraCHEF | Toast's restaurant menu editor has no COGS field; xtraCHEF supplies restaurant recipe/inventory cost tracking. Physical counts and purchases support COGS and actual-versus-theoretical consumption reports. | [Production cost](https://support.toasttab.com/en/article/Where-can-I-enter-the-production-cost-of-a-food-item), [COGS report](https://support.toasttab.com/en/article/xtraCHEF-COGS-Report), [actual/theoretical](https://support.toasttab.com/en/article/xtraCHEF-Get-Started-With-Actual-vs-Theoretical-Analysis-Reports) |
| Lightspeed O-Series | Recipe calculator derives ingredient/batch/unit costs using recipe and yield information. Its COGS documentation says cost is captured with sales for gross-profit reporting, excluding labour and overhead from that cost-price calculation. | [Recipe calculator](https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329334643099-Using-the-recipe-cost-calculator), [COGS](https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329425820443-Calculating-your-Cost-of-goods-with-Lightspeed) |
| MarketMan | Recipe costing calculates portions using ingredient costs from purchasing/inventory. Actual-versus-theoretical reporting compares recipe-and-POS expectations with deliveries and physical counts to identify cost variance. | [Recipe costing](https://www.marketman.com/platform/recipe-costing-software), [variance report](https://www.marketman.com/page/actual-vs-theoretical-food-cost-report) |
| Odoo19 | POS exposes costs/margins. Accounting's Profit and Loss report calculates period net income from revenue and expenses. Item margin and company profit are different reporting levels. | [POS products](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/products.html), [accounting reports](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting.html) |
| SevenRooms / Tablelist Pro | Reviewed docs establish guest spend, table/event revenue, attribution and POS integration. They do not establish complete ingredient valuation or net-profit calculation. Do not infer these private capabilities from sales dashboards. | [SevenRooms nightlife](https://sevenrooms.com/newcustomer/nightlife/), [Tablelist attribution](https://docs.tablelistpro.com/events/event-tracking-links), [POS deposit application](https://docs.tablelistpro.com/integrations/point-of-sale/toast-pos-applying-a-payment-option-for-deposits) |

# Reporting layers to keep separate [Likely]

1. **Projected portion margin:** net portion sale minus the estimated ingredient/packaging cost of its selected portion, recipe and modifiers. Useful for menu pricing; not proof of actual stock usage or net business profit.
2. **Recorded sales gross margin:** net sales minus the product/ingredient cost assigned under the venue's accounting valuation method. Freeze the relevant cost evidence/version so a new recipe or price does not silently rewrite old sales. Correct errors through explicit adjustments.
3. **Inventory usage variance:** expected consumption from sales/recipes versus physical stock reconciliation. In a simple no-transfer/no-return period, actual usage value = opening inventory + purchases - closing inventory. Real calculations must account for transfers, supplier returns, adjustments and prepared/WIP stock. Investigate waste, over-portions, over-pours, comps, missing counts and recording errors; variance is not proof of theft.
4. **Contribution after channel costs:** show payment fees, applicable platform commission and other defined variable costs separately from food/bottle cost. Clear labels prevent inconsistent comparisons.
5. **Period operating/net result:** ledger revenue and all applicable recognised expenses, including payroll, rent, utilities, marketing, depreciation, financing and tax according to classification. It is not a sum of recipe margins or bank receipts. Do not subtract a cost twice between COGS and overhead.

Taxes collected for another party and staff tips payable are not automatically venue sales. An advance deposit is payment toward an obligation, not another sale when applied. A complimentary mixer still costs stock. Refunds and stock returns are separate events. Financial minimum-shortfall revenue and its cost allocation require the approved classification; no recipe or fee is invented for it.

# Illustrative arithmetic, not live financial results

Assume100 portions sold at net5000NGN each and estimated ingredient/packaging cost2000NGN each. Net revenue500000NGN minus expected cost200000NGN gives projected portion margin300000NGN (60%). If reconciled inventory usage for those costs is230000NGN, the adverse usage variance is30000NGN and the corresponding inventory margin is270000NGN (54%), before other expenses. The example assumes no other stock flows or income. It does not establish actual profit for any tenant.

# Inspected DrinksHarbour evidence and limit

`server/services/venue/recipes.js` explicitly describes `costMinorPerUnit` as a PROJECTED authoring input, rather than an automatically invoice-derived cost. `VenueConsumptionEvent.recipeCostMinor` freezes that recipe value times output quantity. `server/services/venue/accounting.js` posts COGS from accepted bill-line cost snapshots. These inspected paths establish recorded/projected cost evidence, not end-to-end proof of actual food-cost valuation or net profit. An implementation audit must trace ingredient receipts, prepared batches, consumption, waste, counts, modifiers, refunds and ledger postings before advertising an actual-profit report.

No production data, policy, fees or schema changed. This is a research/reporting contract linked to [menu and portion research](17-menu-portion-reference-research.md), not an assertion that every proposed report is already implemented.

Implementation follow-up30October: [implementation blueprint](19-catalog-costing-implementation.md) contains the current-source audit, proposed contracts, task sequence, migrations and acceptance checks. Documentation is complete; implementation under that plan has not started.
