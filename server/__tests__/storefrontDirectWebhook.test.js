'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
test('merchant callbacks reject forged bytes before touching checkout state', async t => {
  const old = process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY;
  process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY = 'test-only';
  t.after(() => { if (old === undefined) delete process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY; else process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY = old; });
  const raw = Buffer.from('{"event":"charge.success"}');
  const signature = crypto.createHmac('sha512', 'test-only').update(raw).digest('hex');
  await assert.rejects(require('../services/storefrontDirectWebhook').receive({ raw: Buffer.from('{}'), signature, account: 'CALLBACK_TEST', event: {} }), e => e.statusCode === 401);
});
test('valid callback cannot select another merchant account or a nonexistent reference', async t => {
  const old = process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY;
  process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY = 'test-only';
  t.after(() => { if (old === undefined) delete process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY; else process.env.STOREFRONT_PAYSTACK_CALLBACK_TEST_SECRET_KEY = old; });
  const event = { event: 'charge.success', data: { reference: 'dhw-foreign' } }, raw = Buffer.from(JSON.stringify(event));
  const signature = crypto.createHmac('sha512', 'test-only').update(raw).digest('hex');
  const Checkout = require('../models/IntegrationCheckout');
  t.mock.method(Checkout, 'findOne', query => {
    assert.equal(query.paymentAccount, 'CALLBACK_TEST');
    return { select() { return this; }, lean: async () => null };
  });
  await assert.rejects(require('../services/storefrontDirectWebhook').receive({ raw, signature, account: 'CALLBACK_TEST', event }), e => e.statusCode === 409);
});
