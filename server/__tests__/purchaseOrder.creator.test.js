const test = require('node:test');
const assert = require('node:assert/strict');
const PurchaseOrder = require('../models/PurchaseOrder');
const { getPurchaseOrders, getPurchaseOrder } = require('../controllers/purchaseOrder.controller');
function invoke(handler, req) {
  return new Promise((resolve, reject) =>
    handler(
      req,
      {
        status() {
          return this;
        },
        json: resolve,
      },
      reject,
    ),
  );
}
function setup(t, creator) {
  const data = { _id: 'po', items: [], createdBy: creator };
  const doc = { ...data, toObject: () => data };
  const selected = [];
  const cursor = (result) => {
    const q = {
      sort: () => q,
      skip: () => q,
      limit: () => q,
      populate: (path, fields) => {
        selected.push([path, fields]);
        return q;
      },
      then: (resolve) => resolve(result),
    };
    return q;
  };
  t.mock.method(PurchaseOrder, 'find', (query) => {
    assert.deepEqual(query, { tenant: 'tenant' });
    return cursor([doc]);
  });
  t.mock.method(PurchaseOrder, 'findOne', (query) => {
    assert.deepEqual(query, { _id: 'po', tenant: 'tenant' });
    return cursor(doc);
  });
  t.mock.method(PurchaseOrder, 'countDocuments', async () => 1);
  return { selected, req: { user: { tenant: 'tenant' }, query: {}, params: { id: 'po' } } };
}
test('purchase list selects stored user fields and resolves creator full name', async (t) => {
  const { req, selected } = setup(t, {
    _id: 'creator',
    firstName: 'Ada',
    lastName: 'Okafor',
    email: 'ada@example.test',
  });
  const result = await invoke(getPurchaseOrders, req);
  assert.equal(result.data[0].createdBy.name, 'Ada Okafor');
  const fields = selected.find(([path]) => path === 'createdBy')[1];
  for (const field of ['firstName', 'lastName', 'displayName', 'email'])
    assert.ok(fields.split(' ').includes(field));
});
test('purchase detail resolves display name without removing creator identity fields', async (t) => {
  const { req } = setup(t, {
    _id: 'creator',
    displayName: 'Purchasing Manager',
    email: 'ada@example.test',
  });
  const result = await invoke(getPurchaseOrder, req);
  assert.equal(result.data.createdBy.name, 'Purchasing Manager');
  assert.equal(result.data.createdBy.email, 'ada@example.test');
});
test('deleted purchase creator remains unavailable', async (t) => {
  const { req } = setup(t, null);
  const result = await invoke(getPurchaseOrders, req);
  assert.equal(result.data[0].createdBy, null);
});
