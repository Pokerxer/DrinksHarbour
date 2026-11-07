// server/__tests__/industryScope.test.js
//
// Industry-scope expansion of the taxonomy (2026-11-02, additive; canon
// 2026-11-02 in the plan-entitlements-billing workstream). Pins:
//   • resolveTenantIndustries precedence (explicit > businessType > null);
//   • Category/SubCategory models accept an additive `industry` enum and stay
//     valid with it absent (legacy/global);
//   • the registry's industry declarations are consistent (see also
//     __tests__/productTypeRegistry.test.js);
//   • the pure Mongo predicate (categoryIndustryFilter) and its flag OFF path;
//   • the product WRITE boundary semantics via the pure allow/deny helpers
//     consumed by services/product.service.js + subproduct.service.js
//     (the wiring itself is gated on INDUSTRY_TAXONOMY_SCOPE_ENABLED);
//   • Tenant.businessType stays additive and `industries` validates members;
//   • the industriesForProductType prefix matrix.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const industries = require('../constants/industries');
const taxonomy = require('../constants/marketplaceTaxonomy');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Tenant = require('../models/Tenant');

// ─── resolveTenantIndustries precedence ──────────────────────────────────────

test('explicit tenant.industries wins over businessType', () => {
  const profile = industries.resolveTenantIndustries({
    industries: ['beverage'],
    businessType: 'Fashion Retail', // derived would be ['fashion']
  });
  assert.deepStrictEqual(profile, ['beverage']);
});

test('derived-from-businessType is second; every mapped business type is exact', () => {
  const expectations = {
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
  };
  for (const [businessType, expected] of Object.entries(expectations)) {
    assert.deepEqual(
      industries.resolveTenantIndustries({ businessType }),
      expected,
      businessType
    );
    assert.deepEqual(
      industries.deriveIndustriesFromBusinessType(businessType),
      expected,
      businessType
    );
  }
});

test("'Other', unmapped and missing tenants resolve to null (see everything)", () => {
  assert.equal(industries.resolveTenantIndustries({ businessType: 'Other' }), null);
  assert.equal(industries.resolveTenantIndustries({}), null);
  assert.equal(industries.resolveTenantIndustries({ industries: [] }), null);
  assert.equal(industries.resolveTenantIndustries(null), null);
  assert.equal(industries.deriveIndustriesFromBusinessType('Other'), null);
  assert.equal(industries.deriveIndustriesFromBusinessType(undefined), null);
});

// ─── Category / SubCategory model validation ─────────────────────────────────

const categoryBuild = (overrides = {}) =>
  new Category({
    name: 'Industry Scope Test',
    slug: `industry-scope-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    type: 'wine',
    alcoholCategory: 'alcoholic',
    ...overrides,
  });

const subCategoryBuild = (overrides = {}) =>
  new SubCategory({
    name: 'Industry Scope Sub Test',
    slug: `industry-scope-sub-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    parent: new mongoose.Types.ObjectId(),
    ...overrides,
  });

test('Category: legacy absence is valid; valid industry values validate', async () => {
  const legacy = categoryBuild();
  await assert.doesNotReject(legacy.validate());
  assert.strictEqual(legacy.industry, undefined, 'absence stays absence (no default)');

  for (const value of industries.INDUSTRY_VALUES) {
    const doc = categoryBuild({ industry: value });
    await assert.doesNotReject(doc.validate(), value);
  }
});

test('Category: an unknown industry value is rejected', async () => {
  const doc = categoryBuild({ industry: 'grocery' });
  await assert.rejects(doc.validate(), /industry/i);
});

test('SubCategory: same rules — absence valid, values valid, unknown rejected', async () => {
  const legacy = subCategoryBuild();
  await assert.doesNotReject(legacy.validate());
  assert.strictEqual(legacy.industry, undefined);

  for (const value of ['food-service', 'hospitality']) {
    const doc = subCategoryBuild({ industry: value });
    await assert.doesNotReject(doc.validate(), value);
  }
  const bad = subCategoryBuild({ industry: 'digital' });
  await assert.rejects(bad.validate(), /industry/i);
});

// ─── Registry / model consistency ────────────────────────────────────────────

test('taxonomy category industries are declared and valid', () => {
  // Categories inherit their vertical industry unless the registry gives
  // them a distinct scope, such as hospitality consumables.
  const hospitalitySlugs = new Set(['shisha-and-hookah', 'cigars-and-tobacco', 'venue-merchandise']);
  const verticalBySlug = new Map(taxonomy.CATEGORY_HORIZONTALS.map((v) => [v.slug, v.industry]));
  for (const category of taxonomy.categories) {
    const expectedIndustry = hospitalitySlugs.has(category.slug) ? 'hospitality' : verticalBySlug.get(category.verticalSlug);
    assert.equal(category.industry, expectedIndustry, category.slug);
    assert.ok(industries.INDUSTRY_VALUES.includes(category.industry), category.slug);
  }
  const counts = taxonomy.categories.reduce((m, c) => {
    m[c.verticalSlug] = (m[c.verticalSlug] || 0) + 1;
    return m;
  }, {});
  assert.deepStrictEqual(counts, {
    electronics: 9, fashion: 8, beauty: 7, 'home-living': 11, 'food-service': 17,
  });
});

// ─── Pure write-boundary helpers (consumed by product write paths) ──────────

test('categoryAllowedInIndustries: legacy/global always allowed, mismatch denied', () => {
  const beverage = ['beverage'];
  assert.equal(industries.categoryAllowedInIndustries({ industry: 'electronics' }, beverage), false);
  assert.equal(industries.categoryAllowedInIndustries({ industry: 'beverage' }, beverage), true);
  assert.equal(industries.categoryAllowedInIndustries({ /* legacy: no industry */ }, beverage), true);
  assert.equal(industries.categoryAllowedInIndustries({ industry: undefined }, beverage), true);
  // legacy tenant profile (null) allows everything
  assert.equal(industries.categoryAllowedInIndustries({ industry: 'electronics' }, null), true);
});

test('subCategoryAllowedInIndustries: own industry, then parent fallback when absent', () => {
  const beverage = ['beverage'];
  // Own industry inside the profile → allowed (parent irrelevant).
  assert.equal(industries.subCategoryAllowedInIndustries({ industry: 'beverage' }, { industry: 'electronics' }, beverage), true);
  // Own industry outside → denied.
  assert.equal(industries.subCategoryAllowedInIndustries({ industry: 'electronics' }, null, beverage), false);
  // Own absent → parent's rule decides.
  assert.equal(industries.subCategoryAllowedInIndustries({ }, { industry: 'electronics' }, beverage), false);
  assert.equal(industries.subCategoryAllowedInIndustries({ }, { }, beverage), true);
  assert.equal(industries.subCategoryAllowedInIndustries({ }, null, beverage, ), true, 'absent sub + no parent = legacy/global');
  // profiled industries that do exist but empty → treated as legacy bypass by callers
  assert.equal(industries.subCategoryAllowedInIndustries({ industry: 'electronics' }, null, []), false);
});

test('a beverage tenant cannot attach an electronics category; a legacy tenant can', () => {
  // The exact composition product.service.js performs on tenant writes.
  const tenantWrite = (categoryDoc, resolveIndustries) => {
    const inds = resolveIndustries();
    if (!Array.isArray(inds)) return true; // legacy tenant / platform admin bypass
    return industries.categoryAllowedInIndustries(categoryDoc, inds);
  };

  const beverage = () => industries.resolveTenantIndustries({ businessType: 'Wine Merchant' });
  const legacy = () => industries.resolveTenantIndustries({ businessType: 'Other' });

  assert.equal(tenantWrite({ industry: 'electronics' }, beverage), false, 'wine merchant blocked from electronics');
  assert.equal(tenantWrite({ industry: 'beverage' }, beverage), true);
  assert.equal(tenantWrite({ }, beverage), true, 'legacy/global category visible to profiled tenants too');
  assert.equal(tenantWrite({ industry: 'electronics' }, legacy), true, 'legacy tenant not restricted');
});

// ─── Flag OFF / enabled() ────────────────────────────────────────────────────

test('the flag defaults OFF and every predicate path is flag-gated upstream', () => {
  // When INDUSTRY_TAXONOMY_SCOPE_ENABLED is unset the scope must be inert.
  const saved = process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED;
  delete process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED;
  try {
    assert.equal(industries.enabled(), false);
    // The contract: callers gate on enabled(); the helper below must NOT be
    // reached when enabled() is false. Simulate the controller call point:
    const gateApply = (req, filter) => (industries.enabled() && req ? filter : null);
    assert.equal(gateApply({ user: null }, industries.categoryIndustryFilter(['beverage'])), null);
  } finally {
    if (saved !== undefined) process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED = saved;
  }
});

test('categoryIndustryFilter matches legacy-absent + in-profile and drops for null', () => {
  const predicate = industries.categoryIndustryFilter(['beverage', 'hospitality']);
  assert.deepEqual(predicate, {
    $or: [
      { industry: { $exists: false } },
      { industry: null },
      { industry: { $in: ['beverage', 'hospitality'] } },
    ],
  });
  // Unprofiled tenant → NO filter.
  assert.equal(industries.categoryIndustryFilter(null), null);
  assert.equal(industries.categoryIndustryFilter([]), null);
});

// ─── Tenant model: additive businessType + industries array ─────────────────

test('Tenant.businessType keeps legacy values and gains the five retail ones', () => {
  const values = Tenant.schema.path('businessType').enumValues;
  for (const legacy of ['Wine Merchant', 'Spirit Importer', 'Beverage Brand', 'Liquor Store',
    'Bar / Lounge', 'Nightclub / Club', 'Restaurant', 'Hotel', 'Distributor', 'Other']) {
    assert.ok(values.includes(legacy), legacy);
  }
  for (const added of ['Fashion Retail', 'Electronics Retail', 'Beauty & Skincare', 'Home & Living', 'General Retail']) {
    assert.ok(values.includes(added), added);
  }
});

test('Tenant.industries accepts valid arrays and rejects unknown members', async () => {
  const build = (industriesValue) => new Tenant({
    name: 'Industry Tenant',
    slug: `industry-tenant-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    status: 'approved',
    revenueModel: 'commission',
    industries: industriesValue,
  });

  const doc = build(['beverage', 'food-service']);
  await assert.doesNotReject(doc.validate());
  assert.deepStrictEqual([...doc.industries], ['beverage', 'food-service']);

  // Default/not-yet-profiled state.
  const empty = build();
  await assert.doesNotReject(empty.validate());
  assert.deepStrictEqual(empty.industries, []);

  const bad = build(['grocery']);
  await assert.rejects(bad.validate(), /`grocery`/);
});

// ─── Product-type → industry prefix matrix ───────────────────────────────────

test('industriesForProductType: prefixed vertical types resolve to exactly one industry', () => {
  assert.deepEqual(industries.industriesForProductType('electronics_phone'), ['electronics']);
  assert.deepEqual(industries.industriesForProductType('fashion_dress'), ['fashion']);
  assert.deepEqual(industries.industriesForProductType('beauty_skincare'), ['beauty']);
  assert.deepEqual(industries.industriesForProductType('home_kitchen'), ['home']);
  assert.deepEqual(industries.industriesForProductType('foodservice_produce'), ['food-service']);
  assert.deepEqual(industries.industriesForProductType('hospitality_cigar'), ['hospitality']);
});

test('industriesForProductType: beverages are scoped; shared and unknown types stay global', () => {
  assert.deepEqual(industries.industriesForProductType('wine'), ['beverage']);
  assert.equal(industries.industriesForProductType('gift_set'), null);
  assert.equal(industries.industriesForProductType('womens_dress'), null);
  assert.equal(industries.industriesForProductType(undefined), null);
  assert.equal(industries.industriesForProductType(42), null);
});

// ─── Seed script contract: the backfill flag parses and stays preview-safe ───

test('seed-marketplace-taxonomy: --backfill-industry is a supported argument (source-level)', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../scripts/seed-marketplace-taxonomy'), 'utf8');
  assert.ok(source.includes("'--backfill-industry'") || source.includes('--backfill-industry'),
    'the additive operator step must exist');
  assert.match(source, /backfillIndustry/);
  assert.match(source, /industry: \{ \$exists: false \}/, 'only ABSENT industry fields are backfilled');
});
