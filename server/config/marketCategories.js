'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Supply-category registry (docs/audits/general-saas-evolution).
//
// The platform sells tenants' canonical offers through marketplace and
// storefront channels; enrollment and category policy are scoped by supply
// category. This is the single place that maps product types to those
// categories. services/marketIngress.js delegates here.
//
// The catalogue identity (Product/SubProduct/Size) and every commerce engine
// (stock, money, fulfillment) are category-neutral: a general ecommerce surface
// showing tenants' canonical offers and per-category vertical systems are
// presentation choices over the same engines. Registering a NEW vertical here
// makes the TYPE MAPPING config; the operational gates behind a new category
// (MarketCategoryPolicy bodies, channel economics, moderation, and the market
// eligibility categories marketCatalog derives from this registry) are
// decisions, not a data edit (see backlog D5 / architecture.md §9).
//
// FALLBACK_CATEGORY covers every product type not listed below. 'beverage' is
// intentionally NOT in any list: it stays a fallback and cannot be shadowed by
// a future list mistake.
//
// The ValidationError class matches the original marketIngress contract so
// callers (e.g. listingFilter) keep mapping to HTTP 400, not a masked 500.
const { ValidationError } = require('../utils/errors');
// Retail vertical types + PREFIX RULE come from constants/generalProductTypes.js
// (single source; the registry integrity test in
// __tests__/productTypeRegistry.test.js asserts no drift between the enumerated
// list and the prefix rule).
const { retailTypes, hospitalityTypes, foodserviceTypes, RETAIL_TYPE_PREFIXES, CATERING_SUPPLY_PREFIXES } = require('../constants/generalProductTypes');

const FALLBACK_CATEGORY = 'beverage';

/** Registered verticals: product type → category, in stable order. Frozen. */
const typesByCategory = Object.freeze({
  // Gifts & gifting economy (gift checkout, hampers, baskets).
  gift: Object.freeze(['gift', 'gift_set', 'subscription_box']),
  // Prepared/food service (for marketplace pickup listings via venue menus).
  food: Object.freeze(['snack', 'food', 'prepared_food']),
  // General retail verticals (Electronics/Fashion/Beauty/Home, 2026-11-02,
  // additive). The ENUMERATED list matters even though categoryForType also
  // applies the prefix rule below: services/marketCatalog.js derives its
  // offerStages $switch branches from typesByCategory entries, so every
  // vertical type must appear here to be routable on marketplace surfaces.
  // The beverage FALLBACK covers everything else (e.g. 'womens_dress', which
  // is not a registered type even though fashion_dress now exists — pinned in
  // __tests__/marketCategories.test.js; beverage/gift/food cases stay pinned
  // in __tests__/marketFoundation.test.js).
  retail: Object.freeze(retailTypes.map(t => t.value)),
  // Food Service & Venue verticals (2026-11-02, additive). ONE supply
  // category for BOTH catering prefixes: procurement stock (foodservice_*)
  // and sellable venue stock (hospitality_*). catalogKind splits them into
  // ingredient vs retail kinds; the supply category dimension keeps them
  // together so market enrollment/policy is one decision. Same enumerated-
  // list requirement as retail: the list matters even though categoryForType
  // also applies the CATERING prefix rule below, because marketCatalog
  // derives its offerStages $switch branches from these entries. Fail-closed
  // semantics are unchanged: the beverage FALLBACK still covers every type
  // not listed/prefixed here, and 'beverage' is never enumerated.
  hospitality: Object.freeze([...hospitalityTypes, ...foodserviceTypes].map(t => t.value)),
});

// Supply categories derive from the registry (fallback included) so a newly
// registered vertical needs no config change to route (marketCatalog).
const categories = Object.freeze([FALLBACK_CATEGORY, ...Object.keys(typesByCategory)]);

// PREFIX RULE (canon 2026-11-02): every type starting with a retail-vertical
// prefix resolves to 'retail', including future values registered only in
// constants/generalProductTypes.js. The catering extension (2026-11-02) maps
// BOTH catering prefixes ('foodservice_' + 'hospitality_') to the
// 'hospitality' category — the beverage FALLBACK is untouched and still covers
// everything fail-closed. The rule is applied AFTER the enumerated lookup so
// legacy gift/food matches keep their exact precedence.
function categoryForType(type) {
  for (const [category, types] of Object.entries(typesByCategory)) {
    if (types.includes(type)) return category;
  }
  if (typeof type === 'string' && RETAIL_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    return 'retail';
  }
  if (typeof type === 'string' && CATERING_SUPPLY_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    return 'hospitality';
  }
  return FALLBACK_CATEGORY;
}

function categoryFor(product) {
  if (!product || typeof product.type !== 'string') {
    throw new ValidationError('Authoritative catalogue product required');
  }
  return categoryForType(product.type);
}

module.exports = Object.freeze({ FALLBACK_CATEGORY, typesByCategory, categories, categoryForType, categoryFor });
