'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
test('tenant summary keeps only own discount-adjusted merchandise and hides competing identities', () => {
 const row = { _id: 'order', user: 'buyer', totalAmount: 330, subtotal: 300, shippingFee: 30,
   items: [{ tenant: 'a', quantity: 1, itemSubtotal: 100, discountAmount: 10 }, { tenant: 'b', quantity: 1, itemSubtotal: 200 }] };
 const view = require('../services/orderAccess').merchantSummary(row, 'a');
 assert.equal(view.totalAmount, 90); assert.equal(view.items.length, 1); assert.equal(view.user, 'buyer');
 assert.equal(view.items[0].tenant, 'a');
});
