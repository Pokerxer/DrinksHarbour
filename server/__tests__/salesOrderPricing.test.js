// server/__tests__/salesOrderPricing.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

test('resolveLinePricing returns items unchanged when no pricing engine is available (no live DB connection)', async () => {
  const svc = require('../services/salesOrder.service');
  const items = [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }];
  const result = await svc.resolveLinePricing(items, { tenantId: oid(), pricelistId: null });
  assert.strictEqual(result[0].unitPrice, 1234);
});

test('resolveLinePricing uses an injected pricing engine to recompute unitPrice', async () => {
  const svc = require('../services/salesOrder.service');
  const items = [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }];
  const fakeEngine = async (its) => its.map((it) => ({ ...it, unitPrice: 999 }));
  const result = await svc.resolveLinePricing(items, {
    tenantId: oid(), pricelistId: null, computeAuthoritativeLinePrices: fakeEngine,
  });
  assert.strictEqual(result[0].unitPrice, 999);
});

test('resolveLinePricing falls back to the original items if the injected engine throws', async () => {
  const svc = require('../services/salesOrder.service');
  const items = [{ subproduct: oid(), quantity: 1, unitPrice: 500, priceOverridden: false }];
  const throwingEngine = async () => { throw new Error('boom'); };
  const result = await svc.resolveLinePricing(items, {
    tenantId: oid(), pricelistId: null, computeAuthoritativeLinePrices: throwingEngine,
  });
  assert.strictEqual(result[0].unitPrice, 500);
});

test('mapLine carries priceOverridden through into the stored line shape', () => {
  const svc = require('../services/salesOrder.service');
  const line = svc.mapLine({ quantity: 1, unitPrice: 100, priceOverridden: true });
  assert.strictEqual(line.priceOverridden, true);
  const line2 = svc.mapLine({ quantity: 1, unitPrice: 100 });
  assert.strictEqual(line2.priceOverridden, false);
});

test('applyEdit updates pricelist + appliedPricelist when present in the patch body', async () => {
  const svc = require('../services/salesOrder.service');
  const so = {
    tenant: oid(),
    items: [],
    createdAt: new Date(),
    pricelist: null,
    appliedPricelist: undefined,
  };
  await svc.applyEdit(so, { pricelist: 'pl1', appliedPricelist: { pricelistId: 'pl1', pricelistName: 'Wholesale' } });
  assert.strictEqual(so.pricelist, 'pl1');
  assert.strictEqual(so.appliedPricelist.pricelistName, 'Wholesale');
});
