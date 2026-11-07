'use strict';
// Additive product catalog kinds (docs/saas/venues/03-products-inventory.md §2).
// 'beverage' is the legacy default: products created before this field exists
// behave exactly as before.
// DRI-5 (2026-11-05): the /platform marketplace (public /api/products listing
// + every public strip) is beverage-only. Retail-kind stock sells through
// tenant store surfaces, never the platform marketplace.
// Venue kinds are additionally sellable through tenant venue menus/service.
const { isBeverageType } = require('./productTypes');
// Retail vertical prefix rule — SAME source the supply-category registry uses
// (config/marketCategories.js) so the two mappings can never drift apart.
// hospitalityTypes joins KINDS.retail too (2026-11-02): shisha/cigar stock is
// sellable through tenant store surfaces (never the beverage-only platform
// marketplace; venue menus gate such items via isVenueServiceProduct, which
// still excludes the retail kind).
const {
  retailTypes, hospitalityTypes, RETAIL_TYPE_PREFIXES, CATERING_SUPPLY_PREFIXES,
} = require('./generalProductTypes');
const RETAIL_TYPE_VALUES = new Set([...retailTypes, ...hospitalityTypes].map(t => t.value));
// The 'hospitality_' family shares KINDS.retail even though its SUPPLY
// category is 'hospitality' (two different registries, two different
// dimensions) — extend the retail-kind prefix rule with it. The 'foodservice_'
// family deliberately splits off: procurement stock is an ingredient-kind
// good, not a retail sellable on shop surfaces via the retail channel.
const KIND_RETAIL_PREFIXES = [...RETAIL_TYPE_PREFIXES, 'hospitality_'];
const FOODSERVICE_SUPPLY_PREFIX = CATERING_SUPPLY_PREFIXES[0]; // 'foodservice_'
const KINDS = {
  beverage: 'beverage',
  prepared_beverage: 'prepared_beverage',
  prepared_food: 'prepared_food',
  ingredient: 'ingredient',
  consumable: 'consumable',
  // General retail verticals (Electronics/Fashion/Beauty/Home, additive
  // 2026-11-02). Sellable through tenant store surfaces (DRI-5: never on the
  // beverage-only platform marketplace); NEVER venue-serviceable
  // (isVenueCatalogKind excludes it, and retail types fail isBeverageType
  // anyway).
  retail: 'retail',
};
const VALUES = Object.values(KINDS);
const RETAIL_KINDS = [KINDS.beverage, KINDS.retail];
const VENUE_KINDS = [KINDS.beverage, KINDS.prepared_beverage, KINDS.prepared_food];
const isRetailCatalogKind = (kind) => RETAIL_KINDS.includes(kind || KINDS.beverage);
const isVenueCatalogKind = (kind) => VENUE_KINDS.includes(kind || KINDS.beverage);
// Venue service eligibility for a Product document (docs/saas/venues/03 §2:
// kind governs channel). Legacy docs without catalogKind default to beverage
// and must still pass the beverage-type taxonomy; genuinely prepared items
// (prepared_beverage/prepared_food) bypass it. ingredient/consumable kinds and
// non-beverage legacy types stay excluded. Null-safe: null/missing product is
// never eligible. Single source of truth for venue gating — pricing.js
// assertVenueProduct and menu-candidates.js must not drift apart.
const isVenueServiceProduct = (product) => {
  if (!product || catalogKindForType(product.type) !== KINDS.beverage) return false;
  const kind = product.catalogKind || KINDS.beverage;
  return (isBeverageType(product.type) && isVenueCatalogKind(kind))
    || kind === KINDS.prepared_beverage
    || kind === KINDS.prepared_food;
};
// Retail-sellability clause for TENANT STORE surfaces (searchProducts with
// catalogChannel 'store'): legacy docs (no catalogKind) match as beverages,
// plus the retail kind. Tenant storefronts sell retail kinds per DRI-4.
const retailWhereClause = () => ({ $or: [{ catalogKind: { $exists: false } }, { catalogKind: { $in: RETAIL_KINDS } }] });
// Beverage-only clause for the PLATFORM MARKETPLACE surfaces (DRI-5,
// 2026-11-05): public /api/products listing, every public strip, sitemap
// slugs/facet counts, related/new-arrival feeds and chatbot shopping
// discovery all match legacy docs (catalogKind absent = beverage) and
// beverage-kind docs only. The retail kind must never leak through here;
// retail stock sells via tenant stores (retailWhereClause above).
const marketplaceWhereClause = () => ({ $or: [{ catalogKind: { $exists: false } }, { catalogKind: KINDS.beverage }] });
// Pure type→kind mapping (additive 2026-11-02). Creation services adopt this
// instead of hard-coding 'beverage'. Matrix:
//   electronics_*/fashion_*/beauty_*/home_*  → KINDS.retail  (prefix rule)
//   hospitality_*                            → KINDS.retail  (prefix rule,
//     2026-11-02 — sellable lounge/club stock: shisha kits, molasses,
//     charcoal, cigars; the supply category is 'hospitality')
//   foodservice_*                            → KINDS.ingredient (2026-11-02 —
//     PROCUREMENT stock restaurants/bars buy; not a shop-surface retail good)
//   gift/food/venue/prepared legacy types    → KINDS.beverage (unchanged
//     semantics — kind assignment for prepared items is a document field, not
//     a type mapping; isVenueServiceProduct logic is untouched. NOTE:
//     prepared_food REMAINS A KIND — restaurant menu items keep using the
//     venue-serving machinery; no prepared_food Product.type was added this
//     round, the venue docs' model governs)
//   unknown / missing type                   → KINDS.beverage (legacy-identical)
const catalogKindForType = (type) => {
  if (RETAIL_TYPE_VALUES.has(type)) return KINDS.retail;
  if (typeof type === 'string' && KIND_RETAIL_PREFIXES.some((prefix) => type.startsWith(prefix))) return KINDS.retail;
  if (typeof type === 'string' && type.startsWith(FOODSERVICE_SUPPLY_PREFIX)) return KINDS.ingredient;
  return KINDS.beverage;
};
// DRI-9 (2026-11-05): the public product-DETAIL endpoint follows the same
// surface split as the listing feeds (DRI-5). Public /api/products/slug/:slug
// serves TWO surfaces inside the platform app: the beverage-only main
// marketplace (drinksharbour.com) and tenant storefront subdomains. The
// platform middleware flags the latter with `x-is-tenant-site: true`; every
// transport without that flag defaults to the main-marketplace surface.
// Admin surfaces use product-ID endpoints and never pass through this gate.
const DETAIL_SURFACES = { MARKETPLACE: 'marketplace', TENANT_SITE: 'tenant-site' };
// True when the Product must NOT assemble buy offers on the main-marketplace
// detail surface. A document's explicit `catalogKind` wins when it is a known
// kind; legacy documents without one map from `type` (same convention as
// everywhere above: absent catalogKind = beverage per the type taxonomy —
// which can still be the retail kind when the document was created via the
// retail verticals but the field never got persisted).
const blocksMarketplaceBuyOffers = (product) => {
  if (!product) return false;
  const kind = (product.catalogKind && VALUES.includes(product.catalogKind))
    ? product.catalogKind
    : catalogKindForType(product.type);
  return kind === KINDS.retail;
};
module.exports = { KINDS, VALUES, RETAIL_KINDS, VENUE_KINDS, isRetailCatalogKind, isVenueCatalogKind, isVenueServiceProduct, retailWhereClause, marketplaceWhereClause, catalogKindForType, DETAIL_SURFACES, blocksMarketplaceBuyOffers };
