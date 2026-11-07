'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Catalogue contract indexes (docs/audits/general-saas-evolution/migration.md §2).
//
// Build authority per index ("one home per index", review 2026-11-02):
//   • SUBPRODUCT_TENANT_PRODUCT_UNIQUE — UNIQUE and deliberately NOT declared
//     on the SubProduct schema: autoIndex must never build it on an
//     unreconciled database. This is the ONLY operator-applied index
//     (scripts/ensure-catalogue-uniqueness.js --apply-uniqueness).
//   • PRODUCT_SCOPE_TENANT_LOOKUP and SIZE_TENANT_SKU_UNIQUE are declared on
//     their schemas (Product.js / Size.js, explicit names matching here) and
//     are auto-built like every other schema index. They are listed here as
//     documentation + used by test fixtures; the operator script only RETIRES
//     the legacy global sizes.sku_1 (after the per-tenant index exists).
// Unique contracts over real data always need duplicate reconciliation first;
// the script's report covers (tenant, product), (tenant, sku) and slug pairs.

// One operational listing per (tenant, product): sizes/variants live on Size
// and aggregate stock lives on this single SubProduct row, so a duplicated row
// would split price/stock/report data (finding F2).
const SUBPRODUCT_TENANT_PRODUCT_UNIQUE = {
  collection: 'subproducts',
  key: { tenant: 1, product: 1 },
  // unique lives in options: createIndex receives exactly this object.
  options: { name: 'tenant_product_unique', unique: true },
  unique: true,
};

// Documentation entry for the SCHEMA-declared per-tenant Size SKU contract
// (one SKU = one sellable stock unit, per tenant, like Size.barcode; two
// tenants may share a producer SKU string). Size.js declares the identical
// name so every environment converges; the legacy global `sku_1` is verified
// and retired by the operator script.
const SIZE_TENANT_SKU_UNIQUE = {
  collection: 'sizes',
  key: { tenant: 1, sku: 1 },
  options: { name: 'tenant_sku_unique', unique: true, partialFilterExpression: { sku: { $gt: '' } } },
  unique: true,
};

// Documentation entry for the SCHEMA-declared product scope lookup.
const PRODUCT_SCOPE_TENANT_LOOKUP = {
  collection: 'products',
  key: { publicationScope: 1, owningTenant: 1 },
  options: { name: 'publication_scope_tenant', sparse: true },
  unique: false,
};

// The legacy cross-tenant index name autoIndex used to create from
// unique:true on the Size.sku field. Retired explicitly per environment —
// recorded here so the operator script can name it and never rebuild it.
const SIZE_GLOBAL_SKU_LEGACY = {
  collection: 'sizes',
  name: 'sku_1',
};

// Operator-applied contracts only: schema-declared indexes are NOT here.
const CATALOGUE_CONTRACT_INDEXES = [SUBPRODUCT_TENANT_PRODUCT_UNIQUE];

module.exports = {
  CATALOGUE_CONTRACT_INDEXES,
  SUBPRODUCT_TENANT_PRODUCT_UNIQUE,
  PRODUCT_SCOPE_TENANT_LOOKUP,
  SIZE_TENANT_SKU_UNIQUE,
  SIZE_GLOBAL_SKU_LEGACY,
};
