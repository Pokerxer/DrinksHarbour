// server/__tests__/korapay.charge.test.js
//
// Korapay is the active customer gateway (checkout, wallet fund, gift cards).
// These tests pin the contract the callers rely on:
//  (a) caller-supplied reference + redirect_url are forwarded (wallet/gift-card
//      funding verify against their OWN reference on their OWN return page),
//  (b) a reference is always generated when the caller omits one — Korapay
//      requires it at init time, unlike Paystack,
//  (c) amounts stay in major units (naira), no kobo conversion,
//  (d) verify maps a successful charge to the shared gateway result shape.
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
          checkout_url: 'https://checkout.korapay.com/xyz/pay',
          reference: body.reference,
        },
      },
    };
  };
  return { restore: () => { axios.post = original; }, get: () => captured };
}

test('createKorapayCharge forwards caller reference and redirect_url', async () => {
  const stub = stubAxiosPost();
  try {
    const out = await paymentService.createKorapayCharge(
      5000,
      'buyer@example.com',
      { kind: 'wallet_fund' },
      { reference: 'DHW-abc-123', callbackUrl: 'https://app.test/my-account/wallet' },
    );
    const body = stub.get();
    assert.strictEqual(body.reference, 'DHW-abc-123', 'reference must be sent to Korapay');
    assert.strictEqual(body.redirect_url, 'https://app.test/my-account/wallet', 'redirect_url must use the caller-supplied URL');
    assert.strictEqual(body.amount, 5000, 'Korapay takes major units — no kobo conversion');
    assert.strictEqual(out.reference, 'DHW-abc-123');
    assert.strictEqual(out.authorizationUrl, 'https://checkout.korapay.com/xyz/pay');
  } finally {
    stub.restore();
  }
});

test('createKorapayCharge generates a reference when none supplied (Korapay requires one)', async () => {
  const stub = stubAxiosPost();
  try {
    const out = await paymentService.createKorapayCharge(1000, 'buyer@example.com', {});
    const body = stub.get();
    assert.ok(body.reference && /^DH-\d+-[0-9a-f]{8}$/.test(body.reference), `generated reference expected, got ${body.reference}`);
    assert.ok(/\/payment\/verify$/.test(body.redirect_url), 'cart flow keeps the default redirect');
    assert.strictEqual(out.reference, body.reference);
  } finally {
    stub.restore();
  }
});

test('verifyKorapayCharge maps a successful charge to the shared gateway shape', async () => {
  const originalGet = axios.get;
  axios.get = async () => ({
    data: {
      status: true,
      data: {
        reference: 'DHW-abc-123',
        payment_reference: 'kpy_tx_987',
        amount: 5000,
        amount_paid: 5000,
        currency: 'NGN',
        status: 'success',
        payment_method: 'card',
        transaction_date: '2026-07-10T10:00:00.000Z',
        metadata: { kind: 'wallet_fund' },
      },
    },
  });
  try {
    const result = await paymentService.verifyKorapayCharge('DHW-abc-123');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'paid');
    assert.strictEqual(result.data.reference, 'DHW-abc-123');
    assert.strictEqual(result.data.transactionId, 'kpy_tx_987');
    assert.strictEqual(result.data.amount, 5000, 'amount stays in naira');
    assert.strictEqual(result.data.channel, 'card');
  } finally {
    axios.get = originalGet;
  }
});

test('verifyKorapayCharge reports non-success statuses as failed', async () => {
  const originalGet = axios.get;
  axios.get = async () => ({
    data: { status: true, data: { reference: 'DHW-x', status: 'pending', amount: 100 } },
  });
  try {
    const result = await paymentService.verifyKorapayCharge('DHW-x');
    assert.strictEqual(result.success, false);
    assert.match(result.message, /pending/);
  } finally {
    axios.get = originalGet;
  }
});

test('createKorapayCharge translates AA021 limit errors into shopper-friendly guidance', async () => {
  const original = axios.post;
  axios.post = async () => {
    const err = new Error('Request failed with status code 400');
    err.response = {
      data: {
        status: false,
        code: 'AA021',
        message:
          'The transaction amount should be between NGN100 and NGN200000 for [card] payments, NGN100 and NGN200000 for [bank_transfer] payments. Please check and try again',
      },
    };
    throw err;
  };
  try {
    await assert.rejects(
      () => paymentService.createKorapayCharge(476900, 'buyer@example.com', {}),
      (e) => {
        assert.match(e.message, /₦476,900/, 'names the order amount');
        assert.match(e.message, /₦200,000 per transaction/, 'extracts the limit from Korapay message');
        assert.match(e.message, /DH Wallet/, 'points at the wallet path');
        return true;
      },
    );
  } finally {
    axios.post = original;
  }
});

test('createKorapayCharge always sends an absolute redirect_url', async () => {
  // Production had FRONTEND_URL without a scheme, so every checkout init got
  // 400 "redirect_url must be a valid uri" from Korapay.
  const stub = stubAxiosPost();
  const savedFrontend = process.env.FRONTEND_URL;
  const savedBase = process.env.NEXT_PUBLIC_BASE_URL;
  process.env.FRONTEND_URL = 'www.drinksharbour.com';
  delete process.env.NEXT_PUBLIC_BASE_URL;
  try {
    await paymentService.createKorapayCharge(7500, 'buyer@example.com', {});
    assert.strictEqual(
      stub.get().redirect_url,
      'https://www.drinksharbour.com/payment/verify',
      'a scheme-less FRONTEND_URL must be repaired, not forwarded to Korapay',
    );
  } finally {
    stub.restore();
    if (savedFrontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = savedFrontend;
    if (savedBase !== undefined) process.env.NEXT_PUBLIC_BASE_URL = savedBase;
  }
});

test('createKorapayCharge ignores an unusable caller callbackUrl instead of forwarding it', async () => {
  const stub = stubAxiosPost();
  const savedFrontend = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://drinksharbour.com';
  try {
    await paymentService.createKorapayCharge(5000, 'buyer@example.com', {}, { callbackUrl: '' });
    assert.strictEqual(stub.get().redirect_url, 'https://drinksharbour.com/payment/verify');
  } finally {
    stub.restore();
    if (savedFrontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = savedFrontend;
  }
});

test('createKorapayCharge surfaces Korapay field-level validation errors', async () => {
  // Korapay's top-level message ("One or more fields are invalid") names nothing;
  // the per-field detail lives in data.<field>.message and must reach the caller.
  const original = axios.post;
  axios.post = async () => {
    const err = new Error('Request failed with status code 400');
    err.response = {
      data: {
        status: false,
        error: 'validation_error',
        message: 'One or more fields are invalid. Please fix them and try again.',
        data: { redirect_url: { message: 'redirect_url must be a valid uri' } },
      },
    };
    throw err;
  };
  try {
    await assert.rejects(
      () => paymentService.createKorapayCharge(7500, 'buyer@example.com', {}),
      (e) => {
        assert.match(e.message, /redirect_url must be a valid uri/, 'names the offending field');
        return true;
      },
    );
  } finally {
    axios.post = original;
  }
});

test('createGatewayTransaction routes to Korapay by default', async () => {
  assert.strictEqual(paymentService.ACTIVE_GATEWAY, 'korapay');
  const stub = stubAxiosPost();
  try {
    const out = await paymentService.createGatewayTransaction(2500, 'buyer@example.com', {});
    // Korapay-specific shape: checkout_url mapped, no access code
    assert.strictEqual(out.authorizationUrl, 'https://checkout.korapay.com/xyz/pay');
    assert.strictEqual(out.accessCode, null);
  } finally {
    stub.restore();
  }
});
