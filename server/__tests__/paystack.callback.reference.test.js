// server/__tests__/paystack.callback.reference.test.js
//
// Regression: wallet / gift-card funding must be able to (a) redirect Paystack
// back to their own page and (b) reuse their own reference, so the callback
// echoes the SAME reference we verify against. Previously the callback was
// hard-coded to /payment/verify (the cart flow) and the reference was ignored,
// so funding returns landed on the cart callback → "order data was not found".
const test = require('node:test');
const assert = require('node:assert');
const axios = require('axios');
const paymentService = require('../services/payment.service');

function stubAxiosPost() {
  const original = axios.post;
  let captured = null;
  axios.post = async (_url, body) => {
    captured = body;
    return {
      data: {
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/xyz',
          access_code: 'ac_123',
          reference: body.reference || 'paystack_generated_ref',
        },
      },
    };
  };
  return { restore: () => { axios.post = original; }, get: () => captured };
}

test('createPaystackTransaction forwards caller reference and callbackUrl', async () => {
  const stub = stubAxiosPost();
  try {
    const out = await paymentService.createPaystackTransaction(
      5000,
      'buyer@example.com',
      { kind: 'wallet_fund' },
      { reference: 'DHW-abc-123', callbackUrl: 'https://app.test/my-account/wallet' },
    );
    const body = stub.get();
    assert.strictEqual(body.reference, 'DHW-abc-123', 'reference must be sent to Paystack');
    assert.strictEqual(body.callback_url, 'https://app.test/my-account/wallet', 'callback_url must use the caller-supplied URL');
    // Service echoes back the reference Paystack acknowledged (our own).
    assert.strictEqual(out.reference, 'DHW-abc-123');
  } finally {
    stub.restore();
  }
});

test('createPaystackTransaction keeps the default /payment/verify callback when none supplied', async () => {
  const stub = stubAxiosPost();
  try {
    await paymentService.createPaystackTransaction(1000, 'buyer@example.com', {});
    const body = stub.get();
    assert.ok(/\/payment\/verify$/.test(body.callback_url), 'cart flow keeps the default callback');
    assert.strictEqual(body.reference, undefined, 'no reference forced when caller omits it');
  } finally {
    stub.restore();
  }
});
