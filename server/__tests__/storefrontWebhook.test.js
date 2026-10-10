'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const webhook = require('../services/paystackWebhook');
const settlement = require('../services/storefrontSettlement');
test('webhook signature verifies the exact received bytes and fails closed', () => {
  const raw = Buffer.from('{ "event" : "charge.success" }');
  const secret = 'test-only';
  const signature = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  assert.equal(webhook.validSignature(raw, signature, secret), true);
  assert.equal(webhook.validSignature(Buffer.from(JSON.stringify(JSON.parse(raw))), signature, secret), false);
  assert.equal(webhook.validSignature(raw, 'x', secret), false);
  assert.equal(webhook.validSignature(null, signature, secret), false);
});
test('webhook routes integration payments through strict settlement before returning', async t => {
  let settled = false;
  t.mock.method(settlement, 'settlePayment', async (ref, payment) => {
    assert.equal(ref, 'dhw-test'); assert.equal(payment.amount, 5000); assert.equal(payment.currency, 'NGN');
    await Promise.resolve(); settled = true; return true;
  });
  await webhook.processEvent({ event: 'charge.success', data: { reference: 'dhw-test', status: 'success', amount: 500000, currency: 'NGN' } });
  assert.equal(settled, true);
});
test('gateway attachment cannot bypass integrated checkout verification', async t => {
  const Order = require('../models/Order');
  t.mock.method(Order, 'findById', async () => ({ integrationCheckout: 'checkout' }));
  await assert.rejects(require('../services/payment.service').attachPaymentToOrder('order', { amount: 1 }), /checkout verification/i);
});
