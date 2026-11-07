'use strict';
// DRI-16 — /warehouses server variant-identity plumbing + six-tenant stock
// fixture (DRI-6 board-scope extension #6). The DRI-10/DRI-14 pattern:
// disposable PID-suffixed replica-set Mongo, real routers, real models — the
// DRI-4/DRI-7/DRI-10/DRI-12/DRI-14 fixtures are NOT modified.
//
// Defect on record (docs/memory/pos-retail-accommodation.md, "/warehouses
// extension — 2026-11-06"): the warehouse frontend buckets the whole Size
// dimension by the free `sizeName` string because the server stock payloads it
// consumed carried no variant identity. The server fix is DATA PROVISION ONLY:
// every warehouse-surface payload now carries the exact sizeId plus the Size
// identity fields (colorName/colorHexCode/optionName alongside the existing
// sizeName snapshot). No server label re-composition (snapshot policy), no
// warehouse mutation behaviour change.
//
// DRI-32 extension (board correction 9d3ea157, 7-industry frame): the tenant
// matrix is widened to exercise every flavour the /warehouses payload serves —
//   • ONE profiled beverage tenant ('Wine Merchant' → ['beverage']) with
//     colourless volume/pack rows (no colorName/optionName on the Size — the
//     same identity-free shape the legacy control stores);
//   • ONE hospitality/food-service tenant ('Restaurant' → ['food-service',
//     'hospitality','beverage']) with two same-size portion rows
//     ('Regular plate') carrying optionName identity only.
// Legacy control rows stay byte-identical; retail rows and every pre-existing
// row keep their exact behaviour. Fixture-only, no server change.
//
// Per tenant (7-industry matrix + ONE legacy beverage control), over
// the real HTTP path (warehouse.routes / subproduct.routes / stockTransfer
// .routes behind protect + attachTenant + requireOwnTenant):
//   - seed tenant + two warehouses + SubProduct with TWO same-size colour
//     variants ("M · Emerald" / "M · Ivory" for Fashion; option/sku identity
//     analogues elsewhere; the legacy beverage gets ONE colourless volume row
//     per the DRI-4 control shape);
//   - post DISTINCT balances to the both variants through the real receipt
//     adjustment flow (POST /:id/stock/adjust type 'received' →
//     WarehouseMovement + stock row);
//   - GET /api/warehouses/stock/all (warehouse-analysis / product-inventory
//     StockRow / stock-drill-drawer source) → DISTINCT rows keyed per exact
//     sizeId with correct colorName/colorHexCode/optionName alongside
//     sizeName (no Emerald/Ivory conflation) and correct balances; the
//     per-warehouse drill-drawer rows identify each variant specifically;
//   - GET /api/warehouses/:id/stock (per-warehouse stock payload) — the
//     populated Size carries exact _id + identity; the legacy row projection
//     keeps exactly its pre-change keys (no identity keys on an identity-less
//     Size, so the wire shape is byte-identical);
//   - GET /api/subproducts/:id/stock-by-warehouse (the subproduct-warehouse-
//     breakdown source) — identity per variant line;
//   - POST /api/stock-transfers → GET /api/stock-transfers/:id (the
//     selected-transfers-report data path) — items keep the 24-char string
//     sizeId on the wire (deliberately NO items.sizeId populate: it would
//     flip the wire shape and break string-id consumers) and carry identity
//     only on variant lines; the legacy line shape is byte-identical;
//   - tenant isolation on every projection (cross-tenant JWT surfaces
//     nothing of another tenant's stock, sub-products or transfers).
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/warehouseRetailTypes.mongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// One type-appropriate Product.type per retail businessType, TWO same-size
// colour variants per subProduct (same `size` string, distinct colour/option
// identity — the exact shape the frontend bucketing bug conflates), plus ONE
// legacy beverage tenant as the byte-parity control (colourless single volume
// row, no retail identity data).
const RETAIL_TYPES = [
  {
    key: 'fashion', businessType: 'Fashion Retail',
    productType: 'fashion_dress', productName: 'Skyline Ankara Gown',
    sku: 'WH-GOWN', baseBarcode: 'WH-SKY', variantBase: 'Gown',
    size: 'M', unitType: 'piece', currency: 'NGN', unitCost: 100,
    variants: [
      { colorName: 'Emerald', colorHexCode: '#50C878', optionName: 'Emerald gown', suffix: '-A' },
      { colorName: 'Ivory', colorHexCode: '#FFFFF0', optionName: 'Ivory gown', suffix: '-B' },
    ],
  },
  {
    key: 'electronics', businessType: 'Electronics Retail',
    productType: 'electronics_audio', productName: 'Nova Bluetooth Speaker',
    sku: 'WH-SPK', baseBarcode: 'WH-ELEC', variantBase: 'Speaker',
    size: 'one', unitType: 'count_unit', currency: 'USD', unitCost: 20,
    variants: [
      { optionName: 'Graphite speaker', suffix: '-A' },
      { optionName: 'Sand speaker', suffix: '-B' },
    ],
  },
  {
    key: 'beauty', businessType: 'Beauty & Skincare',
    productType: 'beauty_skincare', productName: 'Glow Shea Body Oil',
    sku: 'WH-OIL', baseBarcode: 'WH-SKN', variantBase: 'Oil blend',
    size: '200ml', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Rose blend', suffix: '-A' },
      { optionName: 'Unscented blend', suffix: '-B' },
    ],
  },
  {
    key: 'home', businessType: 'Home & Living',
    productType: 'home_kitchen', productName: 'Hearth Ceramic Kettle',
    sku: 'WH-KET', baseBarcode: 'WH-HOME', variantBase: 'Kettle glaze',
    size: 'one', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Sage glaze', suffix: '-A' },
      { optionName: 'Terracotta glaze', suffix: '-B' },
    ],
  },
  {
    key: 'general', businessType: 'General Retail',
    productType: 'gift_set', productName: 'Harbour Gift Hamper',
    sku: 'WH-BOX', baseBarcode: 'WH-GEN', variantBase: 'Hamper wrap',
    size: 'one', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Red-ribbon hamper', suffix: '-A' },
      { optionName: 'Gold-ribbon hamper', suffix: '-B' },
    ],
  },
  // DRI-32 — profiled beverage flavour ('Wine Merchant' → ['beverage']).
  // Colourless volume/pack rows: no colorName/optionName identity on the Size
  // — the identity-free shape the legacy control stores, on volume/pack
  // unitTypes. displayName is the plain stored snapshot.
  {
    key: 'beverage', businessType: 'Wine Merchant', flavour: 'beverage',
    productType: 'wine', productName: 'Harbour Cabernet Sauvignon',
    sku: 'WH-WINE', baseBarcode: 'WH-CAB',
    unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
    volumeSizes: [
      { size: '750ml', displayName: 'Harbour Cabernet Sauvignon 750ml',
        unitType: 'volume_ml', volumeMl: 750, sellingPrice: 250, suffix: '-A' },
      { size: 'Case of 6', displayName: 'Harbour Cabernet Sauvignon Case of 6',
        unitType: 'count_case', volumeMl: 4500, sellingPrice: 1200, suffix: '-B' },
    ],
  },
  // DRI-32 — hospitality/food-service flavour ('Restaurant' → ['food-service',
  // 'hospitality','beverage']). Two SAME-size portion rows ('Regular plate')
  // distinguished by optionName identity only, unitType 'serving' — the
  // portions/servings shape these surfaces already carry for option variants.
  {
    key: 'restaurant', businessType: 'Restaurant', flavour: 'restaurant',
    productType: 'foodservice_staples', productName: 'Harbour Kitchen Rice Plate',
    sku: 'WH-PLATE', baseBarcode: 'WH-RICE', variantBase: 'Regular plate',
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
  sku: 'WH-LAG', baseBarcode: 'WH-LAG', displayName: 'Legacy Lager 750ml',
  size: '750ml', unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
};

function sizeVariantLabel(size) {
  return [size.displayName ?? size.size, size.colorName, size.optionName]
    .filter(Boolean)
    .join(' · ');
}

// Receipt quantities per variant line — deliberately DISTINCT so every
// conflation bug shows up as a wrong aggregate, not a zero.
const RECEIPT_A = 3, RECEIPT_B = 8, RECEIPT_LEGACY = 6;

async function seedWarehouseTenant(def, { legacy = false } = {}) {
  const oid = () => new mongoose.Types.ObjectId();
  const Tenant = require('../models/Tenant');
  const Warehouse = require('../models/Warehouse');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const WarehouseStock = require('../models/WarehouseStock');
  const User = require('../models/User');

  const tenantId = oid(), warehouseId = oid(), destinationId = oid(),
    adminId = oid();

  await Tenant.collection.insertOne({
    _id: tenantId, status: 'approved', isActive: true,
    plan: 'growth', subscriptionStatus: 'active', businessType: def.businessType,
  });

  for (const [wid, name, code] of [
    [warehouseId, `${def.key} main warehouse`, `WH-${def.key.toUpperCase()}`],
    [destinationId, `${def.key} annex`, `WHB-${def.key.toUpperCase()}`],
  ]) {
    await Warehouse.create({
      _id: wid, tenant: tenantId, name, code, isActive: true, isDefault: wid === warehouseId,
    });
  }

  await User.collection.insertOne({
    _id: adminId, tenant: tenantId, role: 'tenant_admin', status: 'active',
    firstName: def.key, lastName: 'Warehouse',
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
  // the legacy control stores (colourless volume/pack rows); the Restaurant
  // flavour seeds two same-size portion rows carrying optionName identity
  // only. Every Size seeds a zero WarehouseStock row so the adjustments below
  // are real ledger lifts from a raw stored row.
  let sizes = [];
  if (legacy) {
    const sizeId = oid();
    await Size.collection.insertOne({
      _id: sizeId, tenant: tenantId, subproduct: subId,
      displayName: def.displayName, size: def.size, volumeMl: 750,
      unitType: def.unitType, sellingPrice: 1000, costPrice: def.unitCost,
      sku: `${def.sku}-A`,
    });
    sizes = [{ _id: sizeId, size: def.size, displayName: def.displayName }];
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
        sku: `${def.sku}${v.suffix}`,
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
        sku: `${def.sku}${variant.suffix}`,
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
        sku: `${def.sku}${variant.suffix}`,
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
    warehouseId: String(warehouseId), destinationId: String(destinationId),
    adminId: String(adminId), subId: String(subId),
    productId: String(product.insertedId),
    sizes: sizes.map((s) => ({ ...s, _id: String(s._id) })),
  };
}

test('warehouses_variant_identity_six_tenants_payload_plumbing', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'warehouse_retail_types');

  const tenants = [];
  for (const def of RETAIL_TYPES) tenants.push(await seedWarehouseTenant(def, { legacy: false }));
  tenants.push(await seedWarehouseTenant(LEGACY_DEF, { legacy: true }));

  const app = express();
  app.use(express.json());
  app.use('/api/warehouses', require('../routes/warehouse.routes'));
  app.use('/api/subproducts', require('../routes/subproduct.routes'));
  app.use('/api/stock-transfers', require('../routes/stockTransfer.routes'));
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

  const receiptQtyFor = (state, i) => state.kind === 'legacy' ? RECEIPT_LEGACY : (i === 0 ? RECEIPT_A : RECEIPT_B);

  try {
    for (const state of tenants) {
      const def = state.def;

      // ── 1. Receipt flow — distinct balances per exact Size ───────────────
      for (let i = 0; i < state.sizes.length; i++) {
        const adjusted = await request(state, `/api/warehouses/${state.warehouseId}/stock/adjust`, 'POST', {
          subProduct: state.subId, size: state.sizes[i]._id,
          quantity: receiptQtyFor(state, i), type: 'received',
          unitCost: def.unitCost, notes: `${def.key} seed receipt`,
        });
        assert.equal(adjusted.status, 200, `${def.key}: receipt adjust ${i} failed: ${JSON.stringify(adjusted)}`);
      }

      // ── 2. GET /api/warehouses/stock/all — the analysis/StockRow payload ──
      const all = await request(state, '/api/warehouses/stock/all');
      assert.equal(all.status, 200, `${def.key}: stock/all failed: ${JSON.stringify(all)}`);
      const rows = all.data.filter((r) => r.subProductId === state.subId);
      assert.equal(rows.length, state.sizes.length, `${def.key}: one payload row per seeded Size (no conflation)`);

      // DISTINCT rows keyed per exact sizeId, distinct balances — the exact
      // assertions the pre-fix payload could not satisfy.
      const rowById = new Map(rows.map((r) => [r.sizeId, r]));
      assert.equal(rowById.size, state.sizes.length, `${def.key}: ${state.kind} rows keyed by DISTINCT exact sizeIds`);
      for (let i = 0; i < state.sizes.length; i++) {
        const s = state.sizes[i];
        const r = rowById.get(s._id);
        assert.ok(r, `${def.key}: row present for exact sizeId ${i}`);
        assert.equal(r.sizeName, s.size, `${def.key}: row ${i} sizeName stays the stored size string`);
        assert.equal(r.currentQuantity, receiptQtyFor(state, i), `${def.key}: row ${i} carries ITS OWN balance`);
        if (state.kind === 'legacy') {
          // Byte-identical legacy row: NO identity keys exist on an
          // identity-less Size, and every other key is the composed-report
          // shape the pre-change payload emitted.
          assert.equal('colorName' in r, false, `${def.key}: legacy row carries no colorName key`);
          assert.equal('colorHexCode' in r, false, `${def.key}: legacy row carries no colorHexCode key`);
          assert.equal('optionName' in r, false, `${def.key}: legacy row carries no optionName key`);
        } else if (s.colorName !== null) {
          assert.equal(r.colorName, s.colorName, `${def.key}: row ${i} colorName verbatim`);
          assert.equal(r.colorHexCode, s.colorHexCode, `${def.key}: row ${i} colorHexCode verbatim`);
          assert.equal(r.optionName, s.optionName, `${def.key}: row ${i} optionName verbatim`);
        } else if (s.optionName !== null) {
          assert.equal(r.optionName, s.optionName, `${def.key}: row ${i} optionName verbatim`);
          assert.equal('colorName' in r, false, `${def.key}: option-only row ${i} carries no colorName key`);
          assert.equal('colorHexCode' in r, false, `${def.key}: option-only row ${i} carries no colorHexCode key`);
        } else {
          // DRI-32 profiled-beverage flavour: the identity-free volume/pack
          // row keeps the same emit-only-with-identity shape as the control.
          assert.equal('colorName' in r, false, `${def.key}: identity-free beverage row ${i} carries no colorName key`);
          assert.equal('colorHexCode' in r, false, `${def.key}: identity-free beverage row ${i} carries no colorHexCode key`);
          assert.equal('optionName' in r, false, `${def.key}: identity-free beverage row ${i} carries no optionName key`);
        }
      }

      // Drill-drawer data path: the per-warehouse drill rows are these same
      // StockRows filtered to one warehouse — assert each variant row is
      // identified specifically (exact sizeId, correct per-warehouse balance).
      const drillRows = all.data.filter(
        (r) => r.subProductId === state.subId && r.warehouseId === state.warehouseId
      );
      assert.equal(drillRows.length, state.sizes.length, `${def.key}: drill-drawer row count for the warehouse`);
      for (const s of state.sizes) {
        const r = drillRows.find((x) => x.sizeId === s._id);
        assert.ok(r, `${def.key}: drill row identified by exact sizeId`);
        assert.equal(r.currentQuantity, receiptQtyFor(state, state.sizes.indexOf(s)), `${def.key}: drill row balance for exact sizeId`);
      }

      // ── 3. GET /api/warehouses/:id/stock — per-warehouse drill payload ────
      const detail = await request(state, `/api/warehouses/${state.warehouseId}/stock`);
      assert.equal(detail.status, 200, `${def.key}: /:id/stock failed: ${JSON.stringify(detail)}`);
      const detailRows = detail.data.filter((r) => String(r.subProduct?._id ?? r.subProduct) === state.subId);
      assert.equal(detailRows.length, state.sizes.length, `${def.key}: per-warehouse payload row count`);
      const detailById = new Map(detailRows.map((r) => [String(r.size._id), r]));
      assert.equal(detailById.size, state.sizes.length, `${def.key}: per-warehouse rows keyed by exact Size id`);
      for (let i = 0; i < state.sizes.length; i++) {
        const s = state.sizes[i];
        const r = detailById.get(s._id);
        assert.ok(r, `${def.key}: per-warehouse row for exact Size ${i}`);
        assert.equal(r.currentQuantity, receiptQtyFor(state, i), `${def.key}: per-warehouse row ${i} balance`);
        const sz = r.size;
        assert.equal(sz.size, s.size, `${def.key}: populated Size ${i} carries the size string`);
        assert.equal(sz.displayName, s.displayName, `${def.key}: populated Size ${i} carries the displayName`);
        if (state.kind === 'legacy') {
          assert.deepEqual(
            Object.keys(sz).sort(),
            ['_id', 'costPrice', 'displayName', 'sellingPrice', 'size', 'sku'],
            `${def.key}: legacy Size projection keys byte-identical to the pre-change select`
          );
        } else if (s.colorName !== null) {
          assert.equal(sz.colorName, s.colorName, `${def.key}: populated Size ${i} colorName verbatim`);
          assert.equal(sz.colorHexCode, s.colorHexCode, `${def.key}: populated Size ${i} colorHexCode verbatim`);
          assert.equal(sz.optionName, s.optionName, `${def.key}: populated Size ${i} optionName verbatim`);
        } else if (s.optionName !== null) {
          assert.equal(sz.optionName, s.optionName, `${def.key}: populated Size ${i} optionName verbatim`);
          assert.equal('colorName' in sz, false, `${def.key}: option-only Size ${i} carries no colorName key`);
          assert.equal('colorHexCode' in sz, false, `${def.key}: option-only Size ${i} carries no colorHexCode key`);
        } else {
          // DRI-32 profiled-beverage flavour: the identity-free volume/pack
          // row's populated Size carries exactly the control's key set.
          assert.deepEqual(
            Object.keys(sz).sort(),
            ['_id', 'costPrice', 'displayName', 'sellingPrice', 'size', 'sku'],
            `${def.key}: identity-free beverage Size ${i} keys identical to the control projection`
          );
        }
      }

      // ── 4. GET /api/subproducts/:id/stock-by-warehouse (breakdown) ────────
      const breakdown = await request(state, `/api/subproducts/${state.subId}/stock-by-warehouse`);
      assert.equal(breakdown.status, 200, `${def.key}: stock-by-warehouse failed: ${JSON.stringify(breakdown)}`);
      const mainRows = breakdown.data.filter((r) => String(r.warehouse?._id ?? r.warehouse) === state.warehouseId);
      assert.equal(mainRows.length, state.sizes.length, `${def.key}: breakdown row count for the main warehouse`);
      const breakdownById = new Map(mainRows.map((r) => [String(r.size._id), r]));
      assert.equal(breakdownById.size, state.sizes.length, `${def.key}: breakdown rows keyed by exact Size id`);
      for (let i = 0; i < state.sizes.length; i++) {
        const r = breakdownById.get(state.sizes[i]._id);
        assert.ok(r, `${def.key}: breakdown row for exact Size ${i}`);
        assert.equal(r.currentQuantity, receiptQtyFor(state, i), `${def.key}: breakdown row ${i} balance`);
        const s = state.sizes[i];
        if (!s.colorName && !s.optionName) {
          // Legacy control rows AND DRI-32 profiled-beverage volume/pack rows:
          // identity-free Sizes keep the exact emit-only-with-identity shape.
          assert.equal('colorName' in r.size, false, `${def.key}: row ${i} breakdown Size carries no colorName key`);
          assert.equal('colorHexCode' in r.size, false, `${def.key}: row ${i} breakdown Size carries no colorHexCode key`);
          assert.equal('optionName' in r.size, false, `${def.key}: row ${i} breakdown Size carries no optionName key`);
        } else if (s.colorName) {
          assert.equal(r.size.colorName, s.colorName, `${def.key}: breakdown row ${i} colorName verbatim`);
          assert.equal(r.size.colorHexCode, s.colorHexCode, `${def.key}: breakdown row ${i} colorHexCode verbatim`);
        } else {
          assert.equal(r.size.optionName, s.optionName, `${def.key}: breakdown row ${i} optionName verbatim`);
          assert.equal('colorName' in r.size, false, `${def.key}: breakdown row ${i} carries no colorName key`);
          assert.equal('colorHexCode' in r.size, false, `${def.key}: breakdown row ${i} carries no colorHexCode key`);
        }
      }

      // ── 5. selected-transfers-report data path ────────────────────────────
      // POST the real transfer (draft — no stock movement), then read the
      // detail payload the report composes from.
      const created = await request(state, '/api/stock-transfers', 'POST', {
        sourceWarehouse: state.warehouseId, destinationWarehouse: state.destinationId,
        currency: def.currency,
        items: state.sizes.map((s) => ({
          subProductId: state.subId, sku: s.sku,
          subProductName: def.productName,
          sizeId: s._id, sizeName: s.displayName,
          quantity: 1, costPrice: def.unitCost, taxRate: 0,
        })),
      });
      assert.equal(created.status, 201, `${def.key}: transfer create failed: ${JSON.stringify(created)}`);
      const transferId = String(created.data._id);

      const detailTransfer = await request(state, `/api/stock-transfers/${transferId}`);
      assert.equal(detailTransfer.status, 200, `${def.key}: transfer detail failed: ${JSON.stringify(detailTransfer)}`);
      const items = detailTransfer.data.items;
      assert.equal(items.length, state.sizes.length, `${def.key}: transfer line count`);
      for (let i = 0; i < state.sizes.length; i++) {
        const it = items[i];
        // Wire-shape invariant: sizeId stays a 24-char string (NOT a populated
        // doc) so legacy string-id consumers keep matching.
        assert.equal(typeof it.sizeId, 'string', `${def.key}: transfer item ${i} sizeId stays a string on the wire`);
        assert.equal(/^[a-f\d]{24}$/i.test(it.sizeId), true, `${def.key}: transfer item ${i} sizeId is the exact 24-char Size id`);
        assert.equal(it.sizeId, state.sizes[i]._id, `${def.key}: transfer item ${i} exact Size id`);
        assert.equal(it.sizeName, state.sizes[i].displayName, `${def.key}: transfer item ${i} stored sizeName snapshot byte-exact`);
        if (state.kind === 'legacy') {
          assert.equal('colorName' in it, false, `${def.key}: legacy transfer line carries no colorName key`);
          assert.equal('colorHexCode' in it, false, `${def.key}: legacy transfer line carries no colorHexCode key`);
          assert.equal('optionName' in it, false, `${def.key}: legacy transfer line carries no optionName key`);
        } else if (state.sizes[i].colorName !== null) {
          assert.equal(it.colorName, state.sizes[i].colorName, `${def.key}: transfer item ${i} colorName verbatim`);
          assert.equal(it.colorHexCode, state.sizes[i].colorHexCode, `${def.key}: transfer item ${i} colorHexCode verbatim`);
          assert.equal(it.optionName, state.sizes[i].optionName, `${def.key}: transfer item ${i} optionName verbatim`);
        } else if (state.sizes[i].optionName !== null) {
          assert.equal(it.optionName, state.sizes[i].optionName, `${def.key}: transfer item ${i} optionName verbatim`);
          assert.equal('colorName' in it, false, `${def.key}: option-only transfer line ${i} carries no colorName key`);
          assert.equal('colorHexCode' in it, false, `${def.key}: option-only transfer line ${i} carries no colorHexCode key`);
        } else {
          // DRI-32 profiled-beverage flavour: the identity-free volume/pack
          // transfer line keeps the exact emit-only-with-identity shape.
          assert.equal('colorName' in it, false, `${def.key}: identity-free beverage transfer line ${i} carries no colorName key`);
          assert.equal('colorHexCode' in it, false, `${def.key}: identity-free beverage transfer line ${i} carries no colorHexCode key`);
          assert.equal('optionName' in it, false, `${def.key}: identity-free beverage transfer line ${i} carries no optionName key`);
        }
      }

      // ── 6. Tenant isolation on every projection ───────────────────────────
      // The cross-tenant transfer sweep runs after every tenant has created
      // its transfer (state.transferId is stamped at the loop bottom).
      const foreignAll = await request(state, '/api/warehouses/stock/all');
      assert.equal(
        foreignAll.data.some((r) =>
          tenants.filter((x) => x !== state).map((x) => x.subId).includes(r.subProductId)),
        false,
        `${def.key}: stock/all surfaces ONLY this tenant's sub-products`
      );
      const other = tenants.find((x) => x !== state && x.kind === 'retail');
      const foreignStock = await request(state, `/api/warehouses/${other.warehouseId}/stock`);
      assert.equal(
        Array.isArray(foreignStock.data) && foreignStock.data.length === 0,
        true, `${def.key}: cross-tenant warehouse stock projection is empty`
      );
      const foreignBreakdown = await request(state, `/api/subproducts/${other.subId}/stock-by-warehouse`);
      assert.equal(
        Array.isArray(foreignBreakdown.data) && foreignBreakdown.data.length === 0,
        true, `${def.key}: cross-tenant stock-by-warehouse projection is empty`
      );

      // Record for the cross-tenant sweep below (first pass seeds it).
      state.transferId = transferId;
    }

    // Cross-tenant transfer detail sweep — every tenant's own transfer must be
    // unreadable by every OTHER tenant's JWT (404 from the scoped findOne).
    for (const state of tenants) {
      for (const other of tenants) {
        if (other === state) continue;
        const res = await request(state, `/api/stock-transfers/${other.transferId}`);
        assert.equal(res.status, 404, `${state.def.key}: foreign transfer of ${other.def.key} is 404`);
      }
    }

    console.log(JSON.stringify({
      DRI_EVIDENCE_ID: 'DRI_EVIDENCE_DRI16_WAREHOUSES_SERVER_VARIANT_IDENTITY',
      environment: 'isolated warehouses fixture: real warehouse/subproduct/stock-transfer routers + real models on disposable replica-set Mongo (:29127)',
      tenants: tenants.map((s) => s.def.key),
      receipts: { variantA: RECEIPT_A, variantB: RECEIPT_B, legacy: RECEIPT_LEGACY },
      payloadSurfaces: [
        'GET /api/warehouses/stock/all (warehouse-analysis + product-inventory StockRow + stock-drill-drawer)',
        'GET /api/warehouses/:id/stock (per-warehouse drill payload)',
        'GET /api/subproducts/:id/stock-by-warehouse (subproduct-warehouse-breakdown)',
        'GET /api/stock-transfers/:id (selected-transfers-report data path)',
      ],
      invariants: [
        'distinct rows per exact sizeId on every retail projection (no Emerald/Ivory conflation)',
        'colorName/colorHexCode/optionName verbatim alongside the stored sizeName snapshot',
        'legacy beverage rows byte-identical shape (no identity keys on identity-less Sizes)',
        'DRI-32: profiled beverage (Wine Merchant) volume/pack rows stay identity-free; Restaurant portion rows carry optionName verbatim',
        'transfer item sizeId stays a 24-char string (no items.sizeId populate)',
        'tenant isolation on every warehouse projection',
      ],
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
