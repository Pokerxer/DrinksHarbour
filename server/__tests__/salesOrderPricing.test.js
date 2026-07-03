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

test('applyEdit updates pricelist and derives appliedPricelist server-side', async () => {
  const svc = require('../services/salesOrder.service');
  const so = {
    tenant: oid(),
    items: [],
    createdAt: new Date(),
    pricelist: null,
    appliedPricelist: undefined,
  };
  // appliedPricelist is now derived server-side from the actual pricelist doc.
  // Without a live DB connection the lookup fails gracefully → undefined.
  await svc.applyEdit(so, { pricelist: 'pl1' });
  assert.strictEqual(so.pricelist, 'pl1');
  assert.strictEqual(so.appliedPricelist, undefined);
});

test('applyEdit clears appliedPricelist when pricelist is set to null', async () => {
  const svc = require('../services/salesOrder.service');
  const so = {
    tenant: oid(),
    items: [],
    createdAt: new Date(),
    pricelist: 'pl1',
    appliedPricelist: { pricelistId: 'pl1', pricelistName: 'Old' },
  };
  await svc.applyEdit(so, { pricelist: null });
  assert.strictEqual(so.pricelist, null);
  assert.strictEqual(so.appliedPricelist, undefined);
});

/** Get the Pricelist model for mocking (lazy-required so this doesn't fail
 *  in environments without the model registered). */
function getPricelistModel() {
  try { return require('../models/Pricelist'); } catch { return null; }
}

test('applyEdit runs the pricing engine when pricelist is omitted from body (safety net)', async (t) => {
  const svc = require('../services/salesOrder.service');
  const pricingSvc = require('../services/salesPricing.service');
  const mongoose = require('mongoose');

  const Pricelist = getPricelistModel();
  if (Pricelist) {
    t.mock.method(Pricelist, 'exists', async () => true);
    t.mock.method(Pricelist, 'findById', () => ({
      select: () => ({ lean: async () => ({ _id: oid(), name: 'Test Pricelist' }) }),
    }));
  }

  const origDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  const origCompute = pricingSvc.computeAuthoritativeLinePrices;
  pricingSvc.computeAuthoritativeLinePrices = async (items) =>
    items.map((it) => ({ ...it, unitPrice: 999 }));

  try {
    const plId = oid().toString();
    const so = {
      tenant: oid(),
      items: [],
      createdAt: new Date(),
      pricelist: plId,
      subtotal: 0, discountTotal: 0, promotionTotal: 0, taxTotal: 0, total: 0,
    };
    // pricelist NOT in body → body.pricelist === undefined → still run engine
    await svc.applyEdit(so, {
      items: [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }],
    });
    assert.strictEqual(so.items[0].unitPrice, 999);
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

test('applyEdit skips the pricing engine when pricelist is the same (trusts client prices)', async (t) => {
  const svc = require('../services/salesOrder.service');
  const pricingSvc = require('../services/salesPricing.service');
  const mongoose = require('mongoose');

  const origDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  const origCompute = pricingSvc.computeAuthoritativeLinePrices;
  pricingSvc.computeAuthoritativeLinePrices = async (items) =>
    items.map((it) => ({ ...it, unitPrice: 999 }));

  const Pricelist = getPricelistModel();
  if (Pricelist) {
    t.mock.method(Pricelist, 'exists', async () => true);
    t.mock.method(Pricelist, 'findById', () => ({
      select: () => ({ lean: async () => null }),
    }));
    // findById returns null to simulate a missing pricelist doc → appliedPricelist = undefined
  }

  try {
    const sameId = oid().toString();
    const so = {
      tenant: oid(),
      items: [],
      createdAt: new Date(),
      pricelist: sameId,
      subtotal: 0, discountTotal: 0, promotionTotal: 0, taxTotal: 0, total: 0,
    };
    // Same pricelist ID → engine is NOT called, client prices kept
    await svc.applyEdit(so, {
      items: [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }],
      pricelist: sameId,
    });
    assert.strictEqual(so.items[0].unitPrice, 1234);
    assert.strictEqual(so.subtotal, 1234 * 2);
  } finally {
    pricingSvc.computeAuthoritativeLinePrices = origCompute;
    if (origDescriptor) {
      Object.defineProperty(mongoose.connection, 'readyState', origDescriptor);
    } else {
      delete mongoose.connection.readyState;
    }
  }
});

test('applyEdit runs the pricing engine when pricelist changes', async (t) => {
  const svc = require('../services/salesOrder.service');
  const pricingSvc = require('../services/salesPricing.service');
  const mongoose = require('mongoose');

  const origDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  const origCompute = pricingSvc.computeAuthoritativeLinePrices;
  pricingSvc.computeAuthoritativeLinePrices = async (items) =>
    items.map((it) => ({ ...it, unitPrice: 999 }));

  const Pricelist = getPricelistModel();
  if (Pricelist) {
    t.mock.method(Pricelist, 'exists', async () => true);
    t.mock.method(Pricelist, 'findById', () => ({
      select: () => ({ lean: async () => null }),
    }));
  }

  try {
    const oldPl = oid().toString();
    const newPl = oid().toString();
    const so = {
      tenant: oid(),
      items: [],
      createdAt: new Date(),
      pricelist: oldPl,
      subtotal: 0, discountTotal: 0, promotionTotal: 0, taxTotal: 0, total: 0,
    };
    // Different pricelist → engine runs
    await svc.applyEdit(so, {
      items: [{ subproduct: oid(), quantity: 2, unitPrice: 1234, priceOverridden: false }],
      pricelist: newPl,
    });
    assert.strictEqual(so.items[0].unitPrice, 999);
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
