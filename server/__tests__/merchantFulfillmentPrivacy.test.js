'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dto } = require('../services/merchantFulfillment/access');
test('merchant operational projection strips nested settlement and unexpected fields', () => {
  const view = dto({
    _id: 'own-group',
    order: 'parent',
    tenant: 'own-tenant',
    currency: 'NGN',
    merchandiseMinor: 900,
    tenantShareMinor: 700,
    commissionMinor: 200,
    internalSecret: 'hidden',
    lines: [
      {
        line: 'line1',
        product: 'product1',
        subproduct: 'offer1',
        size: 'size1',
        quantity: 2,
        grossMinor: 1000,
        discountMinor: 100,
        merchandiseMinor: 900,
        tenantShareMinor: 700,
        commissionMinor: 200,
        unexpectedPrivate: 'hidden',
      },
    ],
  });
  assert.deepEqual(view.lines, [
    {
      line: 'line1',
      product: 'product1',
      subproduct: 'offer1',
      size: 'size1',
      quantity: 2,
      grossMinor: 1000,
      discountMinor: 100,
      merchandiseMinor: 900,
    },
  ]);
  assert.equal(view.tenantShareMinor, undefined);
  assert.equal(view.commissionMinor, undefined);
  assert.equal(view.internalSecret, undefined);
});
test('managed parent cannot be collected through legacy whole-order payment command', async (t) => {
  const Order = require('../models/Order'),
    controller = require('../controllers/order.controller');
  let writes = 0,
    error;
  const row = {
    _id: '650000000000000000000004',
    merchantFulfillmentVersion: 1,
    status: 'confirmed',
    paymentStatus: 'pending',
    paymentMethod: 'cash_on_delivery',
    items: [],
    save: async () => {
      writes++;
    },
  };
  t.mock.method(Order, 'findById', async () => row);
  t.mock.method(require('../services/orderAccess'), 'audit', async () => {});
  await controller.updatePaymentStatus(
    {
      params: { id: row._id },
      body: { action: 'mark_paid' },
      user: { _id: '650000000000000000000001', role: 'super_admin' },
    },
    {
      json() {},
      status() {
        return this;
      },
    },
    (e) => {
      error = e;
    }
  );
  assert.equal(error?.statusCode, 409);
  assert.equal(writes, 0);
});
test('quantity progress exposes only own operational ranges and excludes private refund and cost fields',()=>{
 const view=dto({_id:'own',fulfillmentVersion:2,lines:[],quantityProgress:[{line:'line',shipped:1,delivered:0,cancelled:0,privateCost:500,financialBlocks:[{start:1,quantity:1,kind:'reserved',refund:'private-proof',providerReference:'secret'}]}]});
 assert.equal(view.fulfillmentVersion,2);
 assert.deepEqual(view.quantityProgress,[{line:'line',shipped:1,delivered:0,cancelled:0,financialBlocks:[{start:1,quantity:1,kind:'reserved'}]}]);
});
