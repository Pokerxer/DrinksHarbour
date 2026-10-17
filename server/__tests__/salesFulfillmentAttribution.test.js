const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const people = require('../services/salesSalesperson');
const oid = () => new mongoose.Types.ObjectId();
const actor = () => ({ _id: oid(), firstName: 'Bola', lastName: 'Obi' });

test('completion captures the fulfiller name once, not the quotation editor', () => {
  const user = actor();
  const order = { orderStatus: 'partially_fulfilled', salesperson: 'Ada' };
  people.completeFulfillment(order, user);
  assert.equal(order.fulfillmentAttribution, undefined);
  order.orderStatus = 'fulfilled';
  people.completeFulfillment(order, user);
  assert.equal(order.salesperson, 'Bola Obi');
  assert.equal(order.fulfillmentAttribution.name, 'Bola Obi');
  assert.equal(order.fulfillmentAttribution.user, user._id);
  const original = order.fulfillmentAttribution;
  people.completeFulfillment(order, { ...actor(), firstName: 'Changed' });
  assert.equal(order.fulfillmentAttribution, original);
  assert.equal(order.salesperson, 'Bola Obi');
});

test('loaded completed orders reject editing or clearing frozen attribution', async () => {
  for (const mutate of [
    doc => { doc.salesperson = 'Changed'; },
    doc => { doc.salespersonUser = oid(); },
    doc => { doc.fulfillmentAttribution.name = 'Changed'; },
    doc => { doc.fulfillmentAttribution = undefined; },
  ]) {
    const user = actor();
    const order = SalesOrder.hydrate({ _id: oid(), tenant: oid(), soNumber: 'F-1',
      docType: 'order', orderStatus: 'fulfilled', salesperson: 'Bola Obi', salespersonUser: user._id,
      fulfillmentAttribution: { user: user._id, name: 'Bola Obi', at: new Date() },
      items: [], subtotal: 0, total: 0 });
    mutate(order);
    await assert.rejects(order.validate(), /attribution.*locked/i);
  }
});

function order() {
  return { _id: oid(), tenant: oid(), soNumber: 'F-1', docType: 'order', orderStatus: 'confirmed',
    salesperson: 'Ada', total: 20, amountPaid: 0, relatedSales: [], fulfillments: [],
    items: [{ _id: oid(), product: oid(), subproduct: oid(), size: oid(), quantity: 2,
      unitPrice: 10, lineTotal: 20, fulfilledQty: 0, postedQty: 0 }],
    save: async function () { return this; } };
}

test('manual delivery stamps only the final successful shipment', async () => {
  const service = require('../services/salesFulfill.service');
  const so = order(), user = actor();
  const args = { salesOrder: so, tenantId: so.tenant, warehouseId: oid(), userId: user._id,
    actor: user, fulfillLines: [{ lineId: String(so.items[0]._id), qty: 1 }],
    deps: { adjustStock: async () => ({ currentQuantity: 10 }),
      SalesModel: { create: async () => ({ _id: oid() }) }, getUnitCost: async () => 0 } };
  await service.fulfillOrder(args);
  assert.equal(so.fulfillmentAttribution, undefined);
  await service.fulfillOrder({ ...args, actor: { ...user, firstName: 'Final' } });
  assert.equal(so.fulfillmentAttribution.name, 'Final Obi');
});

test('legacy POS completion stamps the cashier and replay cannot replace them', async () => {
  const service = require('../services/salesFulfill.service');
  const so = order(), user = actor();
  const args = { salesOrder: so, actor: user, userId: user._id, ref: 'RECEIPT-1',
    fulfillLines: [{ lineId: String(so.items[0]._id), qty: 2 }] };
  await service.reconcileFulfillment(args);
  assert.equal(so.fulfillmentAttribution.name, 'Bola Obi');
  await service.reconcileFulfillment({ ...args, actor: actor(), userId: oid() });
  assert.equal(so.fulfillmentAttribution.user, user._id);
});

test('reserved POS completion stamps the settled receipt cashier', async t => {
  const { settleReceipt } = require('../services/salesReservations/posReceipt');
  t.mock.method(require('../models/Sales'), 'create', async () => [{ _id: oid() }]);
  const so = order(), user = actor();
  so.$locals = {};
  const receipt = { _id: oid(), tenant: so.tenant, linkedSalesOrder: so._id,
    receiptNumber: 'POS-1', posStaff: user._id, paymentMethod: 'cash', totalAmount: 20,
    items: [{ ...so.items[0], priceAtPurchase: 10, itemSubtotal: 20 }] };
  await settleReceipt({ order: so, receipt, actor: user, actorId: user._id,
    tenantId: so.tenant, warehouseId: oid(), consumed: new Map([[String(so.items[0]._id), 2]]) });
  assert.equal(so.fulfillmentAttribution.name, 'Bola Obi');
  assert.equal(so.salespersonUser, user._id);
});

test('receipt attribution uses the actual POS staff, not a different reconciler', async t => {
  const cashier = actor(), reconciler = actor(), tenant = oid();
  t.mock.method(require('../models/User'), 'findOne', query => {
    assert.equal(query._id, cashier._id);
    assert.equal(query.tenant, tenant);
    return { select() { return this; }, lean: async () => cashier };
  });
  const found = await people.fulfillmentActorForReceipt({ posStaff: cashier._id }, reconciler, tenant);
  assert.equal(found._id, cashier._id);
});
