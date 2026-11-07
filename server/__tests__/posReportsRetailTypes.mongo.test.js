'use strict';
// DRI-10 — POS REPORT surfaces across ALL FIVE retail types + one legacy
// beverage tenant (server variant-identity acceptance).
//
// Extends the DRI-7 fixture pattern (posRetailTypesAcceptance.mongo.test.js —
// kept byte-stable as DRI-7's evidence, NOT modified) to the reporting side of
// the DRI-6 CEO decision (docs/memory/pos-retail-accommodation.md,
// "Report/analytics extension"): shared report views generalize — no
// per-industry forks, variant identity carried by the same server sources.
//
// Per tenant, over the real POS HTTP path (routes/pos.routes.js on real
// models, disposable PID-suffixed replica-set DB): seed → open session →
// cash sale of a type-appropriate variant row → then the report reads:
//   • GET /orders            (order list via services/posReportOrder.service)
//   • GET /orders/analysis   (server-exposed order-analysis payload)
//   • GET /reports/session/:id (Z-report breakdown via
//     controllers/pos.report.controller — buildProductBreakdown)
//   • GET /reports/daily, /reports/summary
// and asserts:
//   • retail line variant identity present, matching the till label semantics
//     (colour/option included — the sizeVariantLabel composition);
//   • legacy beverage line variant string byte-identical to the pre-change
//     shape (`_variant || size?.displayName || ''`);
//   • buildProductBreakdown returns separate rows per variant (retail) and one
//     row for each no-variant legacy product, never rendering a dangling
//     " · ";
//   • tenant isolation on EVERY report read (foreign rows absent, foreign
//     session 404).
//
// Physical till: none available to this run — isolated fixture (Node test
// runner + disposable replica-set Mongo). See docs/reports/
// dri6-pos-reports-server-acceptance-2026-11-05.md for the recorded gap.
//
// DRI-32 extension (board correction 9d3ea157, 7-industry frame): besides the
// five retail types the matrix now seeds   • ONE profiled beverage tenant
// ('Wine Merchant' → ['beverage']) with colourless volume/pack rows (plain
// displayName, no identity — the shape real beverage rows store), and   • ONE
// hospitality/food-service tenant ('Restaurant' → ['food-service',
// 'hospitality','beverage']) with two same-size portion rows ('Regular plate')
// distinguished by optionName identity only. The unprofiled legacy beverage
// control (seedLegacyBeverage below — including its raw no-displayName Size)
// stays byte-identical. Fixture-only, no server change.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/posReportsRetailTypes.mongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo, beverage } = require('./helpers/venueMongo');
const { startRouter } = require('./helpers/routeAuthHarness');

// One type-appropriate Product.type per retail businessType, two same-size
// colour variants — the DRI-7 shape, re-seeded fresh (those fixtures are not
// modified).
const RETAIL_TYPES = [
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
  // Colourless volume/pack rows: plain stored displayName, NO colorName/
  // optionName identity — the shape real beverage rows store. Rows here price
  // at the file's uniform 1000 so the hardcoded money-parity asserts stay
  // shared with the retail rows.
  {
    key: 'beverage', businessType: 'Wine Merchant', flavour: 'beverage',
    productType: 'wine', productName: 'Harbour Cabernet Sauvignon',
    sku: 'SL-WINE', barcode: 'SL-CAB',
    sizes: [
      { size: '750ml', displayName: 'Harbour Cabernet Sauvignon 750ml',
        unitType: 'volume_ml', volumeMl: 750, sellingPrice: 1000 },
      { size: 'Case of 6', displayName: 'Harbour Cabernet Sauvignon Case of 6',
        unitType: 'count_case', volumeMl: 4500, sellingPrice: 1000 },
    ],
  },
  // DRI-32 — hospitality/food-service flavour ('Restaurant' → ['food-service',
  // 'hospitality','beverage']). Two SAME-size portion rows ('Regular plate')
  // distinguished by optionName identity only, unitType 'serving'.
  {
    key: 'restaurant', businessType: 'Restaurant', flavour: 'restaurant',
    productType: 'foodservice_staples', productName: 'Harbour Kitchen Rice Plate',
    sku: 'SL-PLATE', barcode: 'SL-RICE', variantBase: 'Regular plate',
    size: 'Regular plate', unitType: 'serving',
    variants: [
      { optionName: 'Jollof portion' },
      { optionName: 'Goat portion' },
    ],
  },
];

/** The till's cart label semantics (client/apps/admin/src/utils/
 *  size-variant-label.ts — displayName · colorName · optionName). The server
 *  compose must produce the same string for sizes that carry a displayName. */
const tillLabel = (size) =>
  [size.displayName ?? size.size, size.colorName, size.optionName].filter(Boolean).join(' · ');

/** The pre-DRI-10 server fallback string — the byte-parity oracle. */
const preChangeVariant = (item) => (item._variant || item.size?.displayName || '');

/** Seeds one retail-type tenant: POS warehouse, staff, product with two
 *  same-size colour variants and stock — the DRI-4/DRI-7 shape. */
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
    posPermissions: ['pos:sell'], firstName: def.key, lastName: 'Report' });

  const subId = oid(), sizeA = oid(), sizeB = oid();
  const product = await Product.collection.insertOne({ name: def.productName, type: def.productType,
    isAlcoholic: def.flavour === 'beverage', tracksBatch: false });
  await SubProduct.collection.insertOne({ _id: subId, tenant: tenantId, product: product.insertedId,
    status: 'active', visibleInPOS: true, sku: def.sku, baseSellingPrice: 1000, costPrice: 500,
    defaultSize: sizeA, sizes: [sizeA, sizeB] });
  // Two sellable rows per tenant, per flavour (DRI-32):
  //   retail — same-size colour/option variants (the DRI-4/DRI-7 shape);
  //   beverage — colourless volume/pack rows, plain displayName, no identity;
  //   restaurant — same-size portion rows carrying optionName identity only.
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
    sizeADoc = { _id: sizeA, tenant: tenantId, subproduct: subId,
      displayName: `${def.variantBase} — ${def.colours[0][0]}`, optionName: def.colours[0][2],
      colorName: def.colours[0][0], colorHexCode: def.colours[0][1], volumeMl: 750, unitType: 'volume_ml',
      sellingPrice: 1000, costPrice: 500, sku: `${def.sku}-A`, barcode: `${def.barcode}-A` };
    sizeBDoc = { _id: sizeB, tenant: tenantId, subproduct: subId,
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
    def, kind: 'retail', tenantId, locationId, staffId, subId, sizeA, sizeB,
    productId: String(product.insertedId),
    // DRI-32: the seeded row shapes the report assertions compose from.
    shapeA: { displayName: sizeADoc.displayName, colorName: sizeADoc.colorName ?? null, optionName: sizeADoc.optionName ?? null },
    shapeB: { displayName: sizeBDoc.displayName, colorName: sizeBDoc.colorName ?? null, optionName: sizeBDoc.optionName ?? null },
  };
}

/** Seeds the legacy beverage control tenant: one normal-sized beverage with a
 *  plain (colourless) displayName row, plus one DRI-4-style raw Size row with
 *  NO displayName at all. Nobody in the beverage core carries colour data. */
async function seedLegacyBeverage() {
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
    plan: 'starter', subscriptionStatus: 'active',
    posSettings: { retailWarehouse: locationId, barcodes: true } });

  await Warehouse.create({ _id: locationId, tenant: tenantId,
    name: 'Legacy beverage shop', code: 'POS-LEGACY-BEV', isActive: true, posEnabled: true });

  await User.collection.insertOne({ _id: staffId, tenant: tenantId, role: 'tenant_staff', status: 'active',
    posPermissions: ['pos:sell'], firstName: 'Legacy', lastName: 'Beverage' });

  // (a) Normal legacy beverage: colourless, displayName only.
  const subId = oid(), sizeId = oid();
  const product = await Product.collection.insertOne({ name: 'DRI-10 Lager', type: 'beer', isAlcoholic: true, tracksBatch: false });
  await SubProduct.collection.insertOne({ _id: subId, tenant: tenantId, product: product.insertedId,
    status: 'active', visibleInPOS: true, sku: 'LAG-330', baseSellingPrice: 1000, costPrice: 500,
    defaultSize: sizeId, sizes: [sizeId] });
  await Size.collection.insertOne({ _id: sizeId, tenant: tenantId, subproduct: subId,
    displayName: 'DRI-10 Lager 330ml', size: '330ml', volumeMl: 330, unitType: 'volume_ml',
    sellingPrice: 1000, costPrice: 500, sku: 'LAG-330-A', barcode: 'LAG-330-BAR' });
  await WarehouseStock.create({ tenant: tenantId, warehouse: locationId, subProduct: subId, size: sizeId,
    currentQuantity: 10, reservedQuantity: 2 });

  // (b) The DRI-4 raw legacy Size shape: no displayName, no colour, no size code.
  const raw = await beverage({ tenantId: String(tenantId), locationId: String(locationId) });
  const rawSub = await require('../models/SubProduct').findById(raw.subProductId).select('product').lean();

  return {
    kind: 'legacy', tenantId, locationId, staffId,
    subId, sizeId, productId: String(product.insertedId), productName: 'DRI-10 Lager',
    rawSubProductId: raw.subProductId, rawSizeId: raw.sizeId, rawProductId: String(rawSub.product),
  };
}

test('pos_reports_acceptance_six_tenants_variant_identity', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'pos_reports_retail_types');

  const POSSession = require('../models/POSSession');
  const Order = require('../models/Order');

  // ── Seed all six tenants ─────────────────────────────────────────────────────
  const tenants = [];
  for (const def of RETAIL_TYPES) tenants.push(await seedType(def));
  tenants.push(await seedLegacyBeverage());
  const legacy = tenants[tenants.length - 1];

  // Warm-up for order journal posting, per tenant, as DRI-4/DRI-7 do.
  for (const s of tenants) {
    await require('../services/chartOfAccounts.service').ensureDefaultCOA(s.tenantId);
  }
  await require('../models/JournalEntry').createIndexes();

  const app = await startRouter(require('../routes/pos.routes'), '/api/pos');
  let key = 0;
  async function request(token, path, method = 'GET', body) {
    const response = await fetch(app.url(`/api/pos${path}`), { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': `dri10-${key++}` },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...(await response.json()) };
  }
  const tokenFor = (s) =>
    jwt.sign({ type: 'pos', userId: String(s.staffId), tenantId: String(s.tenantId), posPermissions: ['pos:sell'] },
      process.env.JWT_SECRET);
  const sessionOf = async (tenantId) => String((await POSSession.findOne({ tenant: tenantId }).lean())._id);
  const receiptsOf = async (tenantId) =>
    (await Order.find({ tenant: tenantId, source: 'pos' }).lean()).map((o) => String(o._id));

  try {
    // ── Per tenant: open session → cash sale → report reads ──────────────────
    for (const s of tenants) {
      const def = s.def || { key: 'legacy', businessType: 'Legacy Beverage (no colour data)' };
      const token = tokenFor(s);

      const opened = await request(token, '/sessions/open', 'POST', { openingCash: 5000 });
      assert.equal(opened.status, 201, `${def.key} session open failed: ${JSON.stringify(opened)}`);
      const sessionId = String(opened.data.session._id);

      // Cash sale. The till body carries no per-line variant for legacy-sim
      // fidelity — the persisted receipt is the shape every real legacy/foreign
      // order presents (see evidence: `_variant` is strict-stripped by
      // orderItemSchema, so the composed fallback is the identity carrier).
      const saleItems = s.kind === 'retail'
        ? [
            { subProductId: String(s.subId), sizeId: String(s.sizeA), quantity: 2 },
            { subProductId: String(s.subId), sizeId: String(s.sizeB), quantity: 1 },
          ]
        : [
            { subProductId: String(s.subId), sizeId: String(s.sizeId), quantity: 2 },
            { subProductId: String(s.rawSubProductId), sizeId: String(s.rawSizeId), quantity: 1 },
          ];
      const sale = await request(token, '/orders', 'POST', { items: saleItems, paymentMethod: 'cash', amountTendered: 5000 });
      assert.equal(sale.status, 201, `${def.key} sale failed: ${JSON.stringify(sale)}`);
      assert.equal(sale.data.order.total, 3000, `${def.key}: sale total`);

      const receiptId = String(sale.data.order._id);

      // ── Report read 1: order list (posReportOrder.service via GET /orders) ──
      const orders = await request(token, '/orders');
      assert.equal(orders.status, 200, `${def.key} /orders failed: ${JSON.stringify(orders)}`);
      const receipt = orders.data.find((o) => String(o._id) === receiptId);
      assert.ok(receipt, `${def.key}: the sale receipt must appear in the order list`);
      const lines = receipt.items;
      assert.equal(lines.length, 2, `${def.key}: two sold lines`);

      // Expected variant strings, per line.
      let expectedVariants;
      if (s.kind !== 'legacy') {
        // DRI-32: expected labels compute from the SEEDED row shapes for every
        // profiled kind — retail colour compose, Restaurant option-only
        // compose, Wine Merchant plain-bottle displayName — through the same
        // tillLabel composition the server runs on the populated Size.
        expectedVariants = [
          tillLabel({ displayName: s.shapeA.displayName, colorName: s.shapeA.colorName ?? undefined, optionName: s.shapeA.optionName ?? undefined }),
          tillLabel({ displayName: s.shapeB.displayName, colorName: s.shapeB.colorName ?? undefined, optionName: s.shapeB.optionName ?? undefined }),
        ];
        if (s.shapeA.colorName) {
          assert.ok(lines[0].variant.split(' · ').length >= 3, `${def.key}: colour/option identity must be composed into the report line`);
        } else if (s.shapeA.optionName) {
          assert.ok(lines[0].variant.includes(s.shapeA.optionName), `${def.key}: option identity must be composed into the report line`);
        }
      } else {
        expectedVariants = [
          preChangeVariant({ _variant: '', size: { displayName: 'DRI-10 Lager 330ml' } }),
          preChangeVariant({ _variant: '', size: {} }),
        ];
      }
      assert.deepEqual(
        lines.map((l) => l.variant),
        expectedVariants,
        `${def.key}: report line variant strings must match the expected identity`
      );
      if (s.kind === 'legacy') {
        assert.ok(!lines[0].variant.includes(' · '), 'legacy beverage line: byte-exact pre-change string, no separator');
        assert.equal(lines[1].variant, '', 'raw legacy control line: empty string exactly as before');
      }
      assert.notEqual(lines[0].variant, lines[1].variant, `${def.key}: the two variants must stay distinct`);

      // ── Report read 2: order-analysis payload (server-exposed) ─────────────
      const analysis = await request(token, '/orders/analysis');
      assert.equal(analysis.status, 200, `${def.key} /orders/analysis failed: ${JSON.stringify(analysis)}`);
      const analysisReceipt = analysis.data.find((o) => String(o.order._id) === receiptId);
      assert.ok(analysisReceipt, `${def.key}: analysis payload includes the sale`);
      assert.deepEqual(
        analysisReceipt.lines.map((l) => l.v),
        expectedVariants,
        `${def.key}: analysis lines keep the same variant identity`
      );

      // ── Report read 3: session Z-report breakdown (pos.report.controller) ──
      const zReport = await request(token, `/reports/session/${sessionId}`);
      assert.equal(zReport.status, 200, `${def.key} Z-report failed: ${JSON.stringify(zReport)}`);
      const breakdown = zReport.data.productBreakdown;
      const expectedBreakdown = s.kind !== 'legacy'
        ? [
            { name: `${def.productName} · ${expectedVariants[0]}`, qty: 2, net: 2000 },
            { name: `${def.productName} · ${expectedVariants[1]}`, qty: 1, net: 1000 },
          ]
        : [
            { name: `${s.productName} · ${expectedVariants[0]}`, qty: 2, net: 2000 },
            { name: 'Bottle', qty: 1, net: 1000 }, // raw control: no variant → label is the name alone, no dangling ' · '
          ];
      assert.deepEqual(
        breakdown.map((r) => ({ name: r.name, qty: r.qty, net: r.net })),
        expectedBreakdown,
        `${def.key}: Z-report breakdown rows must keep variant identity ${s.kind === 'retail' ? '(one row per variant)' : '(one row per no-variant legacy product)'}`
      );
      assert.ok(
        breakdown.every((r) => (r.name.endsWith(' · ') || r.name.startsWith(' · ')) === false),
        `${def.key}: no dangling separator may render for empty variants`
      );

      // ── Report read 4: daily + range surfaces ───────────────────────────────
      const daily = await request(token, '/reports/daily');
      assert.equal(daily.status, 200, `${def.key} daily report failed: ${JSON.stringify(daily)}`);
      const dailySession = daily.data.sessions.find((x) => String(x._id) === sessionId);
      assert.deepEqual({ orderCount: dailySession?.orderCount, revenue: dailySession?.revenue },
        { orderCount: 1, revenue: 3000 }, `${def.key}: daily report totals unchanged (money parity)`);

      const summary = await request(token, '/reports/summary');
      assert.equal(summary.status, 200, `${def.key} summary report failed: ${JSON.stringify(summary)}`);
      assert.equal(summary.data.totals.sessionCount, 1, `${def.key}: summary sees only its own session`);
      assert.deepEqual(
        summary.data.topProducts.map((r) => ({ name: r.name, qty: r.qty, net: r.net })),
        expectedBreakdown,
        `${def.key}: range-report topProducts carry the same breakdown identity`
      );

      console.log('DRI_EVIDENCE ' + JSON.stringify({
        issue: 'DRI-10', phase: 'report_variant_identity', businessType: def.key,
        environment: 'isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)',
        physicalTillUsed: false,
        tenantId: String(s.tenantId), sessionId, receiptId,
        orderListVariants: lines.map((l) => l.variant),
        analysisVariants: analysisReceipt.lines.map((l) => l.v),
        breakdownRows: breakdown.map((r) => ({ name: r.name, qty: r.qty, net: r.net })),
      }));
    }

    // ── Tenant isolation on EVERY report read ─────────────────────────────────
    // Each tenant token: own receipts only on /orders and /orders/analysis;
    // every foreign session 404s; daily/summary see exactly one (own) session.
    const ownReceipts = {};
    for (const s of tenants) ownReceipts[String(s.tenantId)] = await receiptsOf(s.tenantId);
    const foreignSessions = {};
    for (const s of tenants) foreignSessions[String(s.tenantId)] = await sessionOf(s.tenantId);

    for (const s of tenants) {
      const token = tokenFor(s);
      const own = ownReceipts[String(s.tenantId)];

      const orders = await request(token, '/orders');
      assert.equal(orders.status, 200);
      assert.deepEqual(
        orders.data.map((o) => String(o._id)).sort(),
        [...own].sort(),
        `${s.def?.key || 'legacy'}: /orders must contain exactly its own receipts`);
      // Content-level owner check: every product name on every returned line
      // must be one of THIS tenant's own products (each seed uses a unique
      // product name per tenant).
      const ownProducts = s.kind !== 'legacy'
        ? [s.def.productName]
        : [s.productName, ...((await require('../models/Product').find({ _id: s.rawProductId }).select('name').lean())).map((p) => p.name)];
      const peerNameLists = [];
      for (const p of tenants) {
        if (String(p.tenantId) === String(s.tenantId)) continue;
        peerNameLists.push(p.kind !== 'legacy'
          ? p.def.productName
          : p.productName);
        if (p.kind === 'legacy') {
          peerNameLists.push(...((await require('../models/Product').find({ _id: p.rawProductId }).select('name').lean())).map((row) => row.name));
        }
      }
      const foreignProductNames = peerNameLists;
      assert.ok(ownProducts.every(Boolean) && !ownProducts.some((n) => foreignProductNames.includes(n)),
        'seed product names must be unique per tenant for the content-owner check');
      assert.ok(orders.data.every((o) => (o.items || []).every((l) => !l.name || !foreignProductNames.includes(l.name))),
        `${s.def?.key || 'legacy'}: /orders must not carry any foreign tenant's product on any line`);

      const analysis = await request(token, '/orders/analysis');
      assert.equal(analysis.status, 200);
      assert.deepEqual(
        analysis.data.map((o) => String(o.order._id)).sort(),
        [...own].sort(),
        `${s.def?.key || 'legacy'}: /orders/analysis must be own-tenant only`);

      for (const peer of tenants) {
        if (String(peer.tenantId) === String(s.tenantId)) continue;
        const foreignSession = await request(token, `/reports/session/${foreignSessions[String(peer.tenantId)]}`);
        assert.equal(foreignSession.status, 404,
          `${s.def?.key || 'legacy'} token reading ${peer.def?.key || 'legacy'} Z-report must 404`);
      }

      const summary = await request(token, '/reports/summary');
      assert.equal(summary.status, 200);
      assert.equal(summary.data.totals.sessionCount, 1,
        `${s.def?.key || 'legacy'}: /reports/summary must aggregate only its own session`);

      const productNames = tenants
        .filter((p) => String(p.tenantId) !== String(s.tenantId))
        .map((p) => (p.kind !== 'legacy' ? p.def.productName : p.productName));
      assert.ok(
        !summary.data.topProducts.some((r) => productNames.includes(r.name.split(' · ')[0])),
        `${s.def?.key || 'legacy'}: topProducts must not contain a foreign tenant's product`);
    }

    console.log('DRI_EVIDENCE ' + JSON.stringify({
      issue: 'DRI-10', phase: 'report_tenant_isolation',
      environment: 'isolated report fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)',
      tenantsChecked: tenants.length,
      pairsChecked: tenants.length * (tenants.length - 1),
      result: 'every report read (/orders, /orders/analysis, /reports/session/:foreign → 404, /reports/daily, /reports/summary) returns exactly the caller-tenant rows',
    }));
  } finally {
    await app.close();
  }
});
