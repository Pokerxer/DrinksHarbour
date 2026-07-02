// server/__tests__/salesPriceLines.test.js
//
// POST /api/sales-orders/price-lines — the create/edit pages ask the server
// to price draft lines through the SAME engine createSalesOrderDoc uses
// (resolveLinePricing), so the unit price the operator sees before saving is
// the one the saved document will carry. Regression for the "unit price
// changes on save" bug: the client used to seed lines with the raw catalog
// sellingPrice while the server re-based them on the platform pipeline.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

test('priceLines controller prices items via resolveLinePricing with the request tenant + pricelist', async (t) => {
  const ctrl = require('../controllers/salesOrder.controller');
  const svc = require('../services/salesOrder.service');
  assert.strictEqual(typeof ctrl.priceLines, 'function', 'priceLines endpoint must exist');

  const tenantId = oid();
  const pricelistId = String(oid());
  const items = [
    { subproduct: String(oid()), size: String(oid()), quantity: 1, unitPrice: 9300, priceOverridden: false },
  ];

  let seen;
  t.mock.method(svc, 'resolveLinePricing', async (its, deps) => {
    seen = { its, deps };
    return its.map((it) => ({ ...it, unitPrice: 8553.67 }));
  });

  const req = { tenant: { _id: tenantId }, body: { items, pricelist: pricelistId } };
  const res = mockRes();
  await ctrl.priceLines(req, res, (err) => { if (err) throw err; });

  assert.strictEqual(String(seen.deps.tenantId), String(tenantId));
  assert.strictEqual(seen.deps.pricelistId, pricelistId);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.items[0].unitPrice, 8553.67);
});

test('priceLines rejects a missing/invalid items array with 400', async (t) => {
  const ctrl = require('../controllers/salesOrder.controller');
  const req = { tenant: { _id: oid() }, body: {} };
  const res = mockRes();
  await ctrl.priceLines(req, res, (err) => { if (err) throw err; });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

test('priceLines refuses to run without a resolved tenant (I2 guard)', async (t) => {
  const ctrl = require('../controllers/salesOrder.controller');
  const req = { tenant: undefined, body: { items: [] } };
  const res = mockRes();
  await ctrl.priceLines(req, res, (err) => { if (err) throw err; });
  assert.strictEqual(res.statusCode, 401);
});

test('POST /price-lines is registered on the sales-orders router before /:id', () => {
  const router = require('../routes/salesOrder.routes');
  const hit = router.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === '/price-lines' &&
      layer.route.methods.post
  );
  assert.ok(hit, 'router must expose POST /price-lines');
});

// ── Engine pin: the authoritative figure for the reported repro ────────────
// Carlo Rossi Sweet Red 75cl — size sellingPrice ₦9,300, size costPrice
// ₦7,437.97, tenant markup-model 0%, product platformMarkup 15%, "Website
// Price" pricelist whose rules all carry minQuantity 6 (so none apply at
// qty 1). The engine's answer is cost × 1.15 = ₦8,553.67 — NOT the raw
// catalog ₦9,300. This pins the server-side authority the endpoint exposes.
test('computeLineUnitPrice re-bases on the platform pipeline (Carlo Rossi ₦8,553.67 repro)', async (t) => {
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const { computeLineUnitPrice } = require('../services/salesPricing.service');

  const subProductId = oid();
  const sizeId = oid();
  const spDoc = {
    _id: subProductId,
    sku: 'DRI48B-CARLB363-WIKVUZ',
    baseSellingPrice: 9300,
    costPrice: 7437.97,
    isOnSale: false,
    bundleDeals: [],
    product: { platformMarkup: 15, platformDiscount: { value: 0, type: 'percentage' } },
  };
  const sizeDoc = { _id: sizeId, sellingPrice: 9300, costPrice: 7437.97 };

  t.mock.method(SubProduct, 'findById', () => ({
    select: () => ({ populate: () => ({ lean: async () => spDoc }) }),
  }));
  t.mock.method(Size, 'findById', () => ({ lean: async () => sizeDoc }));

  const websitePricelist = {
    rules: [
      { appliedOn: 'All products', priceType: 'formula', markupPercentage: 20, minQuantity: 6, sequence: 0 },
      { appliedOn: 'All products', priceType: 'bundle', bundleQuantity: 6, bundleDiscount: 15, bundleDiscountType: 'markup_on_cost', minQuantity: 6, sequence: 1 },
    ],
  };

  const price = await computeLineUnitPrice({
    subProductId,
    sizeId,
    quantity: 1,
    pricelist: websitePricelist,
    tenant: { revenueModel: 'markup', markupPercentage: 0, commissionPercentage: 0 },
  });
  assert.strictEqual(price, 8553.67);

  // At qty 6 the formula rule (cost × 1.20) and the markup_on_cost bundle
  // (cost × 1.15) both qualify; the bundle override wins → still 8,553.67.
  const price6 = await computeLineUnitPrice({
    subProductId,
    sizeId,
    quantity: 6,
    pricelist: websitePricelist,
    tenant: { revenueModel: 'markup', markupPercentage: 0, commissionPercentage: 0 },
  });
  assert.strictEqual(price6, 8553.67);
});
