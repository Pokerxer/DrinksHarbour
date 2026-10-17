const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const service = require('../services/accountingPayment.service');
const controller = require('../controllers/arAp.controller');
for (const action of ['create', 'cancel']) {
  test(`vendor ${action} honors the side sent in the body instead of defaulting to customer`, async (t) => {
    t.mock.method(service, `${action}Payment`, async ({ direction }) => { throw new Error(`direction:${direction}`); });
    let error;
    await controller[`${action}Payment`]({ tenant: { _id: 'tenant' }, user: { _id: 'user' }, query: {}, body: { side: 'vendor', amount: 20 }, params: { id: 'payment' } }, {}, (e) => { error = e; });
    assert.equal(error.message, 'direction:vendor');
  });
}
test('conflicting payment sides fail without a write', async (t) => {
  let writes = 0;
  t.mock.method(service, 'createPayment', async () => { writes++; throw new Error('should not write'); });
  let error;
  await controller.createPayment({ query: { side: 'customer' }, body: { side: 'vendor', amount: 20 }, tenant: { _id: 'tenant' }, user: { _id: 'user' } }, {}, (e) => { error = e; });
  assert.match(error.message, /Conflicting payment side/); assert.equal(writes, 0);
});
test('payment browse applies tenant-scoped escaped search and method before paging with complete totals', async (t) => {
  t.mock.method(require('../services/accountingPayment/sourceReceipts'), 'readSourceReceipts', async () => []);
  const Model = require('../models/CustomerPayment');
  const Party = require('../models/POSCustomer');
  const tenant = new mongoose.Types.ObjectId();
  let filter;
  t.mock.method(Party, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  const chain = { sort: () => chain, skip: () => chain, limit: () => chain, populate: () => chain, lean: async () => [] };
  t.mock.method(Model, 'find', (query) => { filter = query; return chain; });
  t.mock.method(Model, 'countDocuments', async () => 50);
  t.mock.method(Model, 'aggregate', async (pipeline) => { assert.deepEqual(pipeline[0].$match, filter); return [{ activeAmount: 300, allocated: 200, unallocated: 100, cancelledAmount: 10 }]; });
  const result = await service.listPayments(tenant, 'customer', { search: 'PAY[', method: 'cash', page: 2, limit: 25 });
  assert.equal(String(filter.tenant), String(tenant)); assert.equal(filter.method, 'cash');
  assert.equal(filter.$or[0].number.test('PAY['), true);
  assert.equal(result.paymentSummary.unallocated, 100); assert.equal(result.pages, 2);
});
test('invalid payment filters fail before reaching Mongo', async () => {
  const tenant = new mongoose.Types.ObjectId();
  await assert.rejects(service.listPayments(tenant, 'unknown'), /Invalid payment side/);
  await assert.rejects(service.listPayments(tenant, 'vendor', { status: 'paid' }), /Invalid payment status/);
  await assert.rejects(service.listPayments(tenant, 'customer', { method: 'crypto' }), /Invalid payment method/);
});
