const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const service = require('../services/batchPayment.service');
const Batch = require('../models/BatchPayment');
test('batch browsing applies account/search/date before paging and returns full filtered totals', async (t) => {
  const tenant = new mongoose.Types.ObjectId(); let filter;
  const chain = { sort: () => chain, skip: () => chain, limit: () => chain, populate: () => chain, lean: async () => [] };
  t.mock.method(Batch, 'find', value => { filter = value; return chain; });
  t.mock.method(Batch, 'countDocuments', async () => 51);
  t.mock.method(Batch, 'aggregate', async pipeline => { assert.deepEqual(pipeline[0].$match, filter); return [{ openCount: 51, openAmount: 200 }]; });
  const result = await service.listBatches(tenant, { account: '2200', search: 'BATCH[', from: '2026-10-01', limit: 25, page: 2 });
  assert.equal(filter.account, '2200'); assert.equal(filter.$or[0].number.test('BATCH['), true);
  assert.equal(result.batchSummary.openAmount, 200); assert.equal(result.pages, 3);
});
test('invalid batch direction/account/status/date fail before querying', async () => {
  const tenant = new mongoose.Types.ObjectId();
  for (const options of [{ direction: 'unknown' }, { account: '1300' }, { status: 'paid' }, { from: '2026-10-20', to: '2026-10-01' }]) await assert.rejects(service.listBatches(tenant, options), /Invalid|date/i);
});
test('batch endpoints forward account/search/date and preserve the filtered summary', async (t) => {
  const controller = require('../controllers/arAp.controller');
  let output;
  t.mock.method(service, 'listBatches', async (_tenant, options) => {
    assert.equal(options.account, '2200'); assert.equal(options.search, 'wallet'); assert.equal(options.from, '2026-10-01');
    return { data: [], total: 0, page: 1, pages: 1, batchSummary: { openAmount: 50 } };
  });
  let error;
  await controller.listBatches({ tenant: { _id: 'tenant' }, query: { account: '2200', search: 'wallet', from: '2026-10-01' } }, { json: value => { output = value; } }, e => { error = e; });
  assert.equal(error, undefined); assert.equal(output.batchSummary.openAmount, 50);
});
for (const action of ['create', 'deposit', 'cancel']) test(`batch ${action} uses authenticated tenant authority instead of another resolved tenant`, async (t) => {
  const controller = require('../controllers/arAp.controller');
  const owner = new mongoose.Types.ObjectId(), different = new mongoose.Types.ObjectId();
  t.mock.method(service, `${action}Batch`, async ({ tenantId }) => {
    assert.equal(String(tenantId), String(owner)); throw new Error('owner confirmed');
  });
  let error;
  await controller[`${action}Batch`]({ user: { _id: new mongoose.Types.ObjectId(), tenant: owner }, tenant: { _id: different }, body: { direction: 'customer', paymentIds: [], tenant: different }, params: { id: String(new mongoose.Types.ObjectId()) } }, {}, e => { error = e; });
  assert.equal(error.message, 'owner confirmed');
});
test('source claim index verification refuses a partial filter that leaves some active claims unprotected', async (t) => {
  const Claim = require('../models/SourceBatchClaim');
  const { requireSourceIndex } = require('../services/batchPayment/mutations');
  t.mock.method(Claim.collection, 'listIndexes', () => ({ toArray: async () => [{
    key: { tenant: 1, journal: 1, account: 1 }, unique: true,
    partialFilterExpression: { active: true, anotherCondition: true },
  }] }));
  await assert.rejects(requireSourceIndex(), /index|protection/i);
});
