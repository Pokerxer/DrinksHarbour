// server/__tests__/stockTransferReceive.test.js
//
// Pins the receive half of transfer-as-purchase (Task 4): each receive line
// must move batches FEFO at the line's effective landed cost, dec/inc
// WarehouseStock on both sides, post a transfer_out/transfer_in movement pair,
// and recalc each touched SubProduct once. Validation rejects over-receiving
// and unknown item indexes before any stock is touched.
//
// Deps are injected, so no MongoDB is involved. Two adaptations vs the plan
// sketch, both sanctioned:
//   - makeDeps' fake WarehouseStock.findOne returns a source lot (999 units)
//     for source-warehouse queries and null for destination queries — the
//     service throws "Insufficient stock" when the source lot is missing.
//   - baseTransfer uses deliveryCharge 120 so line 0 carries a ₦100 charge
//     share ("eff 1000 + 10/unit share = 1010") under the landed weight-share
//     math in stockTransfer.money.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { receiveStockTransferLines } = require('../services/stockTransferReceive');

function makeDeps() {
  const calls = { moved: [], stock: [], movements: [], recalcs: [] };

  // Source warehouse has stock; destination starts with no lot (exercises the
  // create-new-lot branch). currentQuantity defaults to 0 like the real schema.
  class FakeWarehouseStock {
    constructor(init) {
      Object.assign(this, { currentQuantity: 0 }, init);
    }
    async save() {
      calls.stock.push({ ...this });
      return this;
    }
    static async findOne(q) {
      if (q && String(q.warehouse) === 'srcW') {
        return new FakeWarehouseStock({
          tenant: q.tenant,
          warehouse: q.warehouse,
          subProduct: q.subProduct,
          size: q.size,
          currentQuantity: 999,
        });
      }
      return null;
    }
  }

  return {
    deps: {
      batchService: {
        async transferBatchesFefo(a) { calls.moved.push(a); return []; },
      },
      WarehouseStock: FakeWarehouseStock,
      WarehouseMovement: {
        async create(docs) { calls.movements.push(...docs); return docs; },
      },
      recalcSubProductStock: async (id) => calls.recalcs.push(String(id)),
    },
    calls,
  };
}

const baseTransfer = () => ({
  transferNumber: 'TRF-2026-000001',
  sourceWarehouse: 'srcW',
  destinationWarehouse: 'dstW',
  deliveryCharge: 120,
  items: [
    { subProductId: 'sp1', sizeId: 'sz1', subProductName: 'A', quantity: 10, receivedQty: 0, costPrice: 1000, discountRate: 0, taxRate: 0 },
    { subProductId: 'sp2', sizeId: null, subProductName: 'B', quantity: 4, receivedQty: 2, costPrice: 500, taxRate: 10 },
  ],
});

test('moves batches at each line’s effective unit cost and records movements', async () => {
  const { deps, calls } = makeDeps();
  const transfer = baseTransfer();
  // line0: eff 1000 + 10/share = 1010; line1: 550×1.1=605
  await receiveStockTransferLines(
    { transfer, tenantId: 't1', userId: 'u1', lines: [{ itemIndex: 0, quantity: 6 }] },
    deps
  );
  assert.deepEqual(calls.moved[0], {
    tenantId: 't1', subProduct: 'sp1', size: 'sz1',
    fromWarehouse: 'srcW', toWarehouse: 'dstW', quantity: 6,
    destUnitCost: 1010,
  });
  assert.equal(calls.movements.length, 2);
  assert.equal(calls.movements[0].type, 'transfer_out');
  assert.equal(calls.movements[1].type, 'transfer_in');
  assert.match(calls.movements[1].reference, /Transfer TRF-2026-000001/);
  assert.deepEqual(calls.recalcs, ['sp1']);
});

test('rejects receiving more than outstanding', async () => {
  const { deps } = makeDeps();
  await assert.rejects(
    receiveStockTransferLines(
      { transfer: baseTransfer(), tenantId: 't1', userId: 'u1', lines: [{ itemIndex: 1, quantity: 3 }] },
      deps
    ),
    /outstanding/i
  );
});

test('rejects an unknown item index', async () => {
  const { deps } = makeDeps();
  await assert.rejects(
    receiveStockTransferLines(
      { transfer: baseTransfer(), tenantId: 't1', userId: 'u1', lines: [{ itemIndex: 9, quantity: 1 }] },
      deps
    ),
    /invalid/i
  );
});
