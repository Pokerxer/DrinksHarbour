// server/__tests__/adWalletTopup.test.js
// The credit path: a verified ad_wallet payment must credit exactly once.
// The seam is the REAL paystack verify (payment.service.verifyPaystackTransaction)
// — purpose + tenantId live in the charge metadata stamped on the charge at
// initialize time (marketplacePaymentTrust.initialize) and echoed back by the
// gateway verify; the settle helper reads them from there, never from any
// verify request. The transaction's user comes from the stored initialization
// claim (MarketplacePaymentClaim.user).

const test = require('node:test');
const assert = require('node:assert/strict');

const paymentService = require('../services/payment.service');
const adWallet = require('../services/adWallet.service');
const Claim = require('../models/MarketplacePaymentClaim');

test('ad_wallet verification credits the tenant wallet once', async (t) => {
  const credits = [];
  t.mock.method(adWallet, 'creditAdWallet', async (tenantId, amount, meta) => {
    credits.push({ tenantId, amount, ...meta });
    return { _id: 'tx' };
  });
  // Mock the real verify seam to a settled, successful transaction carrying
  // ad_wallet metadata — exactly the shape payment.service returns.
  t.mock.method(paymentService, 'verifyPaystackTransaction', async () => ({
    success: true,
    data: {
      reference: 'PS-REF-1',
      amount: 25000,
      metadata: { purpose: 'ad_wallet', tenantId: '64b0000000000000000000aa' },
    },
  }));
  // The service awaits Claim.findById(...).lean() — a real Mongoose query is a
  // thenable that also carries .lean(), so the mock mirrors that exact shape.
  t.mock.method(Claim, 'findById', () => {
    const row = { user: '507f1f77bcf86cd799439099' };
    return {
      lean: async () => row,
      then: (onFulfilled, onRejected) => Promise.resolve(row).then(onFulfilled, onRejected),
    };
  });

  const { settleAdWalletCredit } = require('../services/adWalletTopup.service');
  await settleAdWalletCredit('PS-REF-1');

  assert.equal(credits.length, 1);
  assert.equal(credits[0].tenantId, '64b0000000000000000000aa');
  assert.equal(credits[0].amount, 25000);
  assert.equal(credits[0].reference, 'PS-REF-1');
  assert.equal(credits[0].reason, 'Ad wallet top-up');
  assert.equal(credits[0].userId, '507f1f77bcf86cd799439099');
});

test('non-ad_wallet verification never touches the ad wallet', async (t) => {
  const credits = [];
  t.mock.method(adWallet, 'creditAdWallet', async () => { credits.push(1); });
  t.mock.method(paymentService, 'verifyPaystackTransaction', async () => ({
    success: true,
    data: { amount: 1000, metadata: {} },
  }));

  const { settleAdWalletCredit } = require('../services/adWalletTopup.service');
  await settleAdWalletCredit('PS-REF-2');
  assert.equal(credits.length, 0);
});

test('ad_wallet metadata without a tenant id is never credited', async (t) => {
  const credits = [];
  t.mock.method(adWallet, 'creditAdWallet', async () => { credits.push(1); });
  t.mock.method(paymentService, 'verifyPaystackTransaction', async () => ({
    success: true,
    data: { amount: 5000, metadata: { purpose: 'ad_wallet' } },
  }));

  const { settleAdWalletCredit } = require('../services/adWalletTopup.service');
  await assert.doesNotReject(() => settleAdWalletCredit('PS-REF-4'));
  assert.equal(credits.length, 0);
});

test('settle failure never throws and never credits', async (t) => {
  const credits = [];
  t.mock.method(adWallet, 'creditAdWallet', async () => { credits.push(1); });

  const { settleAdWalletCredit } = require('../services/adWalletTopup.service');

  // Gateway reports the payment as not successful.
  t.mock.method(paymentService, 'verifyPaystackTransaction', async () => ({ success: false }));
  await assert.doesNotReject(() => settleAdWalletCredit('PS-REF-3'));
  assert.equal(credits.length, 0);

  // Gateway is unreachable / verify throws.
  t.mock.reset();
  t.mock.method(paymentService, 'verifyPaystackTransaction', async () => {
    throw new Error('Paystack down');
  });
  await assert.doesNotReject(() => settleAdWalletCredit('PS-REF-3'));
  assert.equal(credits.length, 0);
});

// ─── initialize guard (money path: charge and credit must stay in step) ──────

const paymentController = require('../controllers/payment.controller');
const trust = require('../services/marketplacePaymentTrust');

const initRes = () => {
  const r = { status: () => r, json: () => r };
  return r;
};

test('ad_wallet initialize rejects a fractional naira amount without initializing a charge', async (t) => {
  const spy = t.mock.method(trust, 'initialize', async () => ({ authorizationUrl: 'x' }));

  let response;
  const r = {
    status(code) { response = { status: code }; return this; },
    json(body) { response = { ...response, body }; return this; },
  };
  const call = (amount) =>
    paymentController.initializePaystackPayment(
      {
        body: { amount, email: 'a@b.c', metadata: { purpose: 'ad_wallet' } },
        user: { tenant: '64b0000000000000000000aa' },
        get: () => 'idem-key',
      },
      r,
      (err) => { if (err) throw err; }
    );

  await call(2500.5);

  assert.equal(spy.mock.callCount(), 0); // no charge created
  assert.equal(response?.status, 400);
  assert.match(response?.body?.message, /whole number of naira/);

  // A whole amount passes the guard and reaches the trust seam.
  await call(5000);
  assert.equal(spy.mock.callCount(), 1);
});

test('ad_wallet initialize stamps the JWT tenant and requires one', async (t) => {
  let stampedMetadata;
  t.mock.method(trust, 'initialize', async (_gateway, user, _amount, _cur, _email, metadata) => {
    stampedMetadata = metadata;
    return { authorizationUrl: 'x' };
  });

  const r = initRes();
  await paymentController.initializePaystackPayment(
    {
      body: { amount: 5000, email: 'a@b.c', metadata: { purpose: 'ad_wallet' } },
      user: { tenant: '64b0000000000000000000aa', _id: '507f1f77bcf86cd799439099' },
      get: () => 'idem-key',
    },
    r,
    (err) => { if (err) throw err; }
  );
  assert.equal(stampedMetadata.tenantId, '64b0000000000000000000aa');
  assert.equal(stampedMetadata.purpose, 'ad_wallet');

  // No tenant in the JWT → refused before any charge.
  await assert.rejects(
    () => paymentController.initializePaystackPayment(
      {
        body: { amount: 5000, email: 'a@b.c', metadata: { purpose: 'ad_wallet' } },
        user: {},
        get: () => 'idem-key',
      },
      initRes(),
      (err) => { throw err; }
    ),
    /tenant account/
  );
});
