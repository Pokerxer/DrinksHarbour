const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const service = require('../services/salesOrder.service');
const oid = () => new mongoose.Types.ObjectId();

test('staff identity uses real User name fields and an immutable user reference', () => {
  const { salespersonIdentity } = require('../services/salesSalesperson');
  const id = oid();
  assert.deepEqual(salespersonIdentity({ _id: id, firstName: ' Ada ', lastName: ' Obi ' }), {
    salesperson: 'Ada Obi', salespersonUser: id,
  });
  assert.equal(salespersonIdentity({ displayName: 'Till operator' }).salesperson, 'Till operator');
  assert.equal(salespersonIdentity({ email: 'staff@example.test' }).salesperson, 'staff@example.test');
});

test('My Quotations uses actor ID with legacy name fallback only for unlinked documents', () => {
  const { mySalespersonQuery } = require('../services/salesSalesperson');
  const id = oid();
  assert.deepEqual(mySalespersonQuery({ _id: id, firstName: 'Ada', lastName: 'Obi' }), {
    $or: [{ salespersonUser: id }, { salespersonUser: null, salesperson: 'Ada Obi' }],
  });
  assert.deepEqual(mySalespersonQuery({ _id: id }), { salespersonUser: id });
  assert.deepEqual(mySalespersonQuery({ name: 'Ada Obi' }), { _id: { $in: [] } });
});

test('creation persists trusted actor assignment and ignores body impersonation', async t => {
  t.mock.method(SalesOrder, 'findOne', () => ({ sort: () => ({ select: () => ({ lean: async () => null }) }) }));
  t.mock.method(SalesOrder, 'create', async doc => doc);
  const userId = oid();
  const order = await service.createSalesOrderDoc({
    tenantId: oid(), salesperson: 'Ada Obi', salespersonUser: userId,
    body: { docType: 'quotation', items: [], salesperson: 'Someone else', salespersonUser: oid() },
  });
  assert.equal(order.salesperson, 'Ada Obi');
  assert.equal(order.salespersonUser, userId);
  const unassigned = await service.createSalesOrderDoc({ tenantId: oid(), body: { items: [], salesperson: 'Forged' } });
  assert.equal(unassigned.salesperson, '');
});

test('duplicating a quotation retains its assigned salesperson', async t => {
  t.mock.method(SalesOrder, 'findOne', () => ({ sort: () => ({ select: () => ({ lean: async () => null }) }) }));
  t.mock.method(SalesOrder.prototype, 'save', async function () { return this; });
  const userId = oid();
  const copy = await service.duplicateSalesOrderDoc({
    tenant: oid(), salesperson: 'Ada Obi', salespersonUser: userId,
    items: [], subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0,
  });
  assert.equal(copy.salesperson, 'Ada Obi');
  assert.equal(String(copy.salespersonUser), String(userId));
});

function response() {
  return { status() { return this; }, json(body) { this.body = body; return this; } };
}

test('HTTP creation takes assignment from authentication, never submitted names', async t => {
  const controller = require('../controllers/salesOrder.controller');
  const user = { _id: oid(), firstName: 'Ada', lastName: 'Obi', role: 'tenant_staff' };
  let captured;
  t.mock.method(service, 'createSalesOrderDoc', async args => {
    captured = args;
    return { _id: oid(), docType: 'quotation' };
  });
  t.mock.method(require('../services/salesActivity.service'), 'logActivity', async () => {});
  await controller.createSalesOrder({ user, tenant: { _id: oid() }, body: { salesperson: 'Forged' } }, response(), err => { throw err; });
  assert.equal(captured.salesperson, 'Ada Obi');
  assert.equal(captured.salespersonUser, user._id);
});

test('My Quotations composes tenant, search and advanced filters for grouping', async t => {
  const controller = require('../controllers/salesOrder.controller');
  const tenant = oid();
  const user = { _id: oid(), firstName: 'Ada', lastName: 'Obi' };
  let query;
  t.mock.method(service, 'getGroupedOrders', async args => {
    query = args.matchQuery;
    return { groups: [], truncated: false, fetched: 0, total: 0 };
  });
  await controller.getSalesOrders({ tenant: { _id: tenant }, user, query: {
    myQuotations: '1', groupBy: 'salesperson', search: 'Wine', docType: 'quotation',
    filters: JSON.stringify([{ field: 'currency', operator: 'equals', value: 'NGN' }]),
  } }, response(), err => { throw err; });
  assert.equal(query.tenant, tenant);
  assert.equal(query.docType, 'quotation');
  assert.equal(query.currency, 'NGN');
  assert.ok(query.$or.some(condition => condition.soNumber));
  assert.deepEqual(query.$and.at(-1), require('../services/salesSalesperson').mySalespersonQuery(user));
});

test('CSV import receives the authenticated assignment for each new document', async t => {
  const importer = require('../services/salesImport.service');
  const assignment = { salesperson: 'Ada Obi', salespersonUser: oid() };
  const seen = [];
  t.mock.method(service, 'createSalesOrderDoc', async args => { seen.push(args); });
  assert.equal((await importer.bulkImportSales([{ items: [] }, { items: [] }], oid(), assignment)).created, 2);
  assert.ok(seen.every(args => args.salespersonUser === assignment.salespersonUser));
});

test('editing a quotation cannot reassign its salesperson through the payload', async () => {
  const userId = oid();
  const order = { tenant: oid(), salesperson: 'Ada Obi', salespersonUser: userId };
  await service.applyEdit(order, { salesperson: 'Forged', salespersonUser: oid(), notes: 'Updated' });
  assert.equal(order.salesperson, 'Ada Obi');
  assert.equal(order.salespersonUser, userId);
});

for (const [endpoint, mutation] of [
  ['updateSalesOrder', 'applyEdit'],
  ['updatePrices', 'updatePricesForOrder'],
  ['applyCoupon', 'applyCouponToOrder'],
]) {
  test(`${endpoint} saves the authenticated quotation editor as salesperson`, async t => {
    const controller = require('../controllers/salesOrder.controller');
    const actor = { _id: oid(), firstName: 'Bola', lastName: 'Obi' };
    const originalUser = oid();
    const logs = [];
    const order = { _id: oid(), tenant: oid(), docType: 'quotation',
      salesperson: 'Ada Obi', salespersonUser: originalUser,
      save: async function () {
        assert.equal(this.salesperson, 'Bola Obi');
        assert.equal(this.salespersonUser, actor._id);
        return this;
      },
    };
    t.mock.method(SalesOrder, 'findOne', async query => {
      assert.equal(query.tenant, order.tenant);
      return order;
    });
    t.mock.method(service, 'canEdit', () => true);
    t.mock.method(service, mutation, async () => {});
    t.mock.method(require('../services/salesActivity.service'), 'logActivity', async (...args) => logs.push(args));
    const res = response();
    await controller[endpoint]({ tenant: { _id: order.tenant }, params: { id: order._id },
      user: actor, body: { notes: 'Changed', salesperson: 'Forged', salespersonUser: oid() } }, res, err => { throw err; });
    assert.equal(res.body.data.salesperson, 'Bola Obi');
    assert.ok(logs.some(([, , activity]) => activity.meta?.field === 'salesperson' && activity.userId === actor._id));
  });
}

test('failed quotation persistence retains assignment and writes no reassignment activity', async t => {
  const { saveSalesEdit } = require('../services/salesSalesperson');
  const logs = t.mock.method(require('../services/salesActivity.service'), 'logActivity', async () => {});
  const original = oid();
  const order = { docType: 'quotation', salesperson: 'Ada Obi', salespersonUser: original,
    save: async () => { throw new Error('Save failed'); } };
  await assert.rejects(saveSalesEdit(order, { _id: oid(), firstName: 'Bola' }), /Save failed/);
  assert.equal(order.salesperson, 'Ada Obi');
  assert.equal(order.salespersonUser, original);
  assert.equal(logs.mock.callCount(), 0);
});

test('sales order saves do not transfer assignment to the editor', async () => {
  const { saveSalesEdit } = require('../services/salesSalesperson');
  const original = oid();
  const order = { docType: 'order', salesperson: 'Ada Obi', salespersonUser: original,
    save: async function () { return this; } };
  await saveSalesEdit(order, { _id: oid(), firstName: 'Bola' });
  assert.equal(order.salesperson, 'Ada Obi');
  assert.equal(order.salespersonUser, original);
});

test('same-editor saves still include assignment fields for concurrent edit safety', async t => {
  const { saveSalesEdit } = require('../services/salesSalesperson');
  const id = oid();
  const marked = [];
  t.mock.method(require('../services/salesActivity.service'), 'logActivity', async () => {});
  await saveSalesEdit({ docType: 'quotation', salesperson: 'Ada', salespersonUser: id,
    markModified: field => marked.push(field), save: async () => {} }, { _id: id, firstName: 'Ada' });
  assert.deepEqual(marked, ['salesperson', 'salespersonUser']);
});

for (const blocked of ['read-only', 'invalid coupon']) {
  test(`${blocked} updates do not transfer salesperson assignment`, async t => {
    const controller = require('../controllers/salesOrder.controller');
    const original = oid();
    const order = { _id: oid(), tenant: oid(), docType: 'quotation',
      salesperson: 'Ada', salespersonUser: original, save: t.mock.fn() };
    t.mock.method(SalesOrder, 'findOne', async () => order);
    t.mock.method(service, 'canEdit', () => blocked !== 'read-only');
    t.mock.method(service, 'applyCouponToOrder', async () => { throw new Error('Invalid coupon'); });
    const res = response();
    await controller.applyCoupon({ tenant: { _id: order.tenant }, params: { id: order._id },
      user: { _id: oid(), firstName: 'Bola' }, body: { code: 'invalid' } }, res, err => { throw err; });
    assert.equal(res.body.success, false);
    assert.equal(order.salespersonUser, original);
    assert.equal(order.save.mock.callCount(), 0);
  });
}
