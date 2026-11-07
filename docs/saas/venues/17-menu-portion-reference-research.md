---
title: Restaurant and nightlife menu and portion reference research
updated: 2026-10-30
status: researched-recommendations-not-an-implementation-approval
---

# Purpose and evidence boundary

The user asked how existing restaurant and club software handles specialised products, categories, food and portions. Sources below were checked on30October2026. [Certain] identifies documented public behaviour or public API objects. [Likely] identifies the proposed DrinksHarbour adaptation. Public manuals are not evidence of a vendor's private database schema, transaction guarantees, Nigerian availability or complete feature coverage. No accounts were accessed and no runtime code or live configuration changed.

This is workflow/model research, not a pricing, investment or product-purchase ranking. An undocumented capability is unknown, not absent. Odoo references are explicitly19.0, not a claim about its latest release. Different Lightspeed product series must not be conflated.

# Official observations

| System | Documented behaviour [Certain] | Useful adaptation [Likely] |
|---|---|---|
| Toast | Menus contain groups, optional subgroups and items. [Menu hierarchy](https://support.toasttab.com/en/article/Menus-Menu-Groups-and-Subgroups). Items and modifiers support size pricing, with channel limitations for modifier pricing. [Size pricing](https://dev.toasttab.com/doc/platformguide/adminSizePrice.html). Its coffee guide recommends separate size-specific items for clearer per-size reports, while also offering size pricing. [Coffee setup](https://support.toasttab.com/en/article/Menu-Best-Practices-for-Bakeries-Coffee-Shops). | Keep menu navigation separate from product identity. Give each sellable portion a stable reporting/recipe identity, whether rendered as a size selector or a separate tile. Validate channel support rather than assuming identical configuration everywhere. |
| Square | `CatalogItem` has `CatalogItemVariation` children with price and measurement references. Its documented stock conversion can connect a wine-glass selling variation to bottle stock; stockable/sellable conversion fields are marked Beta in the inspected API. [Variation API](https://developer.squareup.com/reference/square/objects/CatalogItemVariation). Modifier lists separately govern paid/default/required choices and selection quantities. [Modifiers](https://developer.squareup.com/docs/catalog-api/enable-modifiers-on-items). | Map portion identity to owned SubProduct/Size. Separate portion selection from extras and stock measurement. Treat a vendor's Beta API as a reference, not a dependency or compatibility promise. |
| Odoo19 | POS products support attribute variants, POS-specific parent/child categories, units and combos. Combo choices reference component products and can apply extra prices. [Official POS product documentation](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/products.html). | Reuse commercial products and variants; maintain a service-facing menu hierarchy. Model meal/package choices with explicit inclusions and upgrade charges. |
| Lightspeed O-Series Produce | Recipes distinguish made-to-order production from batch preparation. Ingredient measures can differ from stocked units; batch yield and serving size convert produced volume/weight into portions. [Official recipes and batches guide](https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329433997339-Creating-Recipes-Made-to-Order-Batches). | Model raw inputs, actual prepared output, portion size and waste separately. A portion label alone is insufficient inventory logic. |
| SevenRooms | Nightlife onboarding documents tables/bottle service, guest lists, event experiences, table minimums/upgrades and POS integration with guest profiles. [Official nightlife onboarding](https://sevenrooms.com/newcustomer/nightlife/). | Keep guest/reservation/event commercial terms and capacity distinct from food/beverage merchandise, then connect them through the existing visit and bill. Ingredient/recipe implementation is not established by this source. |
| Tablelist Pro | VIP table packages have guest capacity, sale/arrival windows, dates/recurrence, section quantity, deposit/payment choice and guest-range pricing. [VIP inventory](https://docs.tablelistpro.com/inventory/adding-vip-table-inventory-on-web). Reservations can record minimum spend or minimum bottles. [Reservations](https://docs.tablelistpro.com/reservations-ticketing/adding-a-reservation). | A club offer includes time/capacity/payment terms; it cannot be represented completely by a bottle Size. Preserve explicit distinctions between purchased goods, booking obligations and admissions. |

Tablelist separately documents full prepayment, deposits, card authorization and no advance payment. Those are different states, not interchangeable paid flags. [Payment types](https://docs.tablelistpro.com/inventory/choosing-payment-types). Its Toast integration applies an earlier deposit to the final check, leaving the remainder to collect. [Deposit application](https://docs.tablelistpro.com/integrations/point-of-sale/toast-pos-applying-a-payment-option-for-deposits). These foreign-provider/tax examples do not approve equivalent DrinksHarbour payment methods or Nigerian tax rules.

# What this changes in our recommendation

[Likely] The architecture should preserve distinct responsibilities:

1. **Canonical Product:** identity and catalog kind. Do not duplicate a packaged drink because it appears on a restaurant or club menu. A genuinely different branded dish can have a distinct identity.
2. **Tenant SubProduct and serving Size:** commercial ownership and the stable sellable portion. Store portion label, serving unit, optional net weight/volume/servings, price and the applicable recipe reference. The portion must be reportable independently.
3. **Tenant/location menu organisation:** menus, categories/subcategories, display order, service availability and kitchen/bar presentation. This classification is independent of the central catalogue taxonomy.
4. **Modifiers:** min/max choices, defaults, repeat quantities, pricing and explicit ingredient/stock effects. A free-text instruction is not a reliable priced or stock-consuming component.
5. **Recipe and production:** exact portion recipe, sub-recipes if supported, expected versus actual yield and production/consumption evidence. Larger portions are not automatically a linear multiple of smaller ones. Purchase units, raw ingredient quantity and cooked serving weight are different facts.
6. **Club experience/offer:** event/date, table entitlement, guest capacity, minimum terms, inclusions and deposit/refund policy. Component merchandise and seating/admission capacity must reconcile separately. No fictitious beverage Product for a minimum or deposit.

An item variation and a separate POS tile are not mutually exclusive UI choices. Both can resolve to the same stable underlying serving identity. Toast's separate-item advice does not justify duplicate canonical Products in our multi-tenant catalogue.

# Examples for DrinksHarbour [Likely]

- **Jollof:** canonical prepared-food identity, tenant selling instance, regular/large/tray portions, protein modifier group and exact recipes. A cooked batch must record actual yield; later portions consume prepared output without consuming its raw inputs a second time.
- **Whisky:** one canonical packaged identity; bottle and measured-pour serving definitions reference the correct sealed/opened stock conversion and loss policy.
- **Cocktail:** prepared-beverage identity, tenant recipe and ingredient quantities, portion-specific recipe/price plus valid extra-shot choices.
- **VIP offer:** explicit table/date/guest terms, included bottles/mixers, eligible minimum and deposit policy linked to one visit. The package, admission and physical bottles are distinguishable even if one customer-facing card presents them together.

# Mapping to inspected local source

[Certain] Current source already contains `Product.catalogKind`, `SubProduct`, `Size`, `VenueLocationProfile.menu`, modifier handling and `RecipeVersion.output.subProduct/size`. Phase3 and Phase4 have later handoffs than the earlier Phase2 work; do not infer they are missing from an old roadmap paragraph.

Before any implementation, audit these existing paths for portion-specific units/weights, report identity, batch versus made-to-order handling, nested menu categories, size-dependent modifiers and package/capacity reconciliation. This research does not claim those behaviours are all absent or newly verified. It authorises no new collection, migration or activation by itself.

Profit follow-up: [profit and costing research](18-profit-costing-reference-research.md) distinguishes projected portion margin, recorded COGS, stock variance, contribution and period net results, with official sources and inspected-code limits.

Implementation follow-up30October: [implementation blueprint](19-catalog-costing-implementation.md) contains the current-source audit, proposed contracts, task sequence, migrations and acceptance checks. Documentation is complete; implementation under that plan has not started.
