'use strict';
const { isBeverageType } = require('./productTypes');
// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRIES (2026-11-02 vertical expansion — single source of truth).
//
// CONFIG: `INDUSTRY_TAXONOMY_SCOPE_ENABLED === 'true'` activates industry
// scoping of the catalogue taxonomy. When OFF (the default) every existing
// list/behaviour stays byte-identical. When ON it is consumed at exactly these
// call points:
//   • controllers/category.controller.js + subcategory.controller.js — the
//     public list endpoints scope Categories/SubCategories for authenticated
//     TENANT callers (see services/industryScope.service.js) to what
//     resolveTenantIndustries(tenant) returns; platform admins and anonymous
//     callers are never filtered.
//   • services/product.service.js — create/update category/subCategory writes
//     on tenant paths reject a category outside the tenant's industry profile.
//   • controllers/erm.controller.js (GET /api/erm/status) — additive
//     `industries` on the status payload so client forms can render
//     industry-aware pickers.
// scripts/seed-marketplace-taxonomy.js --backfill-industry writes the registry
// industry values onto existing Category/SubCategory documents (see
// constants/marketplaceTaxonomy.js). A missing `industry` field is ALWAYS
// legacy/global: visible to every business. There is deliberately NO support
// for 'software'/'digital'/'grocery' — digital-goods product lifecycles are a
// deferred design requirement and grocery is meant to ride beverage/
// consumables.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical industry values. Category.industry / SubCategory.industry are
 * String enums of these; Tenant.industries is an additive array of these.
 */
const INDUSTRY_VALUES = Object.freeze([
  'beverage', 'hospitality', 'food-service', 'electronics', 'fashion', 'beauty', 'home',
]);

/** Tenant business types → default industry profile (canonical map). */
const BUSINESS_TYPE_INDUSTRY_MAP = Object.freeze({
  'Wine Merchant': ['beverage'],
  'Spirit Importer': ['beverage'],
  'Beverage Brand': ['beverage'],
  'Liquor Store': ['beverage'],
  'Distributor': ['beverage'],
  'Bar / Lounge': ['beverage', 'hospitality', 'food-service'],
  'Nightclub / Club': ['beverage', 'hospitality', 'food-service'],
  'Restaurant': ['food-service', 'hospitality', 'beverage'],
  'Hotel': ['food-service', 'hospitality', 'beverage'],
  'Fashion Retail': ['fashion'],
  'Electronics Retail': ['electronics'],
  'Beauty & Skincare': ['beauty'],
  'Home & Living': ['home'],
  'General Retail': ['fashion', 'electronics', 'beauty', 'home'],
  // 'Other' / unmapped BUSINESS TYPES are NOT in the map on purpose:
  // they resolve to null = unprofiled/legacy → see everything.
});

/**
 * Derive an industry profile from a Tenant.businessType.
 * @returns {string[]|null} industries, or null when the business type is
 *   'Other' or unmapped (meaning "unprofiled/legacy: see everything").
 */
const deriveIndustriesFromBusinessType = (businessType) =>
  BUSINESS_TYPE_INDUSTRY_MAP[businessType] || null;

/**
 * Resolve the effective industry profile for a Tenant document (or plain
 * object with `industries` / `businessType`). Precedence, in order:
 *   1. tenant.industries — an explicitly saved, non-empty INDUSTRY array;
 *   2. deriveIndustriesFromBusinessType(tenant.businessType);
 *   3. null — unprofiled/legacy → see everything (never filter).
 */
const resolveTenantIndustries = (tenant) => {
  if (!tenant) return null;
  if (Array.isArray(tenant.industries)) {
    const explicit = tenant.industries.filter((v) => INDUSTRY_VALUES.includes(v));
    if (explicit.length) return Object.freeze(explicit.slice());
  }
  return deriveIndustriesFromBusinessType(tenant.businessType);
};

/**
 * Mongo predicate matching documents inside an industry profile, INCLUDING
 * legacy/global documents (no `industry` field). Thin arrays/unprofiled
 * tenants have no predicate.
 *
 * @param {string[]|null} industries — resolved tenant industries
 * @returns {object|null} Mongo predicate, or null meaning "apply no filter".
 */
const categoryIndustryFilter = (industries) => {
  if (!Array.isArray(industries) || industries.length === 0) return null;
  return {
    $or: [
      { industry: { $exists: false } }, // legacy/global: visible to every business
      { industry: null },
      { industry: { $in: industries } },
    ],
  };
};

/** Category documents are allowed when legacy (absent) or inside the profile. */
const categoryAllowedInIndustries = (doc, industries) =>
  !Array.isArray(industries) || !doc || doc.industry == null ||
  industries.includes(doc.industry);

/**
 * SubCategory write rule (categoryIndustryFilter's list rule + parent
 * fallback): allowed when its own industry is inside the profile, OR absent —
 * and when absent, the PARENT category's rule decides (parent absent/global →
 * allowed; parent outside the profile → rejected).
 */
const subCategoryAllowedInIndustries = (sub, parent, industries) => {
  if (!Array.isArray(industries)) return true;
  if (!sub) return false;
  if (sub.industry != null) return industries.includes(sub.industry);
  return categoryAllowedInIndustries(parent, industries);
};

/**
 * Product-type → industry metadata (prefix rule). The admin forms agent
 * mirrors this map client-side; the server uses it only additively.
 * Recognized prefixless beverage types belong to the beverage business.
 */
const TYPE_INDUSTRY_PREFIX_MAP = Object.freeze({
  electronics_: ['electronics'],
  fashion_: ['fashion'],
  beauty_: ['beauty'],
  home_: ['home'],
  foodservice_: ['food-service'],
  hospitality_: ['hospitality'],
});

/**
 * @param {string} type — a product type value
 * @returns {string[]|null} industries owning the type, or null when the type
 *   is unlisted/shared (gift families, unknown values) meaning "all".
 */
const industriesForProductType = (type) => {
  if (typeof type !== 'string') return null;
  if (isBeverageType(type)) return ['beverage'];
  for (const [prefix, inds] of Object.entries(TYPE_INDUSTRY_PREFIX_MAP)) {
    if (type.startsWith(prefix)) return inds;
  }
  return null;
};

/**
 * The scope flag. Pure `enabled()` helper, mirroring
 * constants/catalogScope.js / services/marketContext.js. When false every
 * consumer must behave exactly as before this module existed.
 */
const enabled = () => process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED === 'true';

module.exports = Object.freeze({
  INDUSTRY_VALUES,
  BUSINESS_TYPE_INDUSTRY_MAP,
  TYPE_INDUSTRY_PREFIX_MAP,
  enabled,
  deriveIndustriesFromBusinessType,
  resolveTenantIndustries,
  categoryIndustryFilter,
  categoryAllowedInIndustries,
  subCategoryAllowedInIndustries,
  industriesForProductType,
});
