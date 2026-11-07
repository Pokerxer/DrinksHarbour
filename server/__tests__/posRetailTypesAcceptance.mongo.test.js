'use strict';
// DRI-7 — POS till acceptance across ALL FIVE retail business types.
//
// Extends the verified DRI-4 single-tenant walk (posTillAcceptance.mongo.test.js,
// kept byte-stable as DRI-4's evidence) to Fashion Retail, Electronics Retail,
// Beauty & Skincare, Home & Living and General Retail. Per the DRI-6 CEO
// decision (docs/memory/pos-retail-accommodation.md) the POS is
// business-type-agnostic; this fixture VERIFIES that contract empirically and
// introduces no new gating.
//
// DRI-32 extension (board correction 9d3ea157, 7-industry frame): besides the
// five retail types, the matrix now seeds   • ONE profiled beverage tenant
// ('Wine Merchant' → ['beverage']) with colourless volume/pack rows (no
// colour/option identity — the shape real beverage rows store), and   • ONE
// hospitality/food-service tenant ('Restaurant' → ['food-service',
// 'hospitality','beverage']) with two same-size portion rows ('Regular plate')
// distinguished by optionName identity only. The unprofiled legacy beverage
// control for the till surface stays the byte-stable DRI-4 fixture
// (posTillAcceptance.mongo.test.js — re-run, not modified). Per-type counts,
// money and pairs below are computed from the seeded prices/tenant set;
// retail rows keep their exact pre-extension bytes.
//
// Per type, over the real POS HTTP path (routes/pos.routes.js on real models,
// disposable PID-suffixed replica-set DB): picker labels → session open → cash
// simulation → per-row WarehouseMovement deduction → refused cross-type sale
// and tampered Size ID (zero stock movement) → oversell refusal → drawer totals.
// Plus a full cross-type isolation sweep: a POS token from one retail type can
// neither read nor sell another retail-type tenant's SubProduct, and a foreign
// Size ID never attaches to a foreign product.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/posRetailTypesAcceptance.mongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
const { startRouter } = require('./helpers/routeAuthHarness');

// One type-appropriate Product.type per businessType (values from
// constants/generalProductTypes.js retailTypes — General Retail uses the
// catalogue-level gift format) and colour-variant labels in the DRI-4 shape.
const TYPES = [
  {
    key: 'fashion', businessType: 'Fashion Retail',
    productType: 'fashion_dress', productName: 'Skyline Ankara Gown',
    sku: 'SL-GOWN', barcode: 'SL-SKY', variantBase: 'One-size gown',
    colours: [['Emerald', '#50C878', 'Emerald gown'], ['Ivory', '#FFFFF0', 'Ivory gown']],
  },
  {
    key: 'electronics', businessType: 'Electronics Retail',
    productType: 'electronics_audio', productName: 'Nova Bluetooth Speaker',
    sku: 'NV-SPK', barcode: 'NV-ELEC', variantBase: 'Portable speaker',
    colours: [['Graphite', '#1C1C1C', 'Graphite speaker'], ['Sand', '#D5B895', 'Sand speaker']],
  },
  {
    key: 'beauty', businessType: 'Beauty & Skincare',
    productType: 'beauty_skincare', productName: 'Glow Shea Body Oil',
    sku: 'GL-OIL', barcode: 'GL-SKN', variantBase: 'Oil blend',
    colours: [['Rose', '#E8B4B8', 'Rose blend'], ['Unscented', '#F5F0E1', 'Unscented blend']],
  },
  {
    key: 'home', businessType: 'Home & Living',
    productType: 'home_kitchen', productName: 'Hearth Ceramic Kettle',
    sku: 'HH-KET', barcode: 'HH-HOME', variantBase: 'Kettle glaze',
    colours: [['Sage', '#9CAF88', 'Sage glaze'], ['Terracotta', '#E2725B', 'Terracotta glaze']],
  },
  {
    key: 'general', businessType: 'General Retail',
    productType: 'gift_set', productName: 'Harbour Gift Hamper',
    sku: 'GS-BOX', barcode: 'GS-GEN', variantBase: 'Hamper wrap',
    colours: [['Red ribbon', '#B22222', 'Red-ribbon hamper'], ['Gold ribbon', '#D4AF37', 'Gold-ribbon hamper']],
  },
  // DRI-32 — profiled beverage flavour ('Wine Merchant' → ['beverage']).
  // Colourless volume/pack rows: no colorName/optionName on the Size, honest
  // volume/pack unitTypes. Case row priced 3000 (money asserts below are
  // computed per seeded price).
  {
    key: 'beverage', businessType: 'Wine Merchant', flavour: 'beverage',
    productType: 'wine', productName: 'Harbour Cabernet Sauvignon',
    sku: 'PS-WINE', barcode: 'PS-CAB',
    sizes: [
      { size: '750ml', displayName: 'Harbour Cabernet Sauvignon 750ml',
        unitType: 'volume_ml', volumeMl: 750, sellingPrice: 1000 },
      { size: 'Case of 6', displayName: 'Harbour Cabernet Sauvignon Case of 6',
        unitType: 'count_case', volumeMl: 4500, sellingPrice: 3000 },
    ],
  },
  // DRI-32 — hospitality/food-service flavour ('Restaurant' → ['food-service',
  // 'hospitality','beverage']). Two SAME-size portion rows ('Regular plate')
  // distinguished by optionName identity only, unitType 'serving'.
  {
    key: 'restaurant', businessType: 'Restaurant', flavour: 'restaurant',
    productType: 'foodservice_staples', productName: 'Harbour Kitchen Rice Plate',
    sku: 'PS-PLATE', barcode: 'PS-RICE', variantBase: 'Regular plate',
    size: 'Regular plate', unitType: 'serving',
    variants: [
      { optionName: 'Jollof portion' },
      { optionName: 'Goat portion' },
    ],
  },
];

/** Seeds one retail-type tenant: POS warehouse, staff, product with two
 *  same-size colour variants and stock — the DRI-4 shape, type-flavoured. */
async function seedType(def) {
  const oid = () => new mongoose.Types.ObjectId();
  const Tenant = require('../models/Tenant');
  const Warehouse = require('../models/Warehouse');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const WarehouseStock = require('../models/WarehouseStock');
  const User = require('../models/User');

  const tenantId = oid(), locationId = oid(), staffId = oid();
  await Tenant.collection.insertOne({ _id: tenantId, status: 'approved', isActive: true,
    plan: 'starter', subscriptionStatus: 'active', businessType: def.businessType,
    posSettings: { retailWarehouse: locationId, barcodes: true } });

  await Warehouse.create({ _id: locationId, tenant: tenantId,
    name: `${def.key} retail shop`, code: `POS-${def.key.toUpperCase()}`, isActive: true, posEnabled: true });

  await User.collection.insertOne({ _id: staffId, tenant: tenantId, role: 'tenant_staff', status: 'active',
    posPermissions: ['pos:sell'], firstName: def.key, lastName: 'Till' });

  // Two sellable rows per tenant, per flavour:
  //   retail — same-size colour/option variants (the DRI-4 shape);
  //   beverage (DRI-32) — colourless volume/pack rows, no identity data;
  //   restaurant (DRI-32) — same-size portion rows carrying optionName only.
  const subId = oid(), sizeA = oid(), sizeB = oid();
  const product = await Product.collection.insertOne({ name: def.productName, type: def.productType,
    isAlcoholic: def.flavour === 'beverage', tracksBatch: false });
  await SubProduct.collection.insertOne({ _id: subId, tenant: tenantId, product: product.insertedId,
    status: 'active', visibleInPOS: true, sku: def.sku, baseSellingPrice: 1000, costPrice: 500,
    defaultSize: sizeA, sizes: [sizeA, sizeB] });

  let sizeADoc, sizeBDoc;
  if (def.flavour === 'beverage') {
    sizeADoc = {
      _id: sizeA, tenant: tenantId, subproduct: subId,
      displayName: def.sizes[0].displayName, size: def.sizes[0].size,
      volumeMl: def.sizes[0].volumeMl, unitType: def.sizes[0].unitType,
      sellingPrice: def.sizes[0].sellingPrice, costPrice: 500,
      sku: `${def.sku}-A`, barcode: `${def.barcode}-A` };
    sizeBDoc = {
      _id: sizeB, tenant: tenantId, subproduct: subId,
      displayName: def.sizes[1].displayName, size: def.sizes[1].size,
      volumeMl: def.sizes[1].volumeMl, unitType: def.sizes[1].unitType,
      sellingPrice: def.sizes[1].sellingPrice, costPrice: 500,
      sku: `${def.sku}-B`, barcode: `${def.barcode}-B` };
    await Size.collection.insertMany([sizeADoc, sizeBDoc]);
  } else if (def.flavour === 'restaurant') {
    sizeADoc = {
      _id: sizeA, tenant: tenantId, subproduct: subId,
      displayName: def.variantBase, size: def.size, optionName: def.variants[0].optionName,
      unitType: def.unitType, sellingPrice: 1000, costPrice: 500,
      sku: `${def.sku}-A`, barcode: `${def.barcode}-A` };
    sizeBDoc = {
      _id: sizeB, tenant: tenantId, subproduct: subId,
      displayName: def.variantBase, size: def.size, optionName: def.variants[1].optionName,
      unitType: def.unitType, sellingPrice: 1000, costPrice: 500,
      sku: `${def.sku}-B`, barcode: `${def.barcode}-B` };
    await Size.collection.insertMany([sizeADoc, sizeBDoc]);
  } else {
    sizeADoc = {
      _id: sizeA, tenant: tenantId, subproduct: subId,
      displayName: `${def.variantBase} — ${def.colours[0][0]}`, optionName: def.colours[0][2],
      colorName: def.colours[0][0], colorHexCode: def.colours[0][1], volumeMl: 750, unitType: 'volume_ml',
      sellingPrice: 1000, costPrice: 500, sku: `${def.sku}-A`, barcode: `${def.barcode}-A` };
    sizeBDoc = {
      _id: sizeB, tenant: tenantId, subproduct: subId,
      displayName: `${def.variantBase} — ${def.colours[1][0]}`, optionName: def.colours[1][2],
      colorName: def.colours[1][0], colorHexCode: def.colours[1][1], volumeMl: 750, unitType: 'volume_ml',
      sellingPrice: 1000, costPrice: 500, sku: `${def.sku}-B`, barcode: `${def.barcode}-B` };
    await Size.collection.insertMany([sizeADoc, sizeBDoc]);
  }
  await WarehouseStock.create([
    { tenant: tenantId, warehouse: locationId, subProduct: subId, size: sizeA, currentQuantity: 10, reservedQuantity: 2 },
    { tenant: tenantId, warehouse: locationId, subProduct: subId, size: sizeB, currentQuantity: 10, reservedQuantity: 2 },
  ]);

  return {
    def, tenantId, locationId, staffId, subId, sizeA, sizeB,
    // DRI-32: per-row priced identities for the computed money/picker asserts.
    prices: [sizeADoc.sellingPrice, sizeBDoc.sellingPrice],
    shapeA: { displayName: sizeADoc.displayName, colorName: sizeADoc.colorName ?? null, optionName: sizeADoc.optionName ?? null },
    shapeB: { displayName: sizeBDoc.displayName, colorName: sizeBDoc.colorName ?? null, optionName: sizeBDoc.optionName ?? null },
  };
}

test('pos_till_acceptance_five_retail_types', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'pos_retail_types');

  const WarehouseStock = require('../models/WarehouseStock');
  const POSSession = require('../models/POSSession');
  const Order = require('../models/Order');
  const WarehouseMovement = require('../models/WarehouseMovement');

  // Seed all five types first so every cross-type check has a peer.
  const seeded = {};
  for (const def of TYPES) seeded[def.key] = await seedType(def);

  // Warm-up for order journal posting, per tenant, as DRI-4 does.
  for (const key of Object.keys(seeded)) {
    await require('../services/chartOfAccounts.service').ensureDefaultCOA(seeded[key].tenantId);
  }
  await require('../models/JournalEntry').createIndexes();

  const app = await startRouter(require('../routes/pos.routes'), '/api/pos');
  let key = 0;
  async function request(token, path, method = 'GET', body) {
    const response = await fetch(app.url(`/api/pos${path}`), { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': `dri7-${key++}` },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...(await response.json()) };
  }
  const tokenFor = (s) =>
    jwt.sign({ type: 'pos', userId: String(s.staffId), tenantId: String(s.tenantId), posPermissions: ['pos:sell'] },
      process.env.JWT_SECRET);
  const stockOf = async (tenantId, sizeId) =>
    WarehouseStock.findOne({ tenant: tenantId, size: sizeId }).lean();
  const ownStockOf = async (s) => ({ a: (await stockOf(s.tenantId, s.sizeA)).currentQuantity,
                                     b: (await stockOf(s.tenantId, s.sizeB)).currentQuantity });

  try {
    // ── Deliverable 1 core: the full till walk for EACH of the five types.
    for (const def of TYPES) {
      const s = seeded[def.key];
      const token = tokenFor(s);

      // 1. Picker: this tenant's type-appropriate product with both colour
      //    variants labelled — and ONLY this tenant's rows.
      const picker = await request(token, '/products');
      assert.equal(picker.status, 200, `${def.businessType} picker failed: ${JSON.stringify(picker)}`);
      assert.ok(picker.data.products.every((p) => String(p.tenant?._id ?? p.tenant) === String(s.tenantId)),
        `${def.businessType}: picker must list only own-tenant rows`);
      const row = picker.data.products.find((p) => String(p._id) === String(s.subId));
      assert.ok(row, `${def.businessType} product must appear in the picker`);
      assert.equal(row.product.name, def.productName);
      assert.equal(row.product.type, def.productType);
      const a = row.sizes.find((x) => String(x._id) === String(s.sizeA));
      const b = row.sizes.find((x) => String(x._id) === String(s.sizeB));
      assert.ok(a && b, `${def.businessType}: both same-size colour variants in the picker`);
      // DRI-32: per-flavour picker identity — colour rows carry
      // colorName/colorHexCode, Restaurant portion rows carry optionName only,
      // Wine Merchant volume/pack rows carry no identity at all (the shape
      // real beverage rows have). Quantity/pricing semantics are shared.
      const expectedIdentity = (i) => def.flavour === 'beverage'
        ? [undefined, undefined, undefined, `${def.sku}-${i === 0 ? 'A' : 'B'}`, 10]
        : def.flavour === 'restaurant'
          ? [undefined, undefined, def.variants[i].optionName, `${def.sku}-${i === 0 ? 'A' : 'B'}`, 10]
          : [...def.colours[i], `${def.sku}-${i === 0 ? 'A' : 'B'}`, 10];
      assert.deepEqual(
        { a: [a.colorName, a.colorHexCode, a.optionName, a.sku, a.availableStock],
          b: [b.colorName, b.colorHexCode, b.optionName, b.sku, b.availableStock] },
        { a: expectedIdentity(0), b: expectedIdentity(1) },
        `${def.businessType}: till cart labels must distinguish the rows`);
      assert.equal(a.sellingPrice, s.prices[0]);
      assert.equal(b.sellingPrice, s.prices[1]);

      // 2. Open the till session on the POS-enabled retail warehouse.
      const opened = await request(token, '/sessions/open', 'POST', { openingCash: 5000 });
      assert.equal(opened.status, 201, `${def.businessType} session open failed: ${JSON.stringify(opened)}`);
      const sessionId = String(opened.data.session._id);
      assert.equal(String(opened.data.session.warehouse), String(s.locationId));

      // 3. Paid cash sale (local simulation), two rows: 2×A + 1×B.
      const expectedTotal = 2 * s.prices[0] + 1 * s.prices[1];
      const before = await ownStockOf(s);
      assert.deepEqual(before, { a: 10, b: 10 });
      const sale = await request(token, '/orders', 'POST', {
        items: [
          { subProductId: String(s.subId), sizeId: String(s.sizeA), quantity: 2 },
          { subProductId: String(s.subId), sizeId: String(s.sizeB), quantity: 1 },
        ],
        paymentMethod: 'cash', amountTendered: 5000,
      });
      assert.equal(sale.status, 201, `${def.businessType} sale failed: ${JSON.stringify(sale)}`);
      assert.equal(sale.data.order.total, expectedTotal);
      assert.equal(sale.data.order.amountTendered, 5000);
      assert.equal(sale.data.order.change, 5000 - expectedTotal, 'local payment simulation returns the correct change');

      // Receipt is tenant-scoped, session- and warehouse-stamped, paid.
      const receipt = await Order.findById(sale.data.order._id).lean();
      assert.equal(receipt.source, 'pos');
      assert.equal(String(receipt.tenant), String(s.tenantId));
      assert.equal(String(receipt.posWarehouse), String(s.locationId));
      assert.equal(String(receipt.posSessionId), sessionId);
      assert.equal(receipt.paymentStatus, 'paid');

      // 4. Per-row deduction with running balances.
      const after = await ownStockOf(s);
      assert.deepEqual(after, { a: 8, b: 9 }, `${def.businessType}: sale must deduct per exact Size row`);
      const moveA = await WarehouseMovement.findOne({ tenant: s.tenantId, subProduct: s.subId, size: s.sizeA, type: 'shipped' }).lean();
      const moveB = await WarehouseMovement.findOne({ tenant: s.tenantId, subProduct: s.subId, size: s.sizeB, type: 'shipped' }).lean();
      assert.deepEqual([moveA.quantity, moveA.balanceAfter], [2, 8]);
      assert.deepEqual([moveB.quantity, moveB.balanceAfter], [1, 9]);

      // 5. Oversell refusal past the remaining exact-variant stock.
      const oversell = await request(token, '/orders', 'POST', {
        items: [{ subProductId: String(s.subId), sizeId: String(s.sizeB), quantity: 10 }],
        paymentMethod: 'cash', amountTendered: 5000,
      });
      assert.equal(oversell.status, 409, `${def.businessType} oversell: ${JSON.stringify(oversell)}`);
      assert.match(oversell.message, /Insufficient/);
      assert.deepEqual(await ownStockOf(s), after, `${def.businessType}: oversell must leave stock unchanged`);

      // 6. Drawer totals: exactly one paid receipt landed on the session.
      const session = await POSSession.findById(sessionId).lean();
      assert.deepEqual([session.orderCount, session.totalSales, session.cashSales],
        [1, expectedTotal, expectedTotal]);

      console.log('DRI_EVIDENCE ' + JSON.stringify({
        issue: 'DRI-7', phase: 'retail_type_till_walk', businessType: def.businessType,
        environment: 'isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)',
        physicalTillUsed: false,
        tenantId: String(s.tenantId), warehouseId: String(s.locationId),
        productType: def.productType, subProductId: String(s.subId),
        sizeIds: [String(s.sizeA), String(s.sizeB)],
        sessionId,
        receipt: sale.data.order.receiptNumber,
        stockBefore: before, stockAfterSale: after,
        oversellResult: { status: oversell.status, message: oversell.message },
      }));
    }

    // ── Cross-type isolation sweep: full ordered pairs, every seeded type.
    // A POS token from type X can neither read nor sell type Y's SubProduct,
    // and a foreign Size ID never attaches to a foreign product — zero stock
    // movement anywhere. DRI-32: the sweep now pairs the seven tenants
    // (five retail + Wine Merchant + Restaurant) — 7 × 6 = 42 refusals.
    const postWalkStock = {};
    for (const def of TYPES) postWalkStock[def.key] = await ownStockOf(seeded[def.key]);
    const movementsBeforeRefusals = await WarehouseMovement.countDocuments({});

    const crossType = [];
    for (const x of TYPES) {
      for (const y of TYPES) {
        if (x.key === y.key) continue;
        const xs = seeded[x.key], ys = seeded[y.key];
        const token = tokenFor(xs);

        // Read isolation: Y's product is absent from X's picker.
        const picker = await request(token, '/products');
        assert.equal(picker.status, 200);
        assert.ok(!picker.data.products.some((p) =>
          String(p._id) === String(ys.subId) || String(p.tenant?._id ?? p.tenant) === String(ys.tenantId)),
          `${x.businessType} POS token must NOT read ${y.businessType} rows`);

        // Sell isolation: yards product, yard size, straight from another tenant.
        const crossSell = await request(token, '/orders', 'POST', {
          items: [{ subProductId: String(ys.subId), sizeId: String(ys.sizeA), quantity: 1 }],
          paymentMethod: 'cash', amountTendered: 5000,
        });
        assert.equal(crossSell.status, 409,
          `${x.businessType} token selling ${y.businessType} product: ${JSON.stringify(crossSell)}`);
        assert.equal(crossSell.message, 'Product is unavailable for this POS.');

        // Tampered Size: X's product paired with Y's Size ID.
        const tampered = await request(token, '/orders', 'POST', {
          items: [{ subProductId: String(xs.subId), sizeId: String(ys.sizeA), quantity: 1 }],
          paymentMethod: 'cash', amountTendered: 5000,
        });
        assert.equal(tampered.status, 409,
          `${y.businessType} Size ID on ${x.businessType} product: ${JSON.stringify(tampered)}`);
        assert.equal(tampered.message, 'Size does not belong to this product.');

        crossType.push({ from: x.businessType, to: y.businessType,
          crossSell: { status: crossSell.status, message: crossSell.message },
          tamperedSize: { status: tampered.status, message: tampered.message } });
      }
    }
    assert.equal(crossType.length, 42, 'seven tenants x six peers = 42 refused cross-type walks');

    // Not a single stock row moved across the whole sweep.
    assert.equal(await WarehouseMovement.countDocuments({}), movementsBeforeRefusals,
      'cross-type refusals must produce zero stock movements');
    for (const def of TYPES) {
      assert.deepEqual(await ownStockOf(seeded[def.key]), postWalkStock[def.key],
        `${def.businessType}: stock unchanged after the full cross-type sweep`);
    }
    // Only the seven paid receipts exist; refusals created nothing.
    assert.equal(await Order.countDocuments({ source: 'pos' }), 7,
      'exactly one paid POS receipt per seeded tenant');

    console.log('DRI_EVIDENCE ' + JSON.stringify({
      issue: 'DRI-7', phase: 'cross_type_isolation',
      environment: 'isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)',
      physicalTillUsed: false,
      pairsChecked: crossType.length,
      sample: crossType.slice(0, 4),
      result: 'all 42 cross-type read/sell walks refused with 409; zero stock movements; seven paid receipts only',
    }));
  } finally {
    await app.close();
  }
});
