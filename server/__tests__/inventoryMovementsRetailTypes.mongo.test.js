'use strict';
// DRI-29 — /inventory movement-feed variant identity + six-tenant movements
// fixture (DRI-6 board-scope extension #7, /inventory extension). The DRI-16
// warehouseRetailTypes.mongo.test.js pattern: disposable PID-suffixed
// replica-set Mongo, real routers, real models — no other fixture is modified.
//
// Server gap on record (docs/memory/pos-retail-accommodation.md, "/inventory
// extension — 2026-11-06"): inventoryService.getMovements populated size with
// only 'displayName size', so the /inventory module's movement rows (adjustments
// entry picker source rows, receipts `sizeLabel`, dashboard movements, history
// scope labels) showed a bare 'M' for what the tenant stocked as
// 'M · Emerald' / 'M · Black · Wi-Fi'. The server fix is DATA PROVISION ONLY:
// the populate now also carries colorName/colorHexCode/optionName verbatim from
// the Size doc. No label composition, no display strings server-side, no
// frontend edits.
//
// DRI-32 extension (board correction 9d3ea157, 7-industry frame — server/
// constants/industries.js): the tenant matrix is widened to exercise EVERY
// flavour the /inventory movements surface serves — the five retail types plus
//   • ONE profiled beverage tenant ('Wine Merchant' → ['beverage']) with
//     colourless volume/pack rows — no colorName/optionName on the Size, the
//     same identity-free shape the legacy control stores, volume/pack
//     unitTypes instead of variant identity;
//   • ONE hospitality/food-service tenant ('Restaurant' → ['food-service',
//     'hospitality','beverage']) with two same-size portion rows
//     ('Regular plate') distinguished by optionName identity only —
//     unitType 'serving', the portions/servings flavour.
// The legacy control rows stay byte-identical; the Fashion retail rows and
// every other pre-existing row keep their exact pre-extensions behaviour. This
// is FIXTURE-ONLY: the server label/identity code is industry-agnostic by
// design (shared composer, no per-industry forks). If a new row surfaced a
// real defect it would be reported, not fixed in-scope.
//
// Per tenant (7-industry matrix + ONE legacy beverage control), over
// the real HTTP path (inventory.routes behind protect + attachTenant +
// requireOwnTenant):
//   - seed tenant + warehouse + SubProduct with TWO same-size colour variants
//     ("M · Emerald" / "M · Ivory" for Fashion; option/sku identity analogues
//     elsewhere; the legacy beverage gets ONE colourless volume row per the
//     DRI-4 control shape) and a zero WarehouseStock row per Size;
//   - write adjustments through POST /api/inventory/adjust with the EXACT body
//     the /inventory adjustments entry sends (use-adjustment-entry.ts →
//     inventoryAdjustment.service.create) — the writer is
//     stockAdjustment.postStockAdjustment with the JWT-authority tenant from
//     getTenantId, and it is the movement writer that stores size — DISTINCT
//     target quantities per exact Size;
//   - GET /api/inventory/movements?scope=adjustments (the adjustments entry
//     picker source) and the unscoped feed (dashboard movements / receipts) →
//     every movement row identifies its exact size._id and carries
//     colorName/colorHexCode/optionName verbatim; the legacy row's populated
//     size keeps EXACTLY its pre-change keys (_id, displayName, size) —
//     byte-identical wire shape, no identity keys on an identity-less Size;
//   - tenant isolation: the writer rejects another tenant's product/size with
//     404, and every movements projection surfaces only the caller's own rows.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/inventoryMovementsRetailTypes.mongo.test.js
//
// DRI-31 sibling test (below, _movements_route_api_direct): POST
// /api/inventory/movements with type adjustment_in delegates through
// inventoryService.createMovement to stockAdjustment.postStockAdjustment with
// the tenant resolveTenantId() resolved — the raw ObjectId. The writer's
// string-only id regex 400'd every API-direct adjustments write. The fix
// string-normalizes the tenant at the delegation point; the test pins the
// fixed behaviour over the same real-router pattern for one retail and one
// legacy tenant row (writer payload shape unchanged, still no identity keys).
const test = require('node:test');const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// One type-appropriate Product.type per retail businessType, TWO same-size
// colour variants per subProduct (same `size` string, distinct colour/option
// identity — the rows the pre-change payload rendered identically), plus ONE
// legacy beverage tenant as the byte-parity control (colourless single volume
// row, no retail identity data).
// Profiled tenant matrix. The five retail businessTypes each carry TWO
// same-size colour/option variants (the rows the pre-change payload rendered
// identically). DRI-32 appends the two missing 7-industry flavours:
// `BEVERAGE_DEF` — a profiled beverage tenant ('Wine Merchant' → ['beverage'])
// with colourless volume/pack rows (no colorName/optionName, honest volume/pack
// unitTypes), and `RESTAURANT_DEF` — a hospitality/food-service tenant
// ('Restaurant' → ['food-service','hospitality','beverage']) with two same-size
// portion rows distinguished by optionName identity only. RETAIL_TYPES[0]
// (Fashion Retail) stays the lead retail row: the run order and every retail
// row's produced data are unchanged.
const RETAIL_TYPES = [
  {
    key: 'fashion', businessType: 'Fashion Retail',
    productType: 'fashion_dress', productName: 'Skyline Ankara Gown',
    sku: 'INV-GOWN', baseBarcode: 'INV-SKY', variantBase: 'Gown',
    size: 'M', unitType: 'piece', currency: 'NGN', unitCost: 100,
    variants: [
      { colorName: 'Emerald', colorHexCode: '#50C878', optionName: 'Emerald gown', suffix: '-A' },
      { colorName: 'Ivory', colorHexCode: '#FFFFF0', optionName: 'Ivory gown', suffix: '-B' },
    ],
  },
  {
    key: 'electronics', businessType: 'Electronics Retail',
    productType: 'electronics_audio', productName: 'Nova Bluetooth Speaker',
    sku: 'INV-SPK', baseBarcode: 'INV-ELEC', variantBase: 'Speaker',
    size: 'one', unitType: 'count_unit', currency: 'USD', unitCost: 20,
    variants: [
      { optionName: 'Graphite speaker', suffix: '-A' },
      { optionName: 'Sand speaker', suffix: '-B' },
    ],
  },
  {
    key: 'beauty', businessType: 'Beauty & Skincare',
    productType: 'beauty_skincare', productName: 'Glow Shea Body Oil',
    sku: 'INV-OIL', baseBarcode: 'INV-SKN', variantBase: 'Oil blend',
    size: '200ml', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Rose blend', suffix: '-A' },
      { optionName: 'Unscented blend', suffix: '-B' },
    ],
  },
  {
    key: 'home', businessType: 'Home & Living',
    productType: 'home_kitchen', productName: 'Hearth Ceramic Kettle',
    sku: 'INV-KET', baseBarcode: 'INV-HOME', variantBase: 'Kettle glaze',
    size: 'one', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Sage glaze', suffix: '-A' },
      { optionName: 'Terracotta glaze', suffix: '-B' },
    ],
  },
  {
    key: 'general', businessType: 'General Retail',
    productType: 'gift_set', productName: 'Harbour Gift Hamper',
    sku: 'INV-BOX', baseBarcode: 'INV-GEN', variantBase: 'Hamper wrap',
    size: 'one', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Red-ribbon hamper', suffix: '-A' },
      { optionName: 'Gold-ribbon hamper', suffix: '-B' },
    ],
  },
  // DRI-32 — profiled beverage flavour ('Wine Merchant' → ['beverage']).
  // Colourless volume/pack rows: no colorName/optionName identity on the Size
  // — exactly the identity-free shape the legacy control row stores, on
  // volume/pack unitTypes. displayName is the plain stored snapshot.
  {
    key: 'beverage', businessType: 'Wine Merchant', flavour: 'beverage',
    productType: 'wine', productName: 'Harbour Cabernet Sauvignon',
    sku: 'INV-WINE', baseBarcode: 'INV-CAB',
    unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
    volumeSizes: [
      { size: '750ml', displayName: 'Harbour Cabernet Sauvignon 750ml',
        unitType: 'volume_ml', volumeMl: 750, sellingPrice: 250, suffix: '-A' },
      { size: 'Case of 6', displayName: 'Harbour Cabernet Sauvignon Case of 6',
        unitType: 'count_case', volumeMl: 4500, sellingPrice: 1200, suffix: '-B' },
    ],
  },
  // DRI-32 — hospitality/food-service flavour ('Restaurant' → ['food-service',
  // 'hospitality','beverage']). The portions/servings shape: two SAME-size
  // portion rows distinguished by optionName identity only, unitType
  // 'serving' — the payload/library identity carrier these surfaces already
  // use for option variants.
  {
    key: 'restaurant', businessType: 'Restaurant', flavour: 'restaurant',
    productType: 'foodservice_staples', productName: 'Harbour Kitchen Rice Plate',
    sku: 'INV-PLATE', baseBarcode: 'INV-RICE', variantBase: 'Regular plate',
    size: 'Regular plate', unitType: 'serving', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Jollof portion', suffix: '-A' },
      { optionName: 'Goat portion', suffix: '-B' },
    ],
  },
];

const LEGACY_DEF = {
  key: 'legacy', businessType: 'Legacy Beverage',
  productType: 'beer', productName: 'Legacy Lager',
  sku: 'INV-LAG', baseBarcode: 'INV-LAG', displayName: 'Legacy Lager 750ml',
  size: '750ml', unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
};

function sizeVariantLabel(size) {
  return [size.displayName ?? size.size, size.colorName, size.optionName]
    .filter(Boolean)
    .join(' · ');
}

// DISTINCT counted quantities per variant line — deliberately different so a
// conflation bug shows up as a wrong count mapping, not a zero.
const TARGET_A = 4, TARGET_B = 9, TARGET_LEGACY = 7;

async function seedInventoryTenant(def, { legacy = false } = {}) {
  const oid = () => new mongoose.Types.ObjectId();
  const Tenant = require('../models/Tenant');
  const Warehouse = require('../models/Warehouse');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const WarehouseStock = require('../models/WarehouseStock');
  const User = require('../models/User');

  const tenantId = oid(), warehouseId = oid(), adminId = oid();

  await Tenant.collection.insertOne({
    _id: tenantId, status: 'approved', isActive: true,
    plan: 'growth', subscriptionStatus: 'active', businessType: def.businessType,
  });

  await Warehouse.create({
    _id: warehouseId, tenant: tenantId,
    name: `${def.key} main warehouse`, code: `INV-${def.key.toUpperCase()}`,
    isActive: true, isDefault: true,
  });

  await User.collection.insertOne({
    _id: adminId, tenant: tenantId, role: 'tenant_admin', status: 'active',
    firstName: def.key, lastName: 'Inventory',
  });

  const product = await Product.collection.insertOne({
    name: def.productName, type: def.productType,
    isAlcoholic: !!legacy, tracksBatch: false,
  });

  const subId = oid();
  await SubProduct.collection.insertOne({
    _id: subId, tenant: tenantId, product: product.insertedId,
    status: 'active', visibleInPOS: true, sku: def.sku,
    baseSellingPrice: legacy ? 1000 : 250, costPrice: def.unitCost,
  });

  // Retail = TWO same-size variant Sizes; legacy control = ONE colourless
  // volume Size (no identity columns at all — absent keys, not empty strings).
  // DRI-32: the profiled beverage flavour seeds the same identity-free shape
  // the legacy control stores — colourless volume/pack rows — and the
  // Restaurant flavour seeds two same-size portion rows carrying optionName
  // identity only. Every Size seeds a zero WarehouseStock row so each
  // adjustment below is a real counted correction from a raw stored row
  // (expectedQuantity 0).
  let sizes = [];
  if (legacy) {
    const sizeId = oid();
    await Size.collection.insertOne({
      _id: sizeId, tenant: tenantId, subproduct: subId,
      displayName: def.displayName, size: def.size, volumeMl: 750,
      unitType: def.unitType, sellingPrice: 1000, costPrice: def.unitCost,
      sku: `${def.sku}-A`,
    });
    sizes = [{ _id: String(sizeId), size: def.size, displayName: def.displayName }];
  } else if (def.flavour === 'beverage') {
    for (const v of def.volumeSizes) {
      const sizeId = oid();
      await Size.collection.insertOne({
        _id: sizeId, tenant: tenantId, subproduct: subId,
        displayName: v.displayName, size: v.size, volumeMl: v.volumeMl,
        unitType: v.unitType, sellingPrice: v.sellingPrice, costPrice: def.unitCost,
        sku: `${def.sku}${v.suffix}`, barcode: `${def.baseBarcode}${v.suffix}`,
      });
      sizes.push({
        _id: String(sizeId), size: v.size, displayName: v.displayName,
        colorName: null, colorHexCode: null, optionName: null,
      });
    }
  } else if (def.flavour === 'restaurant') {
    for (const variant of def.variants) {
      const sizeId = oid();
      const composed = sizeVariantLabel({ displayName: def.size, optionName: variant.optionName });
      await Size.collection.insertOne({
        _id: sizeId, tenant: tenantId, subproduct: subId,
        displayName: composed, size: def.size, optionName: variant.optionName,
        unitType: def.unitType, sellingPrice: 250, costPrice: def.unitCost,
        sku: `${def.sku}${variant.suffix}`, barcode: `${def.baseBarcode}${variant.suffix}`,
      });
      sizes.push({
        _id: String(sizeId), size: def.size, displayName: composed,
        colorName: null, colorHexCode: null, optionName: variant.optionName ?? null,
      });
    }
  } else {
    for (const variant of def.variants) {
      const sizeId = oid();
      const composed = sizeVariantLabel({
        displayName: `${def.variantBase} — ${variant.colorName ?? variant.optionName}`,
        colorName: variant.colorName, optionName: variant.optionName,
      });
      await Size.collection.insertOne({
        _id: sizeId, tenant: tenantId, subproduct: subId,
        displayName: composed, size: def.size,
        ...(variant.colorName
          ? { colorName: variant.colorName, colorHexCode: variant.colorHexCode, optionName: variant.optionName }
          : { optionName: variant.optionName }),
        unitType: def.unitType, sellingPrice: 250, costPrice: def.unitCost,
        sku: `${def.sku}${variant.suffix}`, barcode: `${def.baseBarcode}${variant.suffix}`,
      });
      sizes.push({
        _id: String(sizeId), size: def.size, displayName: composed,
        colorName: variant.colorName ?? null,
        colorHexCode: variant.colorHexCode ?? null,
        optionName: variant.optionName ?? null,
      });
    }
  }
  for (const s of sizes) {
    await WarehouseStock.create({
      tenant: tenantId, warehouse: warehouseId, subProduct: subId, size: s._id,
      currentQuantity: 0, reservedQuantity: 0,
    });
  }

  await SubProduct.collection.updateOne(
    { _id: subId },
    { $set: { defaultSize: sizes[0]._id, sizes: sizes.map((s) => s._id) } }
  );

  return {
    def, kind: legacy ? 'legacy' : 'retail', tenantId: String(tenantId),
    warehouseId: String(warehouseId), adminId: String(adminId),
    subId: String(subId), productId: String(product.insertedId),
    sizes: sizes.map((s) => ({ ...s, _id: String(s._id) })),
  };
}

test('inventory_movements_variant_identity_six_tenants_payload', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'inventory_retail_movements');

  const tenants = [];
  for (const def of RETAIL_TYPES) tenants.push(await seedInventoryTenant(def, { legacy: false }));
  tenants.push(await seedInventoryTenant(LEGACY_DEF, { legacy: true }));

  const app = express();
  app.use(express.json());
  app.use('/api/inventory', require('../routes/inventory.routes'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  async function request(state, path, method = 'GET', body) {
    const token = jwt.sign(
      { userId: state.adminId, email: `${state.def.key}@test.local`, role: 'tenant_admin', tenant: state.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { data = {}; }
    return { status: response.status, ...data };
  }

  const targetFor = (state, i) => state.kind === 'legacy' ? TARGET_LEGACY : (i === 0 ? TARGET_A : TARGET_B);

  try {
    for (const state of tenants) {
      const def = state.def;

      // ── 1. Adjustment writes — the /inventory adjustments entry's writer ──
      // The entry (use-adjustment-entry.ts → inventoryAdjustment.service)
      // posts EXACTLY this body to POST /api/inventory/adjust; the controller
      // passes the JWT-authority tenant (getTenantId) into
      // stockAdjustment.postStockAdjustment, the movement writer storing size.
      for (let i = 0; i < state.sizes.length; i++) {
        const adjusted = await request(state, '/api/inventory/adjust', 'POST', {
          warehouseId: state.warehouseId,
          subProductId: state.subId,
          sizeId: state.sizes[i]._id,
          targetQuantity: targetFor(state, i),
          expectedQuantity: 0,
          requestId: `dri29-${def.key}-${i}`,
          reason: 'Cycle count correction',
          notes: `${def.key} DRI-29 fixture adjustment ${i}`,
        });
        assert.equal(adjusted.status, 201, `${def.key}: adjustments write ${i} failed: ${JSON.stringify(adjusted)}`);
        // The writer records the exact Size on the movement ledger row.
        assert.equal(String(adjusted.data.size), state.sizes[i]._id, `${def.key}: movement ${i} stores the exact sizeId`);
        assert.equal(adjusted.data.quantityAfter, targetFor(state, i), `${def.key}: movement ${i} counted quantity`);
      }

      // Cross-tenant write rejection: another tenant's product/size is 404 —
      // the Size lookup is tenant-scoped, never a platform-wide id match.
      const other = tenants.find((x) => x !== state);
      const foreignWrite = await request(state, '/api/inventory/adjust', 'POST', {
        warehouseId: state.warehouseId,
        subProductId: other.subId,
        sizeId: other.sizes[0]._id,
        targetQuantity: 2, expectedQuantity: 0,
        requestId: `dri29-foreign-${def.key}`,
        reason: 'Cross-tenant probe',
      });
      assert.equal(foreignWrite.status, 404, `${def.key}: cross-tenant adjustments write is rejected: ${JSON.stringify(foreignWrite)}`);

      // ── 2. GET /api/inventory/movements — both consumed feeds ─────────────
      // scope=adjustments is the adjustments entry picker's source rows; the
      // unscoped feed is the dashboard movements / receipts source. Same
      // populate, so both carry identical identity semantics.
      for (const feed of ['adjustments', '']) {
        const qs = feed ? `?scope=${feed}` : '';
        const list = await request(state, `/api/inventory/movements${qs}`);
        assert.equal(list.status, 200, `${def.key}: movements feed ${feed || 'unscoped'} failed: ${JSON.stringify(list)}`);
        const movements = list.data.movements;
        assert.equal(list.data.total, state.sizes.length, `${def.key}: feed ${feed || 'unscoped'} total movement count`);
        assert.equal(movements.length, state.sizes.length, `${def.key}: feed ${feed || 'unscoped'} movement row count`);

        // Rows keyed by the EXACT populated size._id — the picker's keying.
        const bySizeId = new Map(movements.map((m) => [String(m.size?._id ?? m.size), m]));
        assert.equal(bySizeId.size, state.sizes.length, `${def.key}: feed ${feed || 'unscoped'} rows keyed by DISTINCT exact sizeIds`);
        for (let i = 0; i < state.sizes.length; i++) {
          const s = state.sizes[i];
          const m = bySizeId.get(s._id);
          assert.ok(m, `${def.key}: feed ${feed || 'unscoped'} row present for exact sizeId ${i}`);
          assert.equal(m.quantity, targetFor(state, i), `${def.key}: feed ${feed || 'unscoped'} row ${i} carries ITS OWN counted delta`);
          assert.equal(m.quantityAfter, targetFor(state, i), `${def.key}: feed ${feed || 'unscoped'} row ${i} quantityAfter`);
          assert.equal(typeof m.size, 'object', `${def.key}: feed ${feed || 'unscoped'} row ${i} size is populated, not a raw id`);
          assert.equal(m.size.size, s.size, `${def.key}: feed ${feed || 'unscoped'} row ${i} size string verbatim`);
          assert.equal(m.size.displayName, s.displayName, `${def.key}: feed ${feed || 'unscoped'} row ${i} displayName verbatim`);
          if (state.kind === 'legacy') {
            // Byte-identical legacy populated Size: EXACTLY the pre-change
            // 'displayName size' projection keys — no identity keys on an
            // identity-less Size.
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'displayName', 'size'],
              `${def.key}: feed ${feed || 'unscoped'} legacy row ${i} populated size keys byte-identical to the pre-change populate`
            );
          } else if (s.colorName !== null) {
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'colorHexCode', 'colorName', 'displayName', 'optionName', 'size'],
              `${def.key}: feed ${feed || 'unscoped'} colour row ${i} populated size keys exact`
            );
            assert.equal(m.size.colorName, s.colorName, `${def.key}: feed ${feed || 'unscoped'} row ${i} colorName verbatim`);
            assert.equal(m.size.colorHexCode, s.colorHexCode, `${def.key}: feed ${feed || 'unscoped'} row ${i} colorHexCode verbatim`);
            assert.equal(m.size.optionName, s.optionName, `${def.key}: feed ${feed || 'unscoped'} row ${i} optionName verbatim`);
          } else if (s.optionName !== null) {
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'displayName', 'optionName', 'size'],
              `${def.key}: feed ${feed || 'unscoped'} option-only row ${i} populated size keys exact`
            );
            assert.equal(m.size.optionName, s.optionName, `${def.key}: feed ${feed || 'unscoped'} row ${i} optionName verbatim`);
          } else {
            // DRI-32 profiled-beverage flavour: the identity-free volume/pack
            // row emits the same populated-size shape as the legacy control —
            // no identity keys on an identity-less Size.
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'displayName', 'size'],
              `${def.key}: feed ${feed || 'unscoped'} identity-free beverage row ${i} populated size keys identical to the control shape`
            );
            assert.equal('colorName' in m.size, false, `${def.key}: feed ${feed || 'unscoped'} beverage row ${i} carries no colorName key`);
            assert.equal('colorHexCode' in m.size, false, `${def.key}: feed ${feed || 'unscoped'} beverage row ${i} carries no colorHexCode key`);
            assert.equal('optionName' in m.size, false, `${def.key}: feed ${feed || 'unscoped'} beverage row ${i} carries no optionName key`);
          }
        }
      }

      // ── 3. Tenant isolation on the projection ─────────────────────────────
      const subProductIdOf = (m) => String(m.subProduct?._id ?? m.subProduct);
      const isolated = await request(state, '/api/inventory/movements');
      assert.equal(
        isolated.data.movements.every((m) => subProductIdOf(m) === state.subId),
        true,
        `${def.key}: movements feed surfaces ONLY this tenant's rows`
      );
      assert.equal(
        isolated.data.movements.every((m) =>
          tenants.filter((x) => x !== state).every((x) => String(m.size?._id ?? m.size) !== x.sizes[0]._id)),
        true,
        `${def.key}: movements feed surfaces no foreign size identity`
      );
    }

    console.log(JSON.stringify({
      DRI_EVIDENCE_ID: 'DRI_EVIDENCE_DRI29_INVENTORY_MOVEMENTS_VARIANT_IDENTITY',
      environment: 'isolated inventory movements fixture: real inventory router + real models on disposable replica-set Mongo (:29127)',
      tenants: tenants.map((s) => s.def.key),
      adjustments: { variantA: TARGET_A, variantB: TARGET_B, legacy: TARGET_LEGACY },
      payloadSurfaces: [
        'POST /api/inventory/adjust (adjustments entry writer → stockAdjustment.postStockAdjustment, JWT-authority tenant)',
        'GET /api/inventory/movements?scope=adjustments (adjustments entry picker source rows)',
        'GET /api/inventory/movements (dashboard movements / receipts feed)',
      ],
      invariants: [
        'movement rows keyed by distinct exact size._id on both consumed feeds (no Emerald/Ivory conflation)',
        'colorName/colorHexCode/optionName ride along verbatim in the populated Size',
        'legacy beverage movement rows byte-identical shape (populated size keys exactly _id/displayName/size)',
        'DRI-32: profiled beverage (Wine Merchant) volume/pack rows emit the identity-free shape; Restaurant portion rows carry optionName identity verbatim',
        'adjustments writer resolves Size by the schema field subproduct (was subProduct: matched no document, 404 on every write)',
        'cross-tenant adjustments write rejected 404; movements projections tenant-scoped',
      ],
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// DRI-31 — API-direct adjustments writes through the movements route.
// Defect: POST /api/inventory/movements with type adjustment_in delegates via
// inventoryService.createMovement to stockAdjustment.postStockAdjustment while
// carrying resolveTenantId()'s raw req.tenant._id ObjectId — the writer's
// string-only id regex rejected it with 400 on every API-direct call. Bounded
// one row per kind: the fix string-normalizes the tenant at the delegation
// point (mirroring getTenantId(req) on /api/inventory/adjust); the writer's id
// validation, tenant scoping and the adjustments-entry payload shape are
// byte-identical — the same body the entry sends, plus nothing, for both a
// retail and the legacy control row.
test('inventory_movements_route_api_direct_adjustment_in_dri31', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'inventory_movements_route_dri31');

  const app = express();
  app.use(express.json());
  app.use('/api/inventory', require('../routes/inventory.routes'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  async function request(state, path, method = 'GET', body) {
    const token = jwt.sign(
      { userId: state.adminId, email: `${state.def.key}@test.local`, role: 'tenant_admin', tenant: state.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { data = {}; }
    return { status: response.status, ...data };
  }

  try {
    const states = [
      await seedInventoryTenant(RETAIL_TYPES[0], { legacy: false }),
      await seedInventoryTenant(LEGACY_DEF, { legacy: true }),
    ];

    for (const state of states) {
      const def = state.def;
      const size = state.sizes[0];

      // The EXACT adjustments-entry body shape, routed API-direct through the
      // movements route (type: adjustment_in routes the same writer via
      // inventoryService.createMovement). Pre-fix this was the failing 400.
      const adjustment = await request(state, '/api/inventory/movements', 'POST', {
        type: 'adjustment_in',
        warehouseId: state.warehouseId,
        subProductId: state.subId,
        sizeId: size._id,
        targetQuantity: 6,
        expectedQuantity: 0,
        requestId: `dri31-${def.key}-route`,
        reason: 'Cycle count correction',
        notes: `${def.key} DRI-31 movements-route adjustment`,
      });
      assert.equal(adjustment.status, 201, `${def.key}: API-direct adjustment_in via movements route failed: ${JSON.stringify(adjustment)}`);
      assert.equal(adjustment.data.type, 'adjustment_in', `${def.key}: movements-route writer records adjustment_in`);
      assert.equal(String(adjustment.data.size), size._id, `${def.key}: movement stores the exact sizeId`);
      assert.equal(adjustment.data.quantityAfter, 6, `${def.key}: movement counted quantity`);

      // Cross-tenant write through the movements route must still 404 — the
      // string normalization never widens the writer's tenant scoping.
      const other = states.find((x) => x !== state);
      const foreignWrite = await request(state, '/api/inventory/movements', 'POST', {
        type: 'adjustment_in',
        warehouseId: state.warehouseId,
        subProductId: other.subId,
        sizeId: other.sizes[0]._id,
        targetQuantity: 2, expectedQuantity: 0,
        requestId: `dri31-foreign-${def.key}`,
        reason: 'Cross-tenant probe',
      });
      assert.equal(foreignWrite.status, 404, `${def.key}: cross-tenant movements-route write is rejected: ${JSON.stringify(foreignWrite)}`);

      // The produced movement rows carry the same populated-size shapes as the
      // /adjust-written rows: legacy byte-identical (_id/displayName/size),
      // retail with the exact identity keys — no label composition anywhere.
      const feed = await request(state, '/api/inventory/movements?scope=adjustments');
      assert.equal(feed.status, 200, `${def.key}: movements feed failed: ${JSON.stringify(feed)}`);
      assert.equal(feed.data.total, 1, `${def.key}: feed total movement count`);
      const row = feed.data.movements[0];
      assert.equal(row.type, 'adjustment_in', `${def.key}: feed row type`);
      assert.equal(String(row.size?._id ?? row.size), size._id, `${def.key}: feed row keyed by exact sizeId`);
      assert.equal(typeof row.size, 'object', `${def.key}: feed row size populated, not a raw id`);
      assert.equal(row.size.size, size.size, `${def.key}: feed row size string verbatim`);
      assert.equal(row.size.displayName, size.displayName, `${def.key}: feed row displayName verbatim`);
      assert.equal(
        feed.data.movements.every((m) => String(m.subProduct?._id ?? m.subProduct) === state.subId),
        true,
        `${def.key}: movements feed surfaces ONLY this tenant's rows`
      );
      if (state.kind === 'legacy') {
        assert.deepEqual(
          Object.keys(row.size).sort(),
          ['_id', 'displayName', 'size'],
          `${def.key}: legacy row populated size keys byte-identical to the pre-change populate`
        );
      } else {
        assert.deepEqual(
          Object.keys(row.size).sort(),
          ['_id', 'colorHexCode', 'colorName', 'displayName', 'optionName', 'size'],
          `${def.key}: colour row populated size keys exact`
        );
      }
    }

    console.log(JSON.stringify({
      DRI_EVIDENCE_ID: 'DRI_EVIDENCE_DRI31_MOVEMENTS_ROUTE_API_DIRECT_ADJUSTMENT',
      environment: 'isolated movements-route fixture: real inventory router + real models on disposable replica-set Mongo (:29127)',
      tenants: states.map((s) => s.def.key),
      surfaces: ['POST /api/inventory/movements (type adjustment_in → inventoryService.createMovement → stockAdjustment.postStockAdjustment, string-normalized tenant)'],
      invariants: [
        'API-direct adjustment_in through the movements route is 201 for a retail and a legacy tenant row (was 400 on the raw ObjectId tenant)',
        'movement stores the exact sizeId and counted quantity; legacy payload shape untouched',
        'cross-tenant write through the movements route still 404s (tenant scoping unchanged)',
        'populated-size shapes identical to /adjust-written rows: legacy _id/displayName/size byte-identical, retail identity keys verbatim',
      ],
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// DRI-33 — the /inventory ten-surface server payload pins for the surfaces
// whose identity already rides on the shared movement feed (board extension
// #9 server half of checklist items 2/3/5/6/7): receipts ('received' rows),
// deliveries (?category=out feed of sold/shipped rows), scrap (damaged-type
// rows over the unscoped feed the client presets filter), internal
// (?scope=internal feed), and the adjustments scope feed + summary counts.
// Writing uses the real per-exact-Size row shapes: adjustments through the
// real POST /api/inventory/adjust writer (DRI-29-verified) and seedings for
// received/sold/damaged/transfer rows in the shapes the sales/warehouse
// engines record (their writers' identity is already proven in the
// DRI-14/DRI-32 purchases + warehouse fixtures, re-run for DRI-33 evidence).
// Per tenant, per type, the quantity is DISTINCT per exact size and per type
// so a conflation bug shows up as a wrong value, not a zero. Legacy rows keep
// their exact populated-size shapes.
test('inventory_movements_scope_feed_identity_dri33', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'inventory_scope_feeds_dri33');

  const tenants = [];
  for (const def of RETAIL_TYPES) tenants.push(await seedInventoryTenant(def, { legacy: false }));
  tenants.push(await seedInventoryTenant(LEGACY_DEF, { legacy: true }));

  const app = express();
  app.use(express.json());
  app.use('/api/inventory', require('../routes/inventory.routes'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  async function request(state, path, method = 'GET', body) {
    const token = jwt.sign(
      { userId: state.adminId, email: `${state.def.key}@test.local`, role: 'tenant_admin', tenant: state.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { data = {}; }
    return { status: response.status, ...data };
  }

  // SECOND warehouse per tenant — the internal transfer pair needs a
  // destination warehouse distinct from the seeded default one.
  const Warehouse = require('../models/Warehouse');
  for (const state of tenants) {
    const second = await Warehouse.create({
      tenant: new mongoose.Types.ObjectId(state.tenantId),
      name: `${state.def.key} second warehouse`,
      code: `D33-${state.def.key.toUpperCase()}-B`,
      isActive: true,
    });
    state.secondWarehouseId = String(second._id);
  }

  // Distinct quantity per type per size index — received/sold/damaged/
  // transfer/adjustments each differ per exact Size so no type can masquerade
  // as another.
  const QTY = (state, feed, i) =>
    (i === 0
      ? {
          received: 5, sold: 4, damaged: 1, transfer: 2,
          adjustments: state.kind === 'legacy' ? TARGET_LEGACY : TARGET_A,
        }
      : {
          received: 9, sold: 3, damaged: 2, transfer: 1, adjustments: TARGET_B,
        })[feed];

  try {
    for (const state of tenants) {
      const def = state.def;

      // Real adjustment writes (the adjustments entry's writer) — quantity
      // DISTINCT per exact Size (DRI-29 walk, kept as the adjustments-scope row set).
      for (let i = 0; i < state.sizes.length; i++) {
        const adjusted = await request(state, '/api/inventory/adjust', 'POST', {
          warehouseId: state.warehouseId,
          subProductId: state.subId,
          sizeId: state.sizes[i]._id,
          targetQuantity: QTY(state, 'adjustments', i),
          expectedQuantity: 0,
          requestId: `dri33-adj-${def.key}-${i}`,
          reason: 'Cycle count correction',
        });
        assert.equal(adjusted.status, 201, `${def.key}: DRI-33 adjustment write ${i}: ${JSON.stringify(adjusted)}`);
      }

      // received/sold/damaged/transfer rows, the exact shape the production
      // engines record (subProduct + product + size + warehouse + category).
      const T = new mongoose.Types.ObjectId(state.tenantId);
      const S = new mongoose.Types.ObjectId(state.subId);
      const P = new mongoose.Types.ObjectId(state.productId);
      const W0 = new mongoose.Types.ObjectId(state.warehouseId);
      const W1 = new mongoose.Types.ObjectId(state.secondWarehouseId);
      const moveRows = [];
      for (let i = 0; i < state.sizes.length; i++) {
        const sz = new mongoose.Types.ObjectId(state.sizes[i]._id);
        const base = (extra) => ({
          tenant: T, subProduct: S, product: P, size: sz,
          status: 'confirmed', isVerified: true, source: 'manual',
          performedAt: new Date('2026-11-05'), createdAt: new Date('2026-11-05'),
          ...extra,
        });
        moveRows.push(
          base({ type: 'received', category: 'in', warehouse: W0, quantity: QTY(state, 'received', i), quantityBefore: 0, quantityAfter: QTY(state, 'received', i), reason: 'Purchase received' }),
          base({ type: 'sold', category: 'out', warehouse: W0, quantity: QTY(state, 'sold', i), quantityBefore: QTY(state, 'received', i), quantityAfter: QTY(state, 'received', i) - QTY(state, 'sold', i), reason: 'POS sale' }),
          base({ type: 'damaged', category: 'out', warehouse: W0, quantity: QTY(state, 'damaged', i), quantityBefore: 9, quantityAfter: 9 - QTY(state, 'damaged', i), reason: 'Damaged stock' }),
          base({ type: 'transfer_out', category: 'transfer', warehouse: W0, sourceWarehouse: W0, destinationWarehouse: W1, quantity: QTY(state, 'transfer', i), quantityBefore: 9, quantityAfter: 9, reason: 'Internal transfer' }),
          base({ type: 'transfer_in', category: 'transfer', warehouse: W1, sourceWarehouse: W0, destinationWarehouse: W1, quantity: QTY(state, 'transfer', i), quantityBefore: 0, quantityAfter: 0, reason: 'Internal transfer' }),
        );
      }
      await mongoose.connection.db.collection('inventorymovements').insertMany(moveRows);

      // ── Feed assertions: unscoped (dashboard/scrap source), scope=internal,
      // ?category=out (deliveries preset query), ?category=in (receipts
      // preset — includes the real adjustment_in writer rows), and
      // ?scope=adjustments (picker/summary). ──
      const feeds = {
        unscoped: '/api/inventory/movements',
        internal: '/api/inventory/movements?scope=internal',
        deliveries: '/api/inventory/movements?category=out',
        receipts: '/api/inventory/movements?category=in',
        adjustments: '/api/inventory/movements?scope=adjustments',
      };
      const qtyKeyOf = (m) =>
        m.type === 'adjustment_in' || m.type === 'adjustment_out'
          ? 'adjustments'
          : m.type === 'transfer_out' || m.type === 'transfer_in'
            ? 'transfer'
            : m.type;
      for (const [label, path] of Object.entries(feeds)) {
        const list = await request(state, path);
        assert.equal(list.status, 200, `${def.key}: feed ${label} failed: ${JSON.stringify(list)}`);
        const movements = list.data.movements;

        if (label === 'internal') {
          assert.equal(movements.length, state.sizes.length * 2, `${def.key}: internal feed = transfer pair per exact size`);
        } else if (label === 'deliveries') {
          assert.equal(movements.length, state.sizes.length * 2, `${def.key}: deliveries feed = sold + damaged per exact size`);
          assert.equal(
            movements.every((m) => ['sold', 'damaged'].includes(m.type)),
            true, `${def.key}: deliveries feed is the client preset's sold/shipped + damaged (out) set`
          );
        } else if (label === 'receipts') {
          // The feed also carries the DRI-31-verified adjustment_in writer
          // rows (category 'in') — pin the received subset per exact size.
          assert.equal(
            movements.filter((m) => m.type === 'received').length,
            state.sizes.length,
            `${def.key}: receipts feed = received per exact size (+ the real adjustment_in rows)`
          );
        } else if (label === 'adjustments') {
          assert.equal(movements.length, state.sizes.length, `${def.key}: adjustments feed = one per exact size (summary counts)`);
          assert.equal(list.data.total, state.sizes.length, `${def.key}: adjustments summary total`);
        }

        const bySizeId = new Map(movements.map((m) => [String(m.size?._id ?? m.size), m]));
        assert.equal(bySizeId.size, state.sizes.length, `${def.key}: feed ${label} keyed by DISTINCT exact sizeIds`);
        for (let i = 0; i < state.sizes.length; i++) {
          const s = state.sizes[i];
          const m = bySizeId.get(s._id);
          assert.ok(m, `${def.key}: feed ${label} row present for exact size ${i}`);
          assert.equal(typeof m.size, 'object', `${def.key}: feed ${label} row ${i} size is populated, not a raw id`);
          assert.equal(m.size.size, s.size, `${def.key}: feed ${label} row ${i} size string verbatim`);
          assert.equal(m.size.displayName, s.displayName, `${def.key}: feed ${label} row ${i} displayName verbatim`);
          assert.ok(
            ['received', 'sold', 'damaged', 'transfer', 'adjustments'].includes(qtyKeyOf(m)),
            `${def.key}: feed ${label} row ${i} type ${m.type}`
          );
          assert.equal(
            m.quantity,
            QTY(state, qtyKeyOf(m), i),
            `${def.key}: feed ${label} row ${i} carries ITS OWN per-type per-size quantity`
          );
          if (state.kind === 'legacy') {
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'displayName', 'size'],
              `${def.key}: feed ${label} legacy row ${i} populated size keys byte-identical to the pre-change populate`
            );
          } else if (s.colorName !== null) {
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'colorHexCode', 'colorName', 'displayName', 'optionName', 'size'],
              `${def.key}: feed ${label} colour row ${i} populated size keys exact`
            );
          } else if (s.optionName !== null) {
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'displayName', 'optionName', 'size'],
              `${def.key}: feed ${label} option-only row ${i} populated size keys exact`
            );
          } else {
            assert.deepEqual(
              Object.keys(m.size).sort(),
              ['_id', 'displayName', 'size'],
              `${def.key}: feed ${label} identity-free beverage row ${i} populated size keys identical to the control shape`
            );
          }
        }
      }

      // ── Tenant isolation ─────────────────────────────────────────────────
      const isolated = await request(state, '/api/inventory/movements');
      assert.equal(
        isolated.data.movements.every((m) => String(m.tenant?._id ?? m.tenant) === state.tenantId),
        true,
        `${def.key}: every movement row is this tenant's`
      );
    }

    console.log(JSON.stringify({
      DRI_EVIDENCE_ID: 'DRI_EVIDENCE_DRI33_MOVEMENTS_SCOPE_FEED_IDENTITY',
      environment: 'isolated movements fixture: real inventory router + real models on disposable replica-set Mongo (:29127)',
      tenants: tenants.map((s) => s.def.key),
      payloadSurfaces: [
        'GET /api/inventory/movements (unscoped — dashboard/exports/scrap preset source)',
        'GET /api/inventory/movements?scope=internal (internal transfer surface)',
        'GET /api/inventory/movements?category=out (deliveries preset query)',
        'GET /api/inventory/movements?category=in (receipts preset query)',
        'GET /api/inventory/movements?scope=adjustments (adjustments entry + summary counts)',
      ],
      invariants: [
        'received/sold/damaged/transfer-pair rows keyed by distinct exact sizeIds on every consumed feed',
        'per-type per-size quantities distinct — no type conflation on any feed',
        'legacy rows byte-identical populated size shape across every scope feed',
        'colour/option-only/identity-free branches mirror the DRI-29 shapes on each feed',
      ],
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
