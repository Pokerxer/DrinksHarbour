'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../models/Order');
const controller = require('../controllers/order.controller');
const A = '650000000000000000000001', B = '650000000000000000000002', C = '650000000000000000000003';
const order = () => ({ _id: '650000000000000000000004', user: C, orderNumber: 'PRIVATE', status: 'pending',
  paymentStatus: 'pending', totalAmount: 330, subtotal: 300, shippingFee: 30, currency: 'NGN',
  paymentDetails: { transactionId: 'private-provider-data' }, platformCommissionTotal: 39,
  items: [{ tenant: A, quantity: 1, priceAtPurchase: 100, itemSubtotal: 100, costPrice: 25, tenantRevenueShare: 87 },
    { tenant: B, quantity: 1, priceAtPurchase: 200, itemSubtotal: 200, costPrice: 50, tenantRevenueShare: 174 }] });
async function run(handler, req) {
  let error; const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res, e => { error = e; });
  if (error) res.statusCode = error.statusCode || 500;
  return res;
}
function stub(t, row) {
  const chain = () => ({ populate() { return this; }, then(resolve) { return Promise.resolve(row).then(resolve); } });
  t.mock.method(Order, 'findById', chain); t.mock.method(Order, 'findOne', chain);
}
test('merchant detail contains only own lines and scoped merchandise total', async t => {
  stub(t, order());
  const res = await run(controller.getOrder, { params: { id: order()._id }, user: { _id: A, tenant: A, role: 'tenant_admin' } });
  assert.equal(res.statusCode, 200); assert.equal(res.body.data.order.items.length, 1);
  assert.equal(res.body.data.order.totalAmount, 100); assert.equal(res.body.data.order.shippingFee, 0);
  assert.equal(JSON.stringify(res.body).includes('tenantRevenueShare'), false);
  assert.equal(JSON.stringify(res.body).includes('private-provider-data'), false);
});
test('entering the owning email cannot authorize order-number lookup', async t => {
  const row = order(); row.shippingAddress = { email: 'owner@example.test' }; stub(t, row);
  const res = await run(controller.getOrderByNumber, { params: { orderNumber: 'PRIVATE' }, query: { email: 'owner@example.test' }, user: { _id: A, role: 'customer' } });
  assert.equal(res.statusCode, 404);
});
test('foreign detail denial is indistinguishable from missing record', async t => {
  stub(t, order());
  const res = await run(controller.getOrder, { params: { id: order()._id }, user: { _id: A, role: 'customer' } });
  assert.equal(res.statusCode, 404);
});
test('mixed merchant cancellation is refused before save or inventory effects', async t => {
  const row = order(); let writes = 0; row.save = async () => { writes++; }; stub(t, row);
  const res = await run(controller.cancelOrder, { params: { id: row._id }, body: {}, user: { _id: A, tenant: A, role: 'tenant_admin' } });
  assert.equal(res.statusCode, 409); assert.equal(writes, 0);
});
test('merchant total deducts its own allocated discount without foreign shipping', () => {
 const row = order(); row.items[0].discountAmount = 10;
 const view = require('../services/orderAccess').project(row, { _id: A, tenant: A, role: 'tenant_admin' });
 assert.equal(view.totalAmount, 90);
});
