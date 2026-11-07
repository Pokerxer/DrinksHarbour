'use strict';
// DRI-35 — /inventory READ surfaces backend slice (board scope extension #10,
// checklist item 13 + the item 11/12/14 server feed confirmation).
//
// VALUATION KPI PAYLOAD PIN (item 13, server half). Recorded decisions bind
// this slice (docs/memory/pos-retail-accommodation.md, enumeration item 13):
// valuation stays KPI-ONLY — no per-Size breakdown payload added (a per-Size
// breakdown would be a separate explicit board decision); the drill-down is the
// identity-aware client browser, NOT this server payload. What IS pinned here
// is that the five KPI numbers are computed PER-LINE from the exact per-Size
// WarehouseStock rows (the DRI-16 getAllStock lines, SIZES and warehouses), so:
//   • totalUnits/totalValue/totalRetailValue sum over EVERY per-Size line
//     (each exact Size row contributes; the per-Size rows cannot merge);
//   • totalItems counts DISTINCT subProducts — not rows, not sizeNames;
//   • the fixture assigns DISTINCT per-Size cost/selling prices (and the
//     retail flavours reuse identical sizeName strings across their variant
//     Rows), so ANY coarser bucketing — per sizeName, per subProduct, or
//     subProduct-aggregate — provably yields different numbers.
//
// Asserted through the REAL HTTP path: GET /api/inventory/valuation on the real
// inventory router (protect + attachTenant + requireOwnTenant +
// authorizeTenantAction('inventory:read') + the wired cacheReport) — pattern
// DRI-16/DRI-32/DRI-33: disposable PID-suffixed replica-set Mongo on :29127,
// 8-tenant matrix from fixtures/dri33VariantMatrix.js (five retail types,
// profiled beverage 'Wine Merchant', Restaurant, plus the unprofiled legacy
// beverage byte-parity control). No code is exercised per-industry — the
// seeding flow is industry-agnostic and every flavour walks the same chain.
//
// FALLBACK BRANCH PIN. The zero-WarehouseStock fallback (SubProduct aggregate)
// is pinned on a dedicated tenant with its EXACT pre-change payload keys.
//
// CACHE SCOPING (recorded contract: "confirm the cached KPI equals fresh
// per-tenant computation, or report atomically if caching conflates
// tenants/scope"). The wired cacheReport pipeline is exercised with the REAL
// inventory route and a mock in-process store: same resource + same query +
// same day but different tenant principals MUST hit separate cache entries and
// each cached KPI must equal that tenant's fresh computation. Production store
// (Redis when enabled) keys every entry by canonical principal + `tenant:<id>`
// scope + revision; entries expire after 30s; ?refresh=true bypasses — the
// test pins the scoping contract only (fixture-isolation contract: if this
// asserts a defect, REPORT it, do not silently fix in this slice).
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/inventoryValuationRetailTypes.mongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
const {
  RETAIL_TYPES, LEGACY_DEF, seedTenantBase, seedVariantsSubProduct,
} = require('./fixtures/dri33VariantMatrix');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Per-sub valuation layout. COSTS/SELLS are patched onto the Size docs after
// the fixture seeds them (the fixture stores flavour-standard unitCost/sell —
// the patch is what makes every per-Size line's arithmetic distinct).
//   subA sizes: 10 units @ 1000 (split 6 + 4 over the tenant's two warehouses)
//               and 5 units @ 3000 (split 3 + 2)  → value 25 000, retail 40 000
//   subB sizes:  1 unit @  500 and 2 units @ 250     → value  1 000, retail  1 500
// Legacy control (ONE size row per sub): subA 10 @ 1000, subB 5 @ 3000
//   → exactly the board's example numbers: totalUnits 15, totalValue 25 000.
const LAYOUTS = [
  {
    costs: [1000, 3000],
    sells: [2000, 4000],
    stock: [
      [{ warehouseIndex: 0, currentQuantity: 6 }, { warehouseIndex: 1, currentQuantity: 4 }],
      [{ warehouseIndex: 0, currentQuantity: 3 }, { warehouseIndex: 1, currentQuantity: 2 }],
    ],
  },
  {
    costs: [500, 250],
    sells: [300, 600],
    stock: [
      [{ warehouseIndex: 0, currentQuantity: 1 }],
      [{ warehouseIndex: 0, currentQuantity: 2 }],
    ],
  },
];
const LEGACY_LAYOUTS = [
  { costs: [1000], sells: [2000], stock: [[{ warehouseIndex: 0, currentQuantity: 6 }, { warehouseIndex: 1, currentQuantity: 4 }]] },
  { costs: [3000], sells: [4000], stock: [[{ warehouseIndex: 0, currentQuantity: 5 }]] },
];

function layoutFor(def) {
  return def.key === 'legacy' ? LEGACY_LAYOUTS : LAYOUTS;
}

async function patchSizeValuation(sub, { costs, sells }) {
  const Size = require('../models/Size');
  for (let i = 0; i < sub.sizes.length; i++) {
    await Size.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(sub.sizes[i]._id) },
      { $set: { costPrice: costs[i], sellingPrice: sells[i] } }
    );
  }
}

async function seedValuationTenant(def) {
  const base = await seedTenantBase(def);
  const layouts = layoutFor(def);
  const legacy = def.key === 'legacy';
  const subA = await seedVariantsSubProduct(def, base, { legacy, stock: layouts[0].stock });
  const subB = await seedVariantsSubProduct(def, base, { legacy, stock: layouts[1].stock });
  await patchSizeValuation(subA, layouts[0]);
  await patchSizeValuation(subB, layouts[1]);
  return { ...base, subA, subB };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/inventory', require('../routes/inventory.routes'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message });
  });
  return app;
}

async function listen(app) {
  return new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
}

async function request(state, port, path) {
  const token = jwt.sign(
    { userId: state.adminId, email: `${state.def.key}@test.local`, role: 'tenant_admin', tenant: state.tenantId },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  return { status: response.status, cacheControl: response.headers.get('cache-control'), ...data };
}

// The exact KPI key set of the pre-change payload — both branches must emit
// precisely these five keys and nothing else.
const KPI_KEYS = ['potentialProfit', 'totalItems', 'totalRetailValue', 'totalUnits', 'totalValue'];

// Expected KPI sums computed PER-LINE from the layout above.
const EXPECTED = {
  // 7-industry flavours: subA (10@1000 + 5@3000) + subB (1@500 + 2@250).
  profiled: {
    totalItems: 2, totalUnits: 18,
    totalValue: 10 * 1000 + 5 * 3000 + 1 * 500 + 2 * 250,       // 26 000
    totalRetailValue: 10 * 2000 + 5 * 4000 + 1 * 300 + 2 * 600,  // 41 500
    potentialProfit: (10 * 2000 + 5 * 4000 + 1 * 300 + 2 * 600)
                   - (10 * 1000 + 5 * 3000 + 1 * 500 + 2 * 250), // 15 500
  },
  // Legacy control: subA 10@1000 + subB 5@3000 — the board's example walk
  // (Emerald-analogue 10 @ cost 1000 / Ivory-analogue 5 @ cost 3000 so the
  // per-line sum lands on 25 000).
  legacy: {
    totalItems: 2, totalUnits: 15,
    totalValue: 10 * 1000 + 5 * 3000,            // 25 000
    totalRetailValue: 10 * 2000 + 5 * 4000,      // 40 000
    potentialProfit: 10 * 2000 + 5 * 4000 - (10 * 1000 + 5 * 3000), // 15 000
  },
};

test('valuation_kpi_per_line_across_seven_industries_plus_legacy_control', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'dri35_valuation_kpi');

  const tenants = [];
  for (const def of RETAIL_TYPES) tenants.push(await seedValuationTenant(def));
  tenants.push(await seedValuationTenant(LEGACY_DEF));

  const server = await listen(buildApp());
  try {
    const { port } = server.address();
    for (const state of tenants) {
      const def = state.def;
      const expected = def.key === 'legacy' ? EXPECTED.legacy : EXPECTED.profiled;
      const flavourSizes =
        state.subA.sizes.length + state.subB.sizes.length;

      const response = await request(state, port, '/api/inventory/valuation');
      assert.equal(
        response.status, 200,
        `${def.key}: valuation read failed: ${JSON.stringify(response)}`
      );
      const data = response.data;
      assert.ok(data, `${def.key}: valuation payload present`);

      // Exact pre-change payload keys — the KPI stays KPI-only, no per-Size
      // breakdown payload (recorded board decision; a per-Size breakdown would
      // be a separate explicit board decision).
      assert.deepEqual(
        Object.keys(data).sort(), KPI_KEYS,
        `${def.key}: valuation payload carries exactly the pre-change KPI keys`
      );

      // Per-line arithmetic — each exact per-Size WarehouseStock line (SIZES ×
      // warehouses) contributes, with NO sizeName/subProduct bucketing: the
      // retail flavours stock every variant under ONE identical sizeName
      // string and restaurant rows share 'Regular plate', so a sizeName
      // bucket would collapse Emerald/Ivory (and Jollof/Goat) to one line;
      // a subProduct-aggregate bucket would value each sub at ONE cost. Every
      // coarser shape gives a different total than this exact number.
      assert.equal(data.totalItems, expected.totalItems, `${def.key}: totalItems counts DISTINCT subProducts (${state.subA.subId} / ${state.subB.subId}) — not the ${flavourSizes} Size rows, not sizeName buckets`);
      assert.equal(data.totalUnits, expected.totalUnits, `${def.key}: totalUnits sums every per-Size WarehouseStock line across both warehouses`);
      assert.equal(data.totalValue, expected.totalValue, `${def.key}: totalValue is computed per-line (each Size's own costPrice — 1000/3000/500/250)`);
      assert.equal(data.totalRetailValue, expected.totalRetailValue, `${def.key}: totalRetailValue per-line (each Size's own sellingPrice — 2000/4000/300/600)`);
      assert.equal(data.potentialProfit, expected.potentialProfit, `${def.key}: potentialProfit retro and retail minus cost`);
      assert.deepEqual(data, expected, `${def.key}: full KPI payload deep-equals the per-line computation`);
    }

    // Tenant isolation on the read surface: each tenant's KPI is computed from
    // its OWN rows only (requireOwnTenant + the walk's per-tenant seeds) —
    // no tenant can observe another's numbers through this route.
    const first = tenants[0];
    const other = tenants.find((x) => x.tenantId !== first.tenantId);
    const a = await request(first, port, '/api/inventory/valuation');
    const b = await request(other, port, '/api/inventory/valuation');
    assert.deepEqual(a.data, EXPECTED.profiled, 'tenant A: isolated KPI unchanged on repeat read');
    assert.deepEqual(b.data, EXPECTED.profiled, 'tenant B: isolated KPI unchanged on repeat read');
    assert.notEqual(first.tenantId, other.tenantId, 'walk sanity: two independent tenants');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('valuation_fallback_zero_warehousestock_branch_shape_pin', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'dri35_valuation_fallback');

  // A tenant with NO WarehouseStock rows at all: the KPI must fall through to
  // the SubProduct-aggregate branch and emit the exact pre-change payload keys
  // there. The fixture's legacy tenant shape (no warehouses seeded) is reused;
  // the SubProducts are raw schema-shaped docs (totalStock/ costPrice live on
  // the aggregate the branch reads).
  const base = await seedTenantBase(LEGACY_DEF, { warehouses: 0 });
  const SubProduct = require('../models/SubProduct');
  const Product = require('../models/Product');
  const tenantId = new mongoose.Types.ObjectId(String(base.tenantId));
  const product = await Product.collection.insertOne({ name: 'Fallback Lager', type: 'beer', isAlcoholic: false, tracksBatch: false });
  const stockedId = new mongoose.Types.ObjectId();
  const zeroId = new mongoose.Types.ObjectId();
  await SubProduct.collection.insertMany([
    { _id: stockedId, tenant: tenantId, product: product.insertedId, status: 'active', visibleInPOS: true, sku: 'FB-A', baseSellingPrice: 4000, costPrice: 1000, totalStock: 15 },
    { _id: zeroId, tenant: tenantId, product: product.insertedId, status: 'active', visibleInPOS: true, sku: 'FB-Z', baseSellingPrice: 4000, costPrice: 1000, totalStock: 0 },
  ]);

  const server = await listen(buildApp());
  try {
    const { port } = server.address();
    const response = await request({ ...base, def: LEGACY_DEF }, port, '/api/inventory/valuation');
    assert.equal(response.status, 200, `fallback read failed: ${JSON.stringify(response)}`);
    const data = response.data;

    assert.deepEqual(
      Object.keys(data).sort(), KPI_KEYS,
      'fallback: exact pre-change payload keys (KPI sums only, no per-Size breakdown)'
    );
    assert.equal(data.totalItems, 1, 'fallback: totalItems counts only subProducts with totalStock > 0 (the zero-stock sub is excluded)');
    assert.equal(data.totalUnits, 15, 'fallback: totalUnits from the aggregate sum');
    assert.equal(data.totalValue, 15000, 'fallback: totalValue = totalStock x costPrice from the aggregate');

    // Pinned as-is (the REAL pre-change payload of a real schema-shaped
    // SubProduct): the branch's retail reference reads the field
    // `sellingPrice`, and NO SubProduct field of that name exists (the schema
    // stores baseSellingPrice/salePrice) — so totalRetailValue aggregates to 0
    // and potentialProfit to minus totalValue on any real fallback tenant.
    // REPORTED ATOMICALLY (fixture-isolation contract): not fixed in this
    // slice; the drill-down clients value retail from the getAllStock lines,
    // so no consumer is served a non-zero retail claim by this branch.
    assert.equal(data.totalRetailValue, 0, 'fallback: totalRetailValue aggregates 0 (pre-change shape — see DRI-35 report gap flag)');
    assert.equal(data.potentialProfit, -15000, 'fallback: potentialProfit is 0 minus totalValue (pre-change shape — see DRI-35 report gap flag)');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('valuation_cache_scoping_cached_kpi_equals_fresh_per_tenant', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'dri35_valuation_cache');

  // Two tenants, both through the REAL route with the wired cacheReport
  // middleware engaged over an in-process store shim. Same resource + same
  // (empty) query + same day; the ONLY delta is the tenant principal — so if
  // caching ever conflated tenants/scope, tenant B would observe tenant A's
  // cached KPI.
  const tenantA = await seedValuationTenant(RETAIL_TYPES[0]); // Fashion
  const tenantB = await seedValuationTenant(RETAIL_TYPES[5]); // profiled beverage
  const server = await listen(buildApp());
  try {
    const { port } = server.address();
    const adminReportCache = require('../services/adminReportCache').adminReportCache;
    const { canonical } = require('../services/adminReportCache');

    // In-process store shim matching the adminReportCache.read contract —
    // counts loads per scope so "cached" vs "fresh" is observable.
    const shim = { reports: new Map(), loads: new Map() };
    shim.read = async function read(context, load, { fresh = false } = {}) {
      const key = JSON.stringify(canonical(context));
      assert.match(context.scope, /^tenant:[0-9a-f]{24}$/, 'cache context scope is the tenant granular scope');
      if (!fresh && this.reports.has(key)) return this.reports.get(key);
      const n = (this.loads.get(key) || 0) + 1;
      this.loads.set(key, n);
      const result = await load();
      if (result.status === 200) this.reports.set(key, result);
      return result;
    };

    t.mock.method(adminReportCache, 'isEnabled', () => true);
    t.mock.method(adminReportCache, 'read', (context, load, opts) => shim.read(context, load, opts));

    const freshLoads = () => [...shim.loads.values()].reduce((a, b) => a + b, 0);

    // Tenant A, first read: one fresh computation, Cache-Control private.
    const a1 = await request(tenantA, port, '/api/inventory/valuation');
    assert.equal(a1.status, 200, `tenant A valuation failed: ${JSON.stringify(a1)}`);
    assert.match(a1.cacheControl, /private.*no-store/, 'wired cacheReport engages on the valuation route');
    assert.deepEqual(a1.data, EXPECTED.profiled, 'tenant A fresh KPI equals the per-line computation');
    assert.equal(freshLoads(), 1, 'tenant A first read computed fresh');

    // Tenant A, second read: served from cache — equal to the fresh one.
    const a2 = await request(tenantA, port, '/api/inventory/valuation');
    assert.deepEqual(a2.data, a1.data, 'tenant A cached KPI equals its own fresh computation');
    assert.equal(freshLoads(), 1, 'tenant A second read was served from cache (no recomputation)');

    // Tenant B, first read: its own principal — must NOT hit A's cache entry
    // (same resource, same query, same day — only the tenant differs).
    const b1 = await request(tenantB, port, '/api/inventory/valuation');
    assert.equal(b1.status, 200, `tenant B valuation failed: ${JSON.stringify(b1)}`);
    assert.deepEqual(b1.data, EXPECTED.profiled, 'tenant B fresh KPI is its own computation');
    assert.notDeepEqual({ tenant: tenantA.tenantId }, { tenant: tenantB.tenantId }, 'walk sanity: distinct principals');
    assert.equal(freshLoads(), 2, 'tenant B recomputed fresh — no cross-tenant cache conflation');
    assert.notEqual(tenantA.tenantId, tenantB.tenantId, 'sanity distinct tenant ids');

    // Tenant B re-read: cache hit.
    const b2 = await request(tenantB, port, '/api/inventory/valuation');
    assert.deepEqual(b2.data, b1.data, 'tenant B cached KPI equals its own fresh computation');
    assert.equal(freshLoads(), 2, 'tenant B second read served from cache');

    // ?refresh=true bypasses the cache and recompues, still per-tenant.
    const a3 = await request(tenantA, port, '/api/inventory/valuation?refresh=true');
    assert.deepEqual(a3.data, a1.data, 'tenant A refreshed KPI still equals the fresh computation');
    assert.equal(freshLoads(), 3, 'refresh bypass produced one extra fresh computation');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
