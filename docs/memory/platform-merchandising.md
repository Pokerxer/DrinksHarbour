# Marketplace merchandising

Marketplace product pages offer a larger size, existing pack pricing,
a comparable premium bottle and a gift checkout entry point. The cart
shows pairings and an editable drink-kit builder. Checkout uses the
current delivery quote to decide whether to offer a top-up.

Offers use published listings and exact seller and size IDs. Cart and
kit additions recheck the selected prices and stock before adding.
Delivery top-ups keep the current sellers and require a fresh quote
before payment. Gift packaging uses the configured published SKU.
The product-detail response includes quantity limits and comparison
fields used by the marketplace. Deploy the API and storefront together.

The [verification handoff](../superpowers/specs/RESUME-platform-merchandising.md)
records the local checks.

The refinement adds cart gift messages and wrapping, exact seller and size
links, offer impressions and refreshed suggestions after stale inventory
or price. Gift text is carried through sign-in by a short-lived browser-tab
draft. The recipe picker also offers rum and cola and a sparkling apple
mocktail when those ingredients are stocked.

Local mobile Chromium verified the editable kit, reduced motion, exact
size link, larger bottle selection, and live six-bottle pack pricing.
Browser tests with controlled API responses verified same-seller pairing,
gift details across sign-in, and delivery repricing after a cart top-up.

The [taxonomy-based cart kit design](../superpowers/specs/2026-11-11-taxonomy-cart-kits-design.md)
describes automatic recipe selection, structured ingredient matching, and
the catalog and cart response fields needed for it. This is a design pass.

Cart kits now use public catalog taxonomy to choose recipes and ingredients.
The cart recognizes Bombay Sapphire from its Gin / London Dry Gin
classification and finds tonic by catalog type, subtype or subcategory.
The automatic prompt requires a purchasable missing ingredient. The same
panel also handles manual recipe selection. Search cards and signed-in
cart lines retain public taxonomy, and legacy guest lines can read it
from product detail.
