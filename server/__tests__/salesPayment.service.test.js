// server/__tests__/salesPayment.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const { capturePayment } = require('../services/salesPayment.service');

const baseOrder = () => ({ _id: 'so1', tenant: 't1', total: 10000, customer: 'c1', customerSnapshot: { customerId: 'c1' } });

test('wallet failure returns ok:false and does not mark paid', async () => {
  const deps = {
    mutateWallet: async () => ({ ok: false, status: 409, message: 'Insufficient balance' }),
    mutateLoyalty: async () => ({ ok: true }),
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'wallet', userId: 'u1',
    posSettings: {}, deps,
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 409);
});

test('cash payment succeeds and computes loyalty earn on paid amount', async () => {
  let loyaltyArgs = null;
  const deps = {
    mutateWallet: async () => ({ ok: true, tx: { _id: 'wtx' } }),
    mutateLoyalty: async (a) => { loyaltyArgs = a; return { ok: true }; },
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'cash', amountTendered: 10000,
    userId: 'u1', posSettings: { loyaltyEnabled: true, loyaltyPointsPerNaira: 0.01 }, deps,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.loyaltyEarned, 100); // 10000 * 0.01
  assert.ok(loyaltyArgs, 'loyalty was credited');
});

test('cash payment with loyalty disabled earns zero and skips mutateLoyalty', async () => {
  let called = false;
  const deps = {
    mutateWallet: async () => ({ ok: true }),
    mutateLoyalty: async () => { called = true; return { ok: true }; },
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'cash', amountTendered: 10000,
    userId: 'u1', posSettings: { loyaltyEnabled: false }, deps,
  });
  assert.strictEqual(result.loyaltyEarned, 0);
  assert.strictEqual(called, false);
});
