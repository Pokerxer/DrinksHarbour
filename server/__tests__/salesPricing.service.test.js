// server/__tests__/salesPricing.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const SubProduct = require('../models/SubProduct');
const Pricelist = require('../models/Pricelist');
const Tenant = require('../models/Tenant');
const { computePOSPricing } = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();

/** Minimal stand-in for a chained Mongoose query (.select().populate().lean()). */
function chainable(doc) {
  const obj = {
    select: () => obj,
    populate: () => obj,
    lean: async () => doc,
  };
  return obj;
}

test('computeAuthoritativeLinePrices leaves priceOverridden lines untouched without touching the DB', async (t) => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');
  // No model mocks set up — if this function tried to hit the DB it would
  // hang on Mongoose command buffering (no live connection in tests).
  const items = [{ subproduct: oid(), quantity: 3, unitPrice: 7777, priceOverridden: true }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId: oid(), pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 7777);
});

test('computeAuthoritativeLinePrices passes through a line with no subproduct unchanged', async () => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');
  const items = [{ quantity: 1, unitPrice: 50, priceOverridden: false }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId: oid(), pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 50);
});

test('computeAuthoritativeLinePrices recomputes unitPrice from the subproduct pipeline + a pricelist discount rule', async (t) => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');

  const tenantId = oid();
  const subProductId = oid();
  const pricelistId = oid();

  const tenantDoc = { _id: tenantId, revenueModel: 'markup', markupPercentage: 25, commissionPercentage: 12 };
  const spDoc = {
    _id: subProductId,
    product: { platformMarkup: 10 },
    baseSellingPrice: 5000,
    costPrice: 3000,
    isOnSale: false,
    flashSale: {},
    bundleDeals: [],
  };
  const pricelistDoc = {
    _id: pricelistId,
    tenant: tenantId,
    rules: [{ priceType: 'discount', discountType: 'fixed', discountAmount: 500, minQuantity: 0, sequence: 0 }],
  };

  t.mock.method(Tenant, 'findById', () => chainable(tenantDoc));
  t.mock.method(SubProduct, 'findById', () => chainable(spDoc));
  t.mock.method(Pricelist, 'findOne', () => chainable(pricelistDoc));

  const baseline = computePOSPricing(spDoc, null, tenantDoc).sellingPrice;

  const items = [{ subproduct: subProductId, quantity: 2, unitPrice: 1, priceOverridden: false }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId, pricelistId });

  assert.strictEqual(result[0].unitPrice, Math.round((baseline - 500) * 100) / 100);
});

test('computeAuthoritativeLinePrices leaves the line untouched if the subproduct lookup fails (best-effort)', async (t) => {
  const { computeAuthoritativeLinePrices } = require('../services/salesPricing.service');
  const tenantId = oid();

  t.mock.method(Tenant, 'findById', () => chainable({ _id: tenantId }));
  t.mock.method(SubProduct, 'findById', () => { throw new Error('db unavailable'); });

  const items = [{ subproduct: oid(), quantity: 1, unitPrice: 999, priceOverridden: false }];
  const result = await computeAuthoritativeLinePrices(items, { tenantId, pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 999);
});
