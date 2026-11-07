'use strict';
// DRI-4 — POS and till acceptance for exact retail variants (synthetic till fixture).
//
// Walks the real POS HTTP path (routes/pos.routes.js over real Mongo models):
// scan/picker selection (GET /products with per-size colour cart labels), till
// session open, locally simulated cash payment (POST /orders), and sale stock
// deduction at a tenant-owned POS-enabled warehouse — plus wrong-tenant /
// tampered Size ID refusals with no stock movement, an oversell refusal, and a
// plain legacy beverage control with no colour variant.
//
// Physical till: none available to this run — everything below is the isolated
// device fixture (Node test runner + disposable replica-set DB). See the DRI-4
// issue report for the recorded physical-till gap.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/posTillAcceptance.mongo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { uri, connectVenueMongo, beverage } = require('./helpers/venueMongo');
const { startRouter } = require('./helpers/routeAuthHarness');

/** Seeds the retail tenant, its POS-enabled warehouse, the two same-size
 *  colour variants, the foreign tenant's product and the legacy control. */
async function seed() {
  const oid = () => new mongoose.Types.ObjectId();
  const Tenant = require('../models/Tenant');
  const Warehouse = require('../models/Warehouse');
  const Product = require('../models/Product');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const WarehouseStock = require('../models/WarehouseStock');

  const tenantA = oid(), tenantB = oid(), locationA = oid(), staffA = oid();
  await Tenant.collection.insertOne({ _id: tenantA, status: 'approved', isActive: true, plan: 'starter', subscriptionStatus: 'active',
    posSettings: { retailWarehouse: locationA, barcodes: true } });
  await Tenant.collection.insertOne({ _id: tenantB, status: 'approved', isActive: true, plan: 'starter', subscriptionStatus: 'active' });

  await Warehouse.create({ _id: locationA, tenant: tenantA, name: 'Retail Shop', code: 'RETAIL-SHOP', isActive: true, posEnabled: true });
  const foreignWarehouse = await Warehouse.create({ tenant: tenantB, name: 'Foreign Shop', code: 'FOREIGN', isActive: true, posEnabled: true });

  const User = require('../models/User');
  await User.collection.insertOne({ _id: staffA, tenant: tenantA, role: 'tenant_staff', status: 'active',
    posPermissions: ['pos:sell'], firstName: 'Ada', lastName: 'Till' });

  // Two sellable variants of the SAME size (750ml) with distinct colours.
  const variantSub = oid(), sizeGreen = oid(), sizeAmber = oid();
  const variantProduct = await Product.collection.insertOne({ name: 'Harbour Signature Bottle', type: 'wine', isAlcoholic: true, tracksBatch: false });
  await SubProduct.collection.insertOne({ _id: variantSub, tenant: tenantA, product: variantProduct.insertedId, status: 'active',
    visibleInPOS: true, sku: 'HS-750', baseSellingPrice: 1000, costPrice: 500, defaultSize: sizeGreen, sizes: [sizeGreen, sizeAmber] });
  await Size.collection.insertMany([
    { _id: sizeGreen, tenant: tenantA, subproduct: variantSub, displayName: '750ml — Green bottle', optionName: 'Green bottle',
      colorName: 'Green', colorHexCode: '#046A38', volumeMl: 750, unitType: 'volume_ml',
      sellingPrice: 1000, costPrice: 500, sku: 'VAR-GRN', barcode: 'HB-GRN-750' },
    { _id: sizeAmber, tenant: tenantA, subproduct: variantSub, displayName: '750ml — Amber bottle', optionName: 'Amber bottle',
      colorName: 'Amber', colorHexCode: '#FFBF00', volumeMl: 750, unitType: 'volume_ml',
      sellingPrice: 1000, costPrice: 500, sku: 'VAR-AMB', barcode: 'HB-AMB-750' },
  ]);
  await WarehouseStock.create([
    { tenant: tenantA, warehouse: locationA, subProduct: variantSub, size: sizeGreen, currentQuantity: 10, reservedQuantity: 2 },
    { tenant: tenantA, warehouse: locationA, subProduct: variantSub, size: sizeAmber, currentQuantity: 10, reservedQuantity: 2 },
  ]);

  // Foreign product under tenant B (for wrong-tenant checks).
  const foreignSub = oid(), foreignSize = oid();
  await Product.collection.insertOne({ name: 'Foreign Bottle', type: 'beer', isAlcoholic: false, tracksBatch: false });
  await SubProduct.collection.insertOne({ _id: foreignSub, tenant: tenantB, product: oid(), status: 'active', visibleInPOS: true,
    baseSellingPrice: 999, defaultSize: foreignSize, sizes: [foreignSize] });
  await Size.collection.insertOne({ _id: foreignSize, tenant: tenantB, subproduct: foreignSub, displayName: '330ml', sellingPrice: 999, costPrice: 400 });

  // Legacy beverage control: plain sized beverage, no colour variant. The raw
  // legacy shape carries only a defaultSize; give the picker its sizes list so
  // it is sellable from the grid like real legacy data that was migrated.
  const control = await beverage({ tenantId: String(tenantA), locationId: String(locationA) });
  await SubProduct.updateOne({ _id: control.subProductId }, { $set: { sizes: [new mongoose.Types.ObjectId(control.sizeId)] } });

  return { oid, tenantA, tenantB, locationA, staffA, variantSub, sizeGreen, sizeAmber, foreignSub, foreignSize, foreignWarehouse: String(foreignWarehouse._id), control };
}

test('pos_till_acceptance_exact_retail_variants', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'pos_till');

  const s = await seed();
  const WarehouseStock = require('../models/WarehouseStock');
  const POSSession = require('../models/POSSession');
  const Order = require('../models/Order');
  const WarehouseMovement = require('../models/WarehouseMovement');

  await require('../services/chartOfAccounts.service').ensureDefaultCOA(s.tenantA);
  await require('../models/JournalEntry').createIndexes();

  const app = await startRouter(require('../routes/pos.routes'), '/api/pos');
  const token = jwt.sign({ type: 'pos', userId: String(s.staffA), tenantId: String(s.tenantA), posPermissions: ['pos:sell'] }, process.env.JWT_SECRET);
  let key = 0;
  async function request(path, method = 'GET', body) {
    const response = await fetch(app.url(`/api/pos${path}`), { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': `dri4-${key++}` },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...(await response.json()) };
  }
  const stockOf = async (sizeId) => (await WarehouseStock.findOne({ tenant: s.tenantA, warehouse: s.locationA, size: sizeId }).lean());

  try {
    // ── 1. Picker lookup: both colour variants and the legacy control are sellable
    //      and carry the labels the till cart shows.
    const picker = await request('/products');
    assert.equal(picker.status, 200, JSON.stringify(picker));
    const variantRow = picker.data.products.find((p) => String(p._id) === String(s.variantSub));
    assert.ok(variantRow, 'exact-retail variant product must appear in the picker');
    const green = variantRow.sizes.find((x) => String(x._id) === String(s.sizeGreen));
    const amber = variantRow.sizes.find((x) => String(x._id) === String(s.sizeAmber));
    assert.ok(green && amber, 'both same-size colour variants are in the picker');
    assert.deepEqual(
      { green: [green.colorName, green.colorHexCode, green.optionName, green.sku, green.availableStock],
        amber: [amber.colorName, amber.colorHexCode, amber.optionName, amber.sku, amber.availableStock] },
      { green: ['Green', '#046A38', 'Green bottle', 'VAR-GRN', 10],
        amber: ['Amber', '#FFBF00', 'Amber bottle', 'VAR-AMB', 10] },
      'till cart labels must distinguish the two exact-retail variants');
    assert.equal(green.sellingPrice, 1000);
    assert.equal(amber.sellingPrice, 1000);
    const controlRow = picker.data.products.find((p) => String(p._id) === String(s.control.subProductId));
    assert.ok(controlRow, 'legacy beverage control appears in the picker');
    assert.equal(controlRow.sizes.length, 1);
    assert.equal(controlRow.sizes[0].colorName, undefined, 'legacy control has no colour-variant label');

    // The picker location is server-owned: foreign / tampered overrides are refused.
    assert.equal((await request(`/products?warehouseId=${s.tenantB}`)).status, 400, 'non-id override accepted');
    assert.equal((await request(`/products?warehouseId=${s.foreignWarehouse}`)).status, 400, 'foreign warehouse override accepted');

    // ── 2. Open the till session on the POS-enabled warehouse.
    const opened = await request('/sessions/open', 'POST', { openingCash: 5000 });
    assert.equal(opened.status, 201, JSON.stringify(opened));
    const sessionId = String(opened.data.session._id);
    assert.equal(String(opened.data.session.warehouse), String(s.locationA));

    // ── 3. Capture before-stock for both rows, then the paid sale (local cash).
    const before = { green: (await stockOf(s.sizeGreen)).currentQuantity, amber: (await stockOf(s.sizeAmber)).currentQuantity };
    const sale = await request('/orders', 'POST', {
      items: [
        { subProductId: String(s.variantSub), sizeId: String(s.sizeGreen), quantity: 2 },
        { subProductId: String(s.variantSub), sizeId: String(s.sizeAmber), quantity: 1 },
      ],
      paymentMethod: 'cash',
      amountTendered: 5000,
    });
    assert.equal(sale.status, 201, JSON.stringify(sale));
    assert.equal(sale.data.order.paymentMethod, 'cash');
    assert.equal(sale.data.order.total, 3000);
    assert.equal(sale.data.order.amountTendered, 5000);
    assert.equal(sale.data.order.change, 2000, 'local payment simulation returns the correct change');
    const [greenLine, amberLine] = sale.data.order.items;
    assert.deepEqual([greenLine.quantity, greenLine.priceAtPurchase, greenLine.sku], [2, 1000, 'HS-750']);
    assert.deepEqual([amberLine.quantity, amberLine.priceAtPurchase, amberLine.sku], [1, 1000, 'HS-750']);

    // Receipt is tenant-scoped, session- and warehouse-stamped, sized exactly.
    const receipt = await Order.findById(sale.data.order._id).lean();
    assert.equal(receipt.source, 'pos');
    assert.equal(String(receipt.tenant), String(s.tenantA));
    assert.equal(String(receipt.posWarehouse), String(s.locationA));
    assert.equal(String(receipt.posSessionId), sessionId);
    assert.equal(receipt.paymentStatus, 'paid');
    assert.deepEqual(receipt.items.map((i) => String(i.size)), [String(s.sizeGreen), String(s.sizeAmber)]);

    // Sale stock deduction, per exact-retail Size row.
    const after = { green: (await stockOf(s.sizeGreen)).currentQuantity, amber: (await stockOf(s.sizeAmber)).currentQuantity };
    assert.deepEqual(before, { green: 10, amber: 10 });
    assert.deepEqual(after, { green: 8, amber: 9 });
    const greenMove = await WarehouseMovement.findOne({ tenant: s.tenantA, subProduct: s.variantSub, size: s.sizeGreen, type: 'shipped' }).lean();
    const amberMove = await WarehouseMovement.findOne({ tenant: s.tenantA, subProduct: s.variantSub, size: s.sizeAmber, type: 'shipped' }).lean();
    assert.deepEqual([greenMove.quantity, greenMove.balanceAfter], [2, 8]);
    assert.deepEqual([amberMove.quantity, amberMove.balanceAfter], [1, 9]);

    // ── 4. Legacy beverage control sale.
    const controlBefore = (await stockOf(s.control.sizeId)).currentQuantity;
    const controlSale = await request('/orders', 'POST', {
      items: [{ subProductId: s.control.subProductId, sizeId: s.control.sizeId, quantity: 3 }],
      paymentMethod: 'cash', amountTendered: 5000,
    });
    assert.equal(controlSale.status, 201, JSON.stringify(controlSale));
    assert.equal(controlSale.data.order.total, 3000);
    assert.equal((await stockOf(s.control.sizeId)).currentQuantity, controlBefore - 3);

    // ── 5. Wrong-tenant and tampered Size ID checks — refused, no stock moves.
    const wrongTenant = await request('/orders', 'POST', {
      items: [{ subProductId: String(s.foreignSub), sizeId: String(s.foreignSize), quantity: 1 }],
      paymentMethod: 'cash', amountTendered: 5000,
    });
    assert.equal(wrongTenant.status, 409, JSON.stringify(wrongTenant));
    assert.equal(wrongTenant.message, 'Product is unavailable for this POS.');

    const tamperedForeignSize = await request('/orders', 'POST', {
      items: [{ subProductId: String(s.variantSub), sizeId: String(s.foreignSize), quantity: 1 }],
      paymentMethod: 'cash', amountTendered: 5000,
    });
    assert.equal(tamperedForeignSize.status, 409, JSON.stringify(tamperedForeignSize));
    assert.equal(tamperedForeignSize.message, 'Size does not belong to this product.');

    const tamperedRandomSize = await request('/orders', 'POST', {
      items: [{ subProductId: String(s.variantSub), sizeId: String(s.oid()), quantity: 1 }],
      paymentMethod: 'cash', amountTendered: 5000,
    });
    assert.equal(tamperedRandomSize.status, 409, JSON.stringify(tamperedRandomSize));
    assert.equal(tamperedRandomSize.message, 'Size does not belong to this product.');

    assert.deepEqual(
      { green: (await stockOf(s.sizeGreen)).currentQuantity, amber: (await stockOf(s.sizeAmber)).currentQuantity, control: (await stockOf(s.control.sizeId)).currentQuantity },
      { green: 8, amber: 9, control: controlBefore - 3 },
      'refused sales must not move any stock row');
    assert.equal(await Order.countDocuments({ source: 'pos' }), 2, 'only the two paid receipts exist');

    // ── 6. Oversell refusal past the remaining exact-variant stock.
    const oversell = await request('/orders', 'POST', {
      items: [{ subProductId: String(s.variantSub), sizeId: String(s.sizeAmber), quantity: 10 }],
      paymentMethod: 'cash', amountTendered: 5000,
    });
    assert.equal(oversell.status, 409, JSON.stringify(oversell));
    assert.match(oversell.message, /Insufficient/);
    assert.equal((await stockOf(s.sizeAmber)).currentQuantity, 9);

    // ── 7. Till session money: two paid receipts land on the drawer.
    const session = await POSSession.findById(sessionId).lean();
    assert.deepEqual([session.orderCount, session.totalSales, session.cashSales], [2, 6000, 6000]);

    console.log('DRI4_EVIDENCE ' + JSON.stringify({
      environment: 'isolated till fixture: real POS HTTP router + real models on disposable replica-set Mongo (:29127)',
      physicalTillUsed: false,
      tenantId: String(s.tenantA),
      warehouseId: String(s.locationA),
      subProductId: String(s.variantSub),
      sizeIdGreen: String(s.sizeGreen),
      sizeIdAmber: String(s.sizeAmber),
      legacyControlSubProductId: s.control.subProductId,
      legacyControlSizeId: s.control.sizeId,
      sessionId,
      receipts: [sale.data.order.receiptNumber, controlSale.data.order.receiptNumber],
      stockBefore: before,
      stockAfterSale: after,
      legacyControlStock: { before: controlBefore, after: controlBefore - 3 },
      wrongTenantResult: { status: wrongTenant.status, message: wrongTenant.message },
      tamperedForeignSizeResult: { status: tamperedForeignSize.status, message: tamperedForeignSize.message },
      tamperedRandomSizeResult: { status: tamperedRandomSize.status, message: tamperedRandomSize.message },
      oversellResult: { status: oversell.status, message: oversell.message },
    }));
  } finally {
    await app.close();
  }
});
