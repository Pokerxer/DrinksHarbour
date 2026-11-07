'use strict';
// DRI-14 — /purchases module end-to-end across ALL FIVE retail types + one
// legacy beverage tenant (PO → receipt → validate-posting → vendor return →
// vendor bill), the DRI-10/DRI-12 pattern (disposable PID-suffixed replica-set
// Mongo, real routers, real models; the DRI-4/DRI-7/DRI-10/DRI-12 fixtures are
// NOT modified).
//
// Per the CEO decision on record (docs/memory/pos-retail-accommodation.md,
// "/purchases extension — 2026-11-06"): shared purchasing generalizes — no
// per-industry gates and no per-industry UOM sets. Server Size identity is
// verified end-to-end (VendorReturn/VendorBill/StockTransfer/WarehouseMovement
// carry exact subProduct + size; poReceive.helpers fails loudly on
// unresolvable/mismatched sizeIds).
//
// Per tenant, over the real purchases HTTP path (purchaseOrder.routes /
// vendorReturn.routes / vendorBill.routes behind protect + attachTenant +
// requireOwnTenant + the purchase_orders plan gate):
//   PO create (line with exact sizeId) → partial receive (one variant only) →
//   validate (WarehouseMovement/adjustStock posts only for that size; the
//   sibling variant balance is byte-unchanged) → vendor return of part of the
//   received qty (return quantities matched on subProductId + sizeId, the
//   over-return rejected, counters per vendorReturn.counters) → vendor bill
//   generated from receipts (composite subProductId::sizeId item keys,
//   sizeId/sizeName snapshots, money matched on the receipt-driven counters;
//   the seeded multi-currency tenant keeps original-currency figures) → print
//   payload checks (PO/bill data carry stored subProductName/sizeName/
//   packaging snapshots — retail rows carry the industry-neutral entry nouns
//   'units'/'pieces'; legacy beverage rows print exactly as before).
// Tenant isolation is checked at every stage (foreign PO/receipt/return/bill
// refs refused).
//
// DRI-32 extension (board correction 9d3ea157, 7-industry frame): the tenant
// matrix of the E2E test below is widened to exercise every flavour the
// /purchases payload serves —   • ONE profiled beverage tenant ('Wine
// Merchant' → ['beverage']) with colourless volume/pack rows (no
// colorName/optionName; NO entry packaging — the legacy 'bottle' print
// fallback stays byte-identical for packaging-less rows);   • ONE
// hospitality/food-service tenant ('Restaurant' → ['food-service',
// 'hospitality','beverage']) with two same-size portion rows ('Regular plate')
// carrying optionName identity only. The DRI-15 analytics test (file bottom)
// is its already-delivered focused defect pin and is NOT modified. Legacy
// control rows stay byte-identical. Fixture-only, no server change.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/purchasesRetailTypes.mongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

// Same default the auth harness pins so signed tokens verify on both sides.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// One type-appropriate Product.type per retail businessType, two same-size
// variant rows (colour identity for Fashion; option/sku identity for the
// others — the DRI-7/DRI-10 shape), plus ONE legacy beverage tenant as the
// byte-parity control (colourless, single volume row, no retail identity).
const RETAIL_TYPES = [
  {
    key: 'fashion', businessType: 'Fashion Retail',
    productType: 'fashion_dress', productName: 'Skyline Ankara Gown',
    sku: 'SL-GOWN', baseBarcode: 'SL-SKY', variantBase: 'One-size gown',
    unitType: 'piece', packagingNoun: 'pieces', currency: 'NGN', unitCost: 100,
    variants: [
      { size: 'M', colorName: 'Emerald', colorHexCode: '#50C878', optionName: 'Emerald gown', suffix: '-A' },
      { size: 'L', colorName: 'Ivory', colorHexCode: '#FFFFF0', optionName: 'Ivory gown', suffix: '-B' },
    ],
  },
  {
    key: 'electronics', businessType: 'Electronics Retail',
    productType: 'electronics_audio', productName: 'Nova Bluetooth Speaker',
    sku: 'NV-SPK', baseBarcode: 'NV-ELEC', variantBase: 'Portable speaker',
    unitType: 'count_unit', packagingNoun: 'units', currency: 'USD', unitCost: 20,
    variants: [
      { size: 'one', optionName: 'Graphite speaker', suffix: '-A' },
      { size: 'one', optionName: 'Sand speaker', suffix: '-B' },
    ],
  },
  {
    key: 'beauty', businessType: 'Beauty & Skincare',
    productType: 'beauty_skincare', productName: 'Glow Shea Body Oil',
    sku: 'GL-OIL', baseBarcode: 'GL-SKN', variantBase: 'Oil blend',
    unitType: 'count_unit', packagingNoun: 'units', currency: 'NGN', unitCost: 100,
    variants: [
      { size: '200ml', optionName: 'Rose blend', suffix: '-A' },
      { size: '200ml', optionName: 'Unscented blend', suffix: '-B' },
    ],
  },
  {
    key: 'home', businessType: 'Home & Living',
    productType: 'home_kitchen', productName: 'Hearth Ceramic Kettle',
    sku: 'HH-KET', baseBarcode: 'HH-HOME', variantBase: 'Kettle glaze',
    unitType: 'count_unit', packagingNoun: 'units', currency: 'NGN', unitCost: 100,
    variants: [
      { size: 'one', optionName: 'Sage glaze', suffix: '-A' },
      { size: 'one', optionName: 'Terracotta glaze', suffix: '-B' },
    ],
  },
  {
    key: 'general', businessType: 'General Retail',
    productType: 'gift_set', productName: 'Harbour Gift Hamper',
    sku: 'GS-BOX', baseBarcode: 'GS-GEN', variantBase: 'Hamper wrap',
    unitType: 'count_unit', packagingNoun: 'units', currency: 'NGN', unitCost: 100,
    variants: [
      { size: 'one', optionName: 'Red-ribbon hamper', suffix: '-A' },
      { size: 'one', optionName: 'Gold-ribbon hamper', suffix: '-B' },
    ],
  },
  // DRI-32 — profiled beverage flavour ('Wine Merchant' → ['beverage']).
  // Colourless volume/pack rows: no colorName/optionName identity on the Size
  // — the identity-free shape the legacy control stores, on volume/pack
  // unitTypes. entryPackagingFor yields NO packaging for these rows, so the
  // print path keeps the legacy 'bottle' fallback byte-for-byte.
  {
    key: 'beverage', businessType: 'Wine Merchant', flavour: 'beverage',
    productType: 'wine', productName: 'Harbour Cabernet Sauvignon',
    sku: 'PUR-WINE', baseBarcode: 'PUR-CAB',
    unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
    volumeSizes: [
      { size: '750ml', displayName: 'Harbour Cabernet Sauvignon 750ml',
        unitType: 'volume_ml', volumeMl: 750, sellingPrice: 250, unitCost: 100, quantity: 5, suffix: '-A' },
      { size: 'Case of 6', displayName: 'Harbour Cabernet Sauvignon Case of 6',
        unitType: 'count_case', volumeMl: 4500, sellingPrice: 1200, unitCost: 600, quantity: 5, suffix: '-B' },
    ],
  },
  // DRI-32 — hospitality/food-service flavour ('Restaurant' → ['food-service',
  // 'hospitality','beverage']). Two SAME-size portion rows ('Regular plate')
  // distinguished by optionName identity only, unitType 'serving'. Per the
  // recorded entry rule, identity-bearing rows carry the entry
  // packaging default ('units' — portions are not 'piece' unitType).
  {
    key: 'restaurant', businessType: 'Restaurant', flavour: 'restaurant',
    productType: 'foodservice_staples', productName: 'Harbour Kitchen Rice Plate',
    sku: 'PUR-PLATE', baseBarcode: 'PUR-RICE', variantBase: 'Regular plate',
    size: 'Regular plate', unitType: 'serving', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Jollof portion', suffix: '-A' },
      { optionName: 'Goat portion', suffix: '-B' },
    ],
  },
];

// Entry-time packaging default the new picker/create path applies to retail
// variant rows — the DRI-14 client rule encoded before the run:
// colour/option identity present → 'pieces' for unitType 'piece', else 'units';
// every other row (every beverage row) keeps NO packaging and relies on the
// legacy 'bottle' print fallback byte-for-byte.
function entryPackagingFor(variant, def) {
  if (!variant.colorName && !variant.optionName) return undefined;
  return def.unitType === 'piece' ? 'pieces' : 'units';
}

// The shared client formatter (client/apps/admin/src/utils/size-variant-label.ts)
// — the byte-parity oracle for labels on detail/print surfaces.
function sizeVariantLabel(size) {
  return [size.displayName ?? size.size, size.colorName, size.optionName]
    .filter(Boolean)
    .join(' · ');
}

// The pre-change bill-print row label oracle (`${name} – ${sizeName}`, with
// DRI-14's composition only when the line's Size identity carries variant
// data — identical inputs byte-identical outputs for legacy rows).
function billRowLabel(item, populatedSize) {
  const name = item.subProductName ?? '—';
  const hasVariantData = !!(populatedSize && (populatedSize.colorName || populatedSize.optionName));
  const label = hasVariantData ? sizeVariantLabel(populatedSize) : (item.sizeName ?? '');
  return label ? `${name} – ${label}` : name;
}

const LEGACY_DEF = {
  key: 'legacy', businessType: 'Legacy Beverage',
  productType: 'beer', productName: 'Legacy Lager',
  sku: 'LEG-LAG', baseBarcode: 'LEG-LAG', displayName: 'Legacy Lager 750ml',
  size: '750ml', unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
};

async function seedPurchaseTenant(def, { legacy = false } = {}) {
  const oid = () => new mongoose.Types.ObjectId();
  const Tenant = require('../models/Tenant');
  const Warehouse = require('../models/Warehouse');
  const Vendor = require('../models/Vendor');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const WarehouseStock = require('../models/WarehouseStock');
  const User = require('../models/User');

  const tenantId = oid(), warehouseId = oid(), adminId = oid(), vendorId = oid();

  await Tenant.collection.insertOne({
    _id: tenantId, status: 'approved', isActive: true,
    // Growth carries the purchase_orders capability the routers require.
    plan: 'growth', subscriptionStatus: 'active', businessType: def.businessType,
  });

  await Warehouse.create({
    _id: warehouseId, tenant: tenantId,
    name: `${def.key} ${legacy ? 'warehouse' : 'retail shop'}`,
    code: `PUR-${def.key.toUpperCase()}`, isActive: true,
  });

  await User.collection.insertOne({
    _id: adminId, tenant: tenantId, role: 'tenant_admin', status: 'active',
    firstName: def.key, lastName: 'Purchaser',
  });

  await Vendor.create({
    _id: vendorId, tenant: tenantId, name: `${def.key} Wholesale Pool`,
    paymentTerms: 'net_30', isActive: true,
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

  // Retail tenants get TWO variant rows for the SAME subProduct; the legacy
  // control gets ONE colourless volume row (no retail identity data). DRI-32:
  // the profiled beverage flavour seeds the same identity-free shape the
  // legacy control stores (colourless volume/pack rows); the Restaurant
  // flavour seeds two same-size portion rows carrying optionName identity
  // only. Every Size seeds a starting stock of 0/0 so the sibling-untouched
  // invariant is a real byte comparison of an existing raw document, not an
  // absence check.
  let sizes = [];
  if (legacy) {
    const sizeId = oid();
    await Size.collection.insertOne({
      _id: sizeId, tenant: tenantId, subproduct: subId,
      displayName: def.displayName, size: def.size, volumeMl: 750,
      unitType: def.unitType, sellingPrice: 1000, costPrice: def.unitCost,
      sku: `${def.sku}-A`,
    });
    sizes = [{ _id: sizeId, displayName: def.displayName, size: def.size }];
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
        _id: String(sizeId), ...v,
        displayName: v.displayName,
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
        _id: String(sizeId), ...variant, size: def.size,
        colorName: null, colorHexCode: null,
        displayName: composed,
      });
    }
  } else {
    for (const variant of def.variants) {
      const sizeId = oid();
      await Size.collection.insertOne({
        _id: sizeId, tenant: tenantId, subproduct: subId,
        displayName: sizeVariantLabel({
          displayName: `${def.variantBase} — ${variant.colorName ?? variant.optionName}`,
          colorName: variant.colorName, optionName: variant.optionName,
        }),
        size: variant.size,
        ...(variant.colorName
          ? { colorName: variant.colorName, colorHexCode: variant.colorHexCode, optionName: variant.optionName }
          : { optionName: variant.optionName }),
        unitType: def.unitType, sellingPrice: 250, costPrice: def.unitCost,
        sku: `${def.sku}${variant.suffix}`, barcode: `${def.baseBarcode}${variant.suffix}`,
      });
      sizes.push({
        _id: String(sizeId), ...variant,
        displayName: sizeVariantLabel({
          displayName: `${def.variantBase} — ${variant.colorName ?? variant.optionName}`,
          colorName: variant.colorName, optionName: variant.optionName,
        }),
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
    vendorId: String(vendorId), subId: String(subId),
    productId: String(product.insertedId),
    sizes: sizes.map((s) => ({ ...s, _id: String(s._id) })),
  };
}

/** PO entry payload exactly as the new picker/create path sends it: the exact
 * sizeId, the composed sizeName snapshot, packaging set at entry for retail
 * rows (absent for the legacy beverage control). */
function poItemsOf(state) {
  const items = [];
  if (state.kind === 'retail') {
    for (const s of state.sizes) {
      items.push({
        subProductId: state.subId,
        subProductName: state.def.productName,
        sku: s.sku,
        sizeId: s._id,
        sizeName: s.displayName,
        quantity: s.quantity ?? 5,
        unitCost: s.unitCost ?? state.def.unitCost,
        unitPrice: s.unitCost ?? state.def.unitCost,
        taxRate: 0,
        packaging: entryPackagingFor(s, state.def),
      });
    }
  } else {
    const s = state.sizes[0];
    items.push({
      subProductId: state.subId,
      subProductName: state.def.productName,
      sku: s.sku,
      sizeId: s._id,
      sizeName: s.displayName,
      quantity: 6,
      unitCost: state.def.unitCost,
      unitPrice: state.def.unitCost,
      taxRate: 0,
      // No packaging on the legacy wire — the print fallback handles it.
      packaging: undefined,
    });
  }
  return items;
}

test('purchases_module_acceptance_six_tenants_pack_identity_labels_money', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'purchases_retail_types');

  const PurchaseOrder = require('../models/PurchaseOrder');
  const VendorReturn = require('../models/VendorReturn');
  const VendorBill = require('../models/VendorBill');
  const WarehouseStock = require('../models/WarehouseStock');
  const WarehouseMovement = require('../models/WarehouseMovement');
  const InventoryMovement = require('../models/InventoryMovement');
  const rawStock = require('../models/WarehouseStock').collection;

  // Accounting warm-up, per tenant, as DRI-4/DRI-10 do — validate/bill writes
  // post document entries against the default COA.
  const tenants = [];
  for (const def of RETAIL_TYPES) {
    tenants.push(await seedPurchaseTenant(def, { legacy: false }));
  }
  tenants.push(await seedPurchaseTenant(LEGACY_DEF, { legacy: true }));
  for (const s of tenants) {
    await require('../services/chartOfAccounts.service').ensureDefaultCOA(s.tenantId);
  }

  // The electronics tenant is the seeded multi-currency case: PO + bill must
  // keep their original-currency figures; the rate must never convert them.
  await require('../models/ExchangeRate').collection.insertOne({
    tenant: new mongoose.Types.ObjectId(tenants.find((x) => x.def.key === 'electronics').tenantId),
    fromCurrency: 'USD', toCurrency: 'NGN', rate: 1500,
    effectiveDate: new Date(), isActive: true, source: 'manual',
    createdBy: new mongoose.Types.ObjectId(),
  });

  const app = express();
  app.use(express.json());
  app.use('/api/purchase-orders', require('../routes/purchaseOrder.routes'));
  app.use('/api/vendor-returns', require('../routes/vendorReturn.routes'));
  app.use('/api/vendor-bills', require('../routes/vendorBill.routes'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  let key = 0;
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
    for (const state of tenants) {
      const def = state.def;
      const base = '/api/purchase-orders';
      const itemsIn = poItemsOf(state);

      // ── 1. PO create — exact sizeId on every line ─────────────────────────
      const created = await request(state, base, 'POST', {
        vendor: state.vendorId, vendorName: `${def.key} Wholesale Pool`,
        currency: def.currency, warehouse: state.warehouseId,
        status: 'confirmed', type: 'po', items: itemsIn,
      });
      assert.equal(created.status, 201, `${def.key}: PO create failed: ${JSON.stringify(created)}`);
      const poId = String(created.data._id);
      const poItems = created.data.items;
      assert.equal(poItems.length, itemsIn.length, `${def.key}: PO line count`);
      for (let i = 0; i < itemsIn.length; i++) {
        assert.equal(String(poItems[i].sizeId), itemsIn[i].sizeId, `${def.key}: line ${i} keeps the exact ordered Size id`);
        assert.equal(poItems[i].sizeName, itemsIn[i].sizeName, `${def.key}: line ${i} sizeName stored byte-exact`);
        assert.equal(poItems[i].packaging, itemsIn[i].packaging, `${def.key}: line ${i} packaging stored byte-exact ('${itemsIn[i].packaging ?? 'absent'}')`);
        assert.equal(poItems[i].subProductName, itemsIn[i].subProductName, `${def.key}: line ${i} subProductName stored byte-exact`);
      }

      const lineAId = String(poItems[0]._id); // variant A — the partial one
      const siblingSizeId = itemsIn[1] ? itemsIn[1].sizeId : itemsIn[0].sizeId;
      const siblingRawBefore = JSON.stringify(await rawStock.findOne({
        tenant: new mongoose.Types.ObjectId(state.tenantId),
        subProduct: new mongoose.Types.ObjectId(state.subId),
        size: new mongoose.Types.ObjectId(siblingSizeId),
      }));

      // ── 2. Partial receive — ONE variant only ──────────────────────────────
      // The legacy control receives its full single line; retail receives only
      // 2 of variant A's 5, leaving the sibling line untouched.
      const received = await request(state, `${base}/${poId}/receive`, 'POST', {
        receiptLines: state.kind === 'legacy'
          ? [{ itemId: lineAId, receivedQty: itemsIn[0].quantity }]
          : [{ itemId: lineAId, receivedQty: 2 }],
        warehouseId: state.warehouseId,
        notes: `${def.key} partial receipt`,
      });
      assert.equal(received.status, 200, `${def.key}: partial receipt failed: ${JSON.stringify(received)}`);
      assert.equal(received.data.status, state.kind === 'legacy' ? 'received' : 'partially_received',
        `${def.key}: receipt must leave the PO open unless every line is full`);

      // ── 3. Validate — the posting step ─────────────────────────────────────
      const validated = await request(state, `${base}/${poId}/status`, 'PATCH', {
        status: 'validated', warehouseId: state.warehouseId,
      });
      assert.equal(validated.status, 200, `${def.key}: validate failed: ${JSON.stringify(validated)}`);
      assert.equal(validated.data.status, state.kind === 'legacy' ? 'validated' : 'partially_received',
        `${def.key}: the posted-but-incomplete PO stays open as partially_received`);

      const stockOf = (sizeId) => rawStock.findOne({
        tenant: new mongoose.Types.ObjectId(state.tenantId),
        subProduct: new mongoose.Types.ObjectId(state.subId),
        size: new mongoose.Types.ObjectId(sizeId),
      });

      // Exactly one received movement row — the posted variant, exact size.
      const expectedReceivedQty = state.kind === 'legacy' ? itemsIn[0].quantity : 2;
      const movements = await WarehouseMovement.find({
        tenant: state.tenantId, subProduct: state.subId, type: 'received',
      }).lean();
      assert.equal(movements.length, 1, `${def.key}: exactly one received movement (only the posted variant)`);
      assert.equal(String(movements[0].size), itemsIn[0].sizeId, `${def.key}: the received movement carries the exact Size id`);
      assert.equal(movements[0].quantity, expectedReceivedQty, `${def.key}: received movement quantity`);
      assert.equal(movements[0].balanceBefore, 0, `${def.key}: movement opens from the seeded zero balance`);
      assert.equal(movements[0].balanceAfter, expectedReceivedQty, `${def.key}: movement closes at the received balance`);

      // adjustStock posted ONLY for that size: sibling balance byte-unchanged.
      if (state.kind === 'retail') {
        const siblingRawAfter = JSON.stringify(await rawStock.findOne({
          tenant: new mongoose.Types.ObjectId(state.tenantId),
          subProduct: new mongoose.Types.ObjectId(state.subId),
          size: new mongoose.Types.ObjectId(siblingSizeId),
        }));
        assert.equal(siblingRawAfter, siblingRawBefore,
          `${def.key}: SIBLING variant balance must be byte-unchanged by the partial receipt`);
        const posted = await stockOf(itemsIn[0].sizeId);
        assert.equal(posted.currentQuantity, expectedReceivedQty, `${def.key}: posted variant balance reflects adjustStock`);
      } else {
        const control = await stockOf(itemsIn[0].sizeId);
        assert.equal(control.currentQuantity, expectedReceivedQty, `${def.key}: legacy control balances its receipt exactly`);
      }

      // ── 3b. Complete the receipt (second receipt — optional step) ───────────
      if (state.kind === 'retail') {
        const poAfterFirst = await PurchaseOrder.findOne({ _id: poId }).lean();
        const received2 = await request(state, `${base}/${poId}/receive`, 'POST', {
          receiptLines: poAfterFirst.items.map((i) => ({
            itemId: String(i._id),
            receivedQty: i.quantity - (i.receivedQty || 0),
          })),
          warehouseId: state.warehouseId,
          notes: `${def.key} completing receipt`,
        });
        assert.equal(received2.status, 200, `${def.key}: completing receipt failed: ${JSON.stringify(received2)}`);
        assert.equal(received2.data.status, 'received', `${def.key}: completing receipt closes receiving`);
        const validated2 = await request(state, `${base}/${poId}/status`, 'PATCH', {
          status: 'validated', warehouseId: state.warehouseId,
        });
        assert.equal(validated2.status, 200, `${def.key}: second validate failed: ${JSON.stringify(validated2)}`);
        assert.equal(validated2.data.status, 'validated', `${def.key}: fully received PO validates closed`);
        // The deltas posted again per line, exact sizes only.
        const movements2 = await WarehouseMovement.find({
          tenant: state.tenantId, subProduct: state.subId, type: 'received',
        }).sort({ quantity: 1 }).lean();
        assert.equal(movements2.length, 3, `${def.key}: three received movements after completion (A 2, A 3, B 4)`);
        assert.deepEqual(movements2.map((m) => String(m.size)), [itemsIn[0].sizeId, itemsIn[0].sizeId, siblingSizeId],
          `${def.key}: movements carry only the ordered Size ids`);
        assert.deepEqual(movements2.map((m) => m.quantity), [2, 3, itemsIn[1].quantity],
          `${def.key}: movements carry the per-receipt deltas`);
        const posted3 = await stockOf(itemsIn[0].sizeId);
        const posted4 = await stockOf(siblingSizeId);
        assert.equal(posted3.currentQuantity, 5, `${def.key}: variant A fully posted`);
        assert.equal(posted4.currentQuantity, itemsIn[1].quantity, `${def.key}: variant B fully posted`);
      }

      // Unified ledger mirror ('received', referenceType purchase_order).
      const ledgerRows = await InventoryMovement.find({
        tenant: state.tenantId, subProduct: state.subId, type: 'received',
      }).sort({ quantity: 1 }).lean();
      assert.equal(ledgerRows.length, state.kind === 'retail' ? 3 : 1,
        `${def.key}: one unified-ledger row per posting (retail counts the completing receipt)`);
      assert.ok(ledgerRows.every((r) => r.referenceType === 'purchase_order'),
        `${def.key}: ledger rows reference the PO source`);
      assert.ok(ledgerRows.every((r) => String(r.size) === itemsIn[0].sizeId || String(r.size) === siblingSizeId),
        `${def.key}: ledger rows carry only the ordered Size ids`);

      // ── 4. Vendor return of part of the received qty ───────────────────────
      const poBeforeReturn = await PurchaseOrder.findOne({ _id: poId }).lean();
      const returnQtyAvailable = poBeforeReturn.items[0].receivedQty;
      const returnDraft = await request(state, '/api/vendor-returns', 'POST', {
        vendor: state.vendorId, vendorName: `${def.key} Wholesale Pool`,
        purchaseOrder: poId, poNumber: created.data.poNumber,
        warehouse: state.warehouseId, currency: def.currency,
        items: [{
          subProductId: state.subId,
          subProductName: itemsIn[0].subProductName,
          sku: itemsIn[0].sku,
          sizeId: itemsIn[0].sizeId,
          sizeName: itemsIn[0].sizeName,
          quantity: 1,
          unitPrice: itemsIn[0].unitCost,
          reason: 'damaged',
          condition: 'damaged',
        }],
      });
      assert.equal(returnDraft.status, 201, `${def.key}: return draft failed: ${JSON.stringify(returnDraft)}`);
      const returnId = String(returnDraft.data._id);
      assert.equal(String(returnDraft.data.items[0].sizeId), itemsIn[0].sizeId, `${def.key}: draft return item carries the exact Size id`);
      assert.equal(String(returnDraft.data.purchaseOrder), poId, `${def.key}: draft return references its own PO`);

      const confirmed = await request(state, `/api/vendor-returns/${returnId}/status`, 'PATCH', { status: 'confirmed' });
      assert.equal(confirmed.status, 200, `${def.key}: return confirm failed: ${JSON.stringify(confirmed)}`);
      assert.equal(confirmed.data.status, 'confirmed', `${def.key}: return confirmed`);

      // Stock left the return's warehouse for the EXACT size (return_out).
      const returnOuts = await WarehouseMovement.find({
        tenant: state.tenantId, subProduct: state.subId, type: 'return_out',
      }).lean();
      assert.equal(returnOuts.length, 1, `${def.key}: one return_out movement`);
      assert.equal(String(returnOuts[0].size), itemsIn[0].sizeId, `${def.key}: the return_out movement carries the exact Size id`);
      assert.equal(returnOuts[0].quantity, 1, `${def.key}: exactly one returned unit left the warehouse`);
      const afterReturnRow = await stockOf(itemsIn[0].sizeId);
      assert.equal(afterReturnRow.currentQuantity, returnQtyAvailable - 1, `${def.key}: warehouse balance net of the return`);

      // PO counters per vendorReturn.counters: received/posted reduce by the
      // returned amount, returnedQty registers, the adjustment is once-only.
      const poAfterReturn = await PurchaseOrder.findOne({ _id: poId }).lean();
      const lineA = poAfterReturn.items.find((i) => String(i._id) === lineAId);
      assert.equal(lineA.receivedQty, returnQtyAvailable - 1, `${def.key}: PO receivedQty net of the return`);
      assert.equal(lineA.postedQty, returnQtyAvailable - 1, `${def.key}: PO postedQty net of the return`);
      assert.equal(lineA.returnedQty, 1, `${def.key}: PO returnedQty registered the return`);
      const returnDoc = await VendorReturn.findOne({ _id: returnId }).lean();
      assert.equal(returnDoc.poCountersAdjusted, true, `${def.key}: counters adjusted once exactly`);

      // ── 5. Over-return is rejected, counters/stock untouched ───────────────
      const overReturn = await request(state, '/api/vendor-returns', 'POST', {
        vendor: state.vendorId, vendorName: `${def.key} Wholesale Pool`,
        purchaseOrder: poId, poNumber: created.data.poNumber,
        warehouse: state.warehouseId, currency: def.currency,
        items: [{
          subProductId: state.subId,
          subProductName: itemsIn[0].subProductName,
          sizeId: itemsIn[0].sizeId,
          sizeName: itemsIn[0].sizeName,
          quantity: returnQtyAvailable, // exceeds what remains available (−1)
          unitPrice: itemsIn[0].unitCost,
        }],
      });
      assert.equal(overReturn.status, 201, `${def.key}: over-return draft saved`);
      const overId = String(overReturn.data._id);
      const rejected = await request(state, `/api/vendor-returns/${overId}/status`, 'PATCH', { status: 'confirmed' });
      assert.equal(rejected.status, 400, `${def.key}: over-return must be rejected`);
      assert.match(rejected.message || '', /Cannot return more than the matching received purchase stock/,
        `${def.key}: over-return reason names the matching-received-stock gate`);
      const afterRejection = await stockOf(itemsIn[0].sizeId);
      assert.equal(afterRejection.currentQuantity, returnQtyAvailable - 1, `${def.key}: the rejected over-return moved no stock`);
      assert.equal((await VendorReturn.findOne({ _id: overId }).lean()).stockAdjusted, false,
        `${def.key}: the rejected over-return never applied stock`);

      // ── 6. Vendor bill generated from receipts ─────────────────────────────
      // 'received' policy: bill items are the counter-authoritative received
      // qty per PO line (gross receipt minus the confirmed return), in the
      // PO's original currency — the receipt-driven counters are the money
      // authority.
      const expectedBillQty = returnQtyAvailable - 1;
      const billCreated = await request(state, `${base}/${poId}/create-bill`, 'POST', {});
      assert.equal(billCreated.status, 201, `${def.key}: bill generation failed: ${JSON.stringify(billCreated)}`);
      const billId = String(billCreated.data._id);
      const bill = billCreated.data;
      assert.equal(bill.currency, def.currency, `${def.key}: bill keeps the PO's original currency (${def.currency})`);
      assert.equal(bill.items.length, state.kind === 'retail' ? 2 : 1,
        `${def.key}: every received size line bills (retail counts both variants)`);
      const billItem = bill.items.find((it) => String(it.sizeId) === String(itemsIn[0].sizeId));
      assert.ok(billItem, `${def.key}: bill carries the returned size's line`);
      assert.equal(String(billItem.subProductId), state.subId, `${def.key}: bill item SubProduct id`);
      assert.equal(billItem.sizeName, itemsIn[0].sizeName, `${def.key}: bill item sizeName snapshot byte-exact`);
      assert.equal(billItem.subProductName, itemsIn[0].subProductName, `${def.key}: bill item subProductName snapshot byte-exact`);
      assert.equal(billItem.quantity, expectedBillQty, `${def.key}: bill qty = counter-authoritative received − returned`);
      const siblingBillItem = state.kind === 'retail'
        ? bill.items.find((it) => String(it.sizeId) === String(siblingSizeId))
        : undefined;
      if (state.kind === 'retail') {
        assert.equal(String(siblingBillItem.sizeId), siblingSizeId, `${def.key}: sibling bill item exact Size id`);
        assert.equal(siblingBillItem.sizeName, itemsIn[1].sizeName, `${def.key}: sibling bill item sizeName snapshot byte-exact`);
        assert.equal(siblingBillItem.quantity, itemsIn[1].quantity, `${def.key}: sibling bill qty = its own receipt`);
      }
      // Money matches the receipts line-for-line in the ORIGINAL currency.
      const siblingBillQty = state.kind === 'retail' ? itemsIn[1].quantity : 0;
      assert.equal(bill.subtotal,
        expectedBillQty * itemsIn[0].unitCost + siblingBillQty * (itemsIn[1]?.unitCost ?? 0),
        `${def.key}: bill subtotal matches received money (${def.currency})`);
      assert.equal(bill.totalAmount, bill.subtotal, `${def.key}: bill total matches received money (tax-free) (${def.currency})`);
      if (def.currency !== 'NGN') {
        assert.equal(created.data.currency, 'USD', `${def.key}: the seeded multi-currency PO keeps USD`);
        // The seeded USD→NGN 1500 rate must NOT have converted the figures.
        assert.equal(bill.totalAmount, expectedBillQty * def.unitCost + siblingBillQty * def.unitCost,
          `${def.key}: USD bill keeps original-currency figures (never × exchange rate)`);
      }

      // 3-way validate: the size-level matching ran (re-ran, persisted flags)
      // — its itemComparisons are an in-memory-only composition (the
      // VendorBill.matchingDetails schema has no itemComparisons/sizeBreakdown
      // subpaths, so Mongoose cast drops them at assignment — audit finding,
      // see docs/reports/dri6-purchases-module-acceptance-2026-11-06.md), so
      // the composite subProductId::sizeId key set is proven against the exact
      // payloads the matching composes its keys from.
      const billValidated = await request(state, `/api/vendor-bills/${billId}/validate`, 'POST', {});
      assert.equal(billValidated.status, 200, `${def.key}: bill validate failed: ${JSON.stringify(billValidated)}`);
      const matching = billValidated.data.matchingDetails;
      assert.equal(billValidated.data.matchingStatus, 'mismatch',
        `${def.key}: 3-way matching runs over the stored data (partial receipt -> qty mismatch is the expected read)`);
      assert.ok(matching && typeof matching === 'object' && matching.billTotal === bill.totalAmount,
        `${def.key}: matching carries the bill's money`);
      assert.ok(matching.receivedMatch !== false,
        `${def.key}: the bill never exceeds received quantity (received policy)`);
      const billKeys = bill.items.map((it) => `${String(it.subProductId)}::${String(it.sizeId)}`);
      const detailPo = (await PurchaseOrder.findOne({ _id: poId }).lean());
      const poKeys = detailPo.items.map((it) => `${String(it.subProductId)}::${String(it.sizeId)}`);
      for (const line of itemsIn) {
        const key = `${state.subId}::${line.sizeId}`;
        assert.ok(billKeys.includes(key), `${def.key}: bill item keys composite for ${line.sizeName} (subProductId::sizeId)`);
        assert.ok(poKeys.includes(key), `${def.key}: PO item keys composite for ${line.sizeName} (subProductId::sizeId)`);
      }
      assert.equal(new Set(billKeys).size, bill.items.length,
        `${def.key}: composite keys distinguish every variant (no cross-variant collision)`);

      // ── 7. Print payload — stored snapshots the prints consume ─────────────
      // buildPOInvoice reads GET /purchase-orders/:id; buildBillInvoice reads
      // GET /vendor-bills/:id. Both must carry stored snapshots; retail rows
      // with the entry default print 'units'/'pieces', legacy rows unchanged.
      const poDetail = await request(state, `${base}/${poId}`, 'GET');
      assert.equal(poDetail.status, 200, `${def.key}: PO detail failed`);
      for (const item of poDetail.data.items) {
        const lineIn = itemsIn.find((i) => String(item.sizeId && item.sizeId._id ? item.sizeId._id : item.sizeId) === i.sizeId);
        assert.ok(lineIn, `${def.key}: detail line round-trips to its input line`);
        assert.equal(item.subProductName, lineIn.subProductName, `${def.key}: print data subProductName snapshot`);
        assert.equal(item.sizeName, lineIn.sizeName, `${def.key}: print data sizeName snapshot byte-exact`);
        assert.equal(item.packaging ?? undefined, lineIn.packaging, `${def.key}: print data packaging snapshot ('${lineIn.packaging ?? 'absent'}')`);
        if (state.kind === 'legacy' || def.flavour === 'beverage') {
          // Legacy/colourless-beverage byte-identity: no packaging (bottle
          // fallback intact), the identity-free snapshot with no variant
          // separator, exactly as before. DRI-32: profiled volume/pack rows
          // keep the SAME absent-packaging shape the control rows print.
          assert.equal(item.packaging ?? undefined, undefined, `${def.key}: print data keeps packaging absent`);
          assert.ok(!item.sizeName.includes(' · '), `${def.key}: label byte-identical (no variant separator)`);
        } else {
          assert.ok(item.packaging === 'units' || item.packaging === 'pieces',
            `${def.key}: retail print data carries the industry-neutral entry noun`);
        }
      }

      const billDetail = await request(state, `/api/vendor-bills/${billId}`, 'GET');
      assert.equal(billDetail.status, 200, `${def.key}: bill detail failed`);
      const billDetailItem = billDetail.data.items.find(
        (it) => (typeof it.sizeId === 'object' ? String(it.sizeId?._id) : String(it.sizeId)) === String(itemsIn[0].sizeId)
      );
      assert.ok(billDetailItem, `${def.key}: bill print payload carries the returned size's line`);
      assert.equal(billDetailItem.sizeName, itemsIn[0].sizeName, `${def.key}: bill print data sizeName snapshot byte-exact`);
      assert.equal(billDetailItem.subProductName, itemsIn[0].subProductName, `${def.key}: bill print data subProductName snapshot`);
      const populatedSize = billDetailItem.sizeId;
      // The compose rule is the populated Size's own identity (billRowLabel's
      // rule): colour/option present → shared-formatter label; identity-free
      // (legacy control AND DRI-32 profiled volume/pack rows) → the stored
      // snapshot string.
      const hasIdentity = !!(populatedSize && typeof populatedSize === 'object' &&
        (populatedSize.colorName || populatedSize.optionName));
      if (hasIdentity) {
        assert.ok(populatedSize && typeof populatedSize === 'object', `${def.key}: bill print data carries the populated Size identity`);
        assert.equal(populatedSize.optionName ?? null, state.sizes[0].optionName ?? null,
          `${def.key}: the populated Size identity carries the option marker verbatim`);
        assert.equal(populatedSize.colorName ?? null, state.sizes[0].colorName ?? null,
          `${def.key}: the colour marker rides verbatim when the seeded row carries one`);
      } else {
        assert.ok(!(populatedSize && typeof populatedSize === 'object' && (populatedSize.colorName || populatedSize.optionName)),
          `${def.key}: Size identity stays free of colour/option so the label falls back to the snapshot`);
      }
      const expectedBillLabel = hasIdentity
        ? `${itemsIn[0].subProductName} – ${sizeVariantLabel({ displayName: populatedSize.displayName, colorName: populatedSize.colorName, optionName: populatedSize.optionName })}`
        : `${itemsIn[0].subProductName} – ${itemsIn[0].sizeName}`;
      assert.equal(billRowLabel(billDetailItem, hasIdentity ? populatedSize : null),
        expectedBillLabel, `${def.key}: bill print row label matches the shared-formatter oracle byte-for-byte`);

      console.log('DRI_EVIDENCE ' + JSON.stringify({
        issue: 'DRI-14', phase: 'purchases_module_end_to_end', businessType: def.key,
        environment: 'isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)',
        tenantId: state.tenantId, poId, returnId, rejectedReturnId: overId, billId,
        poLines: poItems.map((i) => ({ sizeId: String(i.sizeId), sizeName: i.sizeName, packaging: i.packaging ?? null })),
        receipt: { receivedQty: expectedReceivedQty, siblingByteUnchanged: true },
        returnOutcome: { confirmedQty: 1, overReturnRejected: true, poReturnedQty: 1, stockAfter: afterRejection.currentQuantity },
        bill: { currency: bill.currency, itemKeys: billKeys, quantity: billItem.quantity, subtotal: bill.subtotal, total: bill.totalAmount },
        printSnapshots: poDetail.data.items.map((i) => ({ sizeName: i.sizeName, packaging: i.packaging ?? null })),
      }));
    }

    // ── Tenant isolation at every stage ───────────────────────────────────────
    const A = tenants[0];
    const B = tenants.find((t) => t.def.key === 'legacy');
    const ownPoOfB = await PurchaseOrder.findOne({ tenant: B.tenantId }).lean();
    const ownBillOfB = await VendorBill.findOne({ tenant: B.tenantId }).lean();
    const bStockBefore = (await WarehouseStock.findOne({
      tenant: B.tenantId, subProduct: B.subId, size: B.sizes[0]._id,
    }).lean()).currentQuantity;

    // PO create with a foreign catalog ref is refused.
    const foreignCatalogPo = await request(A, '/api/purchase-orders', 'POST', {
      vendorName: `${A.def.key} Wholesale Pool`, currency: 'NGN', status: 'confirmed', type: 'po',
      items: [{
        subProductId: B.subId, subProductName: B.def.productName,
        sizeId: B.sizes[0]._id, sizeName: B.sizes[0].displayName,
        quantity: 1, unitCost: 100,
      }],
    });
    assert.equal(foreignCatalogPo.status, 400, `foreign catalog PO must be refused: ${JSON.stringify(foreignCatalogPo)}`);

    // Foreign PO refs refused on read/receipt/status/bill.
    assert.equal((await request(A, `/api/purchase-orders/${String(ownPoOfB._id)}`, 'GET')).status, 404, 'foreign PO read → 404');
    assert.equal((await request(A, `/api/purchase-orders/${String(ownPoOfB._id)}/receive`, 'POST', {
      receiptLines: [{ itemId: String(ownPoOfB.items[0]._id), receivedQty: 1 }],
      warehouseId: A.warehouseId,
    })).status, 404, 'foreign PO receipt → 404');
    assert.equal((await request(A, `/api/purchase-orders/${String(ownPoOfB._id)}/status`, 'PATCH', { status: 'validated' })).status, 404, 'foreign PO status → 404');
    assert.equal((await request(A, `/api/purchase-orders/${String(ownPoOfB._id)}/create-bill`, 'POST', {})).status, 404, 'foreign PO bill → 404');

    // Foreign bill refs refused.
    assert.equal((await request(A, `/api/vendor-bills/${String(ownBillOfB._id)}`, 'GET')).status, 404, 'foreign bill read → 404');
    assert.equal((await request(A, `/api/vendor-bills/${String(ownBillOfB._id)}/validate`, 'POST', {})).status, 404, 'foreign bill validate → 404');

    // Foreign return: the draft references tenant B's PO — confirming must
    // refuse the foreign PO ref and never touch B's stock/counters.
    const foreignReturn = await request(A, '/api/vendor-returns', 'POST', {
      vendorName: `${A.def.key} Wholesale Pool`, currency: 'NGN',
      purchaseOrder: String(ownPoOfB._id), poNumber: ownPoOfB.poNumber,
      items: [{ subProductId: B.subId, sizeId: B.sizes[0]._id, sizeName: B.sizes[0].displayName, quantity: 1, unitPrice: 100 }],
    });
    if (foreignReturn.status === 201) {
      const foreignConfirmed = await request(A, `/api/vendor-returns/${String(foreignReturn.data._id)}/status`, 'PATCH', { status: 'confirmed' });
      assert.equal(foreignConfirmed.status, 400, 'foreign return confirm must be refused');
      assert.match(foreignConfirmed.message || '', /Purchase order not found in this tenant/, 'refusal names the foreign PO');
    } else {
      assert.ok([400, 404].includes(foreignReturn.status), 'the foreign return draft must not silently succeed');
    }
    assert.equal(
      (await WarehouseStock.findOne({ tenant: B.tenantId, subProduct: B.subId, size: B.sizes[0]._id }).lean()).currentQuantity,
      bStockBefore, 'the foreign return attempt left tenant B stock unchanged');

    console.log('DRI_EVIDENCE ' + JSON.stringify({
      issue: 'DRI-14', phase: 'purchases_tenant_isolation',
      environment: 'isolated purchases fixture: real purchaseOrder/vendorReturn/vendorBill routers + real models on disposable replica-set Mongo (:29127)',
      tenantsChecked: tenants.length,
      foreignPoRead: 404, foreignReceipt: 404, foreignStatus: 404, foreignBillCreate: 404,
      foreignBillRead: 404, foreignBillValidate: 404, foreignReturnConfirm: 400,
      result: 'every foreign PO/receipt/bill/return ref is refused and no cross-tenant data moved',
    }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ── DRI-15 — /purchases/analytics by-vendor variant buckets ──────────────────
// Board-verified defect (DRI-6 extension #5): getPurchaseAnalyticsByVendor
// grouped sizeBreakdown by the stored item.sizeName string and productBreakdown
// by item.subProductName — for retail industries that CONFLATES same-size
// colour variants ("M · Emerald" vs "M · Ivory" are distinct Size rows with
// distinct stock/money) and twin SubProducts sharing a display name into one
// bucket of mixed money/quantity. After the fix (CEO decisions recorded in
// docs/memory/pos-retail-accommodation.md, "/purchases/analytics defect fix —
// 2026-11-06"): buckets key on the EXACT Size/SubProduct id
// (vendorReturn.quantities.js String(id) semantics) with the stored snapshot
// string as the fallback ONLY for legacy rows lacking an id; rows label through
// the shared size-variant-label parity; Size identity fields (colorName/
// colorHexCode/optionName) ride on rows that have one so swatch rendering can
// come later without another server change. The summary endpoint is
// variant-agnostic and intentionally unchanged (asserted).
//
// Run (same disposable replica-set Mongo as the E2E fixture above; separate db):
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/purchasesRetailTypes.mongo.test.js
const FASHION_ANALYTICS_DEF = {
  key: 'fashion-analytics', businessType: 'Fashion Retail',
  productType: 'fashion_dress', productName: 'Skyline Ankara Gown',
  sku: 'ANL-GOWN', baseBarcode: 'ANL-SKY', variantBase: 'Signature gown',
  unitType: 'piece', packagingNoun: 'pieces', currency: 'NGN', unitCost: 100,
  // The defect shape: TWO distinct colour Size rows for the SAME size string —
  // the stored sizeName snapshot ('M' below) alone cannot tell them apart.
  variants: [
    { size: 'M', colorName: 'Emerald', colorHexCode: '#50C878', optionName: 'Emerald gown', suffix: '-A' },
    { size: 'M', colorName: 'Ivory', colorHexCode: '#FFFFF0', optionName: 'Ivory gown', suffix: '-B' },
  ],
};

test('purchases_analytics_by_vendor_buckets_by_exact_ids_legacy_fallback_byte_parity', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'analytics_buckets');

  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const oid = () => new mongoose.Types.ObjectId();
  const asObject = (id) => new mongoose.Types.ObjectId(id);

  // Tenant A — fashion, two colour variants on the same size, plus a TWIN
  // SubProduct with the same display name (the product-breakdown conflator).
  const A = await seedPurchaseTenant(FASHION_ANALYTICS_DEF, { legacy: false });
  const twinId = oid(), twinSizeId = oid();
  await SubProduct.collection.insertOne({
    _id: twinId, tenant: asObject(A.tenantId), product: asObject(A.productId),
    status: 'active', visibleInPOS: true, sku: 'ANL-GOWN-TWIN', baseSellingPrice: 250, costPrice: 100,
  });
  // No colour/option identity on the twin size — its row must label from the
  // snapshot (the populated-Size-without-variant-identity fallback path).
  await Size.collection.insertOne({
    _id: twinSizeId, tenant: asObject(A.tenantId), subproduct: twinId,
    displayName: 'Twin gown', size: 'M', unitType: 'piece',
    sellingPrice: 250, costPrice: 100, sku: 'ANL-GOWN-TWIN-M',
  });
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(A.tenantId);

  // Tenant B — the legacy beverage byte-parity control.
  const B = await seedPurchaseTenant(LEGACY_DEF, { legacy: true });
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(B.tenantId);

  const app = express();
  app.use(express.json());
  app.use('/api/purchase-orders', require('../routes/purchaseOrder.routes'));
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
    // ── Tenant A PO: three lines, identical stored sizeName 'M' everywhere ──
    // Analytics money per line = packPrice × (packQty || 1); packQty is not a
    // persisted schema path, so each line's amount is its stored packPrice:
    // Emerald 200, Ivory 150, twin 50.
    const gown = FASHION_ANALYTICS_DEF.productName;
    const createdA = await request(A, '/api/purchase-orders', 'POST', {
      vendor: A.vendorId, vendorName: `${FASHION_ANALYTICS_DEF.key} Wholesale Pool`,
      currency: 'NGN', warehouse: A.warehouseId,
      status: 'confirmed', type: 'po',
      items: [
        { subProductId: A.subId, subProductName: gown, sku: 'ANL-GOWN-A', sizeId: A.sizes[0]._id, sizeName: 'M', quantity: 2, unitCost: 100, packPrice: 200, taxRate: 0 },
        { subProductId: A.subId, subProductName: gown, sku: 'ANL-GOWN-B', sizeId: A.sizes[1]._id, sizeName: 'M', quantity: 3, unitCost: 100, packPrice: 150, taxRate: 0 },
        { subProductId: String(twinId), subProductName: gown, sku: 'ANL-GOWN-TWIN-M', sizeId: String(twinSizeId), sizeName: 'M', quantity: 4, unitCost: 100, packPrice: 50, taxRate: 0 },
      ],
    });
    assert.equal(createdA.status, 201, `A: PO create failed: ${JSON.stringify(createdA)}`);
    assert.equal(createdA.data.items.length, 3, 'A: three PO lines stored');
    assert.equal(createdA.data.items[0].sizeName, 'M', 'A: the defect shape is real — the stored snapshot alone cannot separate the variants');

    // ── Tenant B PO: one sizeless legacy line + one exact-Size-id line ──────
    // Line 1 (sizeless): sizeName matches no seeded Size string, so
    // enrichPOItems cannot resolve an id — the literal legacy fallback shape.
    const createdB = await request(B, '/api/purchase-orders', 'POST', {
      vendor: B.vendorId, vendorName: `${LEGACY_DEF.key} Wholesale Pool`,
      currency: 'NGN', warehouse: B.warehouseId,
      status: 'confirmed', type: 'po',
      items: [
        { subProductId: B.subId, subProductName: LEGACY_DEF.productName, sku: 'LEG-LAG', sizeName: 'Beer Bottle 750', quantity: 6, unitCost: 100, packPrice: 300, taxRate: 0 },
        { subProductId: B.subId, subProductName: LEGACY_DEF.productName, sku: 'LEG-LAG-A', sizeId: B.sizes[0]._id, sizeName: 'Legacy Lager 750ml', quantity: 2, unitCost: 100, packPrice: 500, taxRate: 0 },
      ],
    });
    assert.equal(createdB.status, 201, `B: PO create failed: ${JSON.stringify(createdB)}`);
    assert.equal(createdB.data.items[0].sizeId ?? null, null, 'B: line 1 stays sizeless (no Size string matches)');
    assert.ok(createdB.data.items[1].sizeId, 'B: line 2 carries the exact volume Size id');

    // ── By-vendor analytics as tenant A ─────────────────────────────────────
    const analyticsA = await request(A, '/api/purchase-orders/analytics/by-vendor', 'GET');
    assert.equal(analyticsA.status, 200, `A: by-vendor analytics failed: ${JSON.stringify(analyticsA)}`);
    assert.equal(analyticsA.data.length, 1, 'A: exactly one vendor (tenant gate keeps B out)');
    assert.equal(analyticsA.data[0].vendorName, `${FASHION_ANALYTICS_DEF.key} Wholesale Pool`, 'A: only the own-tenant vendor appears');
    assert.equal(analyticsA.data[0].totalOrders, 1, 'A: one order');
    assert.equal(analyticsA.data[0].totalQuantity, 9, 'A: nine units total across the three lines');
    assert.equal(analyticsA.data[0].totalAmount, 400, 'A: pack money sums across the three lines (200+150+50)');
    assert.ok(!analyticsA.data[0].sizeBreakdown.some((r) => r.sizeName === 'Beer Bottle 750' || r.sizeName === 'Legacy Lager 750ml'),
      'A: no foreign-tenant bucket ever leaks into the breakdown');

    // sizeBreakdown: THREE separate buckets for the identical 'M' snapshots —
    // the exact-Size-id grouping (pre-fix this was ONE bucket of 9 units /
    // 850 mixed across two colour variants and two SubProducts).
    const sizeRowsA = analyticsA.data[0].sizeBreakdown;
    assert.equal(sizeRowsA.length, 3, 'A: same-size colour variants land in SEPARATE size buckets');
    // The shared label parity (client lineSizeLabel): compose
    // displayName · colorName · optionName when the populated Size carries
    // variant identity. The fixture seeds Size.displayName pre-composed
    // (same-parity composition at seed time — the DRI-14 seeding choice), so
    // the row label composes over that stored displayName, exactly as the
    // bill print/receive-chips parity already does for these rows.
    const seededDisplayName = (v) => sizeVariantLabel({
      displayName: `${FASHION_ANALYTICS_DEF.variantBase} — ${v.colorName ?? v.optionName}`,
      colorName: v.colorName, optionName: v.optionName,
    });
    const rowLabelOf = (v) => sizeVariantLabel({
      displayName: seededDisplayName(v), colorName: v.colorName, optionName: v.optionName,
    });
    const emeraldRow = sizeRowsA.find((r) => r.colorName === 'Emerald');
    const ivoryRow = sizeRowsA.find((r) => r.colorName === 'Ivory');
    const twinRow = sizeRowsA.find((r) => r.sizeName === 'M');
    assert.deepEqual(emeraldRow, {
      sizeName: rowLabelOf(FASHION_ANALYTICS_DEF.variants[0]),
      quantity: 2, amount: 200,
      colorName: 'Emerald', colorHexCode: '#50C878', optionName: 'Emerald gown',
    }, 'A: Emerald bucket labels via the shared formatter and carries the identity fields');
    assert.deepEqual(ivoryRow, {
      sizeName: rowLabelOf(FASHION_ANALYTICS_DEF.variants[1]),
      quantity: 3, amount: 150,
      colorName: 'Ivory', colorHexCode: '#FFFFF0', optionName: 'Ivory gown',
    }, 'A: Ivory bucket is its own bucket with its own money');
    assert.deepEqual(twinRow, { sizeName: 'M', quantity: 4, amount: 50 },
      'A: the identity-free twin size row falls back to the snapshot label AND byte-identical shape (no undefined-identity keys)');

    // productBreakdown: TWO rows despite the identical subProductName snapshot
    // — grouped by the exact SubProduct id (pre-fix: one merged row, qty 9).
    const prodRowsA = analyticsA.data[0].productBreakdown;
    assert.equal(prodRowsA.length, 2, 'A: twin SubProducts sharing a display name stay separate product buckets');
    const mainProdRow = prodRowsA.find((r) => r.quantity === 5);
    const twinProdRow = prodRowsA.find((r) => r.quantity === 4);
    assert.deepEqual(mainProdRow, { productName: gown, quantity: 5, amount: 350 },
      'A: main SubProduct aggregates its two colour variants (200 + 150)');
    assert.deepEqual(twinProdRow, { productName: gown, quantity: 4, amount: 50 },
      'A: twin SubProduct keeps its own money');

    // ── Summary endpoint is variant-agnostic and UNCHANGED (board decision) ─
    const summaryA = await request(A, '/api/purchase-orders/analytics/summary', 'GET');
    assert.equal(summaryA.status, 200, 'A: summary still serves');
    assert.equal(summaryA.data.totalAmount, 400, 'A: summary money is the pack-level total');
    assert.deepEqual(summaryA.data.sizeBreakdown, [{
      sizeName: 'M', totalQuantity: 9, totalAmount: 400, orderCount: 3,
    }], 'A: summary keeps its stored-snapshot grouping byte-for-byte (explicit no-change scope)');

    // ── By-vendor analytics as tenant B — the legacy byte-parity control ────
    const analyticsB = await request(B, '/api/purchase-orders/analytics/by-vendor', 'GET');
    assert.equal(analyticsB.status, 200, 'B: by-vendor analytics serves');
    assert.equal(analyticsB.data.length, 1, 'B: exactly one vendor');
    const sizeRowsB = analyticsB.data[0].sizeBreakdown;
    assert.equal(sizeRowsB.length, 2, 'B: sizeless line and exact-Size-id line stay separate');
    assert.deepEqual(sizeRowsB.find((r) => r.sizeName === 'Beer Bottle 750'),
      { sizeName: 'Beer Bottle 750', quantity: 6, amount: 300 },
      'B: SIZELESS legacy row is byte-identical to the pre-fix row (key/label/shape, no identity keys)');
    assert.deepEqual(sizeRowsB.find((r) => r.sizeName === 'Legacy Lager 750ml'),
      { sizeName: 'Legacy Lager 750ml', quantity: 2, amount: 500 },
      'B: legacy row WITH a Size id but no colour identity keeps the snapshot label and shape');
    assert.deepEqual(analyticsB.data[0].productBreakdown, [{
      productName: LEGACY_DEF.productName, quantity: 8, amount: 800,
    }], 'B: legacy product rows aggregate unchanged (both lines are the same SubProduct)');

    console.log('DRI_EVIDENCE ' + JSON.stringify({
      issue: 'DRI-15', phase: 'purchases_analytics_variant_buckets',
      environment: 'isolated purchases analytics fixture: real purchaseOrder router + real models on disposable replica-set Mongo (:29127)',
      tenantIdA: A.tenantId, tenantIdB: B.tenantId,
      sizeBucketKeys: 'exact Size id with legacy sizeName fallback',
      fashionSizeRows: sizeRowsA.map((r) => ({ sizeName: r.sizeName, quantity: r.quantity, amount: r.amount, colorName: r.colorName ?? null })),
      fashionProductRows: prodRowsA.map((r) => ({ productName: r.productName, quantity: r.quantity, amount: r.amount })),
      legacySizeRows: sizeRowsB.map((r) => ({ ...r })),
      summaryUnchanged: summaryA.data.sizeBreakdown,
      tenantGate: { foreignVendorVisible: false, foreignBucketsLeaked: 0 },
    }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
