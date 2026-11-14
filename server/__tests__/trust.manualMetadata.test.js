// server/__tests__/trust.manualMetadata.test.js
const test = require('node:test');
const assert = require('node:assert');

// Mock the Korapay charge so we can inspect the trusted metadata trust.initialize
// actually sends to the gateway — no network, no DB (mirrors korapay.charge.test.js
// mocking style: patch the service through the require cache).
test('initialize forwards extraMetadata.orderId into the gateway charge metadata', async (t) => {
  const svc = require('../services/payment.service');
  let sent = null;
  t.mock.method(svc, 'createKorapayCharge', async (amount, email, metadata, opts) => {
    sent = metadata;
    // Real Korapay charges echo back the caller-supplied reference (see
    // korapay.charge.test.js) — the trust service asserts this contract.
    return { authorizationUrl: 'https://checkout', reference: opts?.reference, accessCode: null, amount };
  });

  const Claim = require('../models/MarketplacePaymentClaim');
  const Funding = require('../models/CheckoutDebit');
  // The service chains .lean() on these statics, so the mocks must return a
  // lean()able shape (null reads as "no row").
  t.mock.method(Funding, 'create', async (doc) => ({ ...doc.toObject?.() ?? doc }));
  t.mock.method(Funding, 'findById', () => ({ lean: async () => null }));
  t.mock.method(Claim, 'findById', () => ({ lean: async () => null }));
  t.mock.method(Claim, 'create', async (doc) => ({ ...doc, toObject: () => doc }));
  t.mock.method(Claim, 'updateOne', async () => ({}));

  const trust = require('../services/marketplacePaymentTrust');
  const admin = { _id: '507f1f77bcf86cd799439011', role: 'super_admin' };
  await trust.initialize('korapay', admin, 5000, 'NGN', 'customer@example.com',
    { customerName: 'Test Customer' }, 'req-key-1', { orderId: '507f191e77bcf86cd799439990' });

  assert.ok(sent, 'gateway charge must have been called');
  assert.strictEqual(sent.kind, 'marketplace_order');
  assert.strictEqual(sent.orderId, '507f191e77bcf86cd799439990');
  assert.strictEqual(typeof trust.claimReceipt, 'function', 'claimReceipt must be exported');
});
