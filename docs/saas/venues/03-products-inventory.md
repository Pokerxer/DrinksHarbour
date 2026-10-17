---
title: Venue products menus and inventory
date: 2026-10-17
status: proposed
---

# Products, menus, recipes and stock

[Back to the main design](README.md). All target rules are [Likely] recommendations. Numeric examples are [Guessing] illustrations.

## 1. What a venue sells

| Offer | Example | Identity and price | What is consumed |
|---|---|---|---|
| Sealed beverage | 750 ml whisky bottle | Central Product → tenant SubProduct/Size | One sealed bottle at a location |
| Measured serving | 50 ml whisky | Same canonical whisky; tenant serving Size/configuration | 50 ml from eligible opened stock |
| Draught serving | 500 ml draught beer | Canonical beer with tenant serving definition | Measured keg volume and recorded losses |
| Prepared beverage | Signature cocktail, mocktail, coffee | Canonical prepared-beverage Product → SubProduct; private tenant recipe | Recipe ingredients and selected modifiers |
| Prepared food | Jollof plate, grilled fish, platter | New food Product kind → SubProduct | Recipe ingredients or approved prepared batches |
| Modifier | Extra shot, side, choice of mixer | Choice metadata; priced extras reference their own SubProduct/Size | Corresponding ingredient or stock component |
| Service package | Two bottles, mixers and table service | Package offer references priced SubProduct and component definitions | Components when reserved/served; seating separately |
| Event admission | Single entry to a dated event | Event occurrence and ticket type | Admission capacity, not beverage inventory |
| Reservation commitment | Table minimum or room hire | Booking terms/service-charge contract | Table-time capacity; minimum is not stock |

Tickets, deposits, tips and minimum-spend commitments are not fictitious beverage Products. Explicit typed service charges can appear on a bill without pretending to own stock.

## 2. Keep one central catalogue

Product stores canonical identity. SubProduct and the existing Size records store tenant selling terms and stock-facing variants. The inspected code uses names such as `isAlcoholic`, `originCountry` and `baseSellingPrice`; the architecture examples in AGENTS.md are not a replacement schema. Add an adapter rather than silently renaming fields.

Recommended additive `catalogKind`: `beverage` (legacy default), `prepared_beverage`, `prepared_food`, `bundle`, `ingredient`, `consumable`. Bundles represent genuine multi-component offers, not deposits or table commitments. Ingredients/consumables support procurement and need not be sellable. Before adding these values, audit all beverage-only forms, validators, search filters, embeddings, product cards, imports and exports.

Every sellable dish or prepared drink still has a SubProduct pointing to a central Product. **MenuItem is presentation and service configuration, not a second tenant product database.** Signature items can use a genuinely distinct branded canonical identity; copying a global packaged drink under a venue name is prohibited.

Match packaged goods by a normalised GTIN/barcode where present and by brand, identity and pack facts otherwise. Use an explicit review/merge workflow for uncertain duplicates; string similarity is not sufficient evidence to merge stock or history.

New tenant-created Products remain pending for main marketplace publication. An active tenant SubProduct can be sold internally and on permitted tenant venue-menu surfaces according to existing pending-product policy. Main catalogue approval and tenant menu publication are separate checks. No pending Product may appear through `/shop`, central search or aggregated marketplace offers.

Add explicit channel eligibility so approved food does not accidentally flood the beverage shop. Marketplace approval alone does not enable a venue-only item for delivery.

## 3. Where each piece of data belongs

| Owner | Fields/responsibility |
|---|---|
| Product | Kind, canonical name, brand, imagery, beverage facts where applicable, approval and central publication |
| SubProduct/Size | Tenant, selling/cost price, portion/variant identity, sellability, existing pricing rules |
| Menu | Tenant, location(s), sections, service periods, version and publication |
| MenuItem | SubProduct reference, display text/image, category, serving choices, modifier groups, station/course and visibility |
| RecipeVersion | Tenant, output SubProduct/Size, ingredient/component quantities, yield, method and costing version |
| Ingredient profile | Existing stock item reference, measurement conversions, allergen source and perishability |
| Location/channel offer policy | Enabled services, availability schedule and eligible price list |
| Package definition | Sellable package SubProduct, components, included quantities, substitutions and booking entitlements |

No arbitrary `MenuItem.price` overrides. Resolve location/channel pricing through the existing tenant price-list mechanism and SubProduct/Size prices. Modifier upcharges use explicit priced items. Snapshot the final result on a quoted bill line.

Preserve beverage facts for beverages: alcohol flag, ABV, serving volume, origin, flavour notes, shelf life and barcode where available. Distinguish unknown ABV from zero. Prepared beverages without retail barcodes use an internal SKU; never fabricate a manufacturer barcode. Food uses portion weight, ingredients, allergens and dietary claims rather than a false ABV/volume requirement.

## 4. Menus and modifiers

Support breakfast, lunch, dinner, drinks, happy hour, event-only and late-night menus. Each has location scope, local service times, date exceptions, publication and ordering channels. A customer may browse a menu outside ordering hours, but the CTA must explain the next available service.

Modifiers need required/optional flags, minimum and maximum selections, valid serving sizes, incompatible combinations, priced extras and recipe consequences. “Remove peanuts” is not proof a dish becomes allergen-free. Staff must receive the customer's note and the known allergen warning.

Example: a gin cocktail offers single/double, tonic/soda, and optional extra garnish. The recipe determines how much gin and mixer each choice uses. A free-text note cannot introduce an unpriced extra bottle.

Availability combines published menu, location/channel eligibility, service time, item suspension, preparation capacity, component stock and reservation quantities. “Sold out for tonight” is an operational override with actor, reason and expiry.

## 5. Units, yields and recipes

Use a controlled unit model: count, volume in ml and mass in g. Convert within the same dimension using exact factors and fixed precision. Do not convert grams to millilitres without a validated item-specific factor. Procurement packs have explicit content: e.g. one carton contains six 750 ml bottles.

An opened bottle is a stock transformation: sealed count decreases and tracked usable volume increases in the same transaction. It does not create another 750 ml while leaving the sealed bottle sellable. Each opened-stock record references its source stock/batch, location, opening time and remaining usable amount.

Illustration: a 750 ml bottle supports at most fifteen 50 ml pours before loss. Two pours consume 100 ml; a recorded 20 ml spill leaves 630 ml. A default “14 shots per bottle” would hide unexplained loss; configure and record expected yield separately from actual waste.

Recipes are versioned and include base quantities, batch yield, loss assumptions, modifiers and effective dates. Freeze the version and component quantities when a line is accepted for preparation. Later recipe changes affect new lines, not work already fired.

Give every accepted service line a stable `lineId` and freeze its quoted price, serving, choices, seat/course and station. Two cocktails with different modifiers cannot collapse into one line merely because Product and Size match. Stations advance their own assigned items; the containing round's state is derived from its items, so the bar cannot mark an unprepared kitchen dish served.

For a prep batch, consume raw ingredients once when producing the batch; serving consumes the batch output. Never consume both the raw recipe and the prepared batch again for the same dish. Defer complex multi-level production until this basic traceability works.

## 6. Inventory lifecycle

1. Receive purchases through existing procurement, stock and batch services, scoped to Tenant and location.
2. Transfer stock to a bar/kitchen location with source and destination acknowledgement; never move stock by changing only a menu setting.
3. Reserve near-term components when an order is accepted; future reservations have a documented procurement policy rather than locking months of current perishable stock.
4. Consume recipe components when preparation starts, or a sealed item when issued. Store an immutable consumption event keyed to bill line and preparation action.
5. Serving or payment must recognise that consumption and avoid a second stock deduction.
6. Cancel before preparation: release reservations. Cancel after preparation: retain consumption and record waste/return outcome with approval.
7. Refund money separately from stock. Only physically reusable sealed goods may be restocked through a validated return movement.
8. Close the shift with expected versus observed stock and approved variance adjustments.

Use MongoDB transactions for dependent stock transformations on a supported replica-set deployment. A unique business-effect key prevents retry duplication. Existing “deduct at POS settlement” logic needs an adapter for already-consumed recipe lines before recipe sales are enabled.

## 7. Packages and substitutions

A VIP offer may combine a table allocation, one package SubProduct, two sealed bottles and four mixers. Keep the table capacity claim and physical component reservation distinct but coordinated. If either fails, release the other or enter a visible compensation state.

Included stock must be represented by component lines with an explicit price allocation, even if the receipt groups them under one package. A package cannot consume one bottle of stock while the individual bottle line consumes the same bottle again.

Use explicit substitution groups. A replacement with different price, allergens or alcohol content requires a new quote and customer/staff confirmation. Never silently swap a premium bottle to make stock balance.

Exclude bottle custody, customer-owned bottles, corkage and complex banquet production from the first release. Add their fee, liability and stock rules explicitly before offering them.

## 8. Costing and reporting

Show current estimated recipe cost, frozen cost at consumption, ingredient variance, yield, waste, portion margin and stock coverage. Unknown costs remain unknown. Tips, tax and unapplied deposits do not improve food or beverage margin.

AI is optional after clean data exists: a tenant-scoped forecasting job could use XGBoost with booking counts, service day and sell-through to suggest replenishment. An `all-MiniLM-L6-v2` embedding index could help match menu text to candidate catalogue items, with deterministic identity checks and human approval. Neither model may certify allergens, invent ABV, merge Products automatically or place purchase orders without approval.

## 9. Reference-feature integration

Apply [R08 service presets and R09/R10 station routing](10-restaurant-integration.md) as context around existing item/price/recipe identities. Presets select approved price/tax references; category routing selects stations; neither creates another stock pool or price master. Transfers preserve fired quantities and consumption references. A remake after a preparation correction is a new explicitly authorised consumption event.

Apply [N08/N09 experience and upgrade rules](11-nightlife-integration.md) to package components and service/admission entitlements. Public offers, a concierge message and the staff POS must resolve the same package inclusions and availability; importing a reference product name is never a substitute for a valid owned SubProduct.
