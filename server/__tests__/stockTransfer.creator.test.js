const test = require('node:test');
const assert = require('node:assert/strict');
const StockTransfer = require('../models/StockTransfer');
const Tenant = require('../models/Tenant');
const { getStockTransfers, getStockTransfer } = require('../controllers/stockTransfer.controller');

function invoke(handler, req) {
  return new Promise((resolve, reject) => handler(req, { json: resolve }, reject));
}
function setup(t, creator) {
  const selected = [];
  const data = { _id: 'transfer', createdBy: creator };
  const cursor = (result) => {
    const q = {
      populate: (path, fields) => {
        selected.push([path, fields]);
        return q;
      },
      sort: () => q,
      skip: () => q,
      limit: () => q,
      lean: async () => result,
    };
    return q;
  };
  t.mock.method(StockTransfer, 'find', (query) => {
    assert.deepEqual(query, { tenant: 'tenant' });
    return cursor([data]);
  });
  t.mock.method(StockTransfer, 'findOne', (query) => {
    assert.deepEqual(query, { _id: 'transfer', tenant: 'tenant' });
    return cursor(data);
  });
  t.mock.method(StockTransfer, 'countDocuments', async () => 1);
  t.mock.method(StockTransfer, 'aggregate', async () => []);
  return { selected, req: { user: { tenant: 'tenant' }, query: {}, params: { id: 'transfer' } } };
}
test('transfer list reads stored identity fields and resolves the creator full name', async (t) => {
  const { req, selected } = setup(t, {
    _id: 'creator',
    firstName: 'Ada',
    lastName: 'Okafor',
    email: 'ada@example.test',
  });
  const result = await invoke(getStockTransfers, req);
  assert.equal(result.data[0].createdBy.name, 'Ada Okafor');
  const fields = selected.find(([path]) => path === 'createdBy')[1];
  for (const field of ['firstName', 'lastName', 'displayName', 'email'])
    assert.ok(fields.split(' ').includes(field));
});
test('detail creator name prefers display name and retains email for identification', async (t) => {
  const { req } = setup(t, {
    _id: 'creator',
    displayName: 'Store Manager',
    firstName: 'Ada',
    email: 'ada@example.test',
  });
  const result = await invoke(getStockTransfer, req);
  assert.equal(result.data.createdBy.name, 'Store Manager');
  assert.equal(result.data.createdBy.email, 'ada@example.test');
});
test('deleted creators stay unavailable instead of being attributed to the viewer', async (t) => {
  const { req } = setup(t, null);
  const result = await invoke(getStockTransfers, req);
  assert.equal(result.data[0].createdBy, null);
});
