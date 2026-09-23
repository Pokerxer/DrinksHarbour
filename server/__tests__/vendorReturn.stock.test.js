// server/__tests__/vendorReturn.stock.test.js
//
// Pins the inventory side of a vendor return / purchase refund: confirming a
// return deducts the returned goods from the return's warehouse (a `return_out`
// movement + InventoryMovement mirror + recalc), cancelling restores them (a
// `returned` movement). Both directions are idempotent via VendorReturn.stockAdjusted.
// Deps injected → no MongoDB.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyVendorReturnStock,
  reverseVendorReturnStock,
} = require('../services/vendorReturn.stock');

function makeEnv({ lots = {}, log = true } = {}) {
  const calls = { saves: [], movements: [], ledger: [], recalcs: [] };
  class FakeWarehouseStock {
    constructor(init) {
      Object.assign(this, { currentQuantity: 0 }, init);
    }
    async save() {
      calls.saves.push({ ...this });
      return this;
    }
    static async findOne(q) {
      const lot = lots[String(q.warehouse)] || lots['__any__'];
      if (!lot) return null;
      return new this({
        tenant: q.tenant,
        warehouse: q.warehouse,
        subProduct: q.subProduct,
        size: q.size || 'sz1',
        currentQuantity: lot.currentQuantity ?? 0,
        ...(lot.extra || {}),
      });
    }
  }
  const deps = {
    WarehouseStock: FakeWarehouseStock,
    WarehouseMovement: { create: async (...d) => calls.movements.push(...d.flat()) },
    InventoryMovement: { create: async (...d) => calls.ledger.push(...d.flat()) },
    recalcSubProductStock: async (id) => calls.recalcs.push(String(id)),
  };
  return { deps, calls };
}

function vendorReturn(overrides = {}) {
  return {
    _id: 'vr1',
    tenant: 't1',
    returnNumber: 'RET-2026-00001',
    warehouse: 'wh1',
    purchaseOrder: 'po1',
    vendor: 'v1',
    vendorName: 'Vendor One',
    stockAdjusted: false,
    items: [
      {
        subProductId: 'sp1',
        subProductName: 'A',
        sizeId: 'sz1',
        quantity: 4,
        unitPrice: 1000,
      },
      {
        subProductId: 'sp2',
        subProductName: 'B',
        quantity: 2,
        unitPrice: 500,
      },
    ],
    save() {
      this._saved = (this._saved || 0) + 1;
      return Promise.resolve(this);
    },
    ...overrides,
  };
}

test('applies a confirmed vendor return: deducts each line, posts return_out + ledger', async () => {
  const { deps, calls } = makeEnv({
    lots: { wh1: { currentQuantity: 50 } },
  });
  const vr = vendorReturn();
  const res = await applyVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps);

  assert.equal(res.applied, true);
  assert.equal(res.lines, 2);
  assert.equal(vr.stockAdjusted, true);
  assert.equal(vr._saved, 1);

  // One row per line, each decremented by its returned qty.
  const sp1 = calls.saves.find((s) => s.subProduct === 'sp1');
  const sp2 = calls.saves.find((s) => s.subProduct === 'sp2');
  assert.equal(sp1.currentQuantity, 46);
  assert.equal(sp2.currentQuantity, 48);

  // return_out movements with a traceable reference.
  const outs = calls.movements.filter((m) => m.type === 'return_out');
  assert.equal(outs.length, 2);
  assert.ok(outs.every((m) => m.reference === 'Vendor return RET-2026-00001'));
  assert.ok(outs.every((m) => m.warehouse === 'wh1'));

  // InventoryMovement mirrors (return_out / out) link the PO + supplier.
  const led = calls.ledger.filter((m) => m.type === 'return_out');
  assert.equal(led.length, 2);
  assert.ok(led.every((m) => m.category === 'out'));
  assert.ok(led.every((m) => m.referenceType === 'vendor_return'));
  assert.ok(led.every((m) => m.relatedPurchaseOrder === 'po1'));
  assert.ok(led.every((m) => m.supplier === 'v1'));

  // recalc called once per subProduct.
  assert.deepEqual([...new Set(calls.recalcs)].sort(), ['sp1', 'sp2']);
});

test('is idempotent: never applies stock twice', async () => {
  const { deps, calls } = makeEnv({ lots: { wh1: { currentQuantity: 50 } } });
  const vr = vendorReturn({ stockAdjusted: true });
  const res = await applyVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps);
  assert.deepEqual(res, { applied: false, reason: 'already-applied' });
  assert.equal(calls.movements.length, 0);
  assert.equal(calls.saves.length, 0);
  assert.equal(vr._saved, undefined);
});

test('requires a warehouse', async () => {
  const { deps } = makeEnv();
  await assert.rejects(
    applyVendorReturnStock(vendorReturn({ warehouse: null }), { tenantId: 't1', userId: 'u1' }, deps),
    /A warehouse is required/
  );
});

test('rejects before mutating when a line exceeds on-hand', async () => {
  const { deps, calls } = makeEnv({ lots: { wh1: { currentQuantity: 2 } } });
  const vr = vendorReturn(); // line A wants 4, warehouse has only 2
  await assert.rejects(
    applyVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps),
    /Insufficient stock to return to the vendor/
  );
  // Nothing was touched.
  assert.equal(calls.saves.length, 0);
  assert.equal(calls.movements.length, 0);
  assert.equal(calls.ledger.length, 0);
  assert.equal(vr.stockAdjusted, false);
});

test('reverse restores stock and posts a returned movement', async () => {
  const { deps, calls } = makeEnv({ lots: { wh1: { currentQuantity: 46 } } });
  const vr = vendorReturn({ stockAdjusted: true });
  const res = await reverseVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps);

  assert.equal(res.applied, true);
  assert.equal(vr.stockAdjusted, false);

  const sp1 = calls.saves.find((s) => s.subProduct === 'sp1');
  assert.equal(sp1.currentQuantity, 50);

  const ins = calls.movements.filter((m) => m.type === 'returned');
  assert.equal(ins.length, 2);
  assert.ok(ins.every((m) => m.reference.includes('restored')));

  const led = calls.ledger.filter((m) => m.type === 'return');
  assert.equal(led.length, 2);
  assert.ok(led.every((m) => m.category === 'in'));
});

test('reverse reinstates a row that was fully returned earlier', async () => {
  const { deps, calls } = makeEnv({ lots: {} }); // no rows anywhere
  const vr = vendorReturn({ stockAdjusted: true });
  const res = await reverseVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps);
  assert.equal(res.applied, true);
  const created = calls.saves.filter((s) => s.currentQuantity === 4 || s.currentQuantity === 2);
  assert.equal(created.length, 2);
});

test('reverse is a no-op when stock was never applied', async () => {
  const { deps, calls } = makeEnv({ lots: { wh1: { currentQuantity: 50 } } });
  const vr = vendorReturn(); // stockAdjusted false
  const res = await reverseVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps);
  assert.deepEqual(res, { applied: false, reason: 'not-applied' });
  assert.equal(calls.movements.length, 0);
  assert.equal(calls.saves.length, 0);
});

test('duplicate product-size lines cannot return more than the warehouse holds', async () => {
  const { deps, calls } = makeEnv({ lots: { wh1: { currentQuantity: 5 } } });
  const vr = vendorReturn({ items: [
    { subProductId: 'sp1', sizeId: 'sz1', quantity: 4 },
    { subProductId: 'sp1', sizeId: 'sz1', quantity: 4 },
  ] });
  await assert.rejects(applyVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps), /Insufficient stock/);
  assert.equal(calls.saves.length, 0);
});

test('vendor return stock rejects invalid quantities instead of silently skipping lines', async () => {
  const { deps, calls } = makeEnv({ lots: { wh1: { currentQuantity: 5 } } });
  for (const quantity of [-2, 1.5, Infinity]) {
    const vr = vendorReturn({ items: [{ subProductId: 'sp1', sizeId: 'sz1', quantity }] });
    await assert.rejects(applyVendorReturnStock(vr, { tenantId: 't1', userId: 'u1' }, deps), /positive integer/);
  }
  assert.equal(calls.saves.length, 0);
});

test('vendor return ledger rows satisfy the real movement schema', async () => {
  const mongoose = require('mongoose');
  const Movement = require('../models/InventoryMovement');
  const { deps, calls } = makeEnv({ lots: { wh1: { currentQuantity: 5 } } });
  await applyVendorReturnStock(vendorReturn(), { tenantId: 't1', userId: 'u1' }, deps);
  const row = { ...calls.ledger[0] };
  for (const field of ['tenant', 'subProduct', 'size', 'warehouse', 'relatedPurchaseOrder', 'supplier', 'performedBy']) row[field] = new mongoose.Types.ObjectId();
  assert.equal(new Movement(row).validateSync(), undefined);
});
