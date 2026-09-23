// server/__tests__/stockTransferReturn.test.js
//
// Pins the reverse half of transfer-as-purchase (move a transfer line back to
// its origin from a movement-history entry): resolution of a transfer_in /
// transfer_out movement to its source+destination, stock reversal on both
// warehouses with a transfer_out/returned movement pair, and — for StockTransfer
// module movements — money reversal (receivedQty↓, returnedQty↑, re-snapshotted
// totals + tax reversal/re-capture).
//
// Deps are injected, so no MongoDB is involved (same pattern as
// stockTransferReceive.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTransferReturn,
  returnTransferStock,
  reverseTransferMoney,
  applyTransferMoneyRemaining,
} = require('../services/stockTransferReturn');

function makeStockDeps({ holdingLots = {}, saveLog = [], calls = {} } = {}) {
  class FakeWarehouseStock {
    constructor(init) {
      Object.assign(this, { currentQuantity: 0 }, init);
    }
    async save() {
      saveLog.push({ ...this });
      return this;
    }
    static async findOne(q) {
      const key = String(q.warehouse);
      if (holdingLots[key]) {
        return new this({
          tenant: q.tenant,
          warehouse: q.warehouse,
          subProduct: q.subProduct,
          size: q.size,
          ...holdingLots[key],
        });
      }
      return null;
    }
  }
  return {
    deps: {
      batchService: {
        async transferBatchesFefo(a) {
          calls.moved = calls.moved || [];
          calls.moved.push(a);
          return [];
        },
      },
      WarehouseStock: FakeWarehouseStock,
      WarehouseMovement: {
        async create(docs) {
          calls.movements = calls.movements || [];
          calls.movements.push(...docs);
          return docs;
        },
      },
      InventoryMovement: {
        async create(docs) {
          calls.ledger = calls.ledger || [];
          calls.ledger.push(...docs);
          return docs;
        },
      },
      recalcSubProductStock: async (id) => {
        calls.recalcs = calls.recalcs || [];
        calls.recalcs.push(String(id));
      },
    },
    calls,
    saveLog,
  };
}

const baseTransfer = () => ({
  _id: 'trf1',
  tenant: 't1',
  transferNumber: 'TRF-2026-000001',
  sourceWarehouse: 'srcW',
  destinationWarehouse: 'dstW',
  deliveryCharge: 0,
  currency: 'NGN',
  items: [
    {
      subProductId: 'sp1', sizeId: 'sz1', subProductName: 'A',
      quantity: 10, receivedQty: 10, transferredQty: 10, returnedQty: 0,
      costPrice: 1000, discountRate: 0, taxRate: 0,
    },
  ],
  save() {
    this._saved = (this._saved || 0) + 1;
    return Promise.resolve(this);
  },
  status: 'completed',
});

const moduleMovement = (overrides = {}) => ({
  _id: 'm1',
  type: 'transfer_in',
  warehouse: 'dstW',
  subProduct: 'sp1',
  size: 'sz1',
  quantity: 10,
  reference: 'Transfer TRF-2026-000001',
  createdAt: new Date(),
  ...overrides,
});

test('resolves a StockTransfer module movement to source + destination', async () => {
  const transfer = baseTransfer();
  const deps = {
    StockTransfer: {
      async findOne(q) {
        assert.equal(q.tenant, 't1');
        assert.equal(q.transferNumber, 'TRF-2026-000001');
        return transfer;
      },
    },
  };
  const ctx = await resolveTransferReturn({ movement: moduleMovement(), tenantId: 't1' }, deps);
  assert.equal(ctx.kind, 'module');
  assert.equal(ctx.holding, 'dstW');
  assert.equal(ctx.other, 'srcW');
  assert.equal(ctx.returnable, 10);
  assert.equal(ctx.transferNumber, 'TRF-2026-000001');
  assert.equal(ctx.itemIndex, 0);
});

test('resolves a lightweight warehouse transfer via transferGroupId pair', async () => {
  const deps = {
    WarehouseMovement: {
      findOne(q) {
        assert.deepEqual(q, {
          tenant: 't1',
          transferGroupId: 'g1',
          _id: { $ne: 'm1' },
        });
        return {
          lean: async () => ({ warehouse: 'srcW', type: 'transfer_out' }),
        };
      },
    },
  };
  const ctx = await resolveTransferReturn(
    {
      movement: moduleMovement({
        transferGroupId: 'g1',
        reference: 'some notes',
      }),
      tenantId: 't1',
    },
    deps
  );
  assert.equal(ctx.kind, 'light');
  assert.equal(ctx.holding, 'dstW');
  assert.equal(ctx.other, 'srcW');
  assert.equal(ctx.returnable, null);
});

test('rejects a module movement whose warehouses do not match the transfer', async () => {
  const transfer = { ...baseTransfer(), destinationWarehouse: 'elsewhere' };
  const deps = {
    StockTransfer: { async findOne() { return transfer; } },
  };
  await assert.rejects(
    resolveTransferReturn({ movement: moduleMovement(), tenantId: 't1' }, deps),
    /Movement does not match the transfer warehouses/
  );
});

test('reverses stock and records a transfer_out/returned movement pair', async () => {
  const { deps, calls, saveLog } = makeStockDeps({
    holdingLots: { dstW: { currentQuantity: 25 } },
  });
  const ctx = {
    kind: 'module',
    movement: { subProduct: 'sp1', size: 'sz1' },
    holding: 'dstW',
    other: 'srcW',
    transfer: baseTransfer(),
    itemIndex: 0,
    transferNumber: 'TRF-2026-000001',
    returnable: 10,
  };
  const res = await returnTransferStock(
    ctx,
    { quantity: 6, tenantId: 't1', userId: 'u1', note: 'wrong batch' },
    deps
  );

  assert.equal(res.before, 25);
  assert.equal(res.holdingAfter, 19);
  assert.equal(res.receivingAfter, 6);

  const holdSave = saveLog.find((s) => s.warehouse === 'dstW');
  const recvSave = saveLog.find((s) => s.warehouse === 'srcW');
  assert.equal(holdSave.currentQuantity, 19);
  assert.equal(recvSave.currentQuantity, 6);

  // Stock moved at the exact value written on receipt.
  assert.deepEqual(calls.moved[0], {
    tenantId: 't1',
    subProduct: 'sp1',
    size: 'sz1',
    fromWarehouse: 'dstW',
    toWarehouse: 'srcW',
    quantity: 6,
    destUnitCost: 1000,
  });

  assert.equal(calls.movements.length, 2);
  assert.equal(calls.movements[0].type, 'transfer_out');
  assert.equal(calls.movements[0].warehouse, 'dstW');
  assert.equal(calls.movements[0].quantity, 6);
  assert.equal(calls.movements[1].type, 'returned');
  assert.equal(calls.movements[1].warehouse, 'srcW');
  assert.equal(calls.movements[1].quantity, 6);
  assert.match(calls.movements[0].reference, /TRF-2026-000001/);

  assert.equal(calls.ledger.length, 2);
  assert.match(calls.recalcs.join(','), /sp1/);
});

test('allows returning a lightweight transfer without a unit cost', async () => {
  const { deps, calls } = makeStockDeps({
    holdingLots: { dstW: { currentQuantity: 25 } },
  });
  const ctx = {
    kind: 'light',
    movement: { subProduct: 'sp1', size: 'sz1', reference: 'notes', transferGroupId: 'g1' },
    holding: 'dstW',
    other: 'srcW',
    transferNumber: null,
    returnable: null,
  };
  await returnTransferStock(ctx, { quantity: 4, tenantId: 't1', userId: 'u1' }, deps);
  const move = calls.moved[0];
  assert.equal(move.fromWarehouse, 'dstW');
  assert.equal(move.toWarehouse, 'srcW');
  assert.equal('destUnitCost' in move, false);
});

test('rejects returning more than the holding warehouse has', async () => {
  const { deps } = makeStockDeps({ holdingLots: { dstW: { currentQuantity: 5 } } });
  const ctx = {
    kind: 'module',
    movement: { subProduct: 'sp1', size: 'sz1' },
    holding: 'dstW',
    other: 'srcW',
    transfer: baseTransfer(),
    itemIndex: 0,
    transferNumber: 'TRF-2026-000001',
    returnable: 20,
  };
  await assert.rejects(
    returnTransferStock(ctx, { quantity: 12, tenantId: 't1', userId: 'u1' }, deps),
    /Insufficient stock to return/
  );
});

test('rejects returning more than was received and not yet returned', async () => {
  const transfer = baseTransfer();
  transfer.items[0].receivedQty = 4;
  const { deps } = makeStockDeps({ holdingLots: { dstW: { currentQuantity: 25 } } });
  const ctx = {
    kind: 'module',
    movement: { subProduct: 'sp1', size: 'sz1' },
    holding: 'dstW',
    other: 'srcW',
    transfer,
    itemIndex: 0,
    transferNumber: 'TRF-2026-000001',
    returnable: 4,
  };
  await assert.rejects(
    returnTransferStock(ctx, { quantity: 6, tenantId: 't1', userId: 'u1' }, deps),
    /Cannot return more than received/
  );
});

test('reverses money while retaining historical receipts and completed status', async () => {
  const transfer = baseTransfer();
  const deps = {
    reverseDocumentTax: async (a) => {
      assert.equal(a.sourceType, 'stock_transfer');
      assert.equal(a.doc, transfer);
    },
    captureDocumentTax: async (a) => {
      assert.equal(a.sourceType, 'stock_transfer');
      assert.equal(a.doc, transfer);
    },
  };
  const ctx = {
    transfer,
    item: transfer.items[0],
    itemIndex: 0,
  };
  await reverseTransferMoney(ctx, { quantity: 4, userId: 'u1', note: 'kitten' }, deps);

  assert.equal(transfer.items[0].receivedQty, 10);
  assert.equal(transfer.items[0].transferredQty, 10);
  assert.equal(transfer.items[0].returnedQty, 4);
  assert.equal(transfer.returns.length, 1);
  assert.deepEqual(transfer.returns[0].lines, [{ itemIndex: 0, quantity: 4, note: 'kitten' }]);
  // 10@1000 → 6@1000 after the return.
  assert.equal(transfer.subtotal, 6000);
  assert.equal(transfer.total, 6000);
  assert.equal(transfer.status, 'completed'); // returns do not reopen receiving
  assert.equal(transfer._saved, 1);
});

test('applyTransferMoneyRemaining nets per-line returnedQty', () => {
  const transfer = baseTransfer();
  transfer.items.push({
    subProductId: 'sp2', sizeId: null, subProductName: 'B',
    quantity: 4, receivedQty: 4, returnedQty: 2,
    costPrice: 500, discountRate: 0, taxRate: 10,
  });
  const m = applyTransferMoneyRemaining(transfer);
  // line0 unchanged: 10@1000 = 10000; line1 returns 2 → 2@500×(1.1) = 1100.
  assert.equal(m.subtotal, 11000);
  assert.equal(m.taxAmount, 100);
  assert.equal(m.total, 11100);
});
test('resolved context can execute the stock return without caller patching it', async () => {
  const transfer = baseTransfer();
  const env = makeStockDeps({ holdingLots: { dstW: { currentQuantity: 10 } } });
  const ctx = await resolveTransferReturn({ movement: moduleMovement(), tenantId: 't1' }, {
    StockTransfer: { findOne: async () => transfer },
  });
  const result = await returnTransferStock(ctx, { quantity: 2, tenantId: 't1', userId: 'u1' }, env.deps);
  assert.equal(result.holdingAfter, 8);
});

test('two partial returns leave the remaining received goods returnable', async () => {
  const transfer = baseTransfer();
  await reverseTransferMoney({ transfer, item: transfer.items[0], itemIndex: 0 },
    { quantity: 4, userId: 'u1' }, { reverseDocumentTax: async () => {}, captureDocumentTax: async () => {} });
  const ctx = await resolveTransferReturn({ movement: moduleMovement(), tenantId: 't1' }, {
    StockTransfer: { findOne: async () => transfer },
  });
  assert.equal(ctx.returnable, 6);
});

test('money remaining reads actual Mongoose subdocument values', () => {
  const StockTransfer = require('../models/StockTransfer');
  const transfer = new StockTransfer({ items: [{ quantity: 10, returnedQty: 4, costPrice: 1000, discountRate: 10, taxRate: 10 }] });
  const result = applyTransferMoneyRemaining(transfer);
  assert.equal(result.subtotal, 6000);
  assert.equal(result.total, 5940);
});

test('rejects fractional return quantities before changing stock', async () => {
  const env = makeStockDeps();
  await assert.rejects(returnTransferStock({ returnable: 10 }, { quantity: 1.5 }, env.deps), /positive integer/);
  assert.equal(env.saveLog.length, 0);
});


test('transfer tax excludes returned units', () => {
  const { _buildRecordGroups } = require('../services/tax.service');
  const groups = _buildRecordGroups({ sourceType: 'stock_transfer', taxes: [], doc: {
    items: [{ quantity: 10, returnedQty: 4, costPrice: 1000, taxRate: 10 }],
  }});
  assert.equal(groups[0].taxableBase, 6000);
  assert.equal(groups[0].taxAmount, 600);
});

test('partial returns reverse the matching share of delivery charges', () => {
  const transfer = baseTransfer();
  transfer.deliveryCharge = 100;
  transfer.items[0].returnedQty = 4;
  const result = applyTransferMoneyRemaining(transfer);
  // Six of ten units remain, so only 60% of the original delivery charge
  // remains payable: 6,000 goods + 60 delivery.
  assert.equal(result.total, 6060);
});
