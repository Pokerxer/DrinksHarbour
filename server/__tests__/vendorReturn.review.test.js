const test = require('node:test');
const assert = require('node:assert/strict');
const VendorReturn = require('../models/VendorReturn');
const PurchaseOrder = require('../models/PurchaseOrder');
const stock = require('../services/vendorReturn.stock');
const controller = require('../controllers/vendorReturn.controller');
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; }

test('generic edits cannot reset stockAdjusted or bypass the status transition', async (t) => {
  t.mock.method(VendorReturn, 'findOne', async () => ({ status: 'confirmed', stockAdjusted: true }));
  let saved;
  t.mock.method(VendorReturn, 'findOneAndUpdate', async (query, update) => { saved = update; return {}; });
  const res = response();
  await controller.updateVendorReturn({ user: { tenant: 't1' }, params: { id: 'vr1' }, body: { stockAdjusted: false, status: 'draft' } }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
  assert.equal(saved, undefined);
});

test('failed stock confirmation does not change purchase order return counters', async (t) => {
  t.mock.method(VendorReturn, 'findOne', async () => ({ status: 'draft', purchaseOrder: 'po1', items: [{ subProductId: 'sp1', quantity: 3 }] }));
  let writes = 0;
  t.mock.method(PurchaseOrder, 'bulkWrite', async () => { writes++; });
  t.mock.method(stock, 'applyVendorReturnStock', async () => { throw new Error('Insufficient stock'); });
  const VendorBill = require('../models/VendorBill');
  t.mock.method(VendorBill, 'findOne', () => ({ sort: async () => null }));
  let failure;
  await controller.updateReturnStatus({ user: { tenant: 't1', _id: 'u1' }, params: { id: 'vr1' }, body: { status: 'confirmed' } }, response(), (error) => { failure = error; });
  assert.match(failure.message, /Insufficient stock/);
  assert.equal(writes, 0);
});
