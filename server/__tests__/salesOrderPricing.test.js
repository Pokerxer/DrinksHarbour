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

test('applyEdit recomputes line unitPrice via the pricing engine when items are not overridden', async (t) => {
  const svc = require('../services/salesOrder.service');
  const pricingSvc = require('../services/salesPricing.service');
  const mongoose = require('mongoose');

  // Engage defaultPricingEngine by pretending a live DB connection is present
  // (readyState === 1). Without this the guard short-circuits and the submitted
  // unitPrice is left untouched — the existing "no live DB" tests cover that.
  const origDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  // Inject a fake authoritative engine: every line becomes 999. Mutating the
  // cached module export is picked up because defaultPricingEngine reads
  // `require('./salesPricing.service').computeAuthoritativeLinePrices` at call
  // time — no real DB, no module-reload needed.
  const origCompute = pricingSvc.computeAuthoritativeLinePrices;
  pricingSvc.computeAuthoritativeLinePrices = async (items) =>
    items.map((it) => ({ ...it, unitPrice: 999 }));

  try {
    const so = {
      tenant: oid(),
      items: [],
      createdAt: new Date(),
      pricelist: null,
      subtotal: 0, discountTotal: 0, promotionTotal: 0, taxTotal: 0, total: 0,
    };
    await svc.applyEdit(so, {
      items: [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }],
      pricelist: null,
    });
    // resolveLinePricing ran the fake engine → 999 replaces the submitted 1234.
    assert.strictEqual(so.items[0].unitPrice, 999);
    // Totals are re-snapshot off the recomputed line.
    assert.strictEqual(so.subtotal, 999 * 2);
  } finally {
    pricingSvc.computeAuthoritativeLinePrices = origCompute;
    if (origDescriptor) {
      Object.defineProperty(mongoose.connection, 'readyState', origDescriptor);
    } else {
      delete mongoose.connection.readyState;
    }
  }
});

test('applyEdit persists a customer change when body.customer is present', async () => {
  const svc = require('../services/salesOrder.service');
  const custId = oid().toString();
  const so = {
    tenant: oid(),
    items: [],
    createdAt: new Date(),
    pricelist: null,
    customer: undefined,
    customerSnapshot: undefined,
  };
  await svc.applyEdit(so, {
    customer: custId,
    customerSnapshot: { name: 'Ada Eyo', phone: '0801', email: 'ada@x.io', customerId: custId },
  });
  assert.strictEqual(so.customer, custId);
  assert.strictEqual(so.customerSnapshot.name, 'Ada Eyo');
  assert.strictEqual(so.customerSnapshot.customerId, custId);
});

test('applyEdit clears customer + snapshot when body.customer is explicitly null', async () => {
  const svc = require('../services/salesOrder.service');
  const so = {
    tenant: oid(),
    items: [],
    createdAt: new Date(),
    pricelist: null,
    customer: 'oldcust',
    customerSnapshot: { name: 'Old', customerId: 'oldcust' },
  };
  // Explicit null (user cleared the customer in the edit UI): mirror the
  // create-path convention where customer || undefined drops the field.
  await svc.applyEdit(so, { customer: null, customerSnapshot: undefined });
  assert.strictEqual(so.customer, undefined);
  assert.strictEqual(so.customerSnapshot, undefined);
});

test('applyEdit leaves customer untouched when body.customer is omitted', async () => {
  const svc = require('../services/salesOrder.service');
  const so = {
    tenant: oid(),
    items: [],
    createdAt: new Date(),
    pricelist: null,
    customer: 'keepcust',
    customerSnapshot: { name: 'Keep', customerId: 'keepcust' },
  };
  // No customer key in the patch body at all → no change to customer fields.
  await svc.applyEdit(so, { notes: 'edited' });
  assert.strictEqual(so.customer, 'keepcust');
  assert.strictEqual(so.customerSnapshot.name, 'Keep');
});
