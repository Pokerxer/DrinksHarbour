// server/__tests__/salesLoyaltyRedeem.test.js
// Loyalty redemption at confirm: points convert to ₦ off the amount due, capped
// by tenant posSettings. Pure helper + capturePayment integration with injected
// wallet/loyalty deps (repo no-DB convention).
const test = require('node:test');
const assert = require('node:assert');
const { computeRedemption, capturePayment } = require('../services/salesPayment.service');

const baseOrder = () => ({
  _id: 'so1', tenant: 't1', total: 10000, customer: 'c1', customerSnapshot: { customerId: 'c1' },
});

test('computeRedemption converts points to ₦ at the tenant point value', () => {
  const r = computeRedemption(500, { loyaltyEnabled: true, loyaltyPointsValue: 1, loyaltyMaxRedemptionPct: 50 }, 10000);
  assert.deepStrictEqual(r, { pointsRedeemed: 500, value: 500 });
});

test('computeRedemption caps redemption at loyaltyMaxRedemptionPct of the order total', () => {
  // 8000 pts @ ₦1 would be ₦8000, but 50% of ₦10000 caps it at ₦5000 / 5000 pts
  const r = computeRedemption(8000, { loyaltyEnabled: true, loyaltyPointsValue: 1, loyaltyMaxRedemptionPct: 50 }, 10000);
  assert.deepStrictEqual(r, { pointsRedeemed: 5000, value: 5000 });
});

test('computeRedemption returns zero when loyalty disabled or point value is zero', () => {
  assert.deepStrictEqual(computeRedemption(500, { loyaltyEnabled: false }, 10000), { pointsRedeemed: 0, value: 0 });
  assert.deepStrictEqual(computeRedemption(500, { loyaltyEnabled: true, loyaltyPointsValue: 0 }, 10000), { pointsRedeemed: 0, value: 0 });
});

test('capturePayment redeems points, charges only the amount due, and earns on it', async () => {
  const calls = [];
  const deps = {
    mutateWallet: async (a) => { calls.push(['wallet', a.value.amount]); return { ok: true, tx: { _id: 'wtx' } }; },
    mutateLoyalty: async (a) => { calls.push(['loyalty', a.value.type, a.value.points]); return { ok: true }; },
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'wallet', redeemPoints: 2000,
    userId: 'u1',
    posSettings: { loyaltyEnabled: true, loyaltyPointsPerNaira: 0.01, loyaltyPointsValue: 1, loyaltyMaxRedemptionPct: 50 },
    deps,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.loyaltyRedeemed, 2000); // ₦ value redeemed
  assert.strictEqual(result.pointsRedeemed, 2000);
  // wallet charged only the amount due (10000 - 2000)
  assert.deepStrictEqual(calls.find((c) => c[0] === 'wallet'), ['wallet', 8000]);
  // redeem recorded + earn computed on the paid (8000) amount → 80 pts
  assert.ok(calls.some((c) => c[0] === 'loyalty' && c[1] === 'redeem' && c[2] === 2000));
  assert.strictEqual(result.loyaltyEarned, 80);
});

test('capturePayment aborts without charging money when the redeem mutation fails', async () => {
  let walletCalled = false;
  const deps = {
    mutateWallet: async () => { walletCalled = true; return { ok: true, tx: {} }; },
    mutateLoyalty: async (a) => {
      if (a.value.type === 'redeem') throw new Error('loyalty service down');
      return { ok: true };
    },
  };
  const result = await capturePayment({
    salesOrder: baseOrder(), tenantId: 't1', paymentMethod: 'wallet', redeemPoints: 2000,
    userId: 'u1',
    posSettings: { loyaltyEnabled: true, loyaltyPointsValue: 1, loyaltyMaxRedemptionPct: 50 },
    deps,
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(walletCalled, false);
});
