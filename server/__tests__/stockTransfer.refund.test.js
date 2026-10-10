const test = require('node:test');
const assert = require('node:assert/strict');
test('purchases transfer controller exposes a return action', () => {
  assert.equal(typeof require('../controllers/stockTransfer.controller').returnStockTransfer, 'function');
});

const { returnStockTransferLine } = require('../services/stockTransfer.refund');
const realStock = require('../services/stockTransferReturn');
function fixture(overrides = {}) {
  const doc = { _id: 'tr1', transferNumber: 'TRF-1', status: 'completed', tenant: 't1',
    sourceWarehouse: 'source', destinationWarehouse: 'dest', deliveryCharge: 100,
    items: [{ subProductId: 'sp', sizeId: 'sz', quantity: 10, receivedQty: 10, transferredQty: 10,
      returnedQty: 0, costPrice: 100, taxRate: 10 }], returns: [], ...overrides };
  const session = {}; const moves = []; const authorized = []; const tax = [];
  doc.save = async options => assert.equal(options.session, session);
  const deps = { transaction: run => run(session), StockTransfer: { findOne(q) {
    assert.deepEqual(q, { _id: 'tr1', tenant: 't1' });
    return { session: async s => { assert.equal(s, session); return doc; } };
  } }, WarehouseMovement: { findOne(q) {
    assert.equal(q.tenant, 't1'); assert.equal(q.size, 'sz');
    return { session(s) { assert.equal(s, session); return { lean: async () => ({ _id: 'm1', ...q }) }; } };
  } }, stock: { returnTransferStock: async (ctx, args) => { assert.equal(args.session, session); moves.push(args.quantity); },
    reverseTransferMoney: realStock.reverseTransferMoney },
    tax: { reverseDocumentTax: async () => tax.push('reverse'), captureDocumentTax: async () => tax.push('capture') } };
  const record = body => returnStockTransferLine({ id: 'tr1', tenantId: 't1', userId: 'u1',
    authorize: async d => authorized.push(d.destinationWarehouse), ...body }, deps);
  return { doc, moves, authorized, tax, record, deps };
}
test('repeated partial returns reduce value and preserve original receipts', async () => {
  const f = fixture();
  await f.record({ itemIndex: 0, quantity: 3, requestId: 'a' });
  await f.record({ itemIndex: 0, quantity: 4, requestId: 'b' });
  assert.equal(f.doc.items[0].returnedQty, 7);
  assert.equal(f.doc.items[0].receivedQty, 10);
  assert.equal(f.doc.status, 'completed');
  assert.equal(f.doc.total, 360);
  assert.deepEqual(f.moves, [3, 4]);
  await assert.rejects(f.record({ itemIndex: 0, quantity: 4 }), /more than received/);
  assert.equal(f.moves.length, 2);
});
test('transfer return retries do not move stock twice', async () => {
  const f = fixture();
  const data = { itemIndex: 0, quantity: 10, requestId: 'same', note: 'damaged' };
  await f.record(data); await f.record(data);
  assert.deepEqual(f.moves, [10]);
  assert.equal(f.doc.total, 0);
  assert.equal(f.doc.returns.length, 1);
  assert.deepEqual(f.authorized, ['dest', 'dest']);
  await assert.rejects(f.record({ ...data, quantity: 1 }), /different details/);
});
test('invalid line, quantity or status does not mutate stock', async () => {
  const f = fixture({ status: 'draft' });
  await assert.rejects(f.record({ itemIndex: 0, quantity: 1 }), /received/);
  await assert.rejects(f.record({ itemIndex: 0, quantity: 1.5 }), /integer/);
  const completed = fixture();
  await assert.rejects(completed.record({ itemIndex: 2, quantity: 1 }), /not found/);
  assert.equal(f.moves.length, 0); assert.equal(completed.moves.length, 0);
});

test('destination authorization failure prevents any stock operation', async () => {
  const f = fixture();
  await assert.rejects(f.record({ itemIndex: 0, quantity: 1, authorize: async () => { throw new Error('Not destination manager'); } }), /manager/);
  assert.deepEqual(f.moves, []);
});

test('return history records the value reversed and balance after each refund', async () => {
  const f = fixture();
  await f.record({ itemIndex: 0, quantity: 3, requestId: 'first' });
  await f.record({ itemIndex: 0, quantity: 2, requestId: 'second' });
  assert.equal(f.doc.returns[0].refundedValue, 360);
  assert.equal(f.doc.returns[0].remainingValue, 840);
  assert.equal(f.doc.returns[1].refundedValue, 240);
  assert.equal(f.doc.returns[1].remainingValue, 600);
});

test('whole invoice return uses one transaction and returns only received remaining units', async () => {
  const { returnWholeStockTransfer } = require('../services/stockTransfer.refund');
  const doc = { _id: 'tr', status: 'completed', items: [{ receivedQty: 5, returnedQty: 2 }, { receivedQty: 0, returnedQty: 0 }, { receivedQty: 4, returnedQty: 0 }], returns: [] };
  let transactions = 0; const calls = []; const session = {};
  const result = await returnWholeStockTransfer({ id: 'tr', tenantId: 't', userId: 'u', requestId: 'all', authorize: async () => {} }, {
    StockTransfer: { findOne: () => ({ session: async () => doc }) },
    transaction: async run => { transactions++; return run(session); },
    returnLine: async (args, deps) => { await deps.transaction(s => { assert.equal(s, session); }); calls.push(args); return doc; },
    tax: { reverseDocumentTax: async () => {}, captureDocumentTax: async () => {} },
  });
  assert.equal(result, doc); assert.equal(transactions, 1);
  assert.deepEqual(calls.map(c => [c.itemIndex, c.quantity]), [[0, 3], [2, 4]]);
});


test('whole invoice retry preserves history per line and never moves stock twice', async () => {
  const { returnWholeStockTransfer } = require('../services/stockTransfer.refund');
  const f = fixture();
  f.doc.items.push({ ...f.doc.items[0], receivedQty: 6, transferredQty: 6, quantity: 6, returnedQty: 2 });
  const args = { id: 'tr1', tenantId: 't1', userId: 'u1', requestId: 'bulk', note: 'damaged', authorize: async () => {} };
  await returnWholeStockTransfer(args, f.deps);
  await returnWholeStockTransfer(args, f.deps);
  assert.deepEqual(f.moves, [10, 4]);
  assert.equal(f.doc.returns.length, 2);
  assert.deepEqual(f.doc.returns.map(r => r.lines[0].quantity), [10, 4]);
  assert.equal(f.doc.returns[1].remainingValue, 0);
  assert.equal(f.doc.total, 0);
  await assert.rejects(returnWholeStockTransfer({ ...args, note: 'different' }, f.deps), /different details/);
  await assert.rejects(returnWholeStockTransfer({ ...args, requestId: 'new' }, f.deps), /No received products/);
});

test('whole invoice authorization failure prevents every line and tax write', async () => {
  const { returnWholeStockTransfer } = require('../services/stockTransfer.refund');
  const f = fixture();
  await assert.rejects(returnWholeStockTransfer({ id: 'tr1', tenantId: 't1', userId: 'u1', authorize: async () => { throw new Error('Not destination manager'); } }, f.deps), /manager/);
  assert.deepEqual(f.moves, []);
  assert.deepEqual(f.tax, []);
});
