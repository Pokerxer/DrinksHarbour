'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const service = require('../services/orderStatus.service');
const A = '650000000000000000000001', B = '650000000000000000000002';
test('dispatch cannot mutate another merchant in a mixed parent', async () => {
 let writes = 0;
 const order = { status: 'confirmed', paymentStatus: 'paid', items: [{ tenant: A }, { tenant: B }], save: async () => { writes++; } };
 await assert.rejects(service.applyOrderStatus(order, 'shipped', { tenantId: A }), e => e.statusCode === 409);
 assert.equal(writes, 0); assert.equal(order.status, 'confirmed');
});
