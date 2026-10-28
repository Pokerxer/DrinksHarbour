// server/__tests__/posRealtimeOrdersRoom.test.js
//
// The tenant-order feed room: name shape, and the same contract every
// pos.realtime helper has — no io (serverless) is a normal no-op, and every
// emitted payload is stamped with a timestamp.

const test = require('node:test');
const assert = require('node:assert/strict');

const { ordersRoom, emitToTenantOrders } = require('../services/pos.realtime');

test('ordersRoom is namespaced per tenant', () => {
  assert.equal(
    ordersRoom('64f000000000000000000001'),
    'orders:64f000000000000000000001'
  );
});

test('emitToTenantOrders is a no-op without io or tenant', () => {
  assert.equal(
    emitToTenantOrders({}, '64f000000000000000000001', 'marketplace:new_order', {}),
    false
  );
  assert.equal(
    emitToTenantOrders({ app: {} }, null, 'marketplace:new_order', {}),
    false
  );
});

test('emitToTenantOrders emits to the tenant orders room, stamped', () => {
  const sent = [];
  const io = {
    to: (room) => ({
      emit: (event, payload) => sent.push({ room, event, payload }),
    }),
  };
  const req = { app: { get: () => io } };

  const ok = emitToTenantOrders(
    req,
    '64f000000000000000000001',
    'marketplace:new_order',
    { orderNumber: 'DH-1' }
  );

  assert.equal(ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].room, 'orders:64f000000000000000000001');
  assert.equal(sent[0].event, 'marketplace:new_order');
  assert.equal(sent[0].payload.orderNumber, 'DH-1');
  assert.ok(sent[0].payload.at, 'payload must carry a timestamp like its siblings');
});
